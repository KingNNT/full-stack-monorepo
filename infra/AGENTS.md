# infra — Terraform, Helm, CI/CD

Extends the root [`AGENTS.md`](../AGENTS.md); its hard rules apply here. Full
architecture, module reference, and environment comparison:
[`docs/infrastructure.md`](../docs/infrastructure.md).

## Safety

- **Never run `staging:*` or `prod:*` tasks, `terraform apply`, or `helm
  upgrade` against staging/prod** unless the user explicitly asks. Use
  `terraform plan` / `helm template` to validate changes.
- `dev:*` targets a local kind cluster + LocalStack and is safe to run, but
  `dev:k8s:up` needs `localstack`, `kind`, `kubectl`, `helm`, and `terraform`.

## Layout

```
infra/
  ├── terraform/
  │   ├── modules/       # vpc, eks, rds, alb, ecr, s3, acm, route53, cloudfront,
  │   │                  # iam, secrets-manager, codebuild, codepipeline
  │   ├── envs/          # dev (LocalStack), staging, prod — one root module each
  │   └── shared/        # common tags and provider versions
  ├── helm/              # charts: api, web, postgres, monitoring
  ├── codebuild/         # buildspecs: terraform, helm deploy, smoke test
  └── scripts/           # deploy.sh, tf-plan.sh, localstack-init.sh
```

Task scripts live in `mise/tasks/{dev,staging,prod}/`:

```bash
mise run dev:infra:up | dev:infra:down      # LocalStack + kind cluster only
mise run dev:k8s:up | dev:k8s:down          # full env: cluster, terraform, images, helm
mise run dev:terraform:plan | dev:terraform:apply
mise run dev:deploy                         # helm deploy all services to kind
mise run dev:monitoring:up | dev:monitoring:down
mise run dev:monitoring:port-forward        # Grafana → localhost:3001
```

## Monitoring (`helm/monitoring/`)

Self-hosted observability stack, one values file per environment:

- **Metrics**: Prometheus (kube-prometheus-stack)
- **Logs**: Loki + Promtail — collects stdout/stderr from all pods
- **Traces**: Tempo + OpenTelemetry Collector
- **Dashboards**: Grafana, with logs ↔ traces ↔ metrics correlation (`dashboards/`)

The API pushes traces and metrics to the OTel Collector over OTLP/gRPC; see
`apps/api/src/instrumentation.ts`.
