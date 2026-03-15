variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
}

variable "eks_oidc_provider_arn" {
  description = "EKS OIDC provider ARN"
  type        = string
}

variable "namespace" {
  description = "Kubernetes namespace for the LB controller"
  type        = string
  default     = "kube-system"
}

variable "service_account_name" {
  description = "Service account name for the LB controller"
  type        = string
  default     = "aws-load-balancer-controller"
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
