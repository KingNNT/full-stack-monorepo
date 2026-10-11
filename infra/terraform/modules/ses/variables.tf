variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "domain_name" {
  description = "Sending domain"
  type        = string
}

variable "zone_id" {
  description = "Route53 zone that holds the domain's records"
  type        = string
}

variable "dmarc_report_email" {
  description = "Mailbox that receives DMARC aggregate reports"
  type        = string
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
