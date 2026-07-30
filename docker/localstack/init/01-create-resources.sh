#!/bin/bash
set -euo pipefail

REGION="us-east-1"
MAX_RECEIVE_COUNT=3

# Creates <name> with a redrive policy pointing at <name>-suffixed DLQ (which
# must already exist). Echoes the queue's ARN.
create_queue_with_redrive() {
  local queue_name=$1
  local dlq_arn=$2

  local redrive_policy
  redrive_policy=$(printf '{"deadLetterTargetArn":"%s","maxReceiveCount":"%s"}' "$dlq_arn" "$MAX_RECEIVE_COUNT")

  local attributes_json
  attributes_json=$(printf '{"RedrivePolicy":%s}' "$(printf '%s' "$redrive_policy" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")

  local queue_url
  queue_url=$(awslocal sqs create-queue \
    --region "$REGION" \
    --queue-name "$queue_name" \
    --attributes "$attributes_json" \
    --query 'QueueUrl' --output text)

  awslocal sqs get-queue-attributes \
    --region "$REGION" \
    --queue-url "$queue_url" \
    --attribute-names QueueArn \
    --query 'Attributes.QueueArn' --output text
}

create_dlq() {
  local dlq_name=$1
  local queue_url
  queue_url=$(awslocal sqs create-queue --region "$REGION" --queue-name "$dlq_name" --query 'QueueUrl' --output text)
  awslocal sqs get-queue-attributes \
    --region "$REGION" \
    --queue-url "$queue_url" \
    --attribute-names QueueArn \
    --query 'Attributes.QueueArn' --output text
}

echo "[localstack-init] Creating DLQs..."
inventory_dlq_arn=$(create_dlq "local-inventory-order-placed-dlq")
email_dlq_arn=$(create_dlq "local-email-order-placed-dlq")

echo "[localstack-init] Creating queues with redrive policies..."
inventory_queue_arn=$(create_queue_with_redrive "local-inventory-order-placed-queue" "$inventory_dlq_arn")
email_queue_arn=$(create_queue_with_redrive "local-email-order-placed-queue" "$email_dlq_arn")

echo "[localstack-init] Creating SNS topic..."
topic_arn=$(awslocal sns create-topic \
  --region "$REGION" \
  --name "local-orders-order-placed-topic" \
  --query 'TopicArn' --output text)

echo "[localstack-init] Subscribing queues to topic..."
for queue_arn in "$inventory_queue_arn" "$email_queue_arn"; do
  awslocal sns subscribe \
    --region "$REGION" \
    --topic-arn "$topic_arn" \
    --protocol sqs \
    --notification-endpoint "$queue_arn" \
    --attributes '{"RawMessageDelivery":"true"}' \
    >/dev/null
done

echo "[localstack-init] Done."
echo "[localstack-init]   Topic:  $topic_arn"
echo "[localstack-init]   Queue:  $inventory_queue_arn (DLQ: $inventory_dlq_arn)"
echo "[localstack-init]   Queue:  $email_queue_arn (DLQ: $email_dlq_arn)"
