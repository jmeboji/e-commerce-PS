import json
import time
from uuid import uuid4

import boto3

from src.consumers.product_changed_consumer import poll_once
from src.models import ProductEmbedding
from src.services.search_service import upsert_product_embedding

SNS_CLIENT = boto3.client(
    "sns",
    region_name="us-east-1",
    endpoint_url="http://localhost:4566",
    aws_access_key_id="test",
    aws_secret_access_key="test",
)
SQS_CLIENT = boto3.client(
    "sqs",
    region_name="us-east-1",
    endpoint_url="http://localhost:4566",
    aws_access_key_id="test",
    aws_secret_access_key="test",
)

TOPIC_ARN = "arn:aws:sns:us-east-1:000000000000:local-products-product-changed-topic"
QUEUE_URL = "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/local-recommendations-product-changed-queue"


def publish_product_changed(event: dict) -> None:
    SNS_CLIENT.publish(TopicArn=TOPIC_ARN, Message=json.dumps(event))


def test_consumer_upserts_a_real_embedding_from_a_real_published_created_event(db_session):
    product_id = str(uuid4())
    SQS_CLIENT.purge_queue(QueueUrl=QUEUE_URL)

    publish_product_changed(
        {
            "eventType": "created",
            "productId": product_id,
            "name": "SoundWave Headphones",
            "description": "Wireless bluetooth headphones with noise cancellation",
        }
    )
    time.sleep(0.5)  # give LocalStack a moment to actually deliver SNS -> SQS

    processed = poll_once()
    assert len(processed) == 1

    try:
        row = db_session.query(ProductEmbedding).filter_by(product_id=product_id).one()
        assert row.content == "SoundWave Headphones Wireless bluetooth headphones with noise cancellation"
        assert len(row.embedding) == 384
    finally:
        db_session.query(ProductEmbedding).filter_by(product_id=product_id).delete()
        db_session.commit()


def test_consumer_deletes_a_real_embedding_from_a_real_published_deleted_event(db_session):
    product_id = str(uuid4())
    upsert_product_embedding(db_session, product_id, "seeded row to be deleted")
    SQS_CLIENT.purge_queue(QueueUrl=QUEUE_URL)

    publish_product_changed({"eventType": "deleted", "productId": product_id})
    time.sleep(0.5)

    processed = poll_once()
    assert len(processed) == 1

    remaining = db_session.query(ProductEmbedding).filter_by(product_id=product_id).count()
    assert remaining == 0
