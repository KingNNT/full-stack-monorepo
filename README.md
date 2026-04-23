# Full-stack Monorepo

Nx monorepo with a NestJS API backend and Next.js web frontend.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Nx 22, pnpm 10 |
| Backend | NestJS 11, Drizzle ORM, PostgreSQL 16, Passport JWT, Pino |
| Frontend | Next.js 16, React 19, TailwindCSS v4, NextAuth v5, next-intl |
| Testing | Jest + TestContainers (API), Vitest + Playwright (Web) |
| Linting | Biome |
| CI | GitHub Actions |

## Quick Install

One-liner for a fresh macOS or Linux machine (installs Node 22 + pnpm via nvm/corepack, clones the repo, copies `.env`, runs `pnpm install`):

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

Docker is optional; install it separately if you plan to use `make up` or integration tests.

## Prerequisites

- Node.js 22+
- pnpm 10.11+
- Docker (for PostgreSQL and containerized builds)

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Start PostgreSQL
make up-api    # starts postgres + api
# or just postgres:
docker compose up -d postgres

# Run database migrations
make db-migrate

# Seed RBAC data
make db-seed

# Start development
pnpm dev       # both apps
pnpm dev:api   # API only (port 8000)
pnpm dev:web   # Web only (port 3000)

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
pnpm dev              # Run both apps
pnpm dev:api          # API only
pnpm dev:web          # Web only

# Quality
pnpm build            # Build all
pnpm lint             # Biome lint
pnpm typecheck        # TypeScript check
pnpm test             # Run all tests

# Single app
pnpm nx run api:test
pnpm nx run web:test
pnpm nx run api:lint

# Storybook
pnpm storybook:web        # Start Storybook dev server (Web)

# Database
make db-generate      # Generate migrations from schema
make db-migrate       # Run migrations
make db-studio        # Open Drizzle Studio
make db-seed          # Seed RBAC data

# Docker
make up               # Build and start all services
make down             # Stop all
make logs             # Tail logs
make clean            # Remove volumes and images
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

## Tooling

- **Linter/Formatter**: Biome (API: single quotes, 2 spaces, 80 chars / Web: double quotes, tabs, 100 chars)
- **Git hooks**: Husky pre-commit (lint-staged + Biome), commit-msg (commitlint, conventional commits)
- **CI**: GitHub Actions runs `pnpm nx affected -t lint typecheck test build` on push to main and PRs
