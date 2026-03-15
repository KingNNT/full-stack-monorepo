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
      "codebuild:BatchGetBuilds",
      "codebuild:StartBuild",
    ]
    resources = ["*"]
  }

  statement {
    actions = [
      "ecr:DescribeImages",
    ]
    resources = ["*"]
  }

  statement {
    actions   = ["codestar-connections:UseConnection"]
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

# --- EventBridge Rule: ECR Push → Pipeline ---
resource "aws_cloudwatch_event_rule" "ecr_push" {
  name        = "${var.project_name}-${var.environment}-ecr-push"
  description = "Trigger pipeline on ECR image push"

  event_pattern = jsonencode({
    source      = ["aws.ecr"]
    detail-type = ["ECR Image Action"]
    detail = {
      action-type     = ["PUSH"]
      result          = ["SUCCESS"]
      repository-name = var.ecr_repository_names
      image-tag       = [{ prefix = "sha-" }]
    }
  })

  tags = var.tags
}

resource "aws_cloudwatch_event_target" "pipeline" {
  rule      = aws_cloudwatch_event_rule.ecr_push.name
  target_id = "codepipeline"
  arn       = aws_codepipeline.this.arn
  role_arn  = aws_iam_role.eventbridge.arn
}

# --- EventBridge IAM Role ---
data "aws_iam_policy_document" "eventbridge_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "eventbridge" {
  name               = "${var.project_name}-${var.environment}-eventbridge-pipeline"
  assume_role_policy = data.aws_iam_policy_document.eventbridge_assume.json
  tags               = var.tags
}

data "aws_iam_policy_document" "eventbridge_policy" {
  statement {
    actions   = ["codepipeline:StartPipelineExecution"]
    resources = [aws_codepipeline.this.arn]
  }
}

resource "aws_iam_role_policy" "eventbridge" {
  name   = "${var.project_name}-${var.environment}-eventbridge-pipeline"
  role   = aws_iam_role.eventbridge.id
  policy = data.aws_iam_policy_document.eventbridge_policy.json
}

# --- CodePipeline ---
resource "aws_codepipeline" "this" {
  name     = "${var.project_name}-${var.environment}"
  role_arn = aws_iam_role.pipeline.arn

  artifact_store {
    location = aws_s3_bucket.artifacts.id
    type     = "S3"
  }

  # Source: GitHub (for buildspec files)
  stage {
    name = "Source"

    action {
      name             = "Source"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeStarSourceConnection"
      version          = "1"
      output_artifacts = ["source_output"]

      configuration = {
        ConnectionArn    = "" # Set after creating CodeStar connection
        FullRepositoryId = var.source_repo
        BranchName       = var.source_branch
      }
    }
  }

  # Stage 1: Terraform Apply
  stage {
    name = "Terraform"

    action {
      name            = "TerraformApply"
      category        = "Build"
      owner           = "AWS"
      provider        = "CodeBuild"
      version         = "1"
      input_artifacts = ["source_output"]

      configuration = {
        ProjectName = var.codebuild_terraform_project
      }
    }
  }

  # Stage 2: Manual Approval (prod only)
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

        configuration = {
          NotificationArn = var.approval_sns_topic_arn
          CustomData      = "Approve deployment to ${var.environment}?"
        }
      }
    }
  }

  # Stage 3: Helm Deploy
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

  # Stage 4: Smoke Test
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
}
