# Mise Full Adoption Design

## Overview

Replace nvm, corepack, direnv, and Makefile with mise as the single tool manager, task runner, and environment loader for the project.

## Current State

| Area | Tool | Files |
|------|------|-------|
| Node version | nvm | `install.sh` |
| pnpm version | corepack | `package.json` (`packageManager` field) |
| Env vars | direnv | `.envrc`, `.envrc.local` |
| Tasks | GNU Make | `Makefile`, `makefiles/*.mk` (4 files) |

## Target State

| Area | Tool | Files |
|------|------|-------|
| Node + pnpm versions | mise | `.mise.toml` (`[tools]`) |
| Env vars | mise | `.mise.toml` (`[env]`), `.mise.local.toml` |
| Tasks | mise | `mise-tasks/*` (file-based tasks) |

## Section 1: Tool Versions

`.mise.toml`:

```toml
[tools]
node = "lts"
pnpm = "11"
```

- Node tracks latest LTS automatically via mise
- pnpm 11 matches current `packageManager` field
- Individuals can override in `.mise.local.toml` (e.g., `node = "23"`)
- Remove `packageManager` field from `package.json` — mise owns pnpm versioning

## Section 2: Environment Variables

`.mise.toml` `[env]` section:

```toml
[env]
_.file = ".env"
```

- Loads existing `.env` file via `_.file` — no migration of secrets
- `.env.example` stays as documentation

`.mise.local.toml` (gitignored, replaces `.envrc.local`):

```toml
[env]
AWS_ACCESS_KEY_ID = "test"
AWS_SECRET_ACCESS_KEY = "test"
AWS_DEFAULT_REGION = "ap-southeast-1"
AWS_ENDPOINT_URL = "http://localhost:4566"
GITHUB_PERSONAL_ACCESS_TOKEN = "..."
OPENCODE_CONFIG = "./.opencode/opencode.json"
```

- Delete `.envrc` and `.envrc.local` — direnv is no longer a dependency
- Add `.mise.local.toml` and `.mise.local.*` to `.gitignore`

## Section 3: Tasks (File-based)

Each task is an executable bash script in `mise-tasks/` with a `#MISE description=` header comment. mise auto-discovers these files.

### Directory structure

```
mise-tasks/
  up
  up-web
  up-api
  down
  build
  logs
  logs-web
  logs-api
  clean
  db-migrate
  db-generate
  db-studio
  db-seed
  lint
  test-unit
  test-integration
  test-e2e
  test-all
  typecheck
  dev
  k8s-up
  k8s-down
  monitoring-up
  monitoring-down
  monitoring-port-forward
  infra-up
  infra-down
  infra-plan
  infra-apply
  helm-deploy-dev
  helm-deploy-staging
  helm-deploy-prod
```

### Task sources

| Task | Source (Makefile target) | Content |
|------|--------------------------|---------|
| `up` | `docker.mk: up` | `docker compose up --build -d` |
| `up-web` | `docker.mk: up-web` | `docker compose up --build -d postgres web` |
| `up-api` | `docker.mk: up-api` | `docker compose up --build -d postgres api` |
| `down` | `docker.mk: down` | `docker compose down` |
| `build` | `docker.mk: build` | `docker compose build --no-cache` |
| `logs` | `docker.mk: logs` | `docker compose logs -f` |
| `logs-web` | `docker.mk: logs-web` | `docker compose logs -f web` |
| `logs-api` | `docker.mk: logs-api` | `docker compose logs -f api` |
| `clean` | `docker.mk: clean` | `docker compose down -v --rmi local` |
| `db-migrate` | `db.mk: db-migrate` | `pnpm nx run @fullstack-monorepo-app/api:db-migrate` |
| `db-generate` | `db.mk: db-generate` | `pnpm nx run @fullstack-monorepo-app/api:db-generate` |
| `db-studio` | `db.mk: db-studio` | `pnpm nx run @fullstack-monorepo-app/api:db-studio` |
| `db-seed` | `db.mk: db-seed` | `pnpm nx run @fullstack-monorepo-app/api:db:seed` |
| `lint` | `app.mk: lint` | `pnpm nx run-many -t lint` |
| `test-unit` | `app.mk: test-unit` | `pnpm nx run-many -t test` |
| `test-integration` | `app.mk: test-integration` | `pnpm --filter @fullstack-monorepo-app/api test:integration` |
| `test-e2e` | `app.mk: test-e2e` | Runs both api and web e2e tests |
| `test-all` | `app.mk: test-all` | Calls `mise run test-unit`, `mise run test-integration`, `mise run test-e2e` |
| `typecheck` | `app.mk: typecheck` | `pnpm nx run-many -t typecheck` |
| `dev` | `package.json: dev` | `pnpm nx run-many -t dev` |
| `k8s-up` | `infra.mk: k8s-up` | Full content from Make recipe (multi-step) |
| `k8s-down` | `infra.mk: k8s-down` | Full content from Make recipe |
| `monitoring-up` | `infra.mk: monitoring-up` | `bash infra/helm/monitoring/install.sh ${ENV:-dev}` |
| `monitoring-down` | `infra.mk: monitoring-down` | Helm uninstall + namespace delete |
| `monitoring-port-forward` | `infra.mk: monitoring-port-forward` | `kubectl port-forward` |
| `infra-up` | `infra.mk: infra-up` | `bash infra/scripts/localstack-init.sh` |
| `infra-down` | `infra.mk: infra-down` | kind delete + localstack stop + docker compose down |
| `infra-plan` | `infra.mk: infra-plan` | `bash infra/scripts/tf-plan.sh dev` |
| `infra-apply` | `infra.mk: infra-apply` | `cd infra/terraform/envs/dev && terraform apply -auto-approve` |
| `helm-deploy-dev` | `infra.mk: helm-deploy-dev` | `bash infra/scripts/deploy.sh dev all` |
| `helm-deploy-staging` | `infra.mk: helm-deploy-staging` | `bash infra/scripts/deploy.sh staging all` |
| `helm-deploy-prod` | `infra.mk: helm-deploy-prod` | `bash infra/scripts/deploy.sh prod all` |

### Design decisions

- One layer of indirection removed: `k8s-up`/`k8s-down`/`infra-down` go directly into task files instead of Make calling separate scripts
- Task listing available via `mise tasks ls` (replaces `make help`)
- Each file is independently testable, lintable, and gets syntax highlighting
- `test-all` calls `mise run` for sub-tasks sequentially

## Section 4: Bootstrap Script (`install.sh`)

### Changes

Replace `ensure_node()` + `ensure_pnpm()` with single `ensure_mise()`:

```
ensure_mise():
  1. Check if mise binary exists
  2. If not, install via curl -fsSL https://mise.run | sh
  3. Activate for current shell
  4. After repo clone, run `mise install` to install Node + pnpm from .mise.toml
```

### Execution order

```
main():
  detect_os
  ensure_git
  ensure_mise          # installs mise binary only
  check_docker
  prompt_project_name
  prompt_git_config
  clone_repo
  rename_project
  setup_env_file
  mise_install_tools   # NEW: runs `mise install` inside cloned dir
  git_init_fresh
  install_deps
  print_next_steps
```

### Constants removed

- `NODE_MAJOR=22`
- `NVM_VERSION="v0.40.1"`

### Functions removed

- `ensure_node()`
- `ensure_pnpm()`

### Functions added

- `ensure_mise()` — installs mise binary
- `mise_install_tools()` — runs `mise install` inside cloned repo

## Section 5: Cleanup & File Changes

### Files to create

- `.mise.toml` — tools + env
- `mise-tasks/*` — ~28 executable task scripts

### Files to delete

- `.envrc`
- `.envrc.local`
- `Makefile`
- `makefiles/docker.mk`
- `makefiles/db.mk`
- `makefiles/app.mk`
- `makefiles/infra.mk`
- `makefiles/` directory

### Files to modify

- `package.json` — remove `packageManager` field
- `.gitignore` — add `.mise.local.toml` and `.mise.local.*`
- `install.sh` — rewrite tool installation to use mise

## Scope

This is a single implementation plan. No decomposition needed — all changes are tightly coupled (removing old tools requires adding new ones in the same pass).
