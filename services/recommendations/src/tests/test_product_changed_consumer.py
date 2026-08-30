from unittest.mock import MagicMock

from src.consumers import product_changed_consumer
from src.consumers.product_changed_consumer import handle_message, handle_product_changed
from src.models import ProductEmbedding
from src.schemas import ProductCreatedEvent, ProductDeletedEvent, ProductUpdatedEvent


def fake_sqs_message(body: str, message_id: str = "msg-1", receipt_handle: str = "receipt-1") -> dict:
    return {"MessageId": message_id, "ReceiptHandle": receipt_handle, "Body": body}


def test_handle_product_changed_upserts_on_created(monkeypatch):
    upsert_mock = MagicMock()
    monkeypatch.setattr(product_changed_consumer, "upsert_product_embedding", upsert_mock)

    event = ProductCreatedEvent(event_type="created", product_id="p1", name="Widget", description="A widget")
    handle_product_changed("fake-db-session", event)

    upsert_mock.assert_called_once_with("fake-db-session", "p1", "Widget A widget")


def test_handle_product_changed_upserts_on_updated(monkeypatch):
    upsert_mock = MagicMock()
    monkeypatch.setattr(product_changed_consumer, "upsert_product_embedding", upsert_mock)

    event = ProductUpdatedEvent(
        event_type="updated", product_id="p2", name="Widget v2", description="Updated widget"
    )
    handle_product_changed("fake-db-session", event)

    upsert_mock.assert_called_once_with("fake-db-session", "p2", "Widget v2 Updated widget")


def test_handle_product_changed_deletes_on_deleted(monkeypatch):
    upsert_mock = MagicMock()
    delete_mock = MagicMock()
    monkeypatch.setattr(product_changed_consumer, "upsert_product_embedding", upsert_mock)
    monkeypatch.setattr(product_changed_consumer, "delete_product_embedding", delete_mock)

    event = ProductDeletedEvent(event_type="deleted", product_id="p3")
    handle_product_changed("fake-db-session", event)

    delete_mock.assert_called_once_with("fake-db-session", "p3")
    upsert_mock.assert_not_called()


# Real DB, not mocked — this is exactly the property the decision to skip a
# ProcessedMessage-style dedup table depends on: processing the same event
# twice must be safe on its own, since nothing else here catches a redelivery.
def test_handle_product_changed_is_idempotent_for_a_repeat_created_event(db_session):
    event = ProductCreatedEvent(
        event_type="created", product_id="idempotency-check-1", name="Widget", description="A widget"
    )
    try:
        handle_product_changed(db_session, event)
        handle_product_changed(db_session, event)

        rows = db_session.query(ProductEmbedding).filter_by(product_id="idempotency-check-1").all()
        assert len(rows) == 1
        assert rows[0].content == "Widget A widget"
    finally:
        db_session.query(ProductEmbedding).filter_by(product_id="idempotency-check-1").delete()
        db_session.commit()


def test_handle_product_changed_is_idempotent_for_a_repeat_deleted_event(db_session):
    event = ProductDeletedEvent(event_type="deleted", product_id="idempotency-check-2")

    # No row exists for this product_id — a repeat delete of something
    # already gone (or never ingested) must not raise.
    handle_product_changed(db_session, event)
    handle_product_changed(db_session, event)

    remaining = db_session.query(ProductEmbedding).filter_by(product_id="idempotency-check-2").count()
    assert remaining == 0


def test_handle_message_skips_a_malformed_message_without_touching_sqs(monkeypatch):
    delete_mock = MagicMock()
    monkeypatch.setattr(product_changed_consumer.sqs_client, "delete_message", delete_mock)

    result = handle_message({"MessageId": "msg-1"})  # missing ReceiptHandle/Body

    assert result is False
    delete_mock.assert_not_called()


def test_handle_message_upserts_on_created_and_deletes_the_sqs_message(monkeypatch):
    upsert_mock = MagicMock()
    delete_embedding_mock = MagicMock()
    delete_sqs_mock = MagicMock()
    monkeypatch.setattr(product_changed_consumer, "upsert_product_embedding", upsert_mock)
    monkeypatch.setattr(product_changed_consumer, "delete_product_embedding", delete_embedding_mock)
    monkeypatch.setattr(product_changed_consumer.sqs_client, "delete_message", delete_sqs_mock)

    body = '{"eventType": "created", "productId": "p1", "name": "Widget", "description": "A widget"}'
    result = handle_message(fake_sqs_message(body))

    assert result is True
    upsert_mock.assert_called_once()
    call_args = upsert_mock.call_args.args
    assert call_args[1] == "p1"
    assert call_args[2] == "Widget A widget"
    delete_embedding_mock.assert_not_called()
    delete_sqs_mock.assert_called_once_with(
        QueueUrl=product_changed_consumer.settings.product_changed_queue_url,
        ReceiptHandle="receipt-1",
    )


def test_handle_message_upserts_on_updated(monkeypatch):
    upsert_mock = MagicMock()
    monkeypatch.setattr(product_changed_consumer, "upsert_product_embedding", upsert_mock)
    monkeypatch.setattr(product_changed_consumer.sqs_client, "delete_message", MagicMock())

    body = '{"eventType": "updated", "productId": "p2", "name": "Widget v2", "description": "Updated widget"}'
    result = handle_message(fake_sqs_message(body))

    assert result is True
    upsert_mock.assert_called_once()
    call_args = upsert_mock.call_args.args
    assert call_args[1] == "p2"
    assert call_args[2] == "Widget v2 Updated widget"


def test_handle_message_deletes_embedding_on_deleted_without_needing_name_or_description(monkeypatch):
    upsert_mock = MagicMock()
    delete_embedding_mock = MagicMock()
    monkeypatch.setattr(product_changed_consumer, "upsert_product_embedding", upsert_mock)
    monkeypatch.setattr(product_changed_consumer, "delete_product_embedding", delete_embedding_mock)
    monkeypatch.setattr(product_changed_consumer.sqs_client, "delete_message", MagicMock())

    body = '{"eventType": "deleted", "productId": "p3"}'
    result = handle_message(fake_sqs_message(body))

    assert result is True
    upsert_mock.assert_not_called()
    delete_embedding_mock.assert_called_once()
    assert delete_embedding_mock.call_args.args[1] == "p3"


def test_handle_message_returns_false_and_does_not_delete_sqs_message_on_processing_failure(monkeypatch):
    monkeypatch.setattr(
        product_changed_consumer,
        "upsert_product_embedding",
        MagicMock(side_effect=Exception("db down")),
    )
    delete_sqs_mock = MagicMock()
    monkeypatch.setattr(product_changed_consumer.sqs_client, "delete_message", delete_sqs_mock)

    body = '{"eventType": "created", "productId": "p4", "name": "Widget", "description": "A widget"}'
    result = handle_message(fake_sqs_message(body))

    assert result is False
    delete_sqs_mock.assert_not_called()


def test_handle_message_rejects_a_created_event_missing_name_or_description(monkeypatch):
    # The schema itself enforces this, not application logic — confirm a
    # malformed created event (missing the fields that get embedded) is
    # treated as a processing failure, same as any other invalid payload.
    upsert_mock = MagicMock()
    delete_sqs_mock = MagicMock()
    monkeypatch.setattr(product_changed_consumer, "upsert_product_embedding", upsert_mock)
    monkeypatch.setattr(product_changed_consumer.sqs_client, "delete_message", delete_sqs_mock)

    body = '{"eventType": "created", "productId": "p5"}'
    result = handle_message(fake_sqs_message(body))

    assert result is False
    upsert_mock.assert_not_called()
    delete_sqs_mock.assert_not_called()
