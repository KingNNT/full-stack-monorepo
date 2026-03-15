#!/usr/bin/env bash
set -e

ENV="${1:?Usage: tf-plan.sh <env>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_DIR="$(dirname "$SCRIPT_DIR")/terraform/envs/$ENV"

if [ ! -d "$ENV_DIR" ]; then
  echo "ERROR: Environment '$ENV' not found at $ENV_DIR"
  exit 1
fi

cd "$ENV_DIR"
terraform init -input=false
terraform validate
terraform plan -input=false -out=tfplan

echo ""
echo "==> Plan saved to $ENV_DIR/tfplan"
echo "    To apply: cd $ENV_DIR && terraform apply tfplan"
