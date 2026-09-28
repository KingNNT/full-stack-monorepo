# --- S3 Artifact Bucket ---
resource "aws_s3_bucket" "artifacts" {
  bucket        = "${var.project_name}-${var.environment}-pipeline-artifacts"
  force_destroy = true
  tags          = var.tags
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# --- S3 Deploy Source Bucket (GitHub Actions uploads deploy-bundle.zip) ---
resource "aws_s3_bucket" "deploy_source" {
  bucket        = "${var.project_name}-${var.environment}-deploy-source"
  force_destroy = true
  tags          = var.tags
}

resource "aws_s3_bucket_versioning" "deploy_source" {
  bucket = aws_s3_bucket.deploy_source.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "deploy_source" {
  bucket = aws_s3_bucket.deploy_source.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "deploy_source" {
  bucket = aws_s3_bucket.deploy_source.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "deploy_source" {
  bucket = aws_s3_bucket.deploy_source.id

  rule {
    id     = "expire-old-bundle-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = var.deploy_source_noncurrent_days
    }
  }

  depends_on = [aws_s3_bucket_versioning.deploy_source]
}

# --- IAM Role for CodePipeline ---
data "aws_iam_policy_document" "pipeline_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codepipeline.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "pipeline" {
  name               = "${var.project_name}-${var.environment}-codepipeline"
  assume_role_policy = data.aws_iam_policy_document.pipeline_assume.json
  tags               = var.tags
}

data "aws_iam_policy_document" "pipeline_policy" {
  statement {
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:GetBucketVersioning",
    ]
    resources = [
      aws_s3_bucket.artifacts.arn,
      "${aws_s3_bucket.artifacts.arn}/*",
    ]
  }

  statement {
    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:GetBucketVersioning",
    ]
    resources = [
      aws_s3_bucket.deploy_source.arn,
      "${aws_s3_bucket.deploy_source.arn}/*",
    ]
  }

  statement {
    actions = [
      "codebuild:BatchGetBuilds",
      "codebuild:StartBuild",
    ]
    resources = ["*"]
  }

  dynamic "statement" {
    for_each = var.require_approval && var.approval_sns_topic_arn != "" ? [1] : []
    content {
      actions   = ["sns:Publish"]
      resources = [var.approval_sns_topic_arn]
    }
  }
}

resource "aws_iam_role_policy" "pipeline" {
  name   = "${var.project_name}-${var.environment}-codepipeline"
  role   = aws_iam_role.pipeline.id
  policy = data.aws_iam_policy_document.pipeline_policy.json
}

# --- SNS Topic for Pipeline Notifications ---
resource "aws_sns_topic" "pipeline_notifications" {
  name = "${var.project_name}-${var.environment}-pipeline-notifications"
  tags = var.tags
}

data "aws_iam_policy_document" "pipeline_notifications" {
  statement {
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.pipeline_notifications.arn]

    principals {
      type        = "Service"
      identifiers = ["codestar-notifications.amazonaws.com"]
    }
  }
}

resource "aws_sns_topic_policy" "pipeline_notifications" {
  arn    = aws_sns_topic.pipeline_notifications.arn
  policy = data.aws_iam_policy_document.pipeline_notifications.json
}

# --- CodePipeline ---
resource "aws_codepipeline" "this" {
  name     = "${var.project_name}-${var.environment}"
  role_arn = aws_iam_role.pipeline.arn

  artifact_store {
    location = aws_s3_bucket.artifacts.id
    type     = "S3"
  }

  # Source: deploy bundle uploaded by GitHub Actions, which also starts the pipeline
  stage {
    name = "Source"

    action {
      name             = "Source"
      category         = "Source"
      owner            = "AWS"
      provider         = "S3"
      version          = "1"
      output_artifacts = ["source_output"]

      configuration = {
        S3Bucket             = aws_s3_bucket.deploy_source.id
        S3ObjectKey          = var.deploy_source_object_key
        PollForSourceChanges = "false"
      }
    }
  }

  # Manual Approval (prod only)
  dynamic "stage" {
    for_each = var.require_approval ? [1] : []
    content {
      name = "Approval"

      action {
        name     = "ManualApproval"
        category = "Approval"
        owner    = "AWS"
        provider = "Manual"
        version  = "1"

        configuration = merge(
          { CustomData = "Approve deployment to ${var.environment}?" },
          var.approval_sns_topic_arn != "" ? { NotificationArn = var.approval_sns_topic_arn } : {},
        )
      }
    }
  }

  # Helm Deploy
  stage {
    name = "Deploy"

    action {
      name            = "HelmDeploy"
      category        = "Build"
      owner           = "AWS"
      provider        = "CodeBuild"
      version         = "1"
      input_artifacts = ["source_output"]

      configuration = {
        ProjectName = var.codebuild_helm_deploy_project
      }
    }
  }

  # Smoke Test
  stage {
    name = "SmokeTest"

    action {
      name            = "SmokeTest"
      category        = "Build"
      owner           = "AWS"
      provider        = "CodeBuild"
      version         = "1"
      input_artifacts = ["source_output"]

      configuration = {
        ProjectName = var.codebuild_smoke_test_project
      }
    }
  }

  tags = var.tags

  depends_on = [aws_s3_bucket_versioning.deploy_source]
}

# --- Pipeline Notification Rule ---
resource "aws_codestarnotifications_notification_rule" "pipeline" {
  name        = "${var.project_name}-${var.environment}-pipeline"
  resource    = aws_codepipeline.this.arn
  detail_type = "FULL"

  event_type_ids = [
    "codepipeline-pipeline-pipeline-execution-failed",
    "codepipeline-pipeline-pipeline-execution-succeeded",
    "codepipeline-pipeline-manual-approval-needed",
  ]

  target {
    address = aws_sns_topic.pipeline_notifications.arn
  }

  tags = var.tags

  depends_on = [aws_sns_topic_policy.pipeline_notifications]
}
