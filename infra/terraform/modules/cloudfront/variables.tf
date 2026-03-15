variable "domain_name" {
  description = "Domain name for the distribution"
  type        = string
}

variable "origin_domain_name" {
  description = "ALB domain name (web service origin)"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN (must be in us-east-1)"
  type        = string
}

variable "web_acl_id" {
  description = "WAF Web ACL ID (optional, not in v1)"
  type        = string
  default     = ""
}

variable "logging_bucket" {
  description = "S3 bucket domain name for access logs"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
