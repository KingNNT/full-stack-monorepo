output "vpc_id" {
  value = module.vpc.vpc_id
}

output "ecr_repository_urls" {
  value = module.ecr.repository_urls
}

output "eks_cluster_name" {
  value = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "rds_endpoint" {
  value = module.rds.endpoint
}

output "rds_connection_string" {
  value     = module.rds.connection_string
  sensitive = true
}

output "acm_certificate_arn" {
  value = module.acm.certificate_arn
}

output "cloudfront_distribution_id" {
  value = module.cloudfront.distribution_id
}

output "cloudfront_domain_name" {
  value = module.cloudfront.distribution_domain_name
}

output "github_deploy_role_arn" {
  value = module.iam.github_deploy_role_arn
}

output "lb_controller_role_arn" {
  value = module.alb.lb_controller_role_arn
}

output "app_pod_role_arn" {
  value = module.iam.app_pod_role_arn
}

output "route53_zone_id" {
  value = module.route53.zone_id
}

output "route53_name_servers" {
  value = module.route53.zone_name_servers
}

output "pipeline_name" {
  value = module.codepipeline.pipeline_name
}

output "pipeline_notification_topic" {
  value = module.codepipeline.notification_topic_arn
}
