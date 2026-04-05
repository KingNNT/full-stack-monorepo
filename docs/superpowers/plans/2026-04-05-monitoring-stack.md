# Monitoring Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full observability stack (metrics, logs, traces) to the EKS cluster using Prometheus, Loki, Tempo, and OpenTelemetry.

**Architecture:** Self-hosted Grafana ecosystem on EKS. Community Helm charts for infrastructure (kube-prometheus-stack, Loki, Promtail, Tempo, OTel Collector). OpenTelemetry SDK in the API app for auto-instrumentation + custom metrics scaffold. Grafana as single pane of glass with cross-pillar correlation.

**Tech Stack:** Prometheus, Grafana, Loki, Promtail, Tempo, OpenTelemetry SDK/Collector, Terraform (EBS CSI driver), Helm

---

## File Structure

### New Files

```
infra/terraform/modules/eks/main.tf                          (modify — add EBS CSI addon)
infra/terraform/envs/staging/main.tf                         (modify — add EBS CSI IRSA)
infra/terraform/envs/prod/main.tf                            (modify — add EBS CSI IRSA)
infra/helm/monitoring/values.yaml                            (create — shared monitoring values)
infra/helm/monitoring/values-dev.yaml                        (create — dev overrides)
infra/helm/monitoring/values-staging.yaml                    (create — staging overrides)
infra/helm/monitoring/values-prod.yaml                       (create — prod overrides)
infra/helm/monitoring/dashboards/api-overview.json           (create — API metrics dashboard)
infra/helm/monitoring/dashboards/api-dependencies.json       (create — API deps dashboard)
infra/helm/monitoring/install.sh                             (create — install/upgrade script)
makefiles/infra.mk                                          (modify — add monitoring targets)
apps/api/src/instrumentation.ts                              (create — OTel SDK bootstrap)
apps/api/src/shared/infrastructure/metrics/metrics.service.ts (create — custom metrics scaffold)
apps/api/src/shared/infrastructure/metrics/metrics.module.ts  (create — NestJS module)
apps/api/src/shared/infrastructure/logger/logger.module.ts   (modify — add trace correlation)
apps/api/package.json                                        (modify — add OTel deps)
apps/api/src/app.module.ts                                   (modify — import MetricsModule)
```

---

## Task 1: Add EBS CSI Driver to EKS Terraform Module

Prometheus, Loki, and Tempo need PersistentVolumes backed by EBS. The EBS CSI driver addon must be installed on EKS.

**Files:**
- Modify: `infra/terraform/modules/eks/main.tf:19-29`

- [ ] **Step 1: Add EBS CSI driver addon to EKS module**

In `infra/terraform/modules/eks/main.tf`, add `aws-ebs-csi-driver` to the `cluster_addons` block:

```hcl
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent                 = true
      service_account_role_arn    = aws_iam_role.ebs_csi[0].arn
      resolve_conflicts_on_update = "OVERWRITE"
    }
  }
```

- [ ] **Step 2: Add IRSA for EBS CSI driver in EKS module**

Append to `infra/terraform/modules/eks/main.tf` after the `module "eks"` block:

```hcl
data "aws_iam_policy_document" "ebs_csi_assume" {
  count = var.create_ebs_csi_role ? 1 : 0

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    effect  = "Allow"

    principals {
      type        = "Federated"
      identifiers = [module.eks.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${module.eks.oidc_provider}:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "${module.eks.oidc_provider}:sub"
      values   = ["system:serviceaccount:kube-system:ebs-csi-controller-sa"]
    }
  }
}

resource "aws_iam_role" "ebs_csi" {
  count = var.create_ebs_csi_role ? 1 : 0

  name               = "${var.cluster_name}-ebs-csi-driver"
  assume_role_policy = data.aws_iam_policy_document.ebs_csi_assume[0].json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "ebs_csi" {
  count = var.create_ebs_csi_role ? 1 : 0

  role       = aws_iam_role.ebs_csi[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
}
```

- [ ] **Step 3: Add variable for EBS CSI role toggle**

Append to `infra/terraform/modules/eks/variables.tf`:

```hcl
variable "create_ebs_csi_role" {
  description = "Create IAM role for EBS CSI driver"
  type        = bool
  default     = true
}
```

- [ ] **Step 4: Add EBS CSI role ARN to outputs**

Append to `infra/terraform/modules/eks/outputs.tf`:

```hcl
output "ebs_csi_role_arn" {
  description = "IAM role ARN for EBS CSI driver"
  value       = try(aws_iam_role.ebs_csi[0].arn, "")
}
```

- [ ] **Step 5: Validate Terraform syntax**

Run:
```bash
cd infra/terraform/modules/eks && terraform fmt -check && terraform validate
```
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add infra/terraform/modules/eks/
git commit -m "feat(infra): add EBS CSI driver addon to EKS module

Required for PersistentVolume support (Prometheus, Loki, Tempo storage).
Includes IRSA role with AmazonEBSCSIDriverPolicy."
```

---

## Task 2: Create Monitoring Helm Values — Shared Defaults

Central values file configuring all 5 Helm charts (kube-prometheus-stack, loki, promtail, tempo, otel-collector) with Grafana data source linking.

**Files:**
- Create: `infra/helm/monitoring/values.yaml`

- [ ] **Step 1: Create values.yaml**

Create `infra/helm/monitoring/values.yaml`:

```yaml
# Shared monitoring stack values
# Override per-environment in values-{env}.yaml

# -- kube-prometheus-stack --
kube-prometheus-stack:
  nameOverride: prometheus
  fullnameOverride: prometheus

  prometheus:
    prometheusSpec:
      retention: 30d
      storageSpec:
        volumeClaimTemplate:
          spec:
            storageClassName: gp3
            accessModes: ["ReadWriteOnce"]
            resources:
              requests:
                storage: 50Gi
      resources:
        requests:
          cpu: 250m
          memory: 512Mi
        limits:
          cpu: "1"
          memory: 2Gi
      serviceMonitorSelectorNilUsesHelmValues: false
      podMonitorSelectorNilUsesHelmValues: false

  grafana:
    adminPassword: admin
    persistence:
      enabled: false
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 500m
        memory: 512Mi
    sidecar:
      dashboards:
        enabled: true
        label: grafana_dashboard
        folderAnnotation: grafana_folder
        provider:
          foldersFromFilesStructure: true
    additionalDataSources:
      - name: Loki
        type: loki
        url: http://loki.monitoring.svc.cluster.local:3100
        access: proxy
        isDefault: false
        jsonData:
          derivedFields:
            - datasourceUid: tempo
              matcherRegex: '"traceId":"(\\w+)"'
              name: TraceID
              url: "$${__value.raw}"
      - name: Tempo
        type: tempo
        uid: tempo
        url: http://tempo.monitoring.svc.cluster.local:3100
        access: proxy
        isDefault: false
        jsonData:
          tracesToLogsV2:
            datasourceUid: loki
            filterByTraceID: true
            filterBySpanID: false
          tracesToMetrics:
            datasourceUid: prometheus
          serviceMap:
            datasourceUid: prometheus
          nodeGraph:
            enabled: true

  alertmanager:
    enabled: true
    alertmanagerSpec:
      resources:
        requests:
          cpu: 50m
          memory: 64Mi
        limits:
          cpu: 100m
          memory: 128Mi

  nodeExporter:
    enabled: true

  kubeStateMetrics:
    enabled: true

# -- Loki --
loki:
  deploymentMode: SingleBinary
  loki:
    auth_enabled: false
    commonConfig:
      replication_factor: 1
    storage:
      type: filesystem
    limits_config:
      retention_period: 720h  # 30d
    schemaConfig:
      configs:
        - from: "2024-01-01"
          store: tsdb
          object_store: filesystem
          schema: v13
          index:
            prefix: index_
            period: 24h
  singleBinary:
    replicas: 1
    persistence:
      enabled: true
      storageClass: gp3
      size: 50Gi
    resources:
      requests:
        cpu: 100m
        memory: 256Mi
      limits:
        cpu: 500m
        memory: 1Gi
  gateway:
    enabled: false
  read:
    replicas: 0
  write:
    replicas: 0
  backend:
    replicas: 0

# -- Promtail --
promtail:
  config:
    clients:
      - url: http://loki.monitoring.svc.cluster.local:3100/loki/api/v1/push
    snippets:
      pipelineStages:
        - cri: {}
        - json:
            expressions:
              level: level
              traceId: traceId
              spanId: spanId
        - labels:
            level:
            traceId:
            spanId:
  resources:
    requests:
      cpu: 50m
      memory: 64Mi
    limits:
      cpu: 200m
      memory: 128Mi

# -- Tempo --
tempo:
  tempo:
    storage:
      trace:
        backend: local
        local:
          path: /var/tempo/traces
    retention: 720h  # 30d
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318
  persistence:
    enabled: true
    storageClassName: gp3
    size: 30Gi
  resources:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 1Gi

# -- OpenTelemetry Collector --
opentelemetry-collector:
  mode: daemonset
  config:
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318
    processors:
      batch:
        timeout: 5s
        send_batch_size: 1024
      memory_limiter:
        check_interval: 1s
        limit_mib: 512
        spike_limit_mib: 128
    exporters:
      otlphttp/tempo:
        endpoint: http://tempo.monitoring.svc.cluster.local:4318
        tls:
          insecure: true
      prometheus:
        endpoint: 0.0.0.0:8889
        resource_to_telemetry_conversion:
          enabled: true
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, batch]
          exporters: [otlphttp/tempo]
        metrics:
          receivers: [otlp]
          processors: [memory_limiter, batch]
          exporters: [prometheus]
  ports:
    otlp:
      enabled: true
      containerPort: 4317
      servicePort: 4317
      protocol: TCP
    otlp-http:
      enabled: true
      containerPort: 4318
      servicePort: 4318
      protocol: TCP
    prometheus:
      enabled: true
      containerPort: 8889
      servicePort: 8889
      protocol: TCP
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 512Mi
```

- [ ] **Step 2: Commit**

```bash
git add infra/helm/monitoring/values.yaml
git commit -m "feat(monitoring): add shared Helm values for monitoring stack

Configures kube-prometheus-stack, Loki, Promtail, Tempo, and OTel Collector.
Includes Grafana data source linking for logs-traces-metrics correlation."
```

---

## Task 3: Create Per-Environment Monitoring Values

Override shared defaults for dev, staging, and prod environments.

**Files:**
- Create: `infra/helm/monitoring/values-dev.yaml`
- Create: `infra/helm/monitoring/values-staging.yaml`
- Create: `infra/helm/monitoring/values-prod.yaml`

- [ ] **Step 1: Create values-dev.yaml**

Create `infra/helm/monitoring/values-dev.yaml`:

```yaml
# Dev: minimal resources, short retention, no persistence for Grafana

kube-prometheus-stack:
  prometheus:
    prometheusSpec:
      retention: 7d
      replicas: 1
      storageSpec:
        volumeClaimTemplate:
          spec:
            resources:
              requests:
                storage: 5Gi
      resources:
        requests:
          cpu: 100m
          memory: 256Mi
        limits:
          cpu: 500m
          memory: 1Gi
  grafana:
    adminPassword: admin
    persistence:
      enabled: false

loki:
  loki:
    limits_config:
      retention_period: 168h  # 7d
  singleBinary:
    persistence:
      size: 5Gi
    resources:
      requests:
        cpu: 50m
        memory: 128Mi
      limits:
        cpu: 250m
        memory: 512Mi

promtail:
  resources:
    requests:
      cpu: 25m
      memory: 32Mi
    limits:
      cpu: 100m
      memory: 64Mi

tempo:
  tempo:
    retention: 72h  # 3d
  persistence:
    size: 5Gi
  resources:
    requests:
      cpu: 50m
      memory: 128Mi
    limits:
      cpu: 250m
      memory: 512Mi

opentelemetry-collector:
  config:
    processors:
      probabilistic_sampler:
        sampling_percentage: 100
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, probabilistic_sampler, batch]
          exporters: [otlphttp/tempo]
  resources:
    requests:
      cpu: 50m
      memory: 64Mi
    limits:
      cpu: 250m
      memory: 256Mi
```

- [ ] **Step 2: Create values-staging.yaml**

Create `infra/helm/monitoring/values-staging.yaml`:

```yaml
# Staging: moderate resources, 15-day retention

kube-prometheus-stack:
  prometheus:
    prometheusSpec:
      retention: 15d
      replicas: 1
      storageSpec:
        volumeClaimTemplate:
          spec:
            resources:
              requests:
                storage: 20Gi
  grafana:
    persistence:
      enabled: true
      size: 1Gi
      storageClassName: gp3

loki:
  loki:
    limits_config:
      retention_period: 360h  # 15d
  singleBinary:
    persistence:
      size: 20Gi

tempo:
  tempo:
    retention: 168h  # 7d
  persistence:
    size: 10Gi

opentelemetry-collector:
  config:
    processors:
      probabilistic_sampler:
        sampling_percentage: 50
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, probabilistic_sampler, batch]
          exporters: [otlphttp/tempo]
```

- [ ] **Step 3: Create values-prod.yaml**

Create `infra/helm/monitoring/values-prod.yaml`:

```yaml
# Prod: full resources, 30-day retention, HA Prometheus, PDB

kube-prometheus-stack:
  prometheus:
    prometheusSpec:
      retention: 30d
      replicas: 2
      storageSpec:
        volumeClaimTemplate:
          spec:
            resources:
              requests:
                storage: 50Gi
      resources:
        requests:
          cpu: 500m
          memory: 1Gi
        limits:
          cpu: "2"
          memory: 4Gi
  grafana:
    persistence:
      enabled: true
      size: 2Gi
      storageClassName: gp3
    resources:
      requests:
        cpu: 200m
        memory: 256Mi
      limits:
        cpu: "1"
        memory: 1Gi

loki:
  loki:
    limits_config:
      retention_period: 720h  # 30d
  singleBinary:
    persistence:
      size: 50Gi
    resources:
      requests:
        cpu: 250m
        memory: 512Mi
      limits:
        cpu: "1"
        memory: 2Gi

promtail:
  resources:
    requests:
      cpu: 50m
      memory: 64Mi
    limits:
      cpu: 200m
      memory: 256Mi

tempo:
  tempo:
    retention: 720h  # 30d
  persistence:
    size: 30Gi
  resources:
    requests:
      cpu: 250m
      memory: 512Mi
    limits:
      cpu: "1"
      memory: 2Gi

opentelemetry-collector:
  config:
    processors:
      probabilistic_sampler:
        sampling_percentage: 10
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, probabilistic_sampler, batch]
          exporters: [otlphttp/tempo]
  resources:
    requests:
      cpu: 200m
      memory: 256Mi
    limits:
      cpu: "1"
      memory: 1Gi
```

- [ ] **Step 4: Commit**

```bash
git add infra/helm/monitoring/values-dev.yaml infra/helm/monitoring/values-staging.yaml infra/helm/monitoring/values-prod.yaml
git commit -m "feat(monitoring): add per-environment Helm values

Dev: 7d retention, minimal resources, 100% trace sampling.
Staging: 15d retention, moderate resources, 50% sampling.
Prod: 30d retention, HA Prometheus, 10% sampling."
```

---

## Task 4: Create Monitoring Install Script and Makefile Targets

Script to add Helm repos and install/upgrade all monitoring charts. Makefile targets for convenience.

**Files:**
- Create: `infra/helm/monitoring/install.sh`
- Modify: `makefiles/infra.mk`

- [ ] **Step 1: Create install.sh**

Create `infra/helm/monitoring/install.sh`:

```bash
#!/usr/bin/env bash
set -e

ENVIRONMENT="${1:-dev}"
NAMESPACE="monitoring"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Adding Helm repositories..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
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

echo "==> Installing kube-prometheus-stack..."
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  -f "${SCRIPT_DIR}/values.yaml" \
  -f "${SCRIPT_DIR}/values-${ENVIRONMENT}.yaml" \
  --set-string kube-prometheus-stack=true \
  --namespace "${NAMESPACE}" \
  --history-max 5 \
  --wait --timeout 5m

echo "==> Installing Loki..."
helm upgrade --install loki grafana/loki \
  -f "${SCRIPT_DIR}/values.yaml" \
  -f "${SCRIPT_DIR}/values-${ENVIRONMENT}.yaml" \
  --set-string loki=true \
  --namespace "${NAMESPACE}" \
  --history-max 5 \
  --wait --timeout 5m

echo "==> Installing Promtail..."
helm upgrade --install promtail grafana/promtail \
  -f "${SCRIPT_DIR}/values.yaml" \
  -f "${SCRIPT_DIR}/values-${ENVIRONMENT}.yaml" \
  --set-string promtail=true \
  --namespace "${NAMESPACE}" \
  --history-max 5 \
  --wait --timeout 5m

echo "==> Installing Tempo..."
helm upgrade --install tempo grafana/tempo \
  -f "${SCRIPT_DIR}/values.yaml" \
  -f "${SCRIPT_DIR}/values-${ENVIRONMENT}.yaml" \
  --set-string tempo=true \
  --namespace "${NAMESPACE}" \
  --history-max 5 \
  --wait --timeout 5m

echo "==> Installing OpenTelemetry Collector..."
helm upgrade --install otel-collector open-telemetry/opentelemetry-collector \
  -f "${SCRIPT_DIR}/values.yaml" \
  -f "${SCRIPT_DIR}/values-${ENVIRONMENT}.yaml" \
  --set-string opentelemetry-collector=true \
  --namespace "${NAMESPACE}" \
  --history-max 5 \
  --wait --timeout 5m

echo "==> Monitoring stack deployed to ${ENVIRONMENT}!"
echo ""
echo "  Access Grafana:"
echo "    kubectl port-forward svc/prometheus-grafana 3001:80 -n ${NAMESPACE}"
echo "    Open http://localhost:3001 (admin/admin)"
```

- [ ] **Step 2: Make install.sh executable**

Run:
```bash
chmod +x infra/helm/monitoring/install.sh
```

- [ ] **Step 3: Add Makefile targets**

Append to `makefiles/infra.mk` before the `## Infrastructure` section:

```makefile
## Monitoring ─────────────────────────────────────────

monitoring-up: ## Deploy monitoring stack (usage: make monitoring-up ENV=dev)
	@bash infra/helm/monitoring/install.sh $(ENV)

monitoring-down: ## Remove monitoring stack
	@echo "==> Removing monitoring stack..."
	@helm uninstall prometheus loki promtail tempo otel-collector -n monitoring 2>/dev/null || true
	@kubectl delete namespace monitoring 2>/dev/null || true
	@echo "==> Monitoring stack removed."

monitoring-port-forward: ## Port-forward Grafana to localhost:3001
	@echo "Grafana available at http://localhost:3001 (admin/admin)"
	@kubectl port-forward svc/prometheus-grafana 3001:80 -n monitoring
```

- [ ] **Step 4: Commit**

```bash
git add infra/helm/monitoring/install.sh makefiles/infra.mk
git commit -m "feat(monitoring): add install script and Makefile targets

install.sh adds Helm repos, creates gp3 StorageClass, deploys all 5 charts.
Makefile targets: monitoring-up, monitoring-down, monitoring-port-forward."
```

---

## Task 5: Create Custom Grafana Dashboards

Two JSON dashboards provisioned via ConfigMaps: API Overview and API Dependencies.

**Files:**
- Create: `infra/helm/monitoring/dashboards/api-overview.json`
- Create: `infra/helm/monitoring/dashboards/api-dependencies.json`

- [ ] **Step 1: Create API Overview dashboard**

Create `infra/helm/monitoring/dashboards/api-overview.json`:

```json
{
  "annotations": { "list": [] },
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 1,
  "links": [],
  "panels": [
    {
      "title": "Request Rate",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 8, "x": 0, "y": 0 },
      "targets": [
        {
          "expr": "sum(rate(http_server_request_duration_seconds_count{service_name=\"api\"}[5m]))",
          "legendFormat": "req/s"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "reqps",
          "custom": { "drawStyle": "line", "fillOpacity": 10 }
        }
      }
    },
    {
      "title": "Error Rate (4xx + 5xx)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 8, "x": 8, "y": 0 },
      "targets": [
        {
          "expr": "sum(rate(http_server_request_duration_seconds_count{service_name=\"api\", http_response_status_code=~\"4..\"}[5m]))",
          "legendFormat": "4xx"
        },
        {
          "expr": "sum(rate(http_server_request_duration_seconds_count{service_name=\"api\", http_response_status_code=~\"5..\"}[5m]))",
          "legendFormat": "5xx"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "reqps",
          "custom": { "drawStyle": "line", "fillOpacity": 10 }
        }
      }
    },
    {
      "title": "Response Time (p50 / p95 / p99)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 8, "x": 16, "y": 0 },
      "targets": [
        {
          "expr": "histogram_quantile(0.50, sum(rate(http_server_request_duration_seconds_bucket{service_name=\"api\"}[5m])) by (le))",
          "legendFormat": "p50"
        },
        {
          "expr": "histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket{service_name=\"api\"}[5m])) by (le))",
          "legendFormat": "p95"
        },
        {
          "expr": "histogram_quantile(0.99, sum(rate(http_server_request_duration_seconds_bucket{service_name=\"api\"}[5m])) by (le))",
          "legendFormat": "p99"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "s",
          "custom": { "drawStyle": "line", "fillOpacity": 10 }
        }
      }
    },
    {
      "title": "Top Slowest Endpoints (p95)",
      "type": "table",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
      "targets": [
        {
          "expr": "topk(10, histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket{service_name=\"api\"}[5m])) by (le, http_route, http_request_method)))",
          "format": "table",
          "instant": true
        }
      ]
    },
    {
      "title": "Active Connections",
      "type": "stat",
      "gridPos": { "h": 8, "w": 6, "x": 12, "y": 8 },
      "targets": [
        {
          "expr": "sum(http_server_active_requests{service_name=\"api\"})",
          "legendFormat": "active"
        }
      ]
    },
    {
      "title": "Error Rate %",
      "type": "gauge",
      "gridPos": { "h": 8, "w": 6, "x": 18, "y": 8 },
      "targets": [
        {
          "expr": "sum(rate(http_server_request_duration_seconds_count{service_name=\"api\", http_response_status_code=~\"5..\"}[5m])) / sum(rate(http_server_request_duration_seconds_count{service_name=\"api\"}[5m])) * 100",
          "legendFormat": "5xx %"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "percent",
          "thresholds": {
            "steps": [
              { "value": 0, "color": "green" },
              { "value": 1, "color": "yellow" },
              { "value": 5, "color": "red" }
            ]
          }
        }
      }
    }
  ],
  "schemaVersion": 39,
  "tags": ["api", "overview"],
  "templating": { "list": [] },
  "time": { "from": "now-1h", "to": "now" },
  "title": "API Overview",
  "uid": "api-overview"
}
```

- [ ] **Step 2: Create API Dependencies dashboard**

Create `infra/helm/monitoring/dashboards/api-dependencies.json`:

```json
{
  "annotations": { "list": [] },
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 1,
  "links": [],
  "panels": [
    {
      "title": "PostgreSQL Query Rate",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
      "targets": [
        {
          "expr": "sum(rate(db_client_operation_duration_seconds_count{service_name=\"api\"}[5m])) by (db_operation_name)",
          "legendFormat": "{{ db_operation_name }}"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "ops",
          "custom": { "drawStyle": "line", "fillOpacity": 10 }
        }
      }
    },
    {
      "title": "PostgreSQL Query Duration (p95)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
      "targets": [
        {
          "expr": "histogram_quantile(0.95, sum(rate(db_client_operation_duration_seconds_bucket{service_name=\"api\"}[5m])) by (le, db_operation_name))",
          "legendFormat": "{{ db_operation_name }}"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "s",
          "custom": { "drawStyle": "line", "fillOpacity": 10 }
        }
      }
    },
    {
      "title": "PostgreSQL Connection Pool",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
      "targets": [
        {
          "expr": "db_client_connections_usage{service_name=\"api\", state=\"used\"}",
          "legendFormat": "used"
        },
        {
          "expr": "db_client_connections_usage{service_name=\"api\", state=\"idle\"}",
          "legendFormat": "idle"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "custom": { "drawStyle": "line", "fillOpacity": 20, "stacking": { "mode": "normal" } }
        }
      }
    },
    {
      "title": "PostgreSQL Error Rate",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 },
      "targets": [
        {
          "expr": "sum(rate(db_client_operation_duration_seconds_count{service_name=\"api\", error_type!=\"\"}[5m]))",
          "legendFormat": "errors/s"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "ops",
          "custom": { "drawStyle": "line", "fillOpacity": 10 },
          "color": { "mode": "fixed", "fixedColor": "red" }
        }
      }
    }
  ],
  "schemaVersion": 39,
  "tags": ["api", "dependencies", "postgresql"],
  "templating": { "list": [] },
  "time": { "from": "now-1h", "to": "now" },
  "title": "API Dependencies",
  "uid": "api-dependencies"
}
```

- [ ] **Step 3: Commit**

```bash
git add infra/helm/monitoring/dashboards/
git commit -m "feat(monitoring): add custom Grafana dashboards

API Overview: request rate, error rate, latency percentiles, slowest endpoints.
API Dependencies: PostgreSQL query rate, duration, connection pool, errors."
```

---

## Task 6: Add OpenTelemetry SDK to API App

Auto-instrumentation for HTTP, NestJS, and PostgreSQL. Must load before NestJS bootstrap.

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/src/instrumentation.ts`

- [ ] **Step 1: Install OTel packages**

Run:
```bash
cd apps/api && pnpm add \
  @opentelemetry/api \
  @opentelemetry/sdk-node \
  @opentelemetry/sdk-metrics \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-metrics-otlp-grpc \
  @opentelemetry/exporter-trace-otlp-grpc \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions
```

- [ ] **Step 2: Create instrumentation.ts**

Create `apps/api/src/instrumentation.ts`:

```typescript
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const otlpEndpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4317';

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'api',
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.1',
    'deployment.environment': process.env.NODE_ENV ?? 'development',
  }),
  traceExporter: new OTLPTraceExporter({
    url: otlpEndpoint,
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: otlpEndpoint,
    }),
    exportIntervalMillis: 15000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: true },
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-nestjs-core': { enabled: true },
      '@opentelemetry/instrumentation-pg': { enabled: true },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0));
});
```

- [ ] **Step 3: Update start scripts to preload instrumentation**

In `apps/api/package.json`, update the `start` and `start:prod` scripts:

Change:
```json
"start": "node dist/main",
"start:prod": "node dist/main",
```

To:
```json
"start": "node --require ./dist/instrumentation.js dist/main",
"start:prod": "node --require ./dist/instrumentation.js dist/main",
```

- [ ] **Step 4: Add OTEL_EXPORTER_OTLP_ENDPOINT to Helm values**

In `infra/helm/api/values-dev.yaml`, add to the `env` section:

```yaml
env:
  NODE_ENV: development
  PORT: "8000"
  LOG_LEVEL: debug
  CORS_ALLOWED_ORIGINS: http://localhost:3000
  OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector-opentelemetry-collector.monitoring.svc.cluster.local:4317
```

In `infra/helm/api/values-prod.yaml`, add to the `env` section:

```yaml
env:
  NODE_ENV: production
  PORT: "8000"
  LOG_LEVEL: warn
  CORS_ALLOWED_ORIGINS: https://example.com
  OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector-opentelemetry-collector.monitoring.svc.cluster.local:4317
```

- [ ] **Step 5: Verify TypeScript compiles**

Run:
```bash
cd apps/api && pnpm typecheck
```
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/package.json apps/api/src/instrumentation.ts infra/helm/api/values-dev.yaml infra/helm/api/values-prod.yaml
git commit -m "feat(api): add OpenTelemetry auto-instrumentation

SDK auto-instruments HTTP, NestJS, PostgreSQL, and DNS.
Exports traces + metrics to OTel Collector via OTLP gRPC.
Loaded via --require before NestJS bootstrap."
```

---

## Task 7: Add Custom Metrics Scaffold

NestJS injectable service wrapping the OTel Meter API for domain modules to register custom metrics.

**Files:**
- Create: `apps/api/src/shared/infrastructure/metrics/metrics.service.ts`
- Create: `apps/api/src/shared/infrastructure/metrics/metrics.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create metrics.service.ts**

Create `apps/api/src/shared/infrastructure/metrics/metrics.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import {
  type Counter,
  type Histogram,
  type ObservableGauge,
  metrics,
} from '@opentelemetry/api';

@Injectable()
export class MetricsService {
  private readonly meter = metrics.getMeter('api');

  counter(name: string, description?: string): Counter {
    return this.meter.createCounter(name, { description });
  }

  histogram(name: string, description?: string, unit?: string): Histogram {
    return this.meter.createHistogram(name, { description, unit });
  }

  gauge(
    name: string,
    callback: (result: { observe: (value: number) => void }) => void,
    description?: string,
  ): ObservableGauge {
    const gauge = this.meter.createObservableGauge(name, { description });
    gauge.addCallback(callback);
    return gauge;
  }
}
```

- [ ] **Step 2: Create metrics.module.ts**

Create `apps/api/src/shared/infrastructure/metrics/metrics.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
```

- [ ] **Step 3: Import MetricsModule in AppModule**

In `apps/api/src/app.module.ts`, add the import. Find the `imports` array and add `MetricsModule`.

Add the import statement at the top:
```typescript
import { MetricsModule } from './shared/infrastructure/metrics/metrics.module';
```

Add `MetricsModule` to the `imports` array.

- [ ] **Step 4: Verify TypeScript compiles**

Run:
```bash
cd apps/api && pnpm typecheck
```
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/shared/infrastructure/metrics/
git commit -m "feat(api): add MetricsService scaffold for custom OTel metrics

Global NestJS service wrapping OTel Meter API.
Provides counter(), histogram(), gauge() for domain modules."
```

---

## Task 8: Add Log-Trace Correlation to Pino Logger

Inject OTel `traceId` and `spanId` into Pino log context so Grafana can correlate logs with traces.

**Files:**
- Modify: `apps/api/src/shared/infrastructure/logger/logger.module.ts:1-73`

- [ ] **Step 1: Update logger.module.ts**

Replace the full content of `apps/api/src/shared/infrastructure/logger/logger.module.ts`:

```typescript
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { context, trace } from '@opentelemetry/api';
import { ClsService } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import { CLS_REQUEST_ID, CLS_USER_ID } from '../cls/cls.constants';

@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService, ClsService],
      useFactory: (config: ConfigService, cls: ClsService) => {
        const isDev = config.get('NODE_ENV') !== 'production';
        const level = config.get('LOG_LEVEL') ?? (isDev ? 'debug' : 'info');

        return {
          pinoHttp: {
            level,
            genReqId: (req: IncomingMessage) => {
              const id =
                (req.headers['x-request-id'] as string) ?? randomUUID();
              if (cls.isActive()) {
                cls.set(CLS_REQUEST_ID, id);
              }
              return id;
            },
            mixin: () => {
              const otelCtx = trace.getSpan(context.active())?.spanContext();
              const fields: Record<string, string> = {};

              if (otelCtx?.traceId) {
                fields.traceId = otelCtx.traceId;
                fields.spanId = otelCtx.spanId;
              }

              if (cls.isActive()) {
                const userId = cls.get(CLS_USER_ID);
                if (userId) fields.userId = userId;
              }

              return fields;
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.body.password',
                'req.body.passwordHash',
                'req.body.accessToken',
                'req.body.refreshToken',
              ],
              censor: '[REDACTED]',
            },
            serializers: {
              req: (req: {
                method: string;
                url: string;
                headers: Record<string, string>;
              }) => ({
                method: req.method,
                url: req.url,
                host: req.headers?.host,
                'user-agent': req.headers?.['user-agent'],
              }),
              res: (res: { statusCode: number }) => ({
                statusCode: res.statusCode,
              }),
            },
            ...(isDev
              ? {
                  transport: {
                    target: 'pino-pretty',
                    options: { colorize: true, singleLine: true },
                  },
                }
              : {}),
          },
        };
      },
    }),
  ],
})
export class AppLoggerModule {}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd apps/api && pnpm typecheck
```
Expected: No errors.

- [ ] **Step 3: Run existing tests to ensure no regression**

Run:
```bash
cd apps/api && pnpm test
```
Expected: All existing tests pass. The mixin change is additive — it adds fields but doesn't break existing behavior.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/shared/infrastructure/logger/logger.module.ts
git commit -m "feat(api): add traceId/spanId to Pino logs for Grafana correlation

Mixin injects OTel trace context into every log line.
Enables Loki -> Tempo trace linking in Grafana Explore."
```

---

## Task 9: Update API Helm Chart with OTel Environment Variables

Add OTEL env var to the API staging values (dev and prod already handled in Task 6).

**Files:**
- Modify: `infra/helm/api/values-staging.yaml` (if it exists, otherwise create)

- [ ] **Step 1: Check if values-staging.yaml exists**

Run:
```bash
ls infra/helm/api/values-staging.yaml
```

- [ ] **Step 2: Add OTEL endpoint to staging values**

If the file exists, add `OTEL_EXPORTER_OTLP_ENDPOINT` to the `env` section. If not, create it with:

```yaml
env:
  NODE_ENV: staging
  PORT: "8000"
  LOG_LEVEL: info
  OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector-opentelemetry-collector.monitoring.svc.cluster.local:4317
```

- [ ] **Step 3: Commit**

```bash
git add infra/helm/api/values-staging.yaml
git commit -m "feat(api): add OTel endpoint to staging Helm values"
```

---

## Task 10: Update CLAUDE.md and Makefile Documentation

Add monitoring commands to project documentation.

**Files:**
- Modify: `.claude/CLAUDE.md`

- [ ] **Step 1: Add monitoring commands to CLAUDE.md**

In the `## Common Commands` section of `.claude/CLAUDE.md`, add after the Docker section:

```markdown
# Monitoring
make monitoring-up ENV=dev    # Deploy monitoring stack to dev
make monitoring-down          # Remove monitoring stack
make monitoring-port-forward  # Port-forward Grafana to localhost:3001
```

- [ ] **Step 2: Add monitoring to Architecture section**

In the `## Architecture` section, add a brief note about monitoring:

```markdown
### Monitoring (`infra/helm/monitoring/`)

Self-hosted observability stack on EKS:
- **Metrics**: Prometheus (via kube-prometheus-stack) — scrapes K8s + API `/metrics`
- **Logs**: Loki + Promtail — collects stdout/stderr from all pods
- **Traces**: Tempo + OpenTelemetry Collector — receives traces from API OTel SDK
- **Dashboards**: Grafana — unified view with logs-traces-metrics correlation

API instrumented with `@opentelemetry/sdk-node` auto-instrumentation (HTTP, NestJS, PostgreSQL).
Custom metrics available via `MetricsService` injectable.
```

- [ ] **Step 3: Commit**

```bash
git add .claude/CLAUDE.md
git commit -m "docs: add monitoring stack to project documentation"
```

---

## Task 11: Local Dev Smoke Test

Verify the monitoring stack works in the local kind cluster.

**Files:** None (verification only)

- [ ] **Step 1: Build API with instrumentation**

Run:
```bash
cd apps/api && pnpm build
```
Expected: Build succeeds, `dist/instrumentation.js` exists.

- [ ] **Step 2: Verify instrumentation.js is in build output**

Run:
```bash
ls apps/api/dist/instrumentation.js
```
Expected: File exists.

- [ ] **Step 3: Start kind cluster (if not running)**

Run:
```bash
make k8s-up
```

- [ ] **Step 4: Deploy monitoring stack**

Run:
```bash
make monitoring-up ENV=dev
```
Expected: All 5 charts install successfully.

- [ ] **Step 5: Verify all monitoring pods are running**

Run:
```bash
kubectl get pods -n monitoring
```
Expected: All pods in `Running` or `Completed` state.

- [ ] **Step 6: Port-forward Grafana and verify dashboards**

Run:
```bash
kubectl port-forward svc/prometheus-grafana 3001:80 -n monitoring &
```

Open `http://localhost:3001`, login with admin/admin. Verify:
- Prometheus data source is connected (green checkmark)
- Loki data source is connected
- Tempo data source is connected
- API Overview and API Dependencies dashboards are visible

- [ ] **Step 7: Kill port-forward**

```bash
kill %1 2>/dev/null || true
```
