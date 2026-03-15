.PHONY: infra-up infra-down infra-plan infra-apply helm-deploy-dev helm-deploy-staging helm-deploy-prod k8s-up k8s-down

INFRA_SCRIPTS_DIR := infra/scripts
KIND_CLUSTER := fullstack-monorepo-dev

## Kubernetes (Full Local Stack) ──────────────────────

k8s-up: ## Start full K8s dev environment (LocalStack + kind + build + deploy)
	@echo ""
	@echo "\033[1;35m  ━━ Starting K8s Dev Environment ━━\033[0m"
	@echo ""
	@echo "\033[36m[1/7]\033[0m Starting LocalStack..."
	@localstack start -d 2>/dev/null || true
	@for i in $$(seq 1 30); do \
		if curl -s http://localhost:4566/_localstack/health | grep -q '"s3": "available"' 2>/dev/null; then break; fi; \
		sleep 2; \
	done
	@echo "\033[36m[2/7]\033[0m Creating kind cluster..."
	@kind get clusters 2>/dev/null | grep -q $(KIND_CLUSTER) || kind create cluster --name $(KIND_CLUSTER) --wait 60s
	@echo "\033[36m[3/7]\033[0m Installing nginx-ingress..."
	@kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml 2>/dev/null || true
	@kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s 2>/dev/null || true
	@echo "\033[36m[4/7]\033[0m Running Terraform (LocalStack)..."
	@cd infra/terraform/envs/dev && terraform init -input=false >/dev/null 2>&1 && terraform apply -auto-approve -input=false >/dev/null 2>&1
	@echo "\033[36m[5/7]\033[0m Building Docker images..."
	@docker build -t fullstack-monorepo/api:dev -f apps/api/Dockerfile . -q
	@docker build -t fullstack-monorepo/web:dev -f apps/web/Dockerfile . -q
	@kind load docker-image fullstack-monorepo/api:dev --name $(KIND_CLUSTER) 2>/dev/null
	@kind load docker-image fullstack-monorepo/web:dev --name $(KIND_CLUSTER) 2>/dev/null
	@echo "\033[36m[6/7]\033[0m Deploying PostgreSQL + running migrations..."
	@helm upgrade --install postgres ./infra/helm/postgres -n dev --create-namespace --wait --timeout 2m >/dev/null 2>&1
	@kubectl wait --for=condition=ready pod -l app=postgres -n dev --timeout=60s >/dev/null 2>&1
	@kubectl port-forward svc/postgres 5433:5432 -n dev >/dev/null 2>&1 & PF_PID=$$!; \
		sleep 3; \
		DATABASE_URL="postgresql://postgres:password@localhost:5433/inviduality_dev" \
			pnpm --filter @inviduality/api exec drizzle-kit migrate >/dev/null 2>&1; \
		DATABASE_URL="postgresql://postgres:password@localhost:5433/inviduality_dev" \
			pnpm --filter @inviduality/api run db:seed >/dev/null 2>&1; \
		kill $$PF_PID 2>/dev/null || true
	@echo "\033[36m[7/7]\033[0m Deploying API + Web..."
	@helm upgrade --install api ./infra/helm/api \
		-f ./infra/helm/api/values-dev.yaml \
		--set image.repository=fullstack-monorepo/api --set image.tag=dev \
		--set image.pullPolicy=IfNotPresent \
		--set env.NODE_ENV=production --set env.JWT_ACCESS_EXPIRES_IN=15m --set env.JWT_REFRESH_EXPIRES_IN=7d \
		-n dev --wait --timeout 3m >/dev/null 2>&1
	@helm upgrade --install web ./infra/helm/web \
		-f ./infra/helm/web/values-dev.yaml \
		--set image.repository=fullstack-monorepo/web --set image.tag=dev \
		--set image.pullPolicy=IfNotPresent \
		-n dev --wait --timeout 3m >/dev/null 2>&1
	@echo ""
	@echo "\033[1;32m  ✓ K8s dev environment is ready!\033[0m"
	@echo ""
	@echo "    Pods:"
	@kubectl get pods -n dev --no-headers | awk '{printf "      %-30s %s\n", $$1, $$3}'
	@echo ""
	@echo "    Access:"
	@echo "      API:  kubectl port-forward svc/api 8000:8000 -n dev"
	@echo "      Web:  kubectl port-forward svc/web 3000:3000 -n dev"
	@echo ""

k8s-down: ## Stop full K8s dev environment
	@echo ""
	@echo "\033[1;35m  ━━ Stopping K8s Dev Environment ━━\033[0m"
	@echo ""
	@echo "  Uninstalling Helm releases..."
	@helm uninstall api web postgres -n dev 2>/dev/null || true
	@echo "  Deleting kind cluster..."
	@kind delete cluster --name $(KIND_CLUSTER) 2>/dev/null || true
	@echo "  Stopping LocalStack..."
	@localstack stop 2>/dev/null || true
	@echo ""
	@echo "\033[1;32m  ✓ K8s dev environment stopped.\033[0m"
	@echo ""

## Infrastructure ─────────────────────────────────────

infra-up: ## Start LocalStack + kind cluster (no app deploy)
	@bash $(INFRA_SCRIPTS_DIR)/localstack-init.sh

infra-down: ## Tear down dev infrastructure
	@echo "==> Stopping kind cluster..."
	@kind delete cluster --name $(KIND_CLUSTER) 2>/dev/null || true
	@echo "==> Stopping LocalStack..."
	@docker stop localstack 2>/dev/null && docker rm localstack 2>/dev/null || true
	@docker compose down
	@echo "==> Dev infrastructure stopped."

infra-plan: ## Run terraform plan for dev env
	@bash $(INFRA_SCRIPTS_DIR)/tf-plan.sh dev

infra-apply: ## Run terraform apply for dev env
	@cd infra/terraform/envs/dev && terraform apply -auto-approve -input=false

## Helm Deployments ───────────────────────────────────

helm-deploy-dev: ## Deploy all services to kind (dev)
	@bash $(INFRA_SCRIPTS_DIR)/deploy.sh dev all

helm-deploy-staging: ## Deploy all services to staging
	@bash $(INFRA_SCRIPTS_DIR)/deploy.sh staging all

helm-deploy-prod: ## Deploy all services to prod
	@bash $(INFRA_SCRIPTS_DIR)/deploy.sh prod all
