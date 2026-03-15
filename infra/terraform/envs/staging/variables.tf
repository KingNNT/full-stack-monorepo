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
  description = "Domain name"
  type        = string
  default     = "example.com"
}
