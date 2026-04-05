#!/usr/bin/env bash
set -e

ENVIRONMENT="${1:-dev}"
NAMESPACE="monitoring"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Extract a top-level YAML key into a standalone values file.
# Usage: extract_values <key> <input_file> <output_file>
# e.g. extract_values "loki" values.yaml /tmp/loki.yaml
# Turns the nested content under "loki:" into top-level keys.
extract_values() {
  local key="$1" input="$2" output="$3"
  python3 -c "
import json, sys
# Minimal YAML parser for our simple values files (no anchors/aliases needed)
# We just need to extract a top-level key and un-indent its children
key = sys.argv[1]
lines = open(sys.argv[2]).readlines()
inside = False
indent = 0
result = []
for line in lines:
    stripped = line.rstrip()
    if not inside:
        if stripped == key + ':':
            inside = True
            continue
        # Handle 'key:' with trailing comment
        if stripped.startswith(key + ':'):
            inside = True
            continue
    else:
        if stripped == '' or stripped.startswith('#'):
            result.append(stripped)
            continue
        # Calculate current indentation
        cur_indent = len(line) - len(line.lstrip())
        if cur_indent == 0 and stripped != '':
            # Back to top level = different key, stop
            break
        if indent == 0:
            indent = cur_indent
        # Remove the base indentation
        if cur_indent >= indent:
            result.append(line[indent:].rstrip())
        else:
            break
# Remove trailing empty lines
while result and result[-1].strip() == '':
    result.pop()
print('\n'.join(result))
" "$key" "$input" > "$output"
}

echo "==> Adding Helm repositories..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts 2>/dev/null || true
helm repo add grafana https://grafana.github.io/helm-charts 2>/dev/null || true
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts 2>/dev/null || true
helm repo update

echo "==> Creating namespace ${NAMESPACE}..."
kubectl create namespace "${NAMESPACE}" 2>/dev/null || true

echo "==> Creating gp3 StorageClass..."
kubectl apply -f - <<'STORAGECLASS'
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  fsType: ext4
reclaimPolicy: Retain
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
STORAGECLASS

echo "==> Creating dashboard ConfigMaps..."
if [ -d "${SCRIPT_DIR}/dashboards" ]; then
  for f in "${SCRIPT_DIR}/dashboards"/*.json; do
    [ -f "$f" ] || continue
    name="grafana-dashboard-$(basename "$f" .json)"
    kubectl create configmap "${name}" \
      --from-file="$(basename "$f")=${f}" \
      --namespace "${NAMESPACE}" \
      --dry-run=client -o yaml | \
      kubectl label --local -f - grafana_dashboard=1 -o yaml | \
      kubectl apply -f -
  done
fi

# Extract per-chart values from the combined files
echo "==> Extracting per-chart values..."
VALUES="${SCRIPT_DIR}/values.yaml"
VALUES_ENV="${SCRIPT_DIR}/values-${ENVIRONMENT}.yaml"

for chart in kube-prometheus-stack loki promtail tempo opentelemetry-collector; do
  extract_values "$chart" "$VALUES" "${TMPDIR}/${chart}.yaml"
  if [ -f "$VALUES_ENV" ]; then
    extract_values "$chart" "$VALUES_ENV" "${TMPDIR}/${chart}-env.yaml"
  fi
done

echo "==> Installing kube-prometheus-stack..."
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  -f "${TMPDIR}/kube-prometheus-stack.yaml" \
  -f "${TMPDIR}/kube-prometheus-stack-env.yaml" \
  --namespace "${NAMESPACE}" \
  --history-max 5 \
  --wait --timeout 5m

echo "==> Installing Loki..."
helm upgrade --install loki grafana/loki \
  -f "${TMPDIR}/loki.yaml" \
  -f "${TMPDIR}/loki-env.yaml" \
  --namespace "${NAMESPACE}" \
  --history-max 5 \
  --wait --timeout 5m

echo "==> Installing Promtail..."
helm upgrade --install promtail grafana/promtail \
  -f "${TMPDIR}/promtail.yaml" \
  -f "${TMPDIR}/promtail-env.yaml" \
  --namespace "${NAMESPACE}" \
  --history-max 5 \
  --wait --timeout 5m

echo "==> Installing Tempo..."
helm upgrade --install tempo grafana/tempo \
  -f "${TMPDIR}/tempo.yaml" \
  -f "${TMPDIR}/tempo-env.yaml" \
  --namespace "${NAMESPACE}" \
  --history-max 5 \
  --wait --timeout 5m

echo "==> Installing OpenTelemetry Collector..."
helm upgrade --install otel-collector open-telemetry/opentelemetry-collector \
  -f "${TMPDIR}/opentelemetry-collector.yaml" \
  -f "${TMPDIR}/opentelemetry-collector-env.yaml" \
  --namespace "${NAMESPACE}" \
  --history-max 5 \
  --wait --timeout 5m

echo "==> Monitoring stack deployed to ${ENVIRONMENT}!"
echo ""
echo "  Access Grafana:"
echo "    kubectl port-forward svc/prometheus-grafana 3001:80 -n ${NAMESPACE}"
echo "    Open http://localhost:3001 (admin/admin)"
