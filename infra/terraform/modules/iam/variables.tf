variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "eks_oidc_provider_arn" {
  description = "EKS OIDC provider ARN for IRSA"
  type        = string
  default     = ""
}

variable "eks_oidc_provider_url" {
  description = "EKS OIDC provider URL (without https://)"
  type        = string
  default     = ""
}

variable "github_org" {
  description = "GitHub organization name for OIDC federation"
  type        = string
  default     = "fullstack-monorepo"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "fullstack-monorepos"
}

variable "s3_bucket_arns" {
  description = "S3 bucket ARNs the app pods can access"
  type        = list(string)
  default     = []
}

variable "ecr_repository_arns" {
  description = "ECR repository ARNs for CI/CD push access"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
