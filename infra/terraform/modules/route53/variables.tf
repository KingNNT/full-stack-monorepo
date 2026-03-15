variable "domain_name" {
  description = "Root domain name"
  type        = string
}

variable "api_alb_dns_name" {
  description = "ALB DNS name for API"
  type        = string
  default     = ""
}

variable "api_alb_zone_id" {
  description = "ALB hosted zone ID"
  type        = string
  default     = ""
}

variable "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  type        = string
  default     = ""
}

variable "cloudfront_hosted_zone_id" {
  description = "CloudFront hosted zone ID"
  type        = string
  default     = ""
}

variable "api_health_check_path" {
  description = "Health check path for API"
  type        = string
  default     = "/health"
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
