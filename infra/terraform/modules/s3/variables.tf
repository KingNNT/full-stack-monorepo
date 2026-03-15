variable "buckets" {
  description = "Map of bucket configs: key = logical name, value = config"
  type = map(object({
    versioning                = optional(bool, true)
    lifecycle_expiration_days = optional(number, 0)
    force_destroy             = optional(bool, false)
  }))
}

variable "project_name" {
  description = "Project name for bucket naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
