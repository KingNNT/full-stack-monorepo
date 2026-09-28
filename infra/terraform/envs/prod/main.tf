locals {
  azs = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  # Must match backend.tf (backend blocks cannot use variables)
  terraform_state_bucket = "${var.project_name}-${var.environment}-tf-state"
  terraform_lock_table   = "${var.project_name}-${var.environment}-tf-lock"
}

module "s3" {
  source = "../../modules/s3"

  project_name = var.project_name
  environment  = var.environment
  tags         = local.common_tags

  buckets = {
    assets = {
      versioning = true
    }
    backups = {
      versioning                = true
      lifecycle_expiration_days = 365
    }
  }
}

module "vpc" {
  source = "../../modules/vpc"

  name                = "${var.project_name}-${var.environment}"
  azs                 = local.azs
  single_nat_gateway  = false
  enable_flow_log     = true
  flow_log_bucket_arn = module.s3.bucket_arns["backups"]
  tags                = local.common_tags
}

module "ecr" {
  source = "../../modules/ecr"

  repository_names       = ["fullstack-monorepo/api", "fullstack-monorepo/web"]
  max_tagged_image_count = 20
  tags                   = local.common_tags
}

module "rds" {
  source = "../../modules/rds"

  identifier                 = "${var.project_name}-${var.environment}"
  instance_class             = "db.t3.medium"
  allocated_storage          = 50
  multi_az                   = true
  backup_retention_period    = 30
  vpc_id                     = module.vpc.vpc_id
  database_subnet_group_name = module.vpc.database_subnet_group_name
  allowed_security_group_ids = [module.eks.node_security_group_id]
  tags                       = local.common_tags
}

module "eks" {
  source = "../../modules/eks"

  cluster_name        = "${var.project_name}-${var.environment}"
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.private_subnets
  node_instance_types = ["t3.medium"]
  node_min_size       = 2
  node_max_size       = 5
  node_desired_size   = 3
  tags                = local.common_tags
}

module "alb" {
  source = "../../modules/alb"

  cluster_name          = module.eks.cluster_name
  eks_oidc_provider_arn = module.eks.oidc_provider_arn
  tags                  = local.common_tags
}

module "route53" {
  source = "../../modules/route53"

  domain_name = var.domain_name
  tags        = local.common_tags
}

module "acm" {
  source = "../../modules/acm"

  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  zone_id                   = module.route53.zone_id
  tags                      = local.common_tags
}

module "acm_cloudfront" {
  source = "../../modules/acm"

  providers = {
    aws = aws.us_east_1
  }

  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  zone_id                   = module.route53.zone_id
  tags                      = local.common_tags
}

# Enabled once the web ALB hostname is known (set web_origin_domain_name)
module "cloudfront" {
  source = "../../modules/cloudfront"
  count  = var.web_origin_domain_name != "" ? 1 : 0

  domain_name         = var.domain_name
  origin_domain_name  = var.web_origin_domain_name
  acm_certificate_arn = module.acm_cloudfront.certificate_arn
  logging_bucket      = "${module.s3.bucket_ids["backups"]}.s3.amazonaws.com"
  tags                = local.common_tags
}

module "iam" {
  source = "../../modules/iam"

  project_name              = var.project_name
  environment               = var.environment
  eks_oidc_provider_arn     = module.eks.oidc_provider_arn
  eks_oidc_provider_url     = module.eks.oidc_provider_url
  s3_bucket_arns            = values(module.s3.bucket_arns)
  ecr_repository_arns       = values(module.ecr.repository_arns)
  deploy_source_bucket_arns = [module.codepipeline.deploy_source_bucket_arn]
  codepipeline_arns         = [module.codepipeline.pipeline_arn]
  terraform_state_bucket    = local.terraform_state_bucket
  terraform_lock_table      = local.terraform_lock_table
  tags                      = local.common_tags
}

module "secrets_manager" {
  source = "../../modules/secrets-manager"

  project_name = var.project_name
  environment  = var.environment
  tags         = local.common_tags

  secrets = {
    "api/DATABASE_URL" = {
      description = "PostgreSQL connection string for API"
    }
    "api/JWT_ACCESS_SECRET" = {
      description = "JWT access token secret"
    }
    "api/JWT_REFRESH_SECRET" = {
      description = "JWT refresh token secret"
    }
    "web/AUTH_SECRET" = {
      description = "NextAuth secret"
    }
  }
}

module "codebuild" {
  source = "../../modules/codebuild"

  project_name                  = var.project_name
  environment                   = var.environment
  vpc_id                        = module.vpc.vpc_id
  private_subnet_ids            = module.vpc.private_subnets
  eks_cluster_name              = module.eks.cluster_name
  aws_region                    = var.aws_region
  secret_arns                   = values(module.secrets_manager.secret_arns)
  eks_cluster_security_group_id = module.eks.cluster_security_group_id
  lb_controller_role_arn        = module.alb.lb_controller_role_arn
  secret_env_vars = {
    DATABASE_URL       = module.secrets_manager.secret_names["api/DATABASE_URL"]
    JWT_ACCESS_SECRET  = module.secrets_manager.secret_names["api/JWT_ACCESS_SECRET"]
    JWT_REFRESH_SECRET = module.secrets_manager.secret_names["api/JWT_REFRESH_SECRET"]
    AUTH_SECRET        = module.secrets_manager.secret_names["web/AUTH_SECRET"]
  }
  tags = local.common_tags
}

module "codepipeline" {
  source = "../../modules/codepipeline"

  project_name                  = var.project_name
  environment                   = var.environment
  codebuild_helm_deploy_project = module.codebuild.helm_deploy_project_name
  codebuild_smoke_test_project  = module.codebuild.smoke_test_project_name
  require_approval              = true
  tags                          = local.common_tags
}
