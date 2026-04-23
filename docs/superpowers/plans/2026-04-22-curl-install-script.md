# Curl Install Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a single `install.sh` at the repo root that bootstraps a developer machine in one curl-pipe-to-bash command — installs Node 22 + pnpm via nvm/corepack, clones the repo, copies `.env`, runs `pnpm install`, and prints next steps.

**Architecture:** One bash file, `set -euo pipefail`, step-oriented with `==>` progress markers. Functions for each step (`ensure_git`, `ensure_node`, etc.) called linearly from `main`. Config via env vars (`INSTALL_DIR`, `BRANCH`, `USE_HTTPS`). Style matches the existing `infra/helm/monitoring/install.sh`.

**Tech Stack:** Bash, nvm (Node install), corepack (pnpm install), git, standard POSIX tools (`command -v`, `uname`).

**Spec:** `docs/superpowers/specs/2026-04-21-curl-install-script-design.md`

---

## File Structure

- **Create:** `install.sh` (repo root) — the entire script, a single file.
- **Modify:** `README.md` (repo root) — add a "Quick Install" section with the curl-pipe command and link.

Everything lives in one script. It's under ~200 lines and straight-line; splitting into multiple files would hurt readability.

---

## Task 1: Scaffold `install.sh` with preflight and config parsing

**Files:**
- Create: `install.sh`

- [ ] **Step 1: Create the skeleton**

Create `install.sh` at the repo root:

```bash
#!/usr/bin/env bash
#
# Bootstrap installer for KingNNT/nestjs-nextjs-monorepo.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/KingNNT/nestjs-nextjs-monorepo/develop/install.sh | bash
#
# Env vars:
#   INSTALL_DIR   Target directory (default: $HOME/nestjs-nextjs-monorepo)
#   BRANCH        Branch to check out (default: develop)
#   USE_HTTPS     Set to 1 to force HTTPS clone (default: try SSH then HTTPS)

set -euo pipefail

# --- Constants ---------------------------------------------------------------

REPO_SSH="git@github.com:KingNNT/nestjs-nextjs-monorepo.git"
REPO_HTTPS="https://github.com/KingNNT/nestjs-nextjs-monorepo.git"
NODE_MAJOR=22
NVM_VERSION="v0.40.1"

# --- Config (env-var overridable) --------------------------------------------

INSTALL_DIR="${INSTALL_DIR:-$HOME/nestjs-nextjs-monorepo}"
BRANCH="${BRANCH:-develop}"
USE_HTTPS="${USE_HTTPS:-0}"

# --- Helpers -----------------------------------------------------------------

log()  { echo "==> $*"; }
warn() { echo "!!  $*" >&2; }
die()  { echo "!!  $*" >&2; exit 1; }
has()  { command -v "$1" >/dev/null 2>&1; }

detect_os() {
  case "$(uname -s)" in
    Darwin) OS="macos" ;;
    Linux)  OS="linux" ;;
    *)      die "Unsupported OS: $(uname -s). Use macOS, Linux, or WSL." ;;
  esac
}

# --- Main --------------------------------------------------------------------

main() {
  log "nestjs-nextjs-monorepo installer"
  detect_os
  log "OS: $OS"
  log "Install dir: $INSTALL_DIR"
  log "Branch:      $BRANCH"
}

main "$@"
```

- [ ] **Step 2: Make it executable and smoke-test the skeleton**

Run:
```bash
chmod +x install.sh
bash install.sh
```

Expected output:
```
==> nestjs-nextjs-monorepo installer
==> OS: macos
==> Install dir: /Users/<you>/nestjs-nextjs-monorepo
==> Branch:      develop
```

Exit code 0.

- [ ] **Step 3: Verify env-var overrides work**

Run:
```bash
INSTALL_DIR=/tmp/foo BRANCH=main bash install.sh
```

Expected:
```
==> Install dir: /tmp/foo
==> Branch:      main
```

- [ ] **Step 4: Commit**

```bash
git add install.sh
git commit -m "feat(install): scaffold install.sh with preflight and config"
```

---

## Task 2: Git prerequisite check

**Files:**
- Modify: `install.sh` (add `ensure_git` function + call in `main`)

- [ ] **Step 1: Add `ensure_git` function**

Insert after `detect_os()`:

```bash
ensure_git() {
  log "Checking git..."
  if ! has git; then
    case "$OS" in
      macos) die "git not found. Install with: xcode-select --install" ;;
      linux) die "git not found. Install with your package manager (apt install git / dnf install git)." ;;
    esac
  fi
  log "git: $(git --version)"
}
```

Add to `main()` after the initial logs:

```bash
  ensure_git
```

- [ ] **Step 2: Smoke test**

Run:
```bash
bash install.sh
```

Expected to include:
```
==> Checking git...
==> git: git version 2.x.x
```

- [ ] **Step 3: Verify the missing-git path (optional sanity check)**

Run in a shell where `git` is aliased away:
```bash
PATH=/usr/bin:/bin bash -c 'alias git=false; bash install.sh' || true
```

This is a best-effort check; skip if awkward to reproduce. The important part is the function's shape matches other `ensure_*` helpers added in later tasks.

- [ ] **Step 4: Commit**

```bash
git add install.sh
git commit -m "feat(install): require git"
```

---

## Task 3: Node 22 install via nvm

**Files:**
- Modify: `install.sh` (add `ensure_node` function + call in `main`)

- [ ] **Step 1: Add `ensure_node` function**

Insert after `ensure_git()`:

```bash
ensure_node() {
  log "Checking Node.js (>= ${NODE_MAJOR})..."

  # Load nvm if it's already installed but not yet on PATH for this shell.
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

  if has node; then
    local current_major
    current_major="$(node -p 'process.versions.node.split(".")[0]')"
    if [ "$current_major" -ge "$NODE_MAJOR" ]; then
      log "Node $(node --version) OK"
      return 0
    fi
    warn "Node $(node --version) is older than ${NODE_MAJOR}; installing via nvm"
  fi

  if ! has nvm && [ ! -s "$NVM_DIR/nvm.sh" ]; then
    log "Installing nvm ${NVM_VERSION}..."
    curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
  fi

  log "Installing Node ${NODE_MAJOR} via nvm..."
  nvm install "${NODE_MAJOR}"
  nvm use "${NODE_MAJOR}"
  log "Node $(node --version) installed"
}
```

Add to `main()` after `ensure_git`:

```bash
  ensure_node
```

- [ ] **Step 2: Smoke test on a machine that already has Node 22**

Run:
```bash
bash install.sh
```

Expected:
```
==> Checking Node.js (>= 22)...
==> Node v22.x.x OK
```

No install steps should run.

- [ ] **Step 3: Smoke test in a Docker container without Node (optional but recommended)**

Run:
```bash
docker run --rm -it -v "$PWD/install.sh:/install.sh" ubuntu:22.04 bash -c '
  apt-get update && apt-get install -y curl git ca-certificates &&
  bash /install.sh
' || true
```

Expected: the script installs nvm, installs Node 22, and logs `Node v22.x.x installed`. The script will continue past Node and fail later on clone (that's fine for this task — we only need to see Node installed).

- [ ] **Step 4: Commit**

```bash
git add install.sh
git commit -m "feat(install): install Node 22 via nvm when missing"
```

---

## Task 4: pnpm install via corepack

**Files:**
- Modify: `install.sh` (add `ensure_pnpm` function + call in `main`)

- [ ] **Step 1: Add `ensure_pnpm` function**

Insert after `ensure_node()`:

```bash
ensure_pnpm() {
  log "Checking pnpm..."
  if has pnpm; then
    log "pnpm $(pnpm --version) OK"
    return 0
  fi

  if ! has corepack; then
    die "corepack not found. This should ship with Node >= 16; please reinstall Node."
  fi

  log "Enabling pnpm via corepack..."
  corepack enable
  corepack prepare pnpm@latest --activate
  log "pnpm $(pnpm --version) installed"
}
```

Add to `main()` after `ensure_node`:

```bash
  ensure_pnpm
```

Note on version: after the repo is cloned, `pnpm` commands run inside the repo will auto-switch to the version pinned in `package.json` (`packageManager: pnpm@10.11.0`) via corepack. Installing "latest" here is just to have *a* pnpm binary available.

- [ ] **Step 2: Smoke test**

Run:
```bash
bash install.sh
```

Expected:
```
==> Checking pnpm...
==> pnpm 10.x.x OK
```

(Or the "Enabling pnpm via corepack..." path if pnpm wasn't installed.)

- [ ] **Step 3: Commit**

```bash
git add install.sh
git commit -m "feat(install): enable pnpm via corepack"
```

---

## Task 5: Docker detection (no auto-install)

**Files:**
- Modify: `install.sh` (add `check_docker` function + call in `main`)

- [ ] **Step 1: Add `check_docker` function**

Insert after `ensure_pnpm()`:

```bash
check_docker() {
  log "Checking Docker..."
  if has docker; then
    log "Docker $(docker --version | awk '{print $3}' | tr -d ,) OK"
    return 0
  fi
  warn "Docker not found. The app can run without it, but 'make up' and integration tests need it."
  warn "  macOS: https://docs.docker.com/desktop/install/mac-install/"
  warn "  Linux: https://docs.docker.com/engine/install/"
}
```

Add to `main()` after `ensure_pnpm`:

```bash
  check_docker
```

- [ ] **Step 2: Smoke test**

Run:
```bash
bash install.sh
```

Expected (if Docker is installed):
```
==> Checking Docker...
==> Docker 24.x.x OK
```

Or (if not):
```
==> Checking Docker...
!!  Docker not found. ...
```

Exit code should still be 0 — Docker is optional.

- [ ] **Step 3: Commit**

```bash
git add install.sh
git commit -m "feat(install): detect Docker (optional)"
```

---

## Task 6: Clone repository with SSH → HTTPS fallback

**Files:**
- Modify: `install.sh` (add `clone_repo` function + call in `main`)

- [ ] **Step 1: Add `clone_repo` function**

Insert after `check_docker()`:

```bash
clone_repo() {
  log "Cloning repository..."

  if [ -e "$INSTALL_DIR" ]; then
    die "Target directory already exists: $INSTALL_DIR
Remove it or set INSTALL_DIR to a different path, then re-run."
  fi

  local cloned=0

  if [ "$USE_HTTPS" != "1" ]; then
    log "Attempting SSH clone from $REPO_SSH"
    if git clone --branch "$BRANCH" "$REPO_SSH" "$INSTALL_DIR" 2>/dev/null; then
      cloned=1
    else
      warn "SSH clone failed (no key configured?). Falling back to HTTPS."
    fi
  fi

  if [ "$cloned" -eq 0 ]; then
    log "Cloning via HTTPS from $REPO_HTTPS"
    git clone --branch "$BRANCH" "$REPO_HTTPS" "$INSTALL_DIR"
  fi

  log "Cloned to $INSTALL_DIR"
}
```

Add to `main()` after `check_docker`:

```bash
  clone_repo
```

- [ ] **Step 2: Test clone into a temp dir**

Run:
```bash
INSTALL_DIR=/tmp/nestjs-nextjs-monorepo-test bash install.sh
```

Expected:
- Clones successfully (via SSH if keys set up, else HTTPS fallback).
- Target dir contains the repo (`ls /tmp/nestjs-nextjs-monorepo-test/package.json`).

- [ ] **Step 3: Test the "dir already exists" abort**

Run again without cleaning up:
```bash
INSTALL_DIR=/tmp/nestjs-nextjs-monorepo-test bash install.sh
```

Expected: aborts with `Target directory already exists: ...`, exit code 1.

- [ ] **Step 4: Clean up and commit**

```bash
rm -rf /tmp/nestjs-nextjs-monorepo-test
git add install.sh
git commit -m "feat(install): clone repo with SSH→HTTPS fallback"
```

---

## Task 7: Copy `.env.example` → `.env`

**Files:**
- Modify: `install.sh` (add `setup_env_file` function + call in `main`)

- [ ] **Step 1: Add `setup_env_file` function**

Insert after `clone_repo()`:

```bash
setup_env_file() {
  log "Setting up .env..."
  local src="$INSTALL_DIR/.env.example"
  local dst="$INSTALL_DIR/.env"

  if [ ! -f "$src" ]; then
    warn ".env.example not found at $src — skipping"
    return 0
  fi
  if [ -f "$dst" ]; then
    warn ".env already exists — leaving it alone"
    return 0
  fi

  cp "$src" "$dst"
  log "Created $dst from .env.example"
  warn "Review $dst and set JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, AUTH_SECRET before first run."
}
```

Add to `main()` after `clone_repo`:

```bash
  setup_env_file
```

- [ ] **Step 2: Test clean copy**

Run:
```bash
rm -rf /tmp/nestjs-nextjs-monorepo-test
INSTALL_DIR=/tmp/nestjs-nextjs-monorepo-test bash install.sh
```

Expected:
```
==> Setting up .env...
==> Created /tmp/nestjs-nextjs-monorepo-test/.env from .env.example
!!  Review ... set JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, AUTH_SECRET ...
```

Verify: `test -f /tmp/nestjs-nextjs-monorepo-test/.env && echo OK`

- [ ] **Step 3: Test that existing `.env` is preserved**

```bash
echo "SENTINEL=1" >> /tmp/nestjs-nextjs-monorepo-test/.env
# re-run setup_env_file manually by sourcing bits, or just verify the warn path
```

Since the script aborts at `clone_repo` on rerun (target dir exists), the cleanest way to verify is inspect the function: the `[ -f "$dst" ]` branch handles the case. A full end-to-end recheck happens in Task 9.

- [ ] **Step 4: Clean up and commit**

```bash
rm -rf /tmp/nestjs-nextjs-monorepo-test
git add install.sh
git commit -m "feat(install): copy .env.example to .env when absent"
```

---

## Task 8: Install dependencies and print next steps

**Files:**
- Modify: `install.sh` (add `install_deps` + `print_next_steps` functions + calls in `main`)

- [ ] **Step 1: Add `install_deps` function**

Insert after `setup_env_file()`:

```bash
install_deps() {
  log "Installing dependencies with pnpm..."
  (cd "$INSTALL_DIR" && pnpm install)
  log "Dependencies installed"
}
```

- [ ] **Step 2: Add `print_next_steps` function**

Insert after `install_deps()`:

```bash
print_next_steps() {
  cat <<EOF

==> Done! Next steps:

  cd $INSTALL_DIR

  # Review secrets in .env (JWT_*, AUTH_SECRET).
  \$EDITOR .env

  # Start the full stack with Docker (recommended):
  make up
  make db-migrate
  make db-seed

  # Or run locally without Docker:
  pnpm dev

  App:  http://localhost:3000
  API:  http://localhost:8000

EOF
}
```

- [ ] **Step 3: Wire them into `main`**

Add to `main()` after `setup_env_file`:

```bash
  install_deps
  print_next_steps
```

- [ ] **Step 4: Full end-to-end test**

Run:
```bash
rm -rf /tmp/nestjs-nextjs-monorepo-test
INSTALL_DIR=/tmp/nestjs-nextjs-monorepo-test bash install.sh
```

Expected: clone → `.env` created → `pnpm install` runs to completion → next-steps block prints with `cd /tmp/nestjs-nextjs-monorepo-test` and the command list.

Verify: `ls /tmp/nestjs-nextjs-monorepo-test/node_modules | head`

- [ ] **Step 5: Clean up and commit**

```bash
rm -rf /tmp/nestjs-nextjs-monorepo-test
git add install.sh
git commit -m "feat(install): pnpm install and print next steps"
```

---

## Task 9: Remote curl-pipe verification

**Files:**
- None (verification only)

This task must run **after** `install.sh` has been pushed to the `develop` branch on GitHub, because the URL has to resolve. The user controls pushing — do not push from within this task.

- [ ] **Step 1: Confirm the raw URL resolves**

Once pushed:
```bash
curl -fsSL -o /tmp/install.sh https://raw.githubusercontent.com/KingNNT/nestjs-nextjs-monorepo/develop/install.sh
head -5 /tmp/install.sh
```

Expected: first lines match the local `install.sh` shebang and header comment.

- [ ] **Step 2: Run via curl-pipe-bash in a clean dir**

```bash
INSTALL_DIR=/tmp/curlpipe-check curl -fsSL https://raw.githubusercontent.com/KingNNT/nestjs-nextjs-monorepo/develop/install.sh | bash
```

Expected: full installer runs end-to-end, finishing with the "Next steps" block.

- [ ] **Step 3: Clean up**

```bash
rm -rf /tmp/curlpipe-check /tmp/install.sh
```

No commit — this task is verification only.

---

## Task 10: Document the install command in README

**Files:**
- Modify: `README.md` (add "Quick Install" section near the top)

- [ ] **Step 1: Locate the insertion point**

Run:
```bash
head -40 README.md
```

Find the first section after the top-of-file project title (e.g., before an existing "Getting Started", "Prerequisites", or "Development" section). The "Quick Install" section goes there.

- [ ] **Step 2: Add the section**

Insert this block at the chosen location:

```markdown
## Quick Install

One-liner for a fresh macOS or Linux machine (installs Node 22 + pnpm via nvm/corepack, clones the repo, copies `.env`, runs `pnpm install`):

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/KingNNT/nestjs-nextjs-monorepo/develop/install.sh | bash
\`\`\`

Optional overrides:

\`\`\`bash
INSTALL_DIR=~/code/monorepo BRANCH=main USE_HTTPS=1 \\
  curl -fsSL https://raw.githubusercontent.com/KingNNT/nestjs-nextjs-monorepo/develop/install.sh | bash
\`\`\`

Always inspect the script before piping to bash:

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/KingNNT/nestjs-nextjs-monorepo/develop/install.sh | less
\`\`\`

Docker is optional; install it separately if you plan to use `make up` or integration tests.
```

(The backticks in the example are escaped only in this plan file — in README.md they are real triple-backticks.)

- [ ] **Step 3: Verify formatting**

Run:
```bash
grep -n "Quick Install" README.md
```

Expected: the heading appears once, near the top.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): add quick install curl command"
```

---

## Self-Review Notes

- Each spec decision maps to a task: prerequisites → Tasks 2–5, clone+fallback → Task 6, env file → Task 7, pnpm install + next steps → Task 8, curl-pipe verification → Task 9, docs → Task 10.
- No placeholders, no "TBD", every step has concrete code or commands.
- Function names used across tasks: `detect_os`, `ensure_git`, `ensure_node`, `ensure_pnpm`, `check_docker`, `clone_repo`, `setup_env_file`, `install_deps`, `print_next_steps`. They match the spec's "Script Structure" section.
- `.env` handling matches the corrected spec (single root `.env.example`, not per-app).
- `NODE_MAJOR=22` consistent with project's Node 22+ requirement.
- `pnpm@latest` in corepack prepare is intentional for the standalone binary; the repo's `packageManager: pnpm@10.11.0` auto-activates inside the cloned repo.
