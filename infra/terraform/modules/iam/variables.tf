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
  default     = "KingNNT"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "full-stack-monorepo"
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

variable "deploy_source_bucket_arns" {
  description = "Deploy source bucket ARNs the GitHub deploy role can upload bundles to"
  type        = list(string)
  default     = []
}

variable "codepipeline_arns" {
  description = "CodePipeline ARNs the GitHub deploy role can start and poll"
  type        = list(string)
  default     = []
}

variable "terraform_state_bucket" {
  description = "Terraform state bucket for the GitHub plan role (empty disables the plan role)"
  type        = string
  default     = ""
}

variable "terraform_lock_table" {
  description = "Terraform DynamoDB lock table for the GitHub plan role"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
