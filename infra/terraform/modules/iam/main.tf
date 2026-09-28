# --- GitHub Actions OIDC Provider ---
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = var.tags
}

# --- GitHub Actions Deployment Role ---
data "aws_iam_policy_document" "github_assume_role" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    effect  = "Allow"

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_org}/${var.github_repo}:environment:${var.environment}"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "${var.project_name}-${var.environment}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_assume_role.json

  tags = var.tags
}

data "aws_iam_policy_document" "github_deploy" {
  statement {
    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
    ]
    resources = var.ecr_repository_arns
  }

  statement {
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    actions = [
      "eks:DescribeCluster",
      "eks:ListClusters",
    ]
    resources = ["*"]
  }

  # Upload deploy-bundle.zip to the deploy source bucket
  dynamic "statement" {
    for_each = length(var.deploy_source_bucket_arns) > 0 ? [1] : []
    content {
      actions   = ["s3:PutObject"]
      resources = [for arn in var.deploy_source_bucket_arns : "${arn}/*"]
    }
  }

  # Start the deploy pipeline and wait for its result
  dynamic "statement" {
    for_each = length(var.codepipeline_arns) > 0 ? [1] : []
    content {
      actions = [
        "codepipeline:StartPipelineExecution",
        "codepipeline:GetPipelineExecution",
        "codepipeline:GetPipelineState",
      ]
      resources = var.codepipeline_arns
    }
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "${var.project_name}-${var.environment}-github-deploy"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}

# --- GitHub Actions Terraform Plan Role (pull requests) ---
data "aws_iam_policy_document" "github_plan_assume_role" {
  count = var.terraform_state_bucket != "" ? 1 : 0

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    effect  = "Allow"

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_org}/${var.github_repo}:pull_request"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "github_plan" {
  count = var.terraform_state_bucket != "" ? 1 : 0

  name               = "${var.project_name}-${var.environment}-github-plan"
  assume_role_policy = data.aws_iam_policy_document.github_plan_assume_role[0].json

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "github_plan_read_only" {
  count = var.terraform_state_bucket != "" ? 1 : 0

  role       = aws_iam_role.github_plan[0].name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

data "aws_iam_policy_document" "github_plan" {
  count = var.terraform_state_bucket != "" ? 1 : 0

  statement {
    actions   = ["s3:ListBucket"]
    resources = ["arn:aws:s3:::${var.terraform_state_bucket}"]
  }

  statement {
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = ["arn:aws:s3:::${var.terraform_state_bucket}/*"]
  }

  dynamic "statement" {
    for_each = var.terraform_lock_table != "" ? [1] : []
    content {
      actions = [
        "dynamodb:DescribeTable",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem",
      ]
      resources = ["arn:aws:dynamodb:*:*:table/${var.terraform_lock_table}"]
    }
  }

  # ReadOnlyAccess excludes secret values, but refreshing
  # aws_secretsmanager_secret_version during plan needs them
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = ["arn:aws:secretsmanager:*:*:secret:/${var.environment}/*"]
  }
}

resource "aws_iam_role_policy" "github_plan" {
  count = var.terraform_state_bucket != "" ? 1 : 0

  name   = "${var.project_name}-${var.environment}-github-plan"
  role   = aws_iam_role.github_plan[0].id
  policy = data.aws_iam_policy_document.github_plan[0].json
}

# --- IRSA: App Pods (S3 access) ---
data "aws_iam_policy_document" "app_pod_assume" {
  count = var.eks_oidc_provider_arn != "" ? 1 : 0

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    effect  = "Allow"

    principals {
      type        = "Federated"
      identifiers = [var.eks_oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${var.eks_oidc_provider_url}:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "${var.eks_oidc_provider_url}:sub"
      values   = ["system:serviceaccount:${var.environment}:*"]
    }
  }
}

resource "aws_iam_role" "app_pod" {
  count = var.eks_oidc_provider_arn != "" ? 1 : 0

  name               = "${var.project_name}-${var.environment}-app-pod"
  assume_role_policy = data.aws_iam_policy_document.app_pod_assume[0].json

  tags = var.tags
}

data "aws_iam_policy_document" "app_pod_s3" {
  count = length(var.s3_bucket_arns) > 0 ? 1 : 0

  statement {
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
    ]
    resources = flatten([
      var.s3_bucket_arns,
      [for arn in var.s3_bucket_arns : "${arn}/*"]
    ])
  }
}

resource "aws_iam_role_policy" "app_pod_s3" {
  count = length(var.s3_bucket_arns) > 0 && var.eks_oidc_provider_arn != "" ? 1 : 0

  name   = "${var.project_name}-${var.environment}-app-pod-s3"
  role   = aws_iam_role.app_pod[0].id
  policy = data.aws_iam_policy_document.app_pod_s3[0].json
}
