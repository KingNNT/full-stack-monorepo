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

One-liner for a fresh macOS or Linux machine (installs mise, then Node LTS + pnpm via `mise install`, clones the repo, copies `.env`, runs `pnpm install`):

```bash
curl -fsSL https://raw.githubusercontent.com/KingNNT/nestjs-nextjs-monorepo/develop/install.sh | bash
```

Optional overrides:

```bash
INSTALL_DIR=~/code/monorepo BRANCH=main USE_HTTPS=1 \
  curl -fsSL https://raw.githubusercontent.com/KingNNT/nestjs-nextjs-monorepo/develop/install.sh | bash
```

Always inspect the script before piping to bash:

```bash
curl -fsSL https://raw.githubusercontent.com/KingNNT/nestjs-nextjs-monorepo/develop/install.sh | less
```

Docker is required for the pre-commit Gitleaks scan (the helper at `./tools/bin/gitleaks` falls back to `docker run` when no local `gitleaks` binary is on PATH); install it separately if you also plan to use `mise run local:docker-up` or integration tests.

## Prerequisites

- [mise](https://mise.jdx.dev) — runs `mise install` to get Node LTS + pnpm
- [gitleaks](https://github.com/gitleaks/gitleaks) — required for the pre-commit secret scan; the root helper falls back to `docker run` when no local binary is on PATH
- Docker (for PostgreSQL, containerized builds, and the gitleaks helper fallback)

## Getting Started

```bash
# Install tools + dependencies
mise install
pnpm install

# Copy env file
cp .env.example .env

# Start PostgreSQL
mise run local:docker-up-api    # starts postgres + api
# or just postgres:
docker compose up -d postgres

# Run database migrations
mise run local:db-migrate

# Seed RBAC data
mise run local:db-seed

# Start development
mise run dev       # both apps
pnpm dev:api       # API only (port 8000)
pnpm dev:web       # Web only (port 3000)

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
    e2e/              Playwright E2E tests

packages/           Shared libraries (reserved)
```

## Commands

```bash
# Development
mise run dev              # Run both apps
pnpm dev:api              # API only
pnpm dev:web              # Web only

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
mise run local:db-generate      # Generate migrations from schema
mise run local:db-migrate       # Run migrations
mise run local:db-studio        # Open Drizzle Studio
mise run local:db-seed          # Seed RBAC data

# Docker
mise run local:docker-up        # Build and start all services
mise run local:docker-down      # Stop all
mise run local:docker-logs      # Tail logs
mise run local:docker-clean     # Remove volumes and images

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
- Middleware handles locale detection + auth route protection
- API client with retry, token injection, and structured error hierarchy
- Server components by default, `"use client"` only where needed

## Environment Variables

### API (`apps/api/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_ACCESS_SECRET` | Access token signing secret | - |
| `JWT_REFRESH_SECRET` | Refresh token signing secret | - |
| `JWT_ACCESS_EXPIRES_IN` | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL | `7d` |
| `PORT` | API port | `8000` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins | `http://localhost:3000` |

### Web (`apps/web/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_SECRET` | NextAuth secret | - |
| `NEXT_PUBLIC_API_BASE_URL` | API base URL | `http://localhost:8000` |
| `NEXTAUTH_URL` | NextAuth URL | `http://localhost:3000` |

**Setup:** `mise.toml` loads `.env` automatically. For personal overrides, create `.env.local` and add `_.file = ".env.local"` to `mise.local.toml` (both gitignored).

## Tooling

- **Linter/Formatter**: Biome (API: single quotes, 2 spaces, 80 chars / Web: double quotes, tabs, 100 chars)
- **Git hooks**: Husky pre-commit runs lint-staged (Biome) followed by the repository-wide Gitleaks scan (`./tools/bin/gitleaks detect --source . --redact`); commit-msg runs commitlint (conventional commits)
- **CI**: GitHub Actions runs `pnpm nx affected -t lint typecheck test build` on push to main and PRs
