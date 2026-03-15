variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-1"
}

variable "localstack_endpoint" {
  description = "LocalStack endpoint URL"
  type        = string
  default     = "http://localhost:4566"
}

variable "use_localstack_pro" {
  description = "Whether LocalStack Pro is available (enables EKS/RDS)"
  type        = bool
  default     = false
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "fullstack-monorepo"
}

variable "environment" {
  description = "Environment"
  type        = string
  default     = "dev"
}

variable "domain_name" {
  description = "Domain name"
  type        = string
  default     = "example.com"
}
