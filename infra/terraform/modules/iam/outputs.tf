output "github_deploy_role_arn" {
  description = "GitHub Actions deployment role ARN"
  value       = aws_iam_role.github_deploy.arn
}

output "app_pod_role_arn" {
  description = "App pod IRSA role ARN"
  value       = length(aws_iam_role.app_pod) > 0 ? aws_iam_role.app_pod[0].arn : ""
}

output "github_oidc_provider_arn" {
  description = "GitHub OIDC provider ARN"
  value       = aws_iam_openid_connect_provider.github.arn
}
