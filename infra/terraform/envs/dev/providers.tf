provider "aws" {
  region                      = var.aws_region
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  endpoints {
    acm                    = var.localstack_endpoint
    cloudfront             = var.localstack_endpoint
    cloudwatch             = var.localstack_endpoint
    dynamodb               = var.localstack_endpoint
    ec2                    = var.localstack_endpoint
    ecr                    = var.localstack_endpoint
    eks                    = var.localstack_endpoint
    elasticloadbalancingv2 = var.localstack_endpoint
    iam                    = var.localstack_endpoint
    kms                    = var.localstack_endpoint
    rds                    = var.localstack_endpoint
    route53                = var.localstack_endpoint
    s3                     = var.localstack_endpoint
    sts                    = var.localstack_endpoint
  }
}
