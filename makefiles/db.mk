.PHONY: db-migrate db-generate db-studio db-seed

## Database ───────────────────────────────────────────

db-migrate: ## Run database migrations
	pnpm nx run @fullstack-monorepo-app/api:db-migrate

db-generate: ## Generate database migrations
	pnpm nx run @fullstack-monorepo-app/api:db-generate

db-studio: ## Open Drizzle Studio
	pnpm nx run @fullstack-monorepo-app/api:db-studio

db-seed: ## Seed RBAC data
	pnpm nx run @fullstack-monorepo-app/api:db:seed
