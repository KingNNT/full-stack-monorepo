# AGENTS.md

Instructions for AI coding agents working in this repository.

## What this is

An Nx monorepo: a NestJS 11 API (`apps/api`, port 8000) and a Next.js 16 web app
(`apps/web`, port 3000), sharing PostgreSQL 16 via Drizzle ORM. Toolchain
versions and task shortcuts are managed by [mise](https://mise.jdx.dev).

## Hard rules

1. **pnpm only.** Never run `npm`, `npx`, or `yarn`. Use `pnpm`, `pnpm exec`, `pnpm dlx`.
2. **Never modify, print, or commit an existing `.env`** — create it from `.env.example` only when it is absent.
3. **Never commit, push, or create branches** unless the user explicitly asks.
4. **Never run `mise run local:docker-clean`** — it destroys database volumes.

## Installing

**New project from this template** — from the directory that should contain it:

```bash
PROJECT_NAME=my-app \
GIT_USER_NAME="John Doe" \
GIT_USER_EMAIL=john@example.com \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/KingNNT/full-stack-monorepo/develop/install.sh)"
```

Ask the user for those three values; do not invent them. Use `bash -c "$(curl ...)"`,
not `curl ... | bash` — a pipe occupies stdin.

**Existing clone** — from the repo root:

```bash
mise trust ./mise.toml && mise install
eval "$(mise activate bash --shims)"     # node/pnpm are not on PATH without this
pnpm install
[ -f .env ] || cp .env.example .env      # then fill JWT_*/AUTH_SECRET with `openssl rand -base64 48`
mise run local:docker-up-api             # first run builds the API image — several minutes
mise run local:db-migrate
mise run local:db-seed                   # registers users through the API, so it must be up
```

Then verify the stack actually runs. The api container from `local:docker-up-api`
already holds port 8000, so do **not** start `mise run dev` — check that API, and
background only the web dev server:

```bash
# bash only — `set -m` and `kill -- -PID` are bash job control
curl -fsS http://localhost:8000/v1/health | grep -q '"status":"ok"' && echo "API OK"
set -m; pnpm dev:web > /tmp/dev-web.log 2>&1 & WEB_PID=$!; set +m
for i in $(seq 1 30); do curl -sI http://localhost:3000 >/dev/null 2>&1 && break; sleep 2; done
curl -sI http://localhost:3000 | head -1              # expect 307, or any 2xx/3xx
kill -- "-$WEB_PID" 2>/dev/null || kill "$WEB_PID"   # kill the group, not just the wrapper
sleep 3
lsof -i :3000 -sTCP:LISTEN >/dev/null 2>&1 && echo "port 3000 STILL HELD" || echo "port 3000 free"
```

The health path is `/v1/health`, not `/health` (URI versioning applies), and the
body is wrapped: `{"status_code":200,"success":true,"message":"OK","data":{"status":"ok"}}`.

Full runbook — per-step verification, troubleshooting, and the completion
checklist you must satisfy before reporting success: **[`docs/AGENT_INSTALL.md`](docs/AGENT_INSTALL.md)**.

## Writing code here

Architecture, module layout, testing commands, and conventions live in
[`CLAUDE.md`](CLAUDE.md). Read it before changing any code.
