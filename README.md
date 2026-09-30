# Full-stack Monorepo

Nx monorepo with a NestJS API backend and Next.js web frontend.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Nx 22, pnpm 11, mise |
| Backend | NestJS 11, Drizzle ORM, PostgreSQL 16, Passport JWT, Pino |
| Frontend | Next.js 16, React 19, TailwindCSS v4, NextAuth v5, next-intl |
| Testing | Jest + TestContainers (API), Vitest + Playwright (Web) |
| Linting | Biome |
| CI | GitHub Actions |

## Quick Install

One-liner for a fresh macOS or Linux machine. It asks for a project name and your git identity, installs mise (then Node LTS + pnpm via `mise install`), clones the template, renames it, creates `apps/api/.env` and `apps/web/.env` with generated secrets, re-initializes git with a single commit, and runs `pnpm install`:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/KingNNT/full-stack-monorepo/develop/install.sh)"
```

Optional overrides:

```bash
INSTALL_DIR=~/code/monorepo BRANCH=main USE_HTTPS=1 \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/KingNNT/full-stack-monorepo/develop/install.sh)"
```

Always inspect the script before running it:

```bash
curl -fsSL https://raw.githubusercontent.com/KingNNT/full-stack-monorepo/develop/install.sh | less
```

### Install with an AI agent

Paste this into Claude Code, Codex, Cursor, or any agent that can fetch URLs and
run shell commands, from the directory that should contain the project:

```
Install this project by following
https://raw.githubusercontent.com/KingNNT/full-stack-monorepo/develop/docs/AGENT_INSTALL.md
PROJECT_NAME=my-app, GIT_USER_NAME="John Doe", GIT_USER_EMAIL=john@example.com
```

Already cloned? Open the agent at the repo root and say:
`Set up this repo following AGENTS.md and docs/AGENT_INSTALL.md.`

The agent scaffolds the project, starts PostgreSQL + API, migrates, seeds, and
smoke-tests both apps before reporting success. Under the hood it runs
`install.sh` unattended — the script skips its prompts when all three values are
supplied as environment variables:

```bash
PROJECT_NAME=my-app \
GIT_USER_NAME="John Doe" \
GIT_USER_EMAIL=john@example.com \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/KingNNT/full-stack-monorepo/develop/install.sh)"
```

Agents should read [`AGENTS.md`](AGENTS.md) first; the full runbook — including
setup for an already-cloned repo — is in [`docs/AGENT_INSTALL.md`](docs/AGENT_INSTALL.md).

Docker is required for the pre-commit Gitleaks scan (the helper at `./tools/bin/gitleaks` falls back to `docker run` when no local `gitleaks` binary is on PATH); install it separately if you also plan to use `mise run local:docker:up` or integration tests.

## Prerequisites

- [mise](https://mise.jdx.dev) — runs `mise install` to get Node LTS + pnpm
- [gitleaks](https://github.com/gitleaks/gitleaks) — required for the pre-commit secret scan; the helper at `tools/bin/gitleaks` falls back to `docker run` when no local binary is on PATH
- Docker (for PostgreSQL, containerized builds, and the gitleaks helper fallback)

## Getting Started

```bash
# Install tools + dependencies
mise trust ./mise.toml && mise install
pnpm install

# Create each app's .env with generated secrets (skip any that already exist)
for app in api web; do
  f="apps/$app/.env"
  [ -f "$f" ] && continue
  cp "apps/$app/.env.example" "$f"
  for var in JWT_ACCESS_SECRET JWT_REFRESH_SECRET AUTH_SECRET; do
    sed -i.bak "s|^${var}=.*|${var}=$(openssl rand -base64 48 | tr -d '\n')|" "$f" && rm -f "$f.bak"
  done
done

# Start PostgreSQL + API + Web with hot reload (first run builds the images —
# several minutes). Runs in the foreground; Ctrl+C stops the containers.
mise run local:docker:up

# In a second terminal: run migrations, then seed RBAC data + default users
# (registers them through the API, so it must be up)
mise run local:db:migrate
mise run local:db:seed

# API health check (the path is versioned)
curl http://localhost:8000/v1/health

# Storybook
pnpm storybook:web   # Web component playground
```

## Project Structure

```
apps/
  api/              NestJS 11 backend (port 8000)
    src/
      modules/        Domain modules (DDD + CQRS)
        auth/           Authentication (JWT, Passport, bcrypt)
        user/           User aggregate (event sourcing)
        rbac/           Role-based access control
      shared/         Cross-cutting concerns
        domain/         Base classes (AggregateRoot, ValueObject, DomainEvent)
        infrastructure/ Database, event store, logging, CLS
        presentation/   Health check, exception filter
    drizzle/          Database migrations
    test/             Integration & E2E tests (TestContainers)

  web/              Next.js 16 frontend (port 3000)
    src/
      app/            App Router with [locale] and route groups
      apis/           HTTP client layer (Ky)
      components/     React components (shadcn/ui, feature-based)
      configs/        App configuration
      constants/      Shared constants
      enums/          Enum definitions
      exceptions/     Custom error classes
      i18n/           i18n setup (next-intl config)
      langs/          i18n translations (en, vi)
      libs/intl/      Intl polyfill & helpers
      libs/stores/    Zustand state management
      services/       Auth service, NextAuth config
      types/          Shared TypeScript types
      utils/          Utility functions
      proxy.ts        Locale detection + auth route protection
    tests/            Vitest integration tests & helpers
    e2e/              Playwright E2E tests

packages/           Shared libraries (reserved)
infra/              Terraform, Helm charts, CodeBuild specs (see docs/infrastructure.md)
mise/tasks/         mise task scripts per environment (local, dev, staging, prod)
```

## Commands

```bash
# Quality
pnpm build                # Build all
mise run lint             # Biome lint
mise run typecheck        # TypeScript check
mise run test             # Run unit tests

# Single app
pnpm nx run api:test
pnpm nx run web:test
pnpm nx run api:lint

# Storybook
pnpm storybook:web        # Start Storybook dev server (Web)

# Database
mise run local:db:generate      # Generate migrations from schema
mise run local:db:migrate       # Run migrations
mise run local:db:studio        # Open Drizzle Studio
mise run local:db:seed          # Seed RBAC data

# Docker
mise run local:docker:up        # Build and start all services, hot reload (alias: mise run dev)
mise run local:docker:up:api    # PostgreSQL + API only, hot reload
mise run local:docker:down      # Stop all
mise run local:docker:logs      # Tail logs
mise run local:docker:clean     # Remove volumes and images — deletes the database

# Full task list
mise tasks ls             # Show all available tasks
```

## Architecture

### API (DDD + CQRS + Event Sourcing)

Each domain module follows strict layering:

```
modules/{domain}/
  presentation/     Controllers, DTOs, guards
  application/      Commands, handlers, ports (interfaces)
  domain/           Aggregates, value objects, events
  infrastructure/   Repository implementations, adapters
```

- **Write path**: Command -> Aggregate -> Domain Events -> Event Store + Read Model projection
- **Read path**: Direct queries against read model tables
- **Concurrency**: Optimistic locking via event store version constraints
- **Audit**: All tables have createdBy/updatedBy/deletedBy (auto-injected from JWT via CLS)
- **Soft deletes**: All tables use deletedAt/deletedBy

### Web (App Router + i18n)

- Route groups: `(authenticated)` for protected routes, `(unauthenticated)` for public
- `src/proxy.ts` (Next.js 16's replacement for middleware) handles locale detection + auth route protection
- API client with retry, token injection, and structured error hierarchy
- Server components by default, `"use client"` only where needed

## Environment Variables

### API

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_ACCESS_SECRET` | Access token signing secret | - |
| `JWT_REFRESH_SECRET` | Refresh token signing secret | - |
| `JWT_ACCESS_EXPIRES_IN` | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL | `7d` |
| `API_PORT` | API port | `8000` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins | `http://localhost:3000` |
| `LOG_LEVEL` | Pino log level | `debug` (dev) / `info` (prod) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry collector (gRPC) | `http://localhost:4317` |

### Web

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_SECRET` | NextAuth secret | - |
| `API_BASE_URL` | API base URL (server-side, read at runtime) — required | - |
| `AUTH_URL` | Auth.js URL | inferred by Auth.js |
| `APP_URL` | Public site URL (metadata, sitemap) | `https://kingNNT.org` |
| `API_TIMEOUT` | API request timeout (ms) | `30000` |
| `API_MAX_RETRIES` | Retries for idempotent API requests | `3` |
| `API_RETRY_DELAY` | Initial retry delay (ms) | `1000` |
| `API_RETRY_BACKOFF` | Retry backoff multiplier | `2` |

### PostgreSQL (Docker Compose)

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_USER` | Database user | `postgres` |
| `POSTGRES_PASSWORD` | Database password | `password` |
| `POSTGRES_DB` | Database name | `fullstack_monorepo_dev` |

Defaults are what the code falls back to when a variable is unset; `apps/api/.env.example` and `apps/web/.env.example` set working local values for their app. The PostgreSQL variables have no env file — Docker Compose uses the defaults above unless you export them in your shell.

**Setup:** each app loads its own `.env` from its directory (Nest `ConfigModule`, Next.js, drizzle-kit and the seed script). Docker Compose passes `apps/<app>/.env` to each container. There is no root `.env`. Tests: `NODE_ENV=test` also loads `.env.test` in the same app directory. Web-only personal overrides can go in `apps/web/.env.local` (gitignored).

## Tooling

- **Linter/Formatter**: Biome (API: single quotes, 2 spaces, 80 chars / Web: double quotes, tabs, 100 chars)
- **Git hooks**: Husky pre-commit runs lint-staged (Biome) followed by the repository-wide Gitleaks scan (`./tools/bin/gitleaks detect --source . --redact`); commit-msg runs commitlint (conventional commits)
- **CI/CD** (git flow): CI runs `pnpm nx affected -t lint typecheck test build` on PRs and pushes to `develop`/`main`; `release/*` and `hotfix/*` deploy to staging, `v*` tags deploy to prod — see [`docs/infrastructure.md`](docs/infrastructure.md#cicd-pipeline)
- **AI agents**: shared instructions in [`AGENTS.md`](AGENTS.md), scoped ones in `apps/api/`, `apps/web/`, and `infra/`; `CLAUDE.md` files import them
