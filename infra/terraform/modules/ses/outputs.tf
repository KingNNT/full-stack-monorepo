output "identity_arn" {
  description = "SES domain identity ARN"
  value       = aws_sesv2_email_identity.domain.arn
}

output "configuration_set_name" {
  description = "SES configuration set name"
  value       = aws_sesv2_configuration_set.main.configuration_set_name
}

output "configuration_set_arn" {
  description = "SES configuration set ARN"
  value       = aws_sesv2_configuration_set.main.arn
}
