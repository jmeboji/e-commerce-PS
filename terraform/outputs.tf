output "order_placed_topic_arn" {
  value = aws_sns_topic.order_placed.arn
}

output "inventory_queue_arn" {
  value = aws_sqs_queue.inventory_queue.arn
}

output "email_queue_arn" {
  value = aws_sqs_queue.email_queue.arn
}
