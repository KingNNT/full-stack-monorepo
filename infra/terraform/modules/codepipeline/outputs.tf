output "pipeline_arn" {
  description = "CodePipeline ARN"
  value       = aws_codepipeline.this.arn
}

output "pipeline_name" {
  description = "CodePipeline name"
  value       = aws_codepipeline.this.name
}

output "deploy_source_bucket_name" {
  description = "S3 bucket GitHub Actions uploads the deploy bundle to"
  value       = aws_s3_bucket.deploy_source.id
}

output "deploy_source_bucket_arn" {
  description = "ARN of the deploy source bucket"
  value       = aws_s3_bucket.deploy_source.arn
}

output "artifact_bucket" {
  description = "Pipeline artifact bucket"
  value       = aws_s3_bucket.artifacts.id
}

output "notification_topic_arn" {
  description = "SNS topic ARN for pipeline notifications"
  value       = aws_sns_topic.pipeline_notifications.arn
}
