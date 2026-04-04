# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack Monorepo — Nx monorepo with a NestJS API backend and Next.js web frontend. Package manager is **pnpm** (v10.11+). Node 22+.

**IMPORTANT: This project uses pnpm exclusively. Never use npm, npx, or yarn. Use `pnpm` / `pnpm exec` / `pnpm dlx` instead.**

## Common Commands

```bash
# Development
pnpm dev              # Run both apps in watch mode
pnpm dev:api          # API only (port 8000)
pnpm dev:web          # Web only (port 3000)

# Build / Lint / Test (all apps via Nx)
pnpm build
pnpm lint             # Biome
pnpm typecheck
pnpm test

# Run for a single app
pnpm nx run api:test
pnpm nx run web:test
pnpm nx run api:lint
pnpm nx run web:lint

# Storybook
pnpm storybook:web        # Start Storybook dev server (Web)

# Run affected only (CI does this)
pnpm nx affected -t lint typecheck test build

# API-specific tests
cd apps/api
pnpm test                  # Unit tests (Jest)
pnpm test:integration      # Integration tests (TestContainers + PostgreSQL)
pnpm test:e2e              # E2E tests

# Web-specific tests
cd apps/web
pnpm test                  # Unit + integration (Vitest)
pnpm test:e2e              # Playwright

# Database (Drizzle ORM)
make db-generate           # Generate migrations from schema changes
make db-migrate            # Run migrations
make db-studio             # Open Drizzle Studio
make db-seed               # Seed RBAC data (roles, permissions)

# Docker
make up                    # Build and start all services (API + Web + PostgreSQL)
make down                  # Stop all
make up-api / make up-web  # Start individual service + postgres
make logs                  # Tail all logs
make logs-api / make logs-web  # Tail individual service logs
make clean                 # Stop containers, remove volumes and images
```

## Architecture

### Monorepo Structure

- `apps/api` — NestJS 11 backend (port 8000)
- `apps/web` — Next.js 16 frontend (port 3000)
- `packages/` — Shared libraries (empty, ready for extraction)

### API (`apps/api`) — DDD + CQRS

Follows Domain-Driven Design with CQRS + Event Sourcing:

```
src/modules/<domain>/
  ├── application/       # Commands, queries, handlers (@nestjs/cqrs)
  ├── domain/            # Aggregates, value objects, domain events
  ├── infrastructure/    # Repository implementations, services
  └── presentation/      # Controllers, DTOs
src/shared/
  ├── domain/            # Base classes: AggregateRoot, ValueObject, DomainEvent
  ├── application/       # UnitOfWork interface
  ├── infrastructure/    # Database (Drizzle), Logger (Pino), CLS, Event Store
  └── events/            # Integration events
```

**Domain modules**: `auth` (JWT authentication), `user` (user aggregate), `rbac` (role-based access control).

**Patterns**:
- **Write path**: Command → Aggregate → Domain Events → Event Store + Read Model projection
- **Read path**: Direct queries against read model tables
- **Concurrency**: Optimistic locking via event store version constraints
- **Audit**: All tables have createdBy/updatedBy/deletedBy (auto-injected from JWT via nestjs-cls)
- **Soft deletes**: All tables use deletedAt/deletedBy

Key tech: Drizzle ORM + PostgreSQL, Passport JWT auth, nestjs-cls for request context, Pino logging, Swagger/OpenAPI.

Database schema lives in `apps/api/src/shared/infrastructure/database/schema/`. Migrations in `apps/api/drizzle/migrations/`.

### Web (`apps/web`) — App Router + i18n

```
src/
  ├── app/[locale]/              # Next.js App Router with next-intl
  │   ├── (unauthenticated)/     # Public routes (home, login, register)
  │   └── (authenticated)/       # Protected routes (dashboard)
  ├── apis/                      # API client layer (Ky HTTP client)
  ├── components/                # React components (shadcn/ui pattern)
  ├── configs/                   # App configuration
  ├── constants/                 # Shared constants
  ├── enums/                     # Enum definitions
  ├── exceptions/                # Custom error classes
  ├── i18n/                      # i18n setup (next-intl config)
  ├── langs/                     # Translation files (en, vi)
  ├── libs/intl/                 # Intl polyfill & helpers
  ├── libs/stores/               # Zustand state management
  ├── services/                  # Auth service, NextAuth config
  ├── types/                     # Shared TypeScript types
  └── utils/                     # Utility functions
```

Key tech: React 19, TailwindCSS v4, NextAuth (beta), Radix UI + shadcn/ui, Zod validation, React Hook Form, Storybook.

## Tooling

- **Linter/Formatter**: Biome (not ESLint/Prettier). API uses single quotes + 80 char width; Web uses double quotes + tabs + 100 char width. Each app has its own `biome.json`.
- **Git hooks**: Husky pre-commit runs lint-staged (Biome check), commit-msg runs commitlint (conventional commits).
- **CI**: GitHub Actions runs `pnpm nx affected -t lint typecheck test build` on push to main and PRs.
- **Testing**: API uses Jest + TestContainers; Web uses Vitest (unit/integration) + Playwright (e2e).

## Environment Variables

Each app has a `.env.example` file. Key variables:
- API: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PORT`
- Web: `AUTH_SECRET`, `NEXT_PUBLIC_API_BASE_URL`, `NEXTAUTH_URL`
