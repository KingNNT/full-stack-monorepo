output "secret_arns" {
  description = "Map of secret path to ARN"
  value       = { for k, v in aws_secretsmanager_secret.this : k => v.arn }
}

output "secret_names" {
  description = "Map of secret path to full name"
  value       = { for k, v in aws_secretsmanager_secret.this : k => v.name }
}
