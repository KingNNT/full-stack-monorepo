.PHONY: up up-web up-api down build logs logs-web logs-api clean

## Docker ─────────────────────────────────────────────

up: ## Build & start all containers
	docker compose up --build -d

up-web: ## Build & start web + postgres
	docker compose up --build -d postgres web

up-api: ## Build & start api + postgres
	docker compose up --build -d postgres api

down: ## Stop all containers
	docker compose down

build: ## Build all images (no cache)
	docker compose build --no-cache

logs: ## Tail all container logs
	docker compose logs -f

logs-web: ## Tail web container logs
	docker compose logs -f web

logs-api: ## Tail api container logs
	docker compose logs -f api

clean: ## Stop containers, remove volumes and images
	docker compose down -v --rmi local
