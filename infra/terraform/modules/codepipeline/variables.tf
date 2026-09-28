variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
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

variable "deploy_source_object_key" {
  description = "S3 object key of the deploy bundle uploaded by GitHub Actions"
  type        = string
  default     = "deploy-bundle.zip"
}

variable "deploy_source_noncurrent_days" {
  description = "Days to keep noncurrent versions of the deploy bundle"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
