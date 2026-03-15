module "s3_bucket" {
  source   = "terraform-aws-modules/s3-bucket/aws"
  version  = "~> 4.2"
  for_each = var.buckets

  bucket        = "${var.project_name}-${var.environment}-${each.key}"
  force_destroy = each.value.force_destroy

  versioning = {
    enabled = each.value.versioning
  }

  server_side_encryption_configuration = {
    rule = {
      apply_server_side_encryption_by_default = {
        sse_algorithm = "aws:kms"
      }
    }
  }

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true

  lifecycle_rule = each.value.lifecycle_expiration_days > 0 ? [
    {
      id      = "expire-old-objects"
      enabled = true
      expiration = {
        days = each.value.lifecycle_expiration_days
      }
    }
  ] : []

  tags = var.tags
}
