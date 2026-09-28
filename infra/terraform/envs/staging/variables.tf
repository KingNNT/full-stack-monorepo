variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "fullstack-monorepo"
}

variable "environment" {
  description = "Environment"
  type        = string
  default     = "staging"
}

variable "domain_name" {
  description = "Domain name (staging uses its own subdomain, delegated from the prod zone)"
  type        = string
  default     = "staging.example.com"
}
