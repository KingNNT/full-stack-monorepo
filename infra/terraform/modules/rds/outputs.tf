output "endpoint" {
  description = "RDS endpoint"
  value       = module.rds.db_instance_endpoint
}

output "address" {
  description = "RDS hostname"
  value       = module.rds.db_instance_address
}

output "port" {
  description = "RDS port"
  value       = module.rds.db_instance_port
}

output "database_name" {
  description = "Database name"
  value       = module.rds.db_instance_name
}

output "username" {
  description = "Master username"
  value       = module.rds.db_instance_username
  sensitive   = true
}

output "master_user_secret_arn" {
  description = "ARN of the Secrets Manager secret for the master password"
  value       = module.rds.db_instance_master_user_secret_arn
  sensitive   = true
}

output "connection_string" {
  description = "PostgreSQL connection string (password managed by Secrets Manager)"
  value       = "postgresql://${module.rds.db_instance_username}@${module.rds.db_instance_endpoint}/${module.rds.db_instance_name}"
  sensitive   = true
}

output "security_group_id" {
  description = "RDS security group ID"
  value       = aws_security_group.rds.id
}
