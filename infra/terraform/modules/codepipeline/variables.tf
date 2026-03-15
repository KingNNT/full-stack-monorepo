variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "ecr_repository_names" {
  description = "ECR repository names that trigger the pipeline"
  type        = list(string)
}

variable "codebuild_terraform_project" {
  description = "CodeBuild project name for Terraform apply"
  type        = string
}

variable "codebuild_helm_deploy_project" {
  description = "CodeBuild project name for Helm deploy"
  type        = string
}

variable "codebuild_smoke_test_project" {
  description = "CodeBuild project name for smoke test"
  type        = string
}

variable "require_approval" {
  description = "Require manual approval before deploy (for prod)"
  type        = bool
  default     = false
}

variable "approval_sns_topic_arn" {
  description = "SNS topic ARN for approval notifications"
  type        = string
  default     = ""
}

variable "notification_sns_topic_arn" {
  description = "SNS topic ARN for pipeline notifications"
  type        = string
  default     = ""
}

variable "source_repo" {
  description = "GitHub repository (owner/repo format)"
  type        = string
  default     = "inviduality/fullstack-monorepos"
}

variable "source_branch" {
  description = "Source branch"
  type        = string
  default     = "main"
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
