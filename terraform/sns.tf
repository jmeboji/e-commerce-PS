resource "aws_sns_topic" "order_placed" {
  name = "local-orders-order-placed-topic"
}

resource "aws_sns_topic_subscription" "inventory" {
  topic_arn = aws_sns_topic.order_placed.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.inventory_queue.arn

  raw_message_delivery = true
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.order_placed.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.email_queue.arn

  raw_message_delivery = true
}
