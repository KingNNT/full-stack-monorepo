# Callers pass the provider explicitly (e.g. aws = aws.us_east_1 for CloudFront),
# so the module itself only needs the default "aws" configuration.
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.80"
    }
  }
}

module "acm" {
  source  = "terraform-aws-modules/acm/aws"
  version = "~> 5.1"

  domain_name               = var.domain_name
  zone_id                   = var.zone_id
  subject_alternative_names = var.subject_alternative_names

  validation_method   = "DNS"
  wait_for_validation = true

  tags = var.tags
}
