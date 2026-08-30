import json
from typing import Any, Callable

import boto3
from sqlalchemy.orm import Session

from src.config import settings
from src.db import SessionLocal
from src.schemas import ProductChangedEvent, ProductDeletedEvent, parse_product_changed_event
from src.services.search_service import delete_product_embedding, upsert_product_embedding

sqs_client = boto3.client(
    "sqs",
    region_name=settings.aws_region,
    endpoint_url=settings.aws_endpoint_url,
    aws_access_key_id="test",
    aws_secret_access_key="test",
)


# Not async, unlike the sketch this was requested from — everything else in
# this consumer (boto3, upsert_product_embedding, delete_product_embedding)
# is synchronous, so an async signature here wouldn't gain anything and
# would need an event loop this module doesn't have. Takes db explicitly
# rather than opening its own session, matching upsert/delete_product_
# embedding's existing tested signatures instead of changing them to suit
# a single caller.
def handle_product_changed(db: Session, event: ProductChangedEvent) -> None:
    if isinstance(event, ProductDeletedEvent):
        delete_product_embedding(db, event.product_id)
    else:
        text = f"{event.name} {event.description}"
        upsert_product_embedding(db, event.product_id, text)


def handle_message(message: dict[str, Any]) -> bool:
    message_id = message.get("MessageId")
    receipt_handle = message.get("ReceiptHandle")
    body = message.get("Body")
    if not message_id or not receipt_handle or not body:
        print(f"Skipping malformed SQS message (missing id/receipt/body): {message}")
        return False

    try:
        event = parse_product_changed_event(json.loads(body))
        db = SessionLocal()
        try:
            handle_product_changed(db, event)
        finally:
            db.close()

        sqs_client.delete_message(
            QueueUrl=settings.product_changed_queue_url, ReceiptHandle=receipt_handle
        )
        return True
    except Exception as e:
        # Don't delete on failure — leave it for SQS to redeliver after the
        # visibility timeout, up to the queue's maxReceiveCount, then DLQ.
        print(f"Failed to process message {message_id}: {e}")
        return False


# One receive-and-process cycle, exported separately so it can be driven
# directly (e.g. from a test) without needing the loop below. Returns the
# SQS MessageIds that were successfully processed.
def poll_once() -> list[str]:
    response = sqs_client.receive_message(
        QueueUrl=settings.product_changed_queue_url,
        WaitTimeSeconds=20,
        MaxNumberOfMessages=10,
    )
    processed_message_ids: list[str] = []
    for message in response.get("Messages", []):
        if handle_message(message):
            processed_message_ids.append(message["MessageId"])
    return processed_message_ids


# should_continue is polled once per cycle, not mid-poll — boto3's
# receive_message is synchronous with no first-class cancellation (unlike
# the Node consumers' AbortSignal, which cancels an in-flight long-poll
# immediately). A shutdown signal here can take up to WaitTimeSeconds before
# it's noticed, bounded by the current poll's own timeout, not instant.
def start_product_changed_consumer(should_continue: Callable[[], bool]) -> None:
    print(f"[recommendations-worker] polling {settings.product_changed_queue_url}")

    while should_continue():
        try:
            poll_once()
        except Exception as e:
            if not should_continue():
                break
            print(f"[recommendations-worker] poll cycle failed, retrying: {e}")

    print("[recommendations-worker] stopped")


def shutdown_sqs_client() -> None:
    sqs_client.close()
