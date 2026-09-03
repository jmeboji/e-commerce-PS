output "order_placed_topic_arn" {
  value = aws_sns_topic.order_placed.arn
}

output "inventory_queue_arn" {
  value = aws_sqs_queue.inventory_queue.arn
}

output "email_queue_arn" {
  value = aws_sqs_queue.email_queue.arn
}

output "product_changed_topic_arn" {
  value = aws_sns_topic.product_changed.arn
}

output "recommendations_queue_arn" {
  value = aws_sqs_queue.recommendations_queue.arn
}

output "recommendations_queue_url" {
  value = aws_sqs_queue.recommendations_queue.url
}
