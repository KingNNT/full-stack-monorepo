# Agent Install Runbook

Instructions for an AI coding agent (Claude Code, Codex, Cursor, opencode,
Gemini CLI, Copilot) installing this project without a human answering prompts.

Platforms: macOS, Linux, WSL. Windows-native is not supported.

Every snippet below assumes **bash**. `set -m` and `kill -- -PID` in §C are
bash job-control syntax; run them under `bash`, not zsh or sh.

## 0. Pick your branch

Inspect the current working directory:

| Condition | Go to |
|---|---|
| Directory is empty or does not exist | [§A Scaffold a new project](#a-scaffold-a-new-project) |
| Directory contains `pnpm-workspace.yaml` and `.git` | [§B Set up an existing clone](#b-set-up-an-existing-clone) |
| Anything else | Stop. Ask the user what they want. |

## A. Scaffold a new project

> §A applies to the **template repo** (`KingNNT/full-stack-monorepo`). It ships
> unchanged into generated projects, where it no longer applies — a generated
> project only ever needs §B.

You need three values. If the user has not supplied them, **ask** — do not invent
a project name or a git identity:

| Variable | Format | Example |
|---|---|---|
| `PROJECT_NAME` | kebab-case, must match `^[a-z][a-z0-9-]*$` | `my-saas-app` |
| `GIT_USER_NAME` | non-empty | `John Doe` |
| `GIT_USER_EMAIL` | non-empty | `john@example.com` |

Run from the directory that should *contain* the new project:

```bash
PROJECT_NAME=my-saas-app \
GIT_USER_NAME="John Doe" \
GIT_USER_EMAIL=john@example.com \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/KingNNT/full-stack-monorepo/develop/install.sh)"
```

Use `bash -c "$(curl ...)"`, not `curl ... | bash`. A pipe occupies stdin, which
the script's interactive fallback needs.

What the script does, in order — know this before you run it:

1. Verifies `git`, installs `mise` if missing, warns if Docker is absent.
2. Clones `develop` into `./<PROJECT_NAME>`. **Fails if that directory exists.**
3. Rewrites `fullstack-monorepo` → `<PROJECT_NAME>` across all tracked files.
4. Copies `.env.example` → `.env` and generates `JWT_ACCESS_SECRET`,
   `JWT_REFRESH_SECRET`, `AUTH_SECRET`.
5. Trusts the cloned `mise.toml` and runs `mise install`.
6. **Deletes `install.sh`.**
7. **Deletes `.git` and re-initializes it** with one commit. The template's
   history is gone; the origin remote is gone.
8. Runs `pnpm install`.

Verify:

```bash
cd my-saas-app
grep -m1 '"name"' package.json     # expect the new project name
grep -c '^JWT_ACCESS_SECRET=.\+' .env   # expect 1
```

The script put the mise shims on `PATH` inside its own process, not in yours —
do that in your shell too before continuing:

```bash
eval "$(mise activate bash --shims)"
```

Then continue with §B step 4 onward (Docker, migrations, seed, smoke test).
§B steps 1-3 are already done by the script.

## B. Set up an existing clone

Run every command from the repo root.

### Step 1 — Install toolchain

`mise` refuses to parse an untrusted config and hard-errors instead of prompting
when there is no TTY, so trust the config first. The tools it installs resolve
only through the shims directory in a shell that never sourced `mise activate`,
so put that on `PATH` before using `node` or `pnpm`:

```bash
mise trust ./mise.toml && mise install
eval "$(mise activate bash --shims)"
```

Verify:

```bash
node --version    # expect v22 or newer
pnpm --version    # expect 11.x
```

If `mise: command not found`, or `node`/`pnpm` are still not found after a
successful `mise install`, see [§D](#d-troubleshooting).

### Step 2 — Install dependencies

```bash
pnpm install
```

Never use `npm`, `npx`, or `yarn` — this repo is pnpm-only.

Verify: `node_modules/` exists at the repo root and the command exited 0.

### Step 3 — Environment file

Check first:

```bash
test -f .env && echo "EXISTS" || echo "MISSING"
```

**If `EXISTS`: leave it as-is and continue to step 4.** Do not read its
contents, modify it, or overwrite it. Note in your final report that `.env` was
pre-existing and left untouched.

If `MISSING`:

```bash
cp .env.example .env
for var in JWT_ACCESS_SECRET JWT_REFRESH_SECRET AUTH_SECRET; do
  secret="$(openssl rand -base64 48 | tr -d '\n')"
  sed -i.bak "s|^${var}=.*|${var}=${secret}|" .env
  rm -f .env.bak
done
```

Verify: `grep -c '^JWT_ACCESS_SECRET=.\+' .env` prints `1`.

### Step 4 — Start PostgreSQL and the API container

```bash
mise run local:docker-up-api
```

This runs `docker compose up --build -d postgres api`. **The first run builds
the API image and takes several minutes** — allow at least 10 minutes and do not
treat a long-running command as a failure. Later runs reuse the cached layers.

The api container publishes host port 8000. Step 6 and §C both depend on it, so
leave it running, and do **not** start `mise run dev` while it is up — the nx api
target binds the same port and fails with `EADDRINUSE`.

Verify:

```bash
docker compose ps
```

Expect `postgres` healthy and `api` up before continuing. If Docker is
unavailable, see [§D](#d-troubleshooting).

### Step 5 — Run migrations

```bash
mise run local:db-migrate
```

Verify: exit code 0.

### Step 6 — Seed RBAC data

```bash
mise run local:db-seed
```

Verify: exit code 0. This creates the baseline roles and permissions, and
registers the default users by POSTing to
`${API_BASE_URL:-http://localhost:8000}/api/v1/auth/register` — so **the API
from step 4 must be running**, or this step fails partway through.

## C. Smoke test

The API is already running from step 4 (the container on port 8000). **Do not
run `mise run dev` here** — it would start a second API on the same port. Check
the running API, then start only the web dev server.

### API

```bash
curl -fsS http://localhost:8000/v1/health | grep -q '"status":"ok"' \
  && echo "API OK" || echo "API FAILED"
```

Two things about that URL and that check:

- **The path is `/v1/health`.** `/health` is excluded from the `/api` global
  prefix but *not* from URI versioning, so the mapped route is `/v1/health`.
  `/health`, `/api/health`, and `/api/v1/health` all return 404.
- **The body is not `{"status":"ok"}`.** A global `TransformInterceptor` wraps
  every non-204 response, so the full body is:

  ```json
  {"status_code":200,"success":true,"message":"OK","data":{"status":"ok"}}
  ```

  Grep for `"status":"ok"` rather than comparing the whole body.

### Web

The dev server runs until killed. **Start it in the background** — a foreground
run blocks your session indefinitely. `set -m` puts the job in its own process
group so the whole node tree can be killed later.

```bash
set -m
pnpm dev:web > /tmp/dev-web.log 2>&1 &
WEB_PID=$!
set +m
```

Poll until it answers (up to ~60s):

```bash
for i in $(seq 1 30); do
  curl -sI http://localhost:3000 >/dev/null 2>&1 && break
  sleep 2
done

curl -sI http://localhost:3000 | head -1   # expect HTTP/1.1 307 (locale redirect), or any 2xx/3xx
```

Stop it, then confirm the port actually stopped answering — `kill $WEB_PID`
alone signals the wrapper and can leave node children holding port 3000 while
you report success:

```bash
kill -- "-$WEB_PID" 2>/dev/null || kill "$WEB_PID"
sleep 3
lsof -i :3000 -sTCP:LISTEN >/dev/null 2>&1 \
  && echo "port 3000 STILL HELD" || echo "port 3000 free"
```

Run the start, check, and stop in **one shell session** — `WEB_PID` does not
survive across separate shell invocations.

If either app never answers, read `/tmp/dev-web.log` and
`mise run local:docker-logs` before reporting failure.

**Do not report success until every box is checked:**

- [ ] `mise trust` + `mise install` succeeded, `node` and `pnpm` resolve
- [ ] `pnpm install` succeeded
- [ ] `.env` exists (pre-existing and untouched, or created with generated secrets)
- [ ] `postgres` and `api` containers are up
- [ ] `local:db-migrate` exited 0
- [ ] `local:db-seed` exited 0
- [ ] `curl -fsS http://localhost:8000/v1/health` output contains `"status":"ok"`
- [ ] `curl -I http://localhost:3000` returned 2xx or 3xx
- [ ] The background web dev process was stopped **and port 3000 is free**

Optional, only when the user asks for a full check:

```bash
mise run lint
mise run typecheck
```

## D. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `mise: command not found` right after install | mise's own bin dir not on `PATH` | `export PATH="$HOME/.local/bin:$PATH"` |
| `Config files … are not trusted. Trust them with 'mise trust'` | Fresh clone, untrusted `mise.toml`, no TTY to confirm | `mise trust ./mise.toml`, then re-run the command |
| `pnpm: command not found` / `node: command not found` after a successful `mise install` | mise shims not on `PATH`; `mise activate` is a shell-rc hook a non-interactive shell never sources | `eval "$(mise activate bash --shims)"`, or prefix the command with `mise exec --` |
| `Cannot connect to the Docker daemon` | Docker not running | Start Docker Desktop (macOS) or `sudo systemctl start docker` (Linux) |
| `404 Cannot GET /health` | `/health` is versioned; the mapped route is `/v1/health` | Use `http://localhost:8000/v1/health` |
| `address already in use` on 8000 or 3000 | Another process holds the port | Identify it with `lsof -i :8000` (or `:3000`). If it is something *this runbook* started — the api container (`docker compose stop api`) or your own web dev server — stop that. **Otherwise ask the user before killing anything you did not start.** |
| `db-seed` fails with an HTTP error registering `admin@example.com` | No API listening on port 8000 | Bring up step 4's api container first, or point the seed at a running API with `API_BASE_URL` |
| API cannot reach the database | Wrong host in `DATABASE_URL` | Inside Docker the host is `postgres`; from the host machine it is `localhost` |
| Pre-commit hook fails on gitleaks | No local binary and no Docker | `tools/bin/gitleaks` falls back to `docker run` — start Docker, or install gitleaks |
| `Target directory already exists` from `install.sh` | `./<PROJECT_NAME>` is taken | Pick another `PROJECT_NAME`, or set `INSTALL_DIR` to a free path |
| `install.sh` exits complaining about no terminal | Env vars missing under an agent | Set all three: `PROJECT_NAME`, `GIT_USER_NAME`, `GIT_USER_EMAIL` |

## E. Do not

- Overwrite, edit, or print the contents of an existing `.env`.
- Commit, push, or create branches unless the user explicitly asks.
- Use `npm`, `npx`, or `yarn`.
- Run `mise run local:docker-clean` — it deletes volumes, and with them the database.
- Run the dev server in the foreground.
- Kill a process or container you did not start. Ask the user first.
- Report success without completing the §C checklist.
