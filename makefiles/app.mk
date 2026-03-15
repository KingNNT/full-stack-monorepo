.PHONY: lint test typecheck

## App ────────────────────────────────────────────────

lint: ## Lint all apps
	pnpm nx run-many -t lint

test: ## Test all apps
	pnpm nx run-many -t test

typecheck: ## Typecheck all apps
	pnpm nx run-many -t typecheck
