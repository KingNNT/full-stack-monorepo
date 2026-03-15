variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name for secret naming"
  type        = string
}

variable "secrets" {
  description = "Map of secret paths to their initial placeholder values"
  type = map(object({
    description = string
    value       = optional(string, "CHANGE_ME")
  }))
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
