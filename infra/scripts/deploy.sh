#!/usr/bin/env bash
set -e

ENV="${1:?Usage: deploy.sh <env> [api|web|all]}"
SERVICE="${2:-all}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
IMAGE_TAG="${IMAGE_TAG:-latest}"

deploy_chart() {
  local chart="$1"
  local name="$chart"
  local values_file="$INFRA_DIR/helm/$chart/values-${ENV}.yaml"

  if [ ! -f "$values_file" ]; then
    echo "ERROR: Values file not found: $values_file"
    exit 1
  fi

  echo "==> Deploying $name to $ENV..."
  helm upgrade --install "$name" "$INFRA_DIR/helm/$chart" \
    -f "$values_file" \
    --set image.tag="$IMAGE_TAG" \
    --namespace "$ENV" \
    --create-namespace \
    --history-max 5 \
    --wait \
    --timeout 5m

  echo "    $name deployed successfully."
}

case "$SERVICE" in
  api)
    deploy_chart "api"
    ;;
  web)
    deploy_chart "web"
    ;;
  all)
    deploy_chart "api"
    deploy_chart "web"
    ;;
  *)
    echo "ERROR: Unknown service '$SERVICE'. Use: api, web, or all"
    exit 1
    ;;
esac

echo ""
echo "==> Deployment to $ENV complete!"
