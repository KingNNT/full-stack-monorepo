variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID for CodeBuild"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for CodeBuild"
  type        = list(string)
}

variable "eks_cluster_name" {
  description = "EKS cluster name for kubeconfig"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "secret_arns" {
  description = "Secret Manager ARNs that CodeBuild can read"
  type        = list(string)
  default     = []
}

variable "terraform_state_bucket" {
  description = "S3 bucket for Terraform state"
  type        = string
  default     = "fullstack-monorepo-tf-state"
}

variable "terraform_lock_table" {
  description = "DynamoDB table for Terraform lock"
  type        = string
  default     = "fullstack-monorepo-tf-lock"
}

variable "source_repo_url" {
  description = "Source repository URL for buildspec files"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
