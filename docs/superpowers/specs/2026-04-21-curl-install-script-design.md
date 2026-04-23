# Curl Install Script Design

## Overview

A single `install.sh` at the repo root that bootstraps a developer machine for the `nestjs-nextjs-monorepo` project in one command:

```
curl -fsSL https://raw.githubusercontent.com/KingNNT/nestjs-nextjs-monorepo/develop/install.sh | bash
```

It checks and installs prerequisites, clones the repo, copies env files, installs dependencies, and prints next steps.

## Decisions

- **Scope**: Full bootstrap (prerequisites + clone + env + install).
- **Supported OSes**: macOS and Linux. Windows users use WSL.
- **Prerequisite strategy**: Install Node/pnpm automatically via `nvm` and `corepack` (per-user, reversible). Docker is detect-only — installing Docker headlessly is too OS-specific and invasive.
- **Config via env vars**, not flags (curl-piped scripts cannot take flags reliably):
  - `INSTALL_DIR` — default `$HOME/nestjs-nextjs-monorepo`
  - `BRANCH` — default `develop`
  - `USE_HTTPS=1` — skip SSH attempt, clone via HTTPS
- **Idempotency**: Safe to re-run when the target dir does not yet exist. If it exists, abort with a clear message (do not overwrite).
- **Style**: Matches existing `infra/helm/monitoring/install.sh` — `#!/usr/bin/env bash`, `set -euo pipefail`, `==>` progress markers.

## Flow

```
  curl | bash
       |
       v
  [1] Preflight: detect OS, parse env vars, banner
       |
       v
  [2] Prerequisites:
       - git         (required; abort if missing)
       - Node 22     (install via nvm if missing/wrong version)
       - pnpm        (corepack enable && corepack prepare pnpm@latest --activate)
       - Docker      (detect only; print install URL if missing, continue)
       |
       v
  [3] Clone repo to $INSTALL_DIR
       - Abort if dir exists
       - Try SSH, fall back to HTTPS on failure
       - Checkout $BRANCH
       |
       v
  [4] Copy env file:
       - .env.example -> .env (if not exists)
       |
       v
  [5] pnpm install (in $INSTALL_DIR)
       |
       v
  [6] Print next steps:
       - cd $INSTALL_DIR
       - make up          (Docker stack)
       - make db-migrate  (run migrations)
       - pnpm dev         (local dev)
```

## Script Structure

All logic lives in one file: `install.sh` at repo root.

Internal functions:

- `log(msg)` — echo `==> msg`
- `warn(msg)` — echo `!!  msg` to stderr
- `die(msg)` — echo to stderr, exit 1
- `has(cmd)` — `command -v "$cmd" >/dev/null 2>&1`
- `detect_os` — sets `OS=macos|linux`, dies on anything else
- `ensure_git` — require git; print install hint and die if missing
- `ensure_node` — check Node >= 22; install nvm if missing, then `nvm install 22 && nvm use 22`
- `ensure_pnpm` — `corepack enable && corepack prepare pnpm@latest --activate`
- `check_docker` — warn and continue if missing
- `clone_repo` — clone SSH, fall back to HTTPS; checkout `$BRANCH`
- `setup_env_file` — copy root `.env.example` → `.env` only if target does not exist
- `install_deps` — `pnpm install`
- `print_next_steps` — multi-line echo with commands

Execution is a linear `main` function that calls each step.

## Error Handling

- `set -euo pipefail` at top — any unhandled failure aborts the script.
- Each step prints its own `==>` banner before running so failures are attributable.
- Git clone has an explicit SSH → HTTPS fallback (SSH often fails on fresh machines without keys).
- `ensure_node` only reinstalls if the current Node is absent or `< 22`; it does not downgrade higher versions.
- Env file copy skips when target exists — never overwrite a user's `.env`.
- `pnpm install` failure aborts with `set -e` — user sees pnpm's own error output.

## Repo Constants

Hardcoded in the script:

- `REPO_SSH="git@github.com:KingNNT/nestjs-nextjs-monorepo.git"`
- `REPO_HTTPS="https://github.com/KingNNT/nestjs-nextjs-monorepo.git"`
- `NODE_MAJOR=22`
- `NVM_VERSION` — pinned to a specific nvm release tag (picked at implementation time from https://github.com/nvm-sh/nvm/releases); bumped deliberately in future updates.

## Testing

Manual only. No automated tests for this script.

Verification matrix (run before merging):

- [ ] macOS, fresh shell, no Node/pnpm installed → full install works
- [ ] macOS, Node 22 + pnpm already present → skips install steps
- [ ] Linux (Ubuntu 22.04 container) → full install works
- [ ] Target dir already exists → aborts cleanly with message
- [ ] SSH key missing → falls back to HTTPS clone
- [ ] `BRANCH=main INSTALL_DIR=/tmp/foo bash install.sh` → respects overrides
- [ ] Re-run after success in fresh dir → succeeds

## Out of Scope (YAGNI)

- Uninstall / teardown script
- Windows native support (use WSL)
- Auto-installing Docker, PostgreSQL, or any system-level service
- Running DB migrations or seeds
- Starting dev servers or Docker Compose
- Prompting for configuration values (keep non-interactive so `curl | bash` works)
- Telemetry or install analytics

## Security Notes

- Script never writes to `.env` if one exists — respects pre-existing secrets.
- No credentials collected or transmitted.
- User must still inspect the URL before piping to bash; that is a standard curl-install caveat and documented in the README alongside the install command.
