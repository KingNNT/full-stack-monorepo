output "vpc_id" {
  value = module.vpc.vpc_id
}

output "ecr_repository_urls" {
  value = module.ecr.repository_urls
}

output "s3_bucket_ids" {
  value = module.s3.bucket_ids
}

output "route53_zone_id" {
  value = module.route53.zone_id
}

output "github_deploy_role_arn" {
  value = module.iam.github_deploy_role_arn
}

output "rds_connection_string" {
  value     = var.use_localstack_pro && length(module.rds) > 0 ? module.rds[0].connection_string : "N/A (using docker-compose postgres)"
  sensitive = true
}

output "eks_cluster_name" {
  value = var.use_localstack_pro && length(module.eks) > 0 ? module.eks[0].cluster_name : "N/A (using kind cluster)"
}
