output "zone_id" {
  description = "Route53 hosted zone ID"
  value       = aws_route53_zone.main.zone_id
}

output "zone_name_servers" {
  description = "Name servers for the hosted zone"
  value       = aws_route53_zone.main.name_servers
}

output "api_health_check_id" {
  description = "API health check ID"
  value       = length(aws_route53_health_check.api) > 0 ? aws_route53_health_check.api[0].id : ""
}
