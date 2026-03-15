locals {
  azs = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

module "vpc" {
  source = "../../modules/vpc"

  name               = "${var.project_name}-${var.environment}"
  azs                = local.azs
  single_nat_gateway = true
  enable_flow_log    = false
  tags               = local.common_tags
}

module "ecr" {
  source = "../../modules/ecr"

  repository_names = ["fullstack-monorepo/api", "fullstack-monorepo/web"]
  tags             = local.common_tags
}

module "s3" {
  source = "../../modules/s3"

  project_name = var.project_name
  environment  = var.environment
  tags         = local.common_tags

  buckets = {
    assets = {
      versioning    = true
      force_destroy = true
    }
    backups = {
      versioning                = true
      lifecycle_expiration_days = 30
      force_destroy             = true
    }
  }
}

module "route53" {
  source = "../../modules/route53"

  domain_name = var.domain_name
  tags        = local.common_tags
}

module "rds" {
  source = "../../modules/rds"
  count  = var.use_localstack_pro ? 1 : 0

  identifier                 = "${var.project_name}-${var.environment}"
  instance_class             = "db.t3.micro"
  vpc_id                     = module.vpc.vpc_id
  database_subnet_group_name = module.vpc.database_subnet_group_name
  backup_retention_period    = 1
  tags                       = local.common_tags
}

module "eks" {
  source = "../../modules/eks"
  count  = var.use_localstack_pro ? 1 : 0

  cluster_name        = "${var.project_name}-${var.environment}"
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.private_subnets
  node_instance_types = ["t3.small"]
  node_min_size       = 1
  node_max_size       = 2
  node_desired_size   = 1
  tags                = local.common_tags
}

module "iam" {
  source = "../../modules/iam"

  project_name        = var.project_name
  environment         = var.environment
  s3_bucket_arns      = values(module.s3.bucket_arns)
  ecr_repository_arns = values(module.ecr.repository_arns)
  tags                = local.common_tags
}
