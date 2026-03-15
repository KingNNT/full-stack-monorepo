output "bucket_ids" {
  description = "Map of logical name to bucket ID"
  value       = { for k, v in module.s3_bucket : k => v.s3_bucket_id }
}

output "bucket_arns" {
  description = "Map of logical name to bucket ARN"
  value       = { for k, v in module.s3_bucket : k => v.s3_bucket_arn }
}
