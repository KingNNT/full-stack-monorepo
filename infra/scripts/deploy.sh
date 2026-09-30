#!/usr/bin/env bash
set -euo pipefail

# dev:     helm upgrade into the local kind cluster, using the images built by
#          `mise run dev:k8s:up` (fullstack-monorepo/<app>:dev).
# staging/prod: same path as .github/workflows/deploy.yml — upload a deploy
#          bundle for an image tag already in that account's ECR and run the
#          CodePipeline. Needs AWS credentials for the target account
#          (e.g. AWS_PROFILE) and IMAGE_TAG=sha-<commit>.

ENV="${1:?Usage: deploy.sh <dev|staging|prod> [api|web|all]}"
SERVICE="${2:-all}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$INFRA_DIR")"
PROJECT="fullstack-monorepo"
AWS_REGION="${AWS_REGION:-ap-southeast-1}"
KIND_CONTEXT="kind-${PROJECT}-dev"

deploy_dev_chart() {
  local chart="$1"
  echo "==> Deploying $chart to dev ($KIND_CONTEXT)..."
  helm upgrade --install "$chart" "$INFRA_DIR/helm/$chart" \
    --kube-context "$KIND_CONTEXT" \
    -f "$INFRA_DIR/helm/$chart/values-dev.yaml" \
    --set image.repository="$PROJECT/$chart" \
    --set-string image.tag="${IMAGE_TAG:-dev}" \
    --set image.pullPolicy=IfNotPresent \
    --namespace dev \
    --create-namespace \
    --history-max 5 \
    --wait \
    --timeout 5m
  echo "    $chart deployed."
}

deploy_via_pipeline() {
  if [ "$SERVICE" != "all" ]; then
    echo "ERROR: $ENV deploys api and web together; drop the '$SERVICE' argument."
    exit 1
  fi
  : "${IMAGE_TAG:?Set IMAGE_TAG=sha-<commit> (an image tag already pushed to the $ENV ECR)}"

  local account pipeline bundle_dir id
  account="$(aws sts get-caller-identity --query Account --output text)"
  echo "==> Deploying $IMAGE_TAG to $ENV (AWS account $account)"
  read -r -p "Continue? [y/N] " answer
  [ "$answer" = "y" ] || [ "$answer" = "Y" ] || { echo "Aborted."; exit 1; }

  for app in api web; do
    aws ecr describe-images --region "$AWS_REGION" \
      --repository-name "$PROJECT/$app" --image-ids imageTag="$IMAGE_TAG" >/dev/null
  done

  bundle_dir="$(mktemp -d)"
  trap 'rm -rf "$bundle_dir"' EXIT
  {
    echo "IMAGE_TAG=$IMAGE_TAG"
    echo "GIT_SHA=${IMAGE_TAG#sha-}"
    echo "GIT_REF=manual"
  } > "$bundle_dir/deploy.env"
  (cd "$REPO_ROOT" && zip -qr "$bundle_dir/deploy-bundle.zip" infra/helm infra/codebuild)
  (cd "$bundle_dir" && zip -q deploy-bundle.zip deploy.env)

  aws s3 cp --region "$AWS_REGION" "$bundle_dir/deploy-bundle.zip" \
    "s3://$PROJECT-$ENV-deploy-source/deploy-bundle.zip"
  pipeline="$PROJECT-$ENV"
  id="$(aws codepipeline start-pipeline-execution --region "$AWS_REGION" \
    --name "$pipeline" --query pipelineExecutionId --output text)"
  echo "==> Started $pipeline execution $id"
  echo "    https://$AWS_REGION.console.aws.amazon.com/codesuite/codepipeline/pipelines/$pipeline/executions/$id/timeline"
}

case "$ENV" in
  dev)
    case "$SERVICE" in
      api | web) deploy_dev_chart "$SERVICE" ;;
      all)
        deploy_dev_chart api
        deploy_dev_chart web
        ;;
      *)
        echo "ERROR: Unknown service '$SERVICE'. Use: api, web, or all"
        exit 1
        ;;
    esac
    ;;
  staging | prod) deploy_via_pipeline ;;
  *)
    echo "ERROR: Unknown environment '$ENV'. Use: dev, staging, or prod"
    exit 1
    ;;
esac

echo ""
echo "==> Deployment to $ENV done."
