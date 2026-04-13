.PHONY: lint test-unit test-integration test-e2e test-all typecheck

## App ────────────────────────────────────────────────

lint: ## Lint all apps
	pnpm nx run-many -t lint

test-unit: ## Run unit tests for all apps
	pnpm nx run-many -t test

test-integration: ## Run API integration tests (TestContainers + PostgreSQL)
	pnpm --filter @fullstack-monorepo-app/api test:integration

test-e2e: ## Run API and Web e2e tests
	pnpm --filter @fullstack-monorepo-app/api test:e2e
	pnpm --filter @fullstack-monorepo-app/web test:e2e

test-all: test-unit test-integration test-e2e ## Run all test layers (unit, integration, e2e)

typecheck: ## Typecheck all apps
	pnpm nx run-many -t typecheck
