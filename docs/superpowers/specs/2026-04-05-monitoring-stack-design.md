# Monitoring Stack Design

## Overview

Full observability stack for the EKS-based fullstack monorepo, covering metrics, logs, and distributed tracing. Self-hosted on EKS using the Grafana ecosystem. All components deployed via Helm charts.

## Decisions

- **Approach**: kube-prometheus-stack + Loki + Tempo + OpenTelemetry (Approach A — industry standard, battle-tested)
- **Hosting**: Self-hosted on EKS (same cluster as app workloads)
- **Alerting**: Deferred — Alertmanager deployed but not configured. Will set up channels later.
- **App instrumentation**: Auto-instrumentation via OTel SDK + custom metrics scaffold
- **Data retention**: 30 days (prod), scaled down for dev/staging
- **Namespace**: All monitoring resources in `monitoring` namespace

## Architecture

```
                    +------------------------------+
                    |         Grafana               |
                    |  (Dashboards + Explore)       |
                    +--+----------+----------+------+
                       |          |          |
               +-------+--+  +---+----+  +--+------+
               |Prometheus |  |  Loki  |  |  Tempo  |
               | (Metrics) |  | (Logs) |  |(Traces) |
               +-------+--+  +---+----+  +--+------+
                       |         |           |
            +----------+    +----+----+      |
            |          |    |Promtail |      |
       +----+----+ +---+--+|(DaemonSet|  +--+----------+
       |kube-state| |node- || on each  |  |OTel Collector|
       |-metrics  | |export|| node)    |  | (DaemonSet)  |
       +---------+ |er    |+---------+  +------+-------+
                   +------+                     |
                                          +-----+-----+
                                          |  API Pod  |
                                          |(OTel SDK) |
                                          +-----------+
```

### Data Flows

- **Metrics**: Prometheus scrapes kube-state-metrics (cluster state), node-exporter (node resources), and API pods (`/metrics` endpoint exposed by OTel SDK)
- **Logs**: Promtail DaemonSet collects stdout/stderr from all pods on each node, ships to Loki
- **Traces**: API app (OTel SDK) exports traces via OTLP gRPC to OTel Collector, which forwards to Tempo

## Infrastructure Layer — Helm Charts

All monitoring deployed via community Helm charts. No custom charts.

### Charts Used

| Chart | Source | Purpose |
|-------|--------|---------|
| `kube-prometheus-stack` | prometheus-community | Prometheus + Grafana + Alertmanager + node-exporter + kube-state-metrics |
| `loki` | grafana | Log storage (single-binary mode) |
| `promtail` | grafana | Log collector DaemonSet |
| `tempo` | grafana | Trace storage (single-binary mode) |
| `opentelemetry-collector` | open-telemetry | Receives traces + metrics from app, forwards to backends |

### File Structure

```
infra/helm/monitoring/
├── values.yaml              # Shared defaults
├── values-dev.yaml          # Dev overrides (low resources, no persistence)
├── values-staging.yaml
├── values-prod.yaml         # Prod (high resources, persistence enabled)
├── dashboards/
│   ├── api-overview.json    # Request rate, error rate, latency p50/p95/p99
│   └── api-dependencies.json # PostgreSQL query metrics
└── install.sh               # Script to add Helm repos + install/upgrade all charts (called by Makefile targets)
```

### Resource Estimates (Dev)

| Component | CPU request | Memory request |
|-----------|------------|----------------|
| Prometheus | 250m | 512Mi |
| Grafana | 100m | 128Mi |
| Loki | 100m | 256Mi |
| Tempo | 100m | 256Mi |
| Promtail (per node) | 50m | 64Mi |
| OTel Collector | 100m | 128Mi |
| **Total** | **~700m** | **~1.3Gi** |

## Application Layer — OpenTelemetry Instrumentation

Changes only to API app (`apps/api`). Web app not instrumented.

### Packages

```
@opentelemetry/sdk-node
@opentelemetry/auto-instrumentations-node
@opentelemetry/exporter-metrics-otlp-grpc
@opentelemetry/exporter-trace-otlp-grpc
@opentelemetry/resources
@opentelemetry/semantic-conventions
```

### Auto-instrumentation

New file `apps/api/src/instrumentation.ts`, loaded before NestJS bootstrap via `--require ./dist/instrumentation.js`:

- HTTP requests (incoming + outgoing)
- NestJS route handlers
- PostgreSQL queries (pg driver)
- DNS lookups
- Exports metrics and traces to OTel Collector via OTLP gRPC on port 4317
- Resource attributes: `service.name=api`, `deployment.environment` from env var

### Custom Metrics Scaffold

New file `apps/api/src/shared/infrastructure/metrics/metrics.service.ts`:

- NestJS injectable service wrapping OTel Meter API
- Provides `counter()`, `histogram()`, `gauge()` methods
- No custom metrics defined initially — modules add their own as needed

### Log-Trace Correlation

Modify `apps/api/src/shared/infrastructure/logger/logger.module.ts`:

- Add OTel `traceId` and `spanId` to Pino log context via mixin function
- Result: logs include trace context for Grafana correlation

```json
{"level":"info","traceId":"abc123","spanId":"def456","requestId":"...","msg":"User created"}
```

## Grafana Dashboards & Data Sources

### Data Sources (auto-provisioned)

- **Prometheus**: Auto-configured by kube-prometheus-stack
- **Loki**: Added via `grafana.additionalDataSources` with trace-to-logs linking
- **Tempo**: Added via `grafana.additionalDataSources` with trace-to-logs and trace-to-metrics linking

### Built-in Dashboards (from kube-prometheus-stack)

- K8s cluster overview (nodes, pods, namespaces)
- Node resource usage (CPU, memory, disk, network)
- Pod resource usage
- CoreDNS, kubelet, API server

### Custom Dashboards

| Dashboard | Panels |
|-----------|--------|
| **API Overview** | Request rate, error rate (4xx/5xx), response time p50/p95/p99, active connections, top slowest endpoints |
| **API Dependencies** | PostgreSQL query duration, query rate, connection pool usage, error rate |

Dashboards stored as JSON in `infra/helm/monitoring/dashboards/`, mounted via Grafana sidecar.

### Explore Workflow

```
Dashboard: API error rate spike
  -> Click time range
  -> Explore: Loki logs filtered by time + status=500
  -> Log shows traceId
  -> Click traceId -> Tempo full trace
  -> See slow DB query -> root cause identified
```

## Terraform Changes

### EKS Module

Add `aws-ebs-csi-driver` addon for PersistentVolume support:

```hcl
cluster_addons = {
  coredns              = { most_recent = true }
  kube-proxy           = { most_recent = true }
  vpc-cni              = { most_recent = true }
  aws-ebs-csi-driver   = { most_recent = true }  # New
}
```

### IAM

Create IRSA for EBS CSI driver — IAM role with permissions to create/attach/delete EBS volumes, bound to the `ebs-csi-controller-sa` service account.

### Storage Class

Create `gp3` StorageClass as default for monitoring PersistentVolumes.

No new Terraform module for monitoring itself — monitoring components are applications deployed via Helm, not infrastructure.

## Per-Environment Configuration

| Config | Dev | Staging | Prod |
|--------|-----|---------|------|
| Prometheus retention | 7d | 15d | 30d |
| Prometheus storage | 5Gi | 20Gi | 50Gi |
| Loki retention | 7d | 15d | 30d |
| Loki storage | 5Gi | 20Gi | 50Gi |
| Tempo retention | 3d | 7d | 30d |
| Tempo storage | 5Gi | 10Gi | 30Gi |
| Grafana persistence | off | on (1Gi) | on (2Gi) |
| Grafana auth | anonymous | anonymous | OAuth/basic auth |
| OTel trace sampling | 100% | 50% | 10% |
| Promtail | enabled | enabled | enabled |
| Prometheus replicas | 1 | 1 | 2 |

Dev: minimal resources, short retention, 100% sampling (low traffic).
Prod: full resources, 30-day retention, 10% sampling (high traffic). Prometheus HA with 2 replicas.
OTel sampling rate adjustable via Helm values override without app redeploy.
