# Mise Full Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace nvm, corepack, direnv, and Makefile with mise as the single tool manager, task runner, and environment loader.

**Architecture:** Single `.mise.toml` for tools + env config, `mise-tasks/` directory of executable bash scripts for all tasks, rewritten `install.sh` using mise instead of nvm/corepack.

**Tech Stack:** mise, bash, TOML, pnpm, Node.js

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `.mise.toml` | Tool versions + env var config |
| Create | `.mise.local.toml` | Personal overrides (gitignored) |
| Create | `mise-tasks/up` | Docker: start all containers |
| Create | `mise-tasks/up-web` | Docker: start web + postgres |
| Create | `mise-tasks/up-api` | Docker: start api + postgres |
| Create | `mise-tasks/down` | Docker: stop all containers |
| Create | `mise-tasks/build` | Docker: build all images |
| Create | `mise-tasks/logs` | Docker: tail all logs |
| Create | `mise-tasks/logs-web` | Docker: tail web logs |
| Create | `mise-tasks/logs-api` | Docker: tail api logs |
| Create | `mise-tasks/clean` | Docker: remove containers + volumes |
| Create | `mise-tasks/db-migrate` | DB: run migrations |
| Create | `mise-tasks/db-generate` | DB: generate migrations |
| Create | `mise-tasks/db-studio` | DB: open Drizzle Studio |
| Create | `mise-tasks/db-seed` | DB: seed data |
| Create | `mise-tasks/lint` | App: lint all |
| Create | `mise-tasks/test-unit` | App: unit tests |
| Create | `mise-tasks/test-integration` | App: integration tests |
| Create | `mise-tasks/test-e2e` | App: e2e tests |
| Create | `mise-tasks/test-all` | App: all test layers |
| Create | `mise-tasks/typecheck` | App: typecheck all |
| Create | `mise-tasks/dev` | App: start dev servers |
| Create | `mise-tasks/k8s-up` | Infra: start K8s dev env |
| Create | `mise-tasks/k8s-down` | Infra: stop K8s dev env |
| Create | `mise-tasks/monitoring-up` | Infra: deploy monitoring |
| Create | `mise-tasks/monitoring-down` | Infra: remove monitoring |
| Create | `mise-tasks/monitoring-port-forward` | Infra: port-forward Grafana |
| Create | `mise-tasks/infra-up` | Infra: start LocalStack + kind |
| Create | `mise-tasks/infra-down` | Infra: teardown dev infra |
| Create | `mise-tasks/infra-plan` | Infra: terraform plan |
| Create | `mise-tasks/infra-apply` | Infra: terraform apply |
| Create | `mise-tasks/helm-deploy-dev` | Infra: helm deploy dev |
| Create | `mise-tasks/helm-deploy-staging` | Infra: helm deploy staging |
| Create | `mise-tasks/helm-deploy-prod` | Infra: helm deploy prod |
| Create | `tests/install/ensure_mise.bats` | Tests for ensure_mise function |
| Modify | `.gitignore` | Add mise local patterns |
| Modify | `package.json` | Remove packageManager field |
| Modify | `install.sh` | Replace nvm/corepack with mise |
| Delete | `.envrc` | Replaced by mise env |
| Delete | `.envrc.local` | Replaced by .mise.local.toml |
| Delete | `Makefile` | Replaced by mise tasks |
| Delete | `makefiles/docker.mk` | Replaced by mise tasks |
| Delete | `makefiles/db.mk` | Replaced by mise tasks |
| Delete | `makefiles/app.mk` | Replaced by mise tasks |
| Delete | `makefiles/infra.mk` | Replaced by mise tasks |
| Delete | `tests/install/ensure_pnpm.bats` | Replaced by ensure_mise.bats |

---

### Task 1: Create `.mise.toml` — Tools + Env Config

**Files:**
- Create: `.mise.toml`

- [ ] **Step 1: Create `.mise.toml` with tools and env sections**

```toml
[tools]
node = "lts"
pnpm = "11"

[env]
_.file = ".env"
```

- [ ] **Step 2: Verify mise recognizes the config**

Run: `mise ls`
Expected: Shows node (lts) and pnpm (11) listed

- [ ] **Step 3: Commit**

```bash
git add .mise.toml
git commit -m "feat(mise): add .mise.toml with tools and env config"
```

---

### Task 2: Create `.mise.local.toml` and update `.gitignore`

**Files:**
- Create: `.mise.local.toml`
- Modify: `.gitignore`

- [ ] **Step 1: Create `.mise.local.toml` with personal env vars**

```toml
[env]
AWS_ACCESS_KEY_ID = "test"
AWS_SECRET_ACCESS_KEY = "test"
AWS_DEFAULT_REGION = "ap-southeast-1"
AWS_ENDPOINT_URL = "http://localhost:4566"
OPENCODE_CONFIG = "./.opencode/opencode.json"
```

Note: `GITHUB_PERSONAL_ACCESS_TOKEN` should be added by each developer with their own value.

- [ ] **Step 2: Add mise local patterns to `.gitignore`**

Add after the existing `# Environment` section in `.gitignore`:

```
# mise local
.mise.local.toml
.mise.local.*
```

- [ ] **Step 3: Verify `.mise.local.toml` is gitignored**

Run: `git status`
Expected: `.mise.local.toml` does NOT appear in untracked files

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore(mise): add .mise.local.toml to gitignore"
```

---

### Task 3: Create Docker task scripts

**Files:**
- Create: `mise-tasks/up`
- Create: `mise-tasks/up-web`
- Create: `mise-tasks/up-api`
- Create: `mise-tasks/down`
- Create: `mise-tasks/build`
- Create: `mise-tasks/logs`
- Create: `mise-tasks/logs-web`
- Create: `mise-tasks/logs-api`
- Create: `mise-tasks/clean`

- [ ] **Step 1: Create `mise-tasks/` directory**

```bash
mkdir -p mise-tasks
```

- [ ] **Step 2: Create `mise-tasks/up`**

```bash
#!/usr/bin/env bash
#MISE description="Build & start all containers"
docker compose up --build -d
```

- [ ] **Step 3: Create `mise-tasks/up-web`**

```bash
#!/usr/bin/env bash
#MISE description="Build & start web + postgres"
docker compose up --build -d postgres web
```

- [ ] **Step 4: Create `mise-tasks/up-api`**

```bash
#!/usr/bin/env bash
#MISE description="Build & start api + postgres"
docker compose up --build -d postgres api
```

- [ ] **Step 5: Create `mise-tasks/down`**

```bash
#!/usr/bin/env bash
#MISE description="Stop all containers"
docker compose down
```

- [ ] **Step 6: Create `mise-tasks/build`**

```bash
#!/usr/bin/env bash
#MISE description="Build all images (no cache)"
docker compose build --no-cache
```

- [ ] **Step 7: Create `mise-tasks/logs`**

```bash
#!/usr/bin/env bash
#MISE description="Tail all container logs"
docker compose logs -f
```

- [ ] **Step 8: Create `mise-tasks/logs-web`**

```bash
#!/usr/bin/env bash
#MISE description="Tail web container logs"
docker compose logs -f web
```

- [ ] **Step 9: Create `mise-tasks/logs-api`**

```bash
#!/usr/bin/env bash
#MISE description="Tail api container logs"
docker compose logs -f api
```

- [ ] **Step 10: Create `mise-tasks/clean`**

```bash
#!/usr/bin/env bash
#MISE description="Stop containers, remove volumes and images"
docker compose down -v --rmi local
```

- [ ] **Step 11: Make all task scripts executable**

```bash
chmod +x mise-tasks/up mise-tasks/up-web mise-tasks/up-api mise-tasks/down mise-tasks/build mise-tasks/logs mise-tasks/logs-web mise-tasks/logs-api mise-tasks/clean
```

- [ ] **Step 12: Verify mise discovers the tasks**

Run: `mise tasks ls`
Expected: All 9 docker tasks listed with descriptions

- [ ] **Step 13: Commit**

```bash
git add mise-tasks/
git commit -m "feat(mise): add docker task scripts"
```

---

### Task 4: Create DB task scripts

**Files:**
- Create: `mise-tasks/db-migrate`
- Create: `mise-tasks/db-generate`
- Create: `mise-tasks/db-studio`
- Create: `mise-tasks/db-seed`

- [ ] **Step 1: Create `mise-tasks/db-migrate`**

```bash
#!/usr/bin/env bash
#MISE description="Run database migrations"
pnpm nx run @fullstack-monorepo-app/api:db-migrate
```

- [ ] **Step 2: Create `mise-tasks/db-generate`**

```bash
#!/usr/bin/env bash
#MISE description="Generate migration files"
pnpm nx run @fullstack-monorepo-app/api:db-generate
```

- [ ] **Step 3: Create `mise-tasks/db-studio`**

```bash
#!/usr/bin/env bash
#MISE description="Open Drizzle Studio"
pnpm nx run @fullstack-monorepo-app/api:db-studio
```

- [ ] **Step 4: Create `mise-tasks/db-seed`**

```bash
#!/usr/bin/env bash
#MISE description="Seed the database"
pnpm nx run @fullstack-monorepo-app/api:db:seed
```

- [ ] **Step 5: Make scripts executable**

```bash
chmod +x mise-tasks/db-migrate mise-tasks/db-generate mise-tasks/db-studio mise-tasks/db-seed
```

- [ ] **Step 6: Commit**

```bash
git add mise-tasks/db-migrate mise-tasks/db-generate mise-tasks/db-studio mise-tasks/db-seed
git commit -m "feat(mise): add database task scripts"
```

---

### Task 5: Create App task scripts

**Files:**
- Create: `mise-tasks/lint`
- Create: `mise-tasks/test-unit`
- Create: `mise-tasks/test-integration`
- Create: `mise-tasks/test-e2e`
- Create: `mise-tasks/test-all`
- Create: `mise-tasks/typecheck`
- Create: `mise-tasks/dev`

- [ ] **Step 1: Create `mise-tasks/lint`**

```bash
#!/usr/bin/env bash
#MISE description="Lint all apps"
pnpm nx run-many -t lint
```

- [ ] **Step 2: Create `mise-tasks/test-unit`**

```bash
#!/usr/bin/env bash
#MISE description="Run unit tests for all apps"
pnpm nx run-many -t test
```

- [ ] **Step 3: Create `mise-tasks/test-integration`**

```bash
#!/usr/bin/env bash
#MISE description="Run API integration tests"
pnpm --filter @fullstack-monorepo-app/api test:integration
```

- [ ] **Step 4: Create `mise-tasks/test-e2e`**

```bash
#!/usr/bin/env bash
#MISE description="Run API and Web e2e tests"
pnpm --filter @fullstack-monorepo-app/api test:e2e
pnpm --filter @fullstack-monorepo-app/web test:e2e
```

- [ ] **Step 5: Create `mise-tasks/test-all`**

```bash
#!/usr/bin/env bash
#MISE description="Run all test layers (unit, integration, e2e)"
mise run test-unit
mise run test-integration
mise run test-e2e
```

- [ ] **Step 6: Create `mise-tasks/typecheck`**

```bash
#!/usr/bin/env bash
#MISE description="Typecheck all apps"
pnpm nx run-many -t typecheck
```

- [ ] **Step 7: Create `mise-tasks/dev`**

```bash
#!/usr/bin/env bash
#MISE description="Start all apps in dev mode"
pnpm nx run-many -t dev
```

- [ ] **Step 8: Make scripts executable**

```bash
chmod +x mise-tasks/lint mise-tasks/test-unit mise-tasks/test-integration mise-tasks/test-e2e mise-tasks/test-all mise-tasks/typecheck mise-tasks/dev
```

- [ ] **Step 9: Commit**

```bash
git add mise-tasks/lint mise-tasks/test-unit mise-tasks/test-integration mise-tasks/test-e2e mise-tasks/test-all mise-tasks/typecheck mise-tasks/dev
git commit -m "feat(mise): add app task scripts"
```

---

### Task 6: Create Infra task scripts

**Files:**
- Create: `mise-tasks/k8s-up`
- Create: `mise-tasks/k8s-down`
- Create: `mise-tasks/monitoring-up`
- Create: `mise-tasks/monitoring-down`
- Create: `mise-tasks/monitoring-port-forward`
- Create: `mise-tasks/infra-up`
- Create: `mise-tasks/infra-down`
- Create: `mise-tasks/infra-plan`
- Create: `mise-tasks/infra-apply`
- Create: `mise-tasks/helm-deploy-dev`
- Create: `mise-tasks/helm-deploy-staging`
- Create: `mise-tasks/helm-deploy-prod`

- [ ] **Step 1: Create `mise-tasks/k8s-up`**

Content is the full multi-step recipe from `makefiles/infra.mk` lines 9-65, converted to a standalone script:

```bash
#!/usr/bin/env bash
#MISE description="Start full K8s dev environment"
set -euo pipefail

KIND_CLUSTER="fullstack-monorepo-dev"

echo ""
echo -e "\033[1;35m  ━━ Starting K8s Dev Environment ━━\033[0m"
echo ""

echo -e "\033[36m[1/8]\033[0m Starting LocalStack..."
localstack start -d 2>/dev/null || true
for i in $(seq 1 30); do
  if curl -s http://localhost:4566/_localstack/health | grep -q '"s3": "available"' 2>/dev/null; then break; fi
  sleep 2
done

echo -e "\033[36m[2/8]\033[0m Creating kind cluster..."
kind get clusters 2>/dev/null | grep -q "$KIND_CLUSTER" || kind create cluster --name "$KIND_CLUSTER" --wait 60s

echo -e "\033[36m[3/8]\033[0m Installing nginx-ingress..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml 2>/dev/null || true
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s 2>/dev/null || true

echo -e "\033[36m[4/8]\033[0m Running Terraform (LocalStack)..."
cd infra/terraform/envs/dev && terraform init -input=false >/dev/null 2>&1 && terraform apply -auto-approve -input=false >/dev/null 2>&1 && cd -

echo -e "\033[36m[5/8]\033[0m Building Docker images..."
docker build -t fullstack-monorepo/api:dev -f apps/api/Dockerfile . -q
docker build -t fullstack-monorepo/web:dev -f apps/web/Dockerfile . -q
kind load docker-image fullstack-monorepo/api:dev --name "$KIND_CLUSTER" 2>/dev/null
kind load docker-image fullstack-monorepo/web:dev --name "$KIND_CLUSTER" 2>/dev/null

echo -e "\033[36m[6/8]\033[0m Deploying PostgreSQL + running migrations..."
helm upgrade --install postgres ./infra/helm/postgres -n dev --create-namespace --wait --timeout 2m >/dev/null 2>&1
kubectl wait --for=condition=ready pod -l app=postgres -n dev --timeout=60s >/dev/null 2>&1
kubectl port-forward svc/postgres 5433:5432 -n dev >/dev/null 2>&1 & PF_PID=$!
sleep 3
DATABASE_URL="postgresql://postgres:password@localhost:5433/fullstack_monorepo_dev" \
  pnpm --filter @fullstack-monorepo-app/api exec drizzle-kit migrate >/dev/null 2>&1
DATABASE_URL="postgresql://postgres:password@localhost:5433/fullstack_monorepo_dev" \
  pnpm --filter @fullstack-monorepo-app/api run db:seed >/dev/null 2>&1
kill $PF_PID 2>/dev/null || true

echo -e "\033[36m[7/8]\033[0m Deploying API + Web..."
helm upgrade --install api ./infra/helm/api \
  -f ./infra/helm/api/values-dev.yaml \
  --set image.repository=fullstack-monorepo/api --set image.tag=dev \
  --set image.pullPolicy=IfNotPresent \
  --set env.NODE_ENV=production --set env.JWT_ACCESS_EXPIRES_IN=15m --set env.JWT_REFRESH_EXPIRES_IN=7d \
  -n dev --wait --timeout 3m >/dev/null 2>&1
helm upgrade --install web ./infra/helm/web \
  -f ./infra/helm/web/values-dev.yaml \
  --set image.repository=fullstack-monorepo/web --set image.tag=dev \
  --set image.pullPolicy=IfNotPresent \
  -n dev --wait --timeout 3m >/dev/null 2>&1

echo -e "\033[36m[8/8]\033[0m Deploying monitoring stack..."
bash infra/helm/monitoring/install.sh dev >/dev/null 2>&1

echo ""
echo -e "\033[1;32m  ✓ K8s dev environment is ready!\033[0m"
echo ""
echo "    Pods:"
kubectl get pods -n dev --no-headers | awk '{printf "      %-30s %s\n", $1, $3}'
kubectl get pods -n monitoring --no-headers | awk '{printf "      %-30s %s\n", $1, $3}'
echo ""
echo "    Access:"
echo "      API:      kubectl port-forward svc/api 8000:8000 -n dev"
echo "      Web:      kubectl port-forward svc/web 3000:3000 -n dev"
echo "      Grafana:  kubectl port-forward svc/prometheus-grafana 3001:80 -n monitoring"
echo ""
```

- [ ] **Step 2: Create `mise-tasks/k8s-down`**

Content from `makefiles/infra.mk` lines 68-79:

```bash
#!/usr/bin/env bash
#MISE description="Stop full K8s dev environment"
set -euo pipefail

KIND_CLUSTER="fullstack-monorepo-dev"

echo ""
echo -e "\033[1;35m  ━━ Stopping K8s Dev Environment ━━\033[0m"
echo ""

echo "  Uninstalling Helm releases..."
helm uninstall prometheus loki promtail tempo otel-collector -n monitoring 2>/dev/null || true
helm uninstall api web postgres -n dev 2>/dev/null || true

echo "  Deleting kind cluster..."
kind delete cluster --name "$KIND_CLUSTER" 2>/dev/null || true

echo "  Stopping LocalStack..."
localstack stop 2>/dev/null || true

echo ""
echo -e "\033[1;32m  ✓ K8s dev environment stopped.\033[0m"
echo ""
```

- [ ] **Step 3: Create `mise-tasks/monitoring-up`**

```bash
#!/usr/bin/env bash
#MISE description="Deploy monitoring stack (usage: mise run monitoring-up --env=dev)"
set -euo pipefail
bash infra/helm/monitoring/install.sh "${ENV:-dev}"
```

- [ ] **Step 4: Create `mise-tasks/monitoring-down`**

```bash
#!/usr/bin/env bash
#MISE description="Remove monitoring stack"
set -euo pipefail

echo "==> Removing monitoring stack..."
helm uninstall prometheus loki promtail tempo otel-collector -n monitoring 2>/dev/null || true
kubectl delete namespace monitoring 2>/dev/null || true
echo "==> Monitoring stack removed."
```

- [ ] **Step 5: Create `mise-tasks/monitoring-port-forward`**

```bash
#!/usr/bin/env bash
#MISE description="Port-forward Grafana to localhost:3001"
set -euo pipefail

echo "Grafana available at http://localhost:3001 (admin/admin)"
kubectl port-forward svc/prometheus-grafana 3001:80 -n monitoring
```

- [ ] **Step 6: Create `mise-tasks/infra-up`**

```bash
#!/usr/bin/env bash
#MISE description="Start LocalStack + kind cluster"
set -euo pipefail
bash infra/scripts/localstack-init.sh
```

- [ ] **Step 7: Create `mise-tasks/infra-down`**

Content from `makefiles/infra.mk` lines 103-108:

```bash
#!/usr/bin/env bash
#MISE description="Tear down dev infrastructure"
set -euo pipefail

KIND_CLUSTER="fullstack-monorepo-dev"

echo "==> Stopping kind cluster..."
kind delete cluster --name "$KIND_CLUSTER" 2>/dev/null || true

echo "==> Stopping LocalStack..."
docker stop localstack 2>/dev/null && docker rm localstack 2>/dev/null || true

docker compose down

echo "==> Dev infrastructure stopped."
```

- [ ] **Step 8: Create `mise-tasks/infra-plan`**

```bash
#!/usr/bin/env bash
#MISE description="Run terraform plan for dev env"
set -euo pipefail
bash infra/scripts/tf-plan.sh dev
```

- [ ] **Step 9: Create `mise-tasks/infra-apply`**

```bash
#!/usr/bin/env bash
#MISE description="Run terraform apply for dev env"
set -euo pipefail
cd infra/terraform/envs/dev && terraform apply -auto-approve -input=false
```

- [ ] **Step 10: Create `mise-tasks/helm-deploy-dev`**

```bash
#!/usr/bin/env bash
#MISE description="Deploy all services to kind (dev)"
set -euo pipefail
bash infra/scripts/deploy.sh dev all
```

- [ ] **Step 11: Create `mise-tasks/helm-deploy-staging`**

```bash
#!/usr/bin/env bash
#MISE description="Deploy all services to staging"
set -euo pipefail
bash infra/scripts/deploy.sh staging all
```

- [ ] **Step 12: Create `mise-tasks/helm-deploy-prod`**

```bash
#!/usr/bin/env bash
#MISE description="Deploy all services to prod"
set -euo pipefail
bash infra/scripts/deploy.sh prod all
```

- [ ] **Step 13: Make all infra scripts executable**

```bash
chmod +x mise-tasks/k8s-up mise-tasks/k8s-down mise-tasks/monitoring-up mise-tasks/monitoring-down mise-tasks/monitoring-port-forward mise-tasks/infra-up mise-tasks/infra-down mise-tasks/infra-plan mise-tasks/infra-apply mise-tasks/helm-deploy-dev mise-tasks/helm-deploy-staging mise-tasks/helm-deploy-prod
```

- [ ] **Step 14: Verify all tasks are discovered**

Run: `mise tasks ls`
Expected: All 28 tasks listed with descriptions

- [ ] **Step 15: Commit**

```bash
git add mise-tasks/
git commit -m "feat(mise): add infra task scripts"
```

---

### Task 7: Update `package.json` — Remove `packageManager` field

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Remove the `packageManager` field from `package.json`**

Remove line 5:
```
"packageManager": "pnpm@11.4.0+sha512.f0febc7e37552ab485494a914241b338e0b3580b93d54ce31f00933015880863129038a1b4ae4e414a0ee63ac35bf21197e990172c4a68256450b5636310968f",
```

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json'))" && echo "Valid JSON"`
Expected: "Valid JSON"

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: remove packageManager field, mise now manages pnpm version"
```

---

### Task 8: Rewrite `install.sh` — Replace nvm/corepack with mise

**Files:**
- Modify: `install.sh`
- Create: `tests/install/ensure_mise.bats`
- Delete: `tests/install/ensure_pnpm.bats`

- [ ] **Step 1: Update constants section**

Remove:
```
NODE_MAJOR=22
NVM_VERSION="v0.40.1"
```

No replacement constants needed — mise installs via `.mise.toml`.

- [ ] **Step 2: Replace `ensure_node()` function (lines 159-188) with `ensure_mise()`**

Remove the entire `ensure_node()` function. Add in its place:

```bash
ensure_mise() {
  log "Checking mise..."
  if ! has mise; then
    log "Installing mise..."
    curl -fsSL https://mise.run | sh
    # shellcheck disable=SC1091
    . "$HOME/.local/bin/mise" activate bash 2>/dev/null || true
    # Also add to PATH for current shell in case activate didn't fully work
    export PATH="$HOME/.local/bin:$PATH"
  fi
  log "mise $(mise --version)"
}
```

- [ ] **Step 3: Remove `ensure_pnpm()` function entirely (lines 190-205)**

This is no longer needed — `mise install` inside the cloned repo handles pnpm.

- [ ] **Step 4: Add `mise_install_tools()` function after `setup_env_file()`**

```bash
mise_install_tools() {
  log "Installing tools via mise..."
  (cd "$INSTALL_DIR" && mise install)
  log "Node $(node --version) + pnpm $(pnpm --version) installed"
}
```

- [ ] **Step 5: Update `main()` to use new flow**

Replace:
```bash
  ensure_node
  ensure_pnpm
```

With:
```bash
  ensure_mise
```

And add `mise_install_tools` call after `setup_env_file` and before `git_init_fresh`:

```bash
  setup_env_file
  mise_install_tools
  git_init_fresh
```

- [ ] **Step 6: Update `print_next_steps()`**

Replace:
```
  # Or run locally without Docker:
  pnpm dev
```

With:
```
  # Or run locally without Docker:
  mise run dev
```

- [ ] **Step 7: Remove the `--filter` rename from `rename_project()` if it references nvm**

No changes needed in `rename_project()` — it doesn't reference nvm/corepack.

- [ ] **Step 8: Write `tests/install/ensure_mise.bats`**

```bash
#!/usr/bin/env bats
# Tests for ensure_mise() in install.sh

setup() {
  load helpers/stubs
  setup_stub_dir
  # shellcheck disable=SC1091
  source install.sh
}

teardown() {
  teardown_stub_dir
}

@test "ensure_mise: skips install when mise is already available" {
  stub mise "echo '2026.6.2 macos-arm64'"

  run ensure_mise
  [ "$status" -eq 0 ]
  [[ "$output" == *"mise"*"2026.6.2"* ]]
}

@test "ensure_mise: installs mise when not found" {
  # Stub curl to simulate mise install script
  stub curl "echo '#!/bin/bash' > \$HOME/.local/bin/mise; chmod +x \$HOME/.local/bin/mise"
  stub sh "true"

  # Ensure mise is not on PATH
  export PATH="$STUB_DIR"

  run ensure_mise
  [ "$status" -eq 0 ]
}
```

- [ ] **Step 9: Delete `tests/install/ensure_pnpm.bats`**

```bash
rm tests/install/ensure_pnpm.bats
```

- [ ] **Step 10: Run tests to verify**

Run: `bats tests/install/`
Expected: All tests pass (note: some existing tests may need PATH adjustments — fix as needed)

- [ ] **Step 11: Commit**

```bash
git add install.sh tests/install/ensure_mise.bats
git rm tests/install/ensure_pnpm.bats
git commit -m "feat(install): replace nvm/corepack with mise for tool management"
```

---

### Task 9: Delete old tooling files

**Files:**
- Delete: `.envrc`
- Delete: `.envrc.local`
- Delete: `Makefile`
- Delete: `makefiles/docker.mk`
- Delete: `makefiles/db.mk`
- Delete: `makefiles/app.mk`
- Delete: `makefiles/infra.mk`

- [ ] **Step 1: Delete direnv files**

```bash
rm .envrc .envrc.local
```

- [ ] **Step 2: Delete Makefile and makefiles directory**

```bash
rm Makefile
rm -r makefiles/
```

- [ ] **Step 3: Verify everything still works**

Run: `mise tasks ls`
Expected: All 28 tasks listed

Run: `mise ls`
Expected: node (lts) and pnpm (11) listed

Run: `node --version`
Expected: A Node LTS version

Run: `pnpm --version`
Expected: pnpm 11.x

- [ ] **Step 4: Commit**

```bash
git rm .envrc .envrc.local Makefile makefiles/docker.mk makefiles/db.mk makefiles/app.mk makefiles/infra.mk
git commit -m "chore: remove direnv and Makefile, replaced by mise"
```

---

### Task 10: Final verification

- [ ] **Step 1: Verify mise install works from scratch**

```bash
mise install
```

Expected: Installs node (lts) and pnpm (11) without errors

- [ ] **Step 2: Verify env vars are loaded**

```bash
mise set
```

Expected: Shows env vars from `.env` file

- [ ] **Step 3: Verify task listing is clean**

```bash
mise tasks ls
```

Expected: All 28 tasks with descriptions, no errors

- [ ] **Step 4: Verify install.sh tests pass**

```bash
bats tests/install/
```

Expected: All tests pass

- [ ] **Step 5: Verify existing npm scripts still work**

```bash
pnpm install
```

Expected: Dependencies install without errors (pnpm is provided by mise)

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address final mise migration issues"
```
