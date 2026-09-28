# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Antigravity, opencode,
Cursor, Copilot, …) working in this repository. This file is the single source
of truth; harness-specific files (`CLAUDE.md`, …) only import or extend it.

## What this is

An Nx monorepo: a NestJS 11 API (`apps/api`, port 8000) and a Next.js 16 web app
(`apps/web`, port 3000), sharing PostgreSQL 16 via Drizzle ORM. Toolchain
versions (Node LTS, pnpm), env vars, and task shortcuts are managed by
[mise](https://mise.jdx.dev) (`mise.toml`).

## Hard rules

1. **pnpm only.** Never run `npm`, `npx`, or `yarn`. Use `pnpm`, `pnpm exec`, `pnpm dlx`.
2. **Never modify, print, or commit an existing `.env`** — create it from `.env.example` only when it is absent.
3. **Never commit, push, or create branches** unless the user explicitly asks.
4. **Never run `mise run local:docker-clean`** — it destroys database volumes.

## Scoped instructions — read before editing

Each area has its own `AGENTS.md`. Before changing files under one of these
paths, read that file (and the detail docs it links) if your tool has not
already loaded it:

| Path | Instructions |
|---|---|
| `apps/api/` | [`apps/api/AGENTS.md`](apps/api/AGENTS.md) — DDD/CQRS, Jest, Drizzle |
| `apps/web/` | [`apps/web/AGENTS.md`](apps/web/AGENTS.md) — App Router, next-intl, Vitest/Playwright |
| `infra/`, `mise/tasks/{dev,staging,prod}/` | [`infra/AGENTS.md`](infra/AGENTS.md) — Terraform, Helm, monitoring |

## Installing

Follow [`docs/AGENT_INSTALL.md`](docs/AGENT_INSTALL.md) — it covers scaffolding
a new project from this template, setting up an existing clone, the smoke test,
and the checklist you must satisfy before reporting success.

## Common commands

```bash
pnpm dev                 # both apps in watch mode (dev:api / dev:web for one)
pnpm build | lint | typecheck | test     # all apps via Nx
pnpm nx run <api|web>:<target>           # single app, e.g. pnpm nx run api:test
pnpm nx affected -t lint typecheck test build   # what CI runs
```

Tasks are namespaced by environment: `local:*` (dev machine — apps, db,
docker), `dev:*` (kind/LocalStack cluster), `staging:*` and `prod:*` (helm
deploys). Task files live in `mise/tasks/<env>/` as executable bash scripts
with a `#MISE description="…"` header; `mise tasks ls` lists them.
Short aliases: `mise run dev | lint | test | typecheck`.

```bash
mise run local:docker-up-api     # postgres + api containers
mise run local:docker-up         # api + web + postgres
mise run local:docker-down       # stop all
mise run local:docker-logs       # tail logs
mise run local:db-generate       # migrations from schema changes
mise run local:db-migrate
mise run local:db-seed           # RBAC roles/permissions + default users (API must be up)
mise run local:db-studio
```

## Layout

- `apps/api` — NestJS 11 backend
- `apps/web` — Next.js 16 frontend
- `packages/` — shared libraries (empty, ready for extraction)
- `infra/` — Terraform, Helm charts, CodeBuild specs
- `mise/tasks/` — task scripts per environment
- `docs/` — install runbook, infrastructure, DB diagram, brand

## Tooling

- **Biome**, not ESLint/Prettier. Each app has its own `biome.json` with a
  different style — see the app's `AGENTS.md`.
- **Git hooks**: Husky pre-commit runs lint-staged (Biome check) then the
  repo-wide Gitleaks scan (`./tools/bin/gitleaks detect --source . --redact`);
  commit-msg runs commitlint.
- **Commits**: Conventional Commits (`feat(api): …`, `fix(web): …`).
- **CI/CD** (git flow): CI (`pnpm nx affected -t lint typecheck test build`)
  runs on PRs and pushes to `develop`/`main`; `release/*` and `hotfix/*`
  deploy to staging, `v*` tags deploy to prod. Details in
  [`docs/infrastructure.md`](docs/infrastructure.md#cicd-pipeline).

## Environment variables

mise loads the root `.env` (template: `.env.example`), shared by all apps. For
personal overrides create `mise.local.toml` with `_.file = ".env.local"`
(gitignored). Key variables:

- API: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `API_PORT`
- Web: `AUTH_SECRET`, `API_BASE_URL`, `AUTH_URL`
