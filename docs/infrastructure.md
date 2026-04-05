# Infrastructure Documentation

## Overview

AWS-based infrastructure managed by **Terraform** (provisioning) and **Helm** (application deployment) on **EKS** (Kubernetes). Three environments: dev (LocalStack + kind), staging, and prod.

```
┌─────────────────────────────────────────────────────────────┐
│                        AWS Account                          │
│                                                             │
│  ┌─────────────────── VPC ────────────────────────────┐     │
│  │                                                     │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │     │
│  │  │ Public   │  │ Private  │  │ Database │         │     │
│  │  │ Subnets  │  │ Subnets  │  │ Subnets  │         │     │
│  │  │          │  │          │  │          │         │     │
│  │  │  NAT GW  │  │  EKS     │  │  RDS     │         │     │
│  │  │  ALB     │  │  Nodes   │  │  Postgres│         │     │
│  │  └──────────┘  └──────────┘  └──────────┘         │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │   ECR    │  │   S3     │  │   ACM    │  │ Secrets   │  │
│  │ (Images) │  │ (Assets) │  │ (SSL)    │  │ Manager   │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │Route53   │  │CloudFront│  │CodePipeline                │
│  │ (DNS)    │  │ (CDN)    │  │ (CI/CD)  │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
infra/
├── terraform/
│   ├── modules/           # Reusable Terraform modules
│   │   ├── vpc/           # VPC, subnets, NAT gateways, flow logs
│   │   ├── eks/           # EKS cluster, node groups, addons, EBS CSI
│   │   ├── rds/           # PostgreSQL RDS, multi-AZ, auto-scaling storage
│   │   ├── alb/           # AWS Load Balancer Controller (IRSA)
│   │   ├── ecr/           # Container image registries
│   │   ├── s3/            # Encrypted S3 buckets with lifecycle policies
│   │   ├── acm/           # SSL certificates with DNS validation
│   │   ├── route53/       # DNS hosted zones and records
│   │   ├── cloudfront/    # CDN distribution for web frontend
│   │   ├── codebuild/     # Build projects for CI/CD
│   │   ├── codepipeline/  # Deployment pipeline orchestration
│   │   ├── iam/           # IAM roles (GitHub OIDC, IRSA)
│   │   └── secrets-manager/ # Application secrets
│   └── envs/              # Per-environment configurations
│       ├── dev/           # Local dev (LocalStack compatible)
│       ├── staging/       # Cost-optimized staging
│       └── prod/          # Production (HA, multi-AZ)
├── helm/
│   ├── api/               # NestJS API deployment
│   ├── web/               # Next.js frontend deployment
│   ├── postgres/          # PostgreSQL for dev
│   └── monitoring/        # Prometheus + Grafana + Loki + Tempo
├── codebuild/             # CodeBuild buildspec files
│   ├── buildspec-terraform.yml
│   ├── buildspec-helm-deploy.yml
│   └── buildspec-smoke-test.yml
└── scripts/
    ├── deploy.sh          # Helm deployment wrapper
    ├── tf-plan.sh         # Terraform plan helper
    └── localstack-init.sh # Local dev environment setup
```

---

## Terraform Modules

### VPC (`modules/vpc/`)

Creates an isolated network with 3 subnet tiers across multiple availability zones.

| Subnet Type | Purpose | Internet Access |
|-------------|---------|-----------------|
| Public | NAT Gateway, ALB | Direct |
| Private | EKS nodes, app pods | Via NAT Gateway |
| Database | RDS PostgreSQL | None (private only) |

- **NAT Gateway**: Single (dev/staging) or per-AZ (prod) for HA
- **VPC Flow Logs**: Disabled in dev, enabled in staging/prod (shipped to S3)
- **DNS**: Hostnames and resolution enabled for internal service discovery
- Tags configured for Kubernetes ELB auto-discovery (`kubernetes.io/role/elb`)

### EKS (`modules/eks/`)

Managed Kubernetes cluster using the `terraform-aws-modules/eks/aws` community module (v20.31+).

**Cluster addons:**
- `coredns` — internal DNS resolution
- `kube-proxy` — network proxy on each node
- `vpc-cni` — AWS VPC networking for pods (each pod gets a VPC IP)
- `aws-ebs-csi-driver` — EBS volume provisioning for PersistentVolumes

**Node groups:** Single managed node group with configurable instance types and auto-scaling (min/max/desired).

**Security:**
- IRSA enabled (pods assume IAM roles via service accounts)
- Control plane logging: API, audit, authenticator
- Private endpoint enabled, public endpoint configurable per environment

**EBS CSI Driver IRSA:** Dedicated IAM role with `AmazonEBSCSIDriverPolicy` for the `ebs-csi-controller-sa` service account. Required for Prometheus/Loki/Tempo PersistentVolumes.

### RDS (`modules/rds/`)

PostgreSQL 16 managed database.

| Config | Dev | Staging | Prod |
|--------|-----|---------|------|
| Instance | db.t3.micro | db.t3.micro | db.t3.medium |
| Multi-AZ | No | No | Yes |
| Backups | 1 day | 7 days | 30 days |
| Storage auto-scaling | 2x allocated | 2x allocated | 2x allocated |

- Security group allows ingress on port 5432 only from EKS node security group
- Encryption at rest enabled
- Deletion protection enabled in prod

### ALB (`modules/alb/`)

Provisions the **AWS Load Balancer Controller** on EKS via IRSA. The controller watches Kubernetes Ingress resources and creates/manages AWS Application Load Balancers automatically.

How it works:
1. Terraform creates IAM role for the ALB controller
2. Helm chart (deployed separately) installs the controller pod
3. When a Helm chart creates a K8s Ingress with `className: alb`, the controller creates an ALB
4. ALB routes traffic to pods via target groups (IP mode)

### ECR (`modules/ecr/`)

Container image registries for API and Web apps.

- Image scanning on push (vulnerability detection)
- Lifecycle policies: auto-delete untagged images after 7 days, keep max N tagged images
- Repositories: `fullstack-monorepo/api`, `fullstack-monorepo/web`

### S3 (`modules/s3/`)

Encrypted S3 buckets with KMS encryption, versioning, and lifecycle policies.

| Bucket | Purpose | Lifecycle |
|--------|---------|-----------|
| assets | User uploads, static files | No expiration |
| backups | DB backups, VPC flow logs, CloudFront logs | 30d (dev), 90d (staging), 365d (prod) |

All buckets have public access blocked and server-side encryption enabled.

### ACM (`modules/acm/`)

SSL/TLS certificates with automatic DNS validation via Route53.

- Primary domain + wildcard SAN (`*.example.com`)
- Separate certificate in `us-east-1` for CloudFront (CloudFront requires certs in us-east-1)

### Route53 (`modules/route53/`)

DNS hosted zone with alias records:
- `api.example.com` → ALB (API)
- `example.com` / `www.example.com` → CloudFront (Web)
- Health checks on API endpoint

### CloudFront (`modules/cloudfront/`)

CDN distribution for the Next.js frontend.

- Origin: ALB (proxies to web pods)
- Cache policy: static assets (`/_next/static/*`) cached at edge
- HTTPS-only with ACM certificate
- Logging to S3 backups bucket
- Price class 200 (excludes expensive regions)

### IAM (`modules/iam/`)

IAM roles and policies:

| Role | Purpose | Trust |
|------|---------|-------|
| GitHub Deploy | CI/CD deployment from GitHub Actions | OIDC federation (`token.actions.githubusercontent.com`) |
| App Pod | S3 access for app pods | IRSA (EKS OIDC → service account) |
| EBS CSI | EBS volume management | IRSA (kube-system/ebs-csi-controller-sa) |
| ALB Controller | ALB management | IRSA |

GitHub Actions authenticate via OIDC (no long-lived credentials).

### Secrets Manager (`modules/secrets-manager/`)

Stores application secrets with environment-namespaced keys:

- `{env}/api/DATABASE_URL`
- `{env}/api/JWT_ACCESS_SECRET`
- `{env}/api/JWT_REFRESH_SECRET`
- `{env}/web/AUTH_SECRET`

Injected into pods at deploy time via `helm --set secrets.XXX=...`

### CodeBuild & CodePipeline (`modules/codebuild/`, `modules/codepipeline/`)

CI/CD pipeline:

```
ECR image push (trigger)
  → CodePipeline
    → Stage 1: Terraform Apply (infra changes)
    → Stage 2: Manual Approval (prod only)
    → Stage 3: Helm Deploy (app deployment)
    → Stage 4: Smoke Test (health check + auto-rollback)
```

CodeBuild projects run in VPC private subnets for RDS/EKS access.

---

## Environment Comparison

| Resource | Dev | Staging | Prod |
|----------|-----|---------|------|
| **VPC NAT** | Single | Single | Per-AZ (HA) |
| **VPC Flow Logs** | Off | On (S3) | On (S3) |
| **EKS Nodes** | t3.small, 1-2 | t3.medium, 2-5 | t3.medium, 2-5 |
| **RDS** | t3.micro, single-AZ | t3.micro, single-AZ | t3.medium, multi-AZ |
| **RDS Backups** | 1 day | 7 days | 30 days |
| **S3 Lifecycle** | 30 days | 90 days | 365 days |
| **CloudFront** | No | Yes | Yes |
| **CodePipeline** | No | Yes (auto-deploy) | Yes (manual approval) |
| **Secrets Manager** | No (env vars) | Yes | Yes |

---

## Helm Charts

### API Chart (`helm/api/`)

Deploys the NestJS backend.

```
Deployment
├── 2 replicas (default), HPA: 2-10 based on CPU/memory
├── Container: port 8000
├── envFrom: ConfigMap (env vars) + Secret (credentials)
├── Readiness probe: GET /health (10s interval, 10s initial delay)
├── Liveness probe: GET /health (20s interval, 15s initial delay)
├── Resources: 250m/256Mi → 500m/512Mi
├── Security: runAsNonRoot, runAsUser 1001
└── Pod anti-affinity: soft (prefer spread across AZs)

Service (ClusterIP)
└── port 8000 → pod port 8000

Ingress (ALB)
├── internet-facing, HTTPS 443 only
├── SSL redirect, ACM certificate
└── Health check: /health

HPA
└── Scale up when CPU > 70% or memory > 80%

PDB (prod only)
└── minAvailable: 2
```

**Config checksum trick:** Pod annotations include SHA256 of ConfigMap and Secret. When env vars change, checksum changes → K8s triggers rolling restart automatically.

### Web Chart (`helm/web/`)

Same structure as API chart, adapted for Next.js (port 3000, health check on `/`).

### Postgres Chart (`helm/postgres/`)

StatefulSet for local dev PostgreSQL. Not used in staging/prod (RDS instead).

### Monitoring Chart (`helm/monitoring/`)

See [Monitoring Stack Design](superpowers/specs/2026-04-05-monitoring-stack-design.md) for full details.

Deploys 5 community Helm charts:

| Component | Chart | Purpose |
|-----------|-------|---------|
| Prometheus + Grafana + Alertmanager | kube-prometheus-stack | Metrics collection + dashboards |
| Loki | grafana/loki | Log aggregation (single-binary mode) |
| Promtail | grafana/promtail | Log collection (DaemonSet per node) |
| Tempo | grafana/tempo | Distributed trace storage |
| OTel Collector | opentelemetry-collector | Receives traces/metrics from app pods |

Data flow:
```
App pods (OTel SDK) → OTel Collector → Tempo (traces) + Prometheus (metrics)
All pods (stdout)   → Promtail       → Loki (logs)
Everything          → Grafana        → Dashboards + Explore
```

---

## CI/CD Pipeline

### GitHub Actions → AWS

```
Developer pushes code
  → GitHub Actions workflow triggers
  → OIDC authentication to AWS (no stored credentials)
  → Docker build + push to ECR
  → ECR push event triggers CodePipeline
```

### CodePipeline Stages

```
Stage 1: Terraform Apply
  └── buildspec-terraform.yml
  └── Updates infrastructure if changed

Stage 2: Manual Approval (prod only)
  └── Requires human confirmation

Stage 3: Helm Deploy
  └── buildspec-helm-deploy.yml
  └── Fetches secrets from Secrets Manager
  └── helm upgrade --install api + web
  └── Waits for rollout (--wait --timeout 5m)

Stage 4: Smoke Test
  └── buildspec-smoke-test.yml
  └── GET /health → expect HTTP 200
  └── On failure: helm rollback api + web
```

### Secrets Flow

```
AWS Secrets Manager
  → CodeBuild env (buildspec secrets-manager section)
  → helm --set secrets.DATABASE_URL="${DATABASE_URL}"
  �� Kubernetes Secret (base64 encoded)
  → Pod envFrom secretRef
  → process.env.DATABASE_URL in app
```

---

## Local Development

### Docker Compose (fast feedback)

```bash
make up          # Start postgres + api + web
make logs        # Tail logs
make down        # Stop everything
```

Runs the apps directly in Docker containers. Fastest way to develop.

### Full K8s Environment (integration testing)

```bash
make k8s-up      # Full stack: LocalStack + kind + Terraform + Helm
make k8s-down    # Teardown everything
```

What `k8s-up` does (7 steps):
1. Start LocalStack (AWS API emulation)
2. Create kind cluster (local Kubernetes)
3. Install nginx-ingress controller
4. Run Terraform against LocalStack
5. Build Docker images + load into kind
6. Deploy PostgreSQL + run migrations + seed data
7. Deploy API + Web via Helm

Access after setup:
```bash
kubectl port-forward svc/api 8000:8000 -n dev
kubectl port-forward svc/web 3000:3000 -n dev
```

### Monitoring Stack

```bash
make monitoring-up ENV=dev      # Deploy Prometheus + Grafana + Loki + Tempo
make monitoring-port-forward    # Grafana at http://localhost:3001
make monitoring-down            # Remove monitoring stack
```

---

## Scaling Architecture

Three independent scaling layers:

```
Layer 1: Terraform (infrastructure ceiling)
  └── EKS node group: min_size=2, max_size=5

Layer 2: Cluster Autoscaler / Karpenter (node scaling)
  └── Adds/removes EC2 nodes within Terraform limits
  └── Triggered when pods can't be scheduled

Layer 3: HPA (pod scaling)
  └── API: 2-10 pods based on CPU > 70% or memory > 80%
  └── Web: 2-8 pods based on CPU > 70%
```

Traffic spike example:
```
Traffic increases
  → HPA adds pods (CPU > 70%)
  → Pods pending (no node capacity)
  → Autoscaler adds EC2 node (within max_size)
  → Pods scheduled on new node
  → Traffic decreases → reverse process
```

---

## Network Architecture

```
Internet
  │
  ├── CloudFront (web) ──→ ALB ──→ Web Pods (port 3000)
  │
  └── ALB (api) ──→ API Pods (port 8000)
                         │
                         └──→ RDS PostgreSQL (port 5432)
                              (private subnet, no internet)
```

- All pods run in **private subnets** (no direct internet access)
- Outbound traffic goes through **NAT Gateway**
- RDS is in **database subnets** (accessible only from EKS node security group)
- ALB terminates SSL (ACM certificates)
- CloudFront caches Next.js static assets at edge
