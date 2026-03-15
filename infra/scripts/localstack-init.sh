#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$INFRA_DIR")"
KIND_CLUSTER_NAME="fullstack-monorepo-dev"
LOCALSTACK_ENDPOINT="${LOCALSTACK_ENDPOINT:-http://localhost:4566}"

echo "==> Starting LocalStack..."
docker compose -f "$PROJECT_ROOT/docker-compose.yml" up -d postgres
docker run -d --name localstack \
  -p 4566:4566 \
  -e SERVICES=s3,ecr,iam,route53,acm,cloudfront,sts \
  -e DEFAULT_REGION=ap-southeast-1 \
  localstack/localstack:latest 2>/dev/null || echo "LocalStack already running"

echo "==> Waiting for LocalStack..."
for i in $(seq 1 30); do
  if curl -s "$LOCALSTACK_ENDPOINT/_localstack/health" | grep -q '"s3": "available"'; then
    echo "LocalStack is ready!"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: LocalStack failed to start"
    exit 1
  fi
  sleep 2
done

echo "==> Setting up kind cluster..."
if ! kind get clusters 2>/dev/null | grep -q "$KIND_CLUSTER_NAME"; then
  kind create cluster --name "$KIND_CLUSTER_NAME" --wait 60s
  echo "kind cluster created."
else
  echo "kind cluster already exists."
fi

echo "==> Installing nginx-ingress controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml 2>/dev/null || true
echo "Waiting for ingress controller..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s 2>/dev/null || echo "Ingress controller may take a moment..."

echo "==> Running terraform init & apply..."
cd "$INFRA_DIR/terraform/envs/dev"
terraform init -input=false
terraform apply -auto-approve -input=false

echo ""
echo "==> Dev infrastructure is ready!"
echo "    LocalStack:  $LOCALSTACK_ENDPOINT"
echo "    Kind cluster: $KIND_CLUSTER_NAME"
echo "    PostgreSQL:   localhost:5432"
echo ""
echo "    Next: run 'make helm-deploy-dev' to deploy apps"
