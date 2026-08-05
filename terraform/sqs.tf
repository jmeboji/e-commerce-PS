locals {
  max_receive_count = 3
}

resource "aws_sqs_queue" "inventory_dlq" {
  name = "local-inventory-order-placed-dlq"
}

resource "aws_sqs_queue" "email_dlq" {
  name = "local-email-order-placed-dlq"
}

resource "aws_sqs_queue" "inventory_queue" {
  name = "local-inventory-order-placed-queue"

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.inventory_dlq.arn
    maxReceiveCount     = local.max_receive_count
  })
}

resource "aws_sqs_queue" "email_queue" {
  name = "local-email-order-placed-queue"

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.email_dlq.arn
    maxReceiveCount     = local.max_receive_count
  })
}
