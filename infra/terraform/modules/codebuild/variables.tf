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

variable "eks_cluster_security_group_id" {
  description = "EKS cluster security group ID (CodeBuild is allowed 443 ingress to the API endpoint)"
  type        = string
}

variable "lb_controller_role_arn" {
  description = "IAM role ARN for the AWS Load Balancer Controller service account"
  type        = string
}

variable "secret_env_vars" {
  description = "Helm deploy env vars resolved from Secrets Manager (env var name => secret name or ARN)"
  type        = map(string)
  default     = {}
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
