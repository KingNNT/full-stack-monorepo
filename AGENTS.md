# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Antigravity, opencode,
Cursor, Copilot, …) working in this repository. This file is the single source
of truth; harness-specific files (`CLAUDE.md`, …) only import or extend it.

## What this is

An Nx monorepo: a NestJS 11 API (`apps/api`, port 8000) and a Next.js 16 web app
(`apps/web`, port 3000), sharing PostgreSQL 16 via Drizzle ORM. Toolchain
versions (Node LTS, pnpm) and task shortcuts are managed by
[mise](https://mise.jdx.dev) (`mise.toml`); env vars live per app.

## Hard rules

1. **pnpm only.** Never run `npm`, `npx`, or `yarn`. Use `pnpm`, `pnpm exec`, `pnpm dlx`.
2. **Never modify, print, or commit an existing `.env`** (`apps/<app>/.env*`) — create it from that app's `.env.example` only when it is absent.
3. **Never commit, push, or create branches** unless the user explicitly asks. When asked, use the `mise run flow:*` tasks (see *Git flow* below).
4. **Never run `mise run local:docker:clean`** — it destroys database volumes.

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
pnpm build | lint | typecheck | test     # all apps via Nx
pnpm nx run <api|web>:<target>           # single app, e.g. pnpm nx run api:test
pnpm nx affected -t lint typecheck test build   # what CI runs
```

Tasks are namespaced by environment: `local:*` (dev machine — apps, db,
docker), `dev:*` (kind/LocalStack cluster), `staging:*` and `prod:*` (helm
deploys), plus `github:setup` (one-time git flow rulesets for a project's
GitHub repo). Task files live in `mise/tasks/<env>/` as executable bash scripts
with a `#MISE description="…"` header; `mise tasks ls` lists them. Each
directory level is a `:` segment (`mise/tasks/local/db/migrate` →
`local:db:migrate`); a `_default` file names the directory itself
(`local/test/_default` → `local:test`).
Short aliases: `mise run lint | test | typecheck`.

**Git flow.** The `flow:*` tasks wrap branches, PRs and releases with the same
checks CI runs; those that push, merge or start a workflow take `--dry-run`.
Agents follow the `git-flow` skill (`.agents/skills/git-flow/SKILL.md`); the
flow itself is in [`docs/infrastructure.md`](docs/infrastructure.md#git-flow).

```bash
mise run flow:status                 # open releases, PRs, runs, next version
mise run flow:start feature <name>   # branch off the right base
mise run flow:pr                     # push + PR into that base
mise run flow:release [hotfix]       # Start release workflow → staging
mise run flow:finish                 # merge release PR → tag → prod
mise run flow:back-merge             # merge the back-merge PRs
```

The apps run only in Docker — there is no host `pnpm dev`. `local:db:*` tasks
run inside the `api` container; Mailpit SMTP is reachable only on the compose
network. Published ports (loopback only; `mise.toml` sets them, `false` in
`mise.local.toml` leaves one unpublished — see `mise.local.toml.example`): web 3000
(`HOST_MACHINE_WEB_PORT`), api 8000 (`HOST_MACHINE_API_PORT`), Postgres 5432
for GUI clients (`HOST_MACHINE_POSTGRES_PORT`), Mailpit UI 8025
(`HOST_MACHINE_MAILPIT_PORT`), Drizzle Studio 4983
(`HOST_MACHINE_DRIZZLE_STUDIO_PORT`). Tests, lint, typecheck and
git hooks still run on the host.

```bash
mise run local:docker:up         # postgres + api + web + mailpit (watch mode)
mise run local:docker:down       # stop all
mise run local:docker:logs       # tail logs
mise run local:db:generate       # migrations from schema changes
mise run local:db:migrate
mise run local:db:seed           # RBAC roles/permissions + default users (API must be up)
mise run local:db:studio         # https://local.drizzle.studio (port 4983)
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
  and PR checks (branch names, merge targets, PR title) run on PRs; `feature/*`
  and `bugfix/*` merge into `develop`; the **Start release** workflow cuts
  `release/X.Y.Z` (or `hotfix/X.Y.Z`), which deploys to staging; merging it
  into `main` tags `vX.Y.Z`, deploys to prod and opens the back-merge PR. One
  version for the repo. Details in
  [`docs/infrastructure.md`](docs/infrastructure.md#cicd-pipeline).

## Environment variables

Each app owns its env: `apps/api/.env` and `apps/web/.env` (templates:
`.env.example` next to them). There is no root `.env` — add a new variable to
the template of the app that reads it. `NODE_ENV=test` also loads `.env.test`
from the same directory; Docker Compose passes each app's `.env` to its
container. Key variables:

- API: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `API_PORT`
- Web: `AUTH_SECRET`, `API_BASE_URL`, `AUTH_URL`

**Infisical (optional).** When `.infisical.json` exists at the repo root,
the `<env>:env:*` tasks sync env vars with the Infisical environment of the
same name, for `<env>` in `local`, `rpi`, `dev`, `staging`, `prod`.
`mise run <env>:env:push [--dry-run]` pushes `apps/<app>/.env.<env>`
(git-ignored) to Infisical under `/apps/<app>` and refuses any other
`.env.<suffix>` besides `.env.example`/`.env.test`; keys marked `# @shared` on their
`.env.example` line are stored once in `/shared` and referenced from the apps
(`${<env>.shared.KEY}`). `mise run <env>:env:pull [--dry-run]` always writes
`apps/<app>/.env`, references resolved — the apps only load `.env`.
`mise run <env>:env:check [--remote]` compares each `.env.example` with
`.env.<env>` or Infisical. The tasks authenticate from environment variables
first — exported in the shell or set under `[env]` in the git-ignored
`mise.local.toml`: `INFISICAL_TOKEN`, or a universal-auth machine identity
(`INFISICAL_UNIVERSAL_AUTH_CLIENT_ID` + `INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET`).
Without them they use the host `infisical login` session, and fail when there
is none. `INFISICAL_PROJECT_ID` overrides the `workspaceId` of
`.infisical.json`; `INFISICAL_DOMAIN` points at a self-hosted or EU instance.
Agents follow the `env-push`,
`env-pull` and `env-check` skills (`.agents/skills/`). Without
`.infisical.json` these tasks do nothing.
