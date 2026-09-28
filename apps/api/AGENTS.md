# apps/api — NestJS 11 API

Extends the root [`AGENTS.md`](../../AGENTS.md); its hard rules apply here.

## Detail docs — read the matching one before writing code

| When you are… | Read |
|---|---|
| Writing or changing any `.ts` (naming, DI, commands, aggregates, controllers, response format, Drizzle) | [`docs/agents/code-styles.md`](docs/agents/code-styles.md) |
| Touching auth, validation, errors, audit fields, soft deletes, secrets | [`docs/agents/security.md`](docs/agents/security.md) |
| Writing or fixing tests | [`docs/agents/testing.md`](docs/agents/testing.md) |

## Commands

Run from `apps/api` (or `pnpm nx run api:<target>` from the root):

```bash
pnpm test                  # unit (Jest, co-located *.spec.ts)
pnpm test:integration      # TestContainers + PostgreSQL — needs Docker
pnpm test:e2e
pnpm dev:api               # from root; port 8000 — conflicts with the api container
```

Health check: `GET /v1/health` (URI-versioned; `/health` is a 404).

## Architecture — DDD + CQRS + Event Sourcing

```
src/modules/<domain>/        # auth (JWT), user (user aggregate), rbac
  ├── application/           # commands, queries, handlers (@nestjs/cqrs)
  ├── domain/                # aggregates, value objects, domain events, ports
  ├── infrastructure/        # repository implementations, adapters
  └── presentation/          # controllers, DTOs, guards
src/shared/
  ├── domain/                # AggregateRoot, ValueObject, DomainEvent
  ├── application/           # UnitOfWork interface
  ├── infrastructure/        # Drizzle, Pino logger, CLS, event store
  ├── presentation/          # health check, global exception filter
  └── events/                # integration events
```

- **Write path**: Command → Aggregate → Domain Events → Event Store + read-model projection
- **Read path**: direct queries against read-model tables
- **Concurrency**: optimistic locking via event-store version constraints
- **Audit**: every table has `createdBy`/`updatedBy`/`deletedBy`, auto-injected from the JWT via nestjs-cls
- **Soft deletes**: every table uses `deletedAt`/`deletedBy`

Do not flatten or merge layers; never import infrastructure from application or domain.

## Database

- Schema: `src/shared/infrastructure/database/schema/`
- Migrations: `drizzle/migrations/` — generate with `mise run local:db-generate`

## Observability

`src/instrumentation.ts` sets up OpenTelemetry auto-instrumentation (HTTP,
NestJS, PostgreSQL) and pushes traces and metrics over OTLP/gRPC to the
collector — there is no `/metrics` scrape endpoint. Custom metrics go through
the injectable `MetricsService` (`src/shared/infrastructure/metrics/`).

## Style

Biome (`apps/api/biome.json`): single quotes, 2-space indent, 80-char lines,
`import type` for type-only imports.
