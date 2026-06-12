#!/usr/bin/env bash
#
# Interactive project scaffolding tool for KingNNT/full-stack-monorepo.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/KingNNT/full-stack-monorepo/develop/install.sh | bash
#
# The script will prompt for:
#   1. Project name (kebab-case) — used for directory name, package names, DB name
#   2. Your name — for local git config
#   3. Your email — for local git config
#
# Env vars:
#   BRANCH        Branch to check out (default: develop)
#   USE_HTTPS     Set to 1 to force HTTPS clone (default: try SSH then HTTPS)

set -euo pipefail

# --- Constants ---------------------------------------------------------------

REPO_SSH="git@github.com:KingNNT/full-stack-monorepo.git"
REPO_HTTPS="https://github.com/KingNNT/full-stack-monorepo.git"


# --- Config (env-var overridable) --------------------------------------------

# INSTALL_DIR is set dynamically in main() after prompt_project_name.
# Override only if you need a custom path (e.g. for testing).
INSTALL_DIR="${INSTALL_DIR:-}"
BRANCH="${BRANCH:-develop}"
USE_HTTPS="${USE_HTTPS:-0}"

# --- Helpers -----------------------------------------------------------------

log()  { echo "==> $*"; }
warn() { echo "!!  $*" >&2; }
die()  { echo "!!  $*" >&2; exit 1; }
has()  { command -v "$1" >/dev/null 2>&1; }

# File descriptor for interactive reads. Defaults to /dev/tty so prompts work
# even when the script itself is piped (curl ... | bash). Tests override this
# to /dev/stdin so they can feed input via stdin piping.
: "${INPUT_FD:=/dev/tty}"

prompt_project_name() {
  while true; do
    printf "==> Enter project name (kebab-case, e.g. my-saas-app): "
    local name
    read -r name <"$INPUT_FD"
    if [[ "$name" =~ ^[a-z][a-z0-9-]*$ ]]; then
      PROJECT_NAME="$name"
      return 0
    fi
    warn "'$name' is not valid. Use lowercase letters, digits, and dashes. Must start with a letter."
  done
}

prompt_git_config() {
  while true; do
    printf "==> Enter your name (for git config, e.g. John Doe): "
    local name
    read -r name <"$INPUT_FD"
    if [ -n "$name" ]; then
      GIT_USER_NAME="$name"
      break
    fi
    warn "Name cannot be empty."
  done

  while true; do
    printf "==> Enter your email (for git config, e.g. john@example.com): "
    local email
    read -r email <"$INPUT_FD"
    if [ -n "$email" ]; then
      GIT_USER_EMAIL="$email"
      break
    fi
    warn "Email cannot be empty."
  done
}

rename_project() {
  log "Renaming project to $PROJECT_NAME..."

  local name_us
  name_us="${PROJECT_NAME//-/_}"

  # Get list of tracked files (skip .git, node_modules, .nx, pnpm-lock.yaml, binaries)
  local files
  files="$(cd "$INSTALL_DIR" && git ls-files \
    | grep -v '^pnpm-lock.yaml$' \
    | grep -v '\.png$' \
    | grep -v '\.jpg$' \
    | grep -v '\.jpeg$' \
    | grep -v '\.gif$' \
    | grep -v '\.ico$' \
    | grep -v '\.woff2$' \
    | grep -v '\.woff$' \
    | grep -v '\.ttf$' \
    | grep -v '\.eot$' \
    || true)"

  local file
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    local filepath="$INSTALL_DIR/$file"

    # Order matters: more specific patterns first
    sed -i.bak \
      -e "s|@fullstack-monorepo-app/|@${PROJECT_NAME}/|g" \
      -e "s|@fullstack-monorepo/|@${PROJECT_NAME}/|g" \
      -e "s|fullstack_monorepo_dev|${name_us}_dev|g" \
      -e "s|fullstack-monorepo|${PROJECT_NAME}|g" \
      "$filepath"
    rm -f "${filepath}.bak"
  done <<< "$files"

  # Also update APP_NAME in .env
  local env_file="$INSTALL_DIR/.env"
  if [ -f "$env_file" ]; then
    sed -i.bak "s|^APP_NAME=.*|APP_NAME=${PROJECT_NAME}|" "$env_file"
    rm -f "${env_file}.bak"
  fi

  log "Project renamed to $PROJECT_NAME"
}

git_init_fresh() {
  log "Initializing fresh git repository..."
  rm -rf "$INSTALL_DIR/.git"
  git init "$INSTALL_DIR"
  git -C "$INSTALL_DIR" config user.name "$GIT_USER_NAME"
  git -C "$INSTALL_DIR" config user.email "$GIT_USER_EMAIL"
  git -C "$INSTALL_DIR" add -A
  git -C "$INSTALL_DIR" commit -m "feat: initialize $PROJECT_NAME from full-stack-monorepo template"
  log "Git repository initialized with clean history"
}

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

ensure_mise() {
  log "Checking mise..."
  if ! has mise; then
    log "Installing mise..."
    curl -fsSL https://mise.run | sh
    # shellcheck disable=SC1091
    . "$HOME/.local/bin/mise" activate bash 2>/dev/null || true
    # Also add to PATH for current shell in case activate didn't fully work
    export PATH="$HOME/.local/bin:$PATH"
  fi
  log "mise $(mise --version)"
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

  # Auto-generate secrets
  local secret
  for var in JWT_ACCESS_SECRET JWT_REFRESH_SECRET AUTH_SECRET; do
    secret="$(openssl rand -base64 48 | tr -d '\n')"
    sed -i.bak "s|^${var}=.*|${var}=${secret}|" "$dst"
    rm -f "${dst}.bak"
  done

  log "Created $dst with auto-generated secrets"
}

mise_install_tools() {
  log "Installing tools via mise..."
  (cd "$INSTALL_DIR" && mise install)
  log "Node $(node --version) + pnpm $(pnpm --version) installed"
}

install_deps() {
  log "Installing dependencies with pnpm..."
  (cd "$INSTALL_DIR" && pnpm install)
  log "Dependencies installed"
}

print_next_steps() {
  cat <<EOF

==> Done! Your project '$PROJECT_NAME' is ready.

  cd $INSTALL_DIR

  # Start the full stack with Docker (recommended):
  make up
  make db-migrate
  make db-seed

  # Or run locally without Docker:
  mise run dev

  App:  http://localhost:3000
  API:  http://localhost:8000

  Git config set locally:
    user.name:  $GIT_USER_NAME
    user.email: $GIT_USER_EMAIL

  To push to your own remote:
    git remote set-url origin <your-repo-url>
    git push -u origin main

EOF
}

# --- Main --------------------------------------------------------------------

main() {
  log "full-stack-monorepo project scaffolder"
  detect_os
  log "OS: $OS"
  ensure_git
  ensure_mise
  check_docker

  # Interactive prompts
  prompt_project_name
  prompt_git_config

  # Set install directory to ./<project-name> in current working directory
  INSTALL_DIR="$(pwd)/${PROJECT_NAME}"

  # Validate target directory
  if [ -e "$INSTALL_DIR" ]; then
    die "Target directory already exists: $INSTALL_DIR
Remove it or choose a different project name, then re-run."
  fi

  clone_repo
  rename_project
  setup_env_file
  mise_install_tools

  # Remove scaffolding artifacts — not part of the user's project
  rm -f "$INSTALL_DIR/install.sh"

  git_init_fresh
  install_deps
  print_next_steps
}

# Only run main when executed directly, not when sourced (e.g. by tests).
# When piped to bash (curl ... | bash), BASH_SOURCE is unset, so we default to
# running main since a piped invocation is always a direct execution.
if [[ "${BASH_SOURCE[0]:-}" == "$0" ]] || [[ -z "${BASH_SOURCE[0]:-}" ]]; then
  main "$@"
fi
