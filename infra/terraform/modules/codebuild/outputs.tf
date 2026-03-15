output "terraform_apply_project_name" {
  description = "CodeBuild project name for Terraform apply"
  value       = aws_codebuild_project.terraform_apply.name
}

output "helm_deploy_project_name" {
  description = "CodeBuild project name for Helm deploy"
  value       = aws_codebuild_project.helm_deploy.name
}

output "smoke_test_project_name" {
  description = "CodeBuild project name for smoke test"
  value       = aws_codebuild_project.smoke_test.name
}

output "codebuild_role_arn" {
  description = "CodeBuild IAM role ARN"
  value       = aws_iam_role.codebuild.arn
}

output "codebuild_security_group_id" {
  description = "CodeBuild security group ID"
  value       = aws_security_group.codebuild.id
}
