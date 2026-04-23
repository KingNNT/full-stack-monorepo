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

clone_repo() {
  log "Cloning repository..."

  if [ -e "$INSTALL_DIR" ]; then
    die "Target directory already exists: $INSTALL_DIR
Remove it or set INSTALL_DIR to a different path, then re-run."
  fi

  local cloned=0

  if [ "$USE_HTTPS" != "1" ]; then
    log "Attempting SSH clone from $REPO_SSH"
    if GIT_SSH_COMMAND="ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new" \
       git clone --branch "$BRANCH" "$REPO_SSH" "$INSTALL_DIR" 2>/dev/null; then
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

install_deps() {
  log "Installing dependencies with pnpm..."
  (cd "$INSTALL_DIR" && pnpm install)
  log "Dependencies installed"
}

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

# --- Main --------------------------------------------------------------------

main() {
  log "nestjs-nextjs-monorepo installer"
  detect_os
  log "OS: $OS"
  log "Install dir: $INSTALL_DIR"
  log "Branch:      $BRANCH"
  ensure_git
  ensure_node
  ensure_pnpm
  check_docker
  clone_repo
  setup_env_file
  install_deps
  print_next_steps
}

# Only run main when executed directly, not when sourced (e.g. by tests).
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
