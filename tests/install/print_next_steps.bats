#!/usr/bin/env bats
# Tests for print_next_steps() in install.sh — the last text a user or agent
# sees, so it must match the commands the repo actually ships.

load 'helpers/stubs'

INSTALL_SH="${BATS_TEST_DIRNAME}/../../install.sh"

setup() {
  setup_stub_dir
  FAKE_INSTALL_DIR="$(mktemp -d "${BATS_TMPDIR:-/tmp}/next-steps.XXXXXX")"
  export FAKE_INSTALL_DIR
}

teardown() {
  teardown_stub_dir
  [ -d "${FAKE_INSTALL_DIR:-}" ] && rm -rf "$FAKE_INSTALL_DIR"
}

# Creates a git repo at $FAKE_INSTALL_DIR with one commit on branch $1.
make_repo() {
  local branch="$1"
  git init --initial-branch="$branch" "$FAKE_INSTALL_DIR" >/dev/null 2>&1
  git -C "$FAKE_INSTALL_DIR" config user.name "Test" >/dev/null 2>&1
  git -C "$FAKE_INSTALL_DIR" config user.email "test@example.com" >/dev/null 2>&1
  touch "$FAKE_INSTALL_DIR/file.txt"
  git -C "$FAKE_INSTALL_DIR" add -A >/dev/null 2>&1
  git -C "$FAKE_INSTALL_DIR" commit -m "init" >/dev/null 2>&1
}

run_banner() {
  run bash -c "
    source '$INSTALL_SH'
    PROJECT_NAME='my-app'
    INSTALL_DIR='$FAKE_INSTALL_DIR'
    GIT_USER_NAME='John Doe'
    GIT_USER_EMAIL='john@example.com'
    print_next_steps
  "
}

@test "print_next_steps: uses mise tasks, never nonexistent make targets" {
  make_repo main
  run_banner
  [ "$status" -eq 0 ]
  [[ "$output" == *"mise run local:docker-up-api"* ]]
  [[ "$output" == *"mise run local:db-migrate"* ]]
  [[ "$output" == *"mise run local:db-seed"* ]]
  [[ "$output" != *"make up"* ]]
  [[ "$output" != *"make db-migrate"* ]]
  [[ "$output" != *"make db-seed"* ]]
}

@test "print_next_steps: says 'git remote add', not 'set-url' (no origin exists)" {
  make_repo main
  run_banner
  [ "$status" -eq 0 ]
  [[ "$output" == *"git remote add origin"* ]]
  [[ "$output" != *"git remote set-url"* ]]
}

@test "print_next_steps: pushes the repo's actual default branch" {
  make_repo trunk
  run_banner
  [ "$status" -eq 0 ]
  [[ "$output" == *"git push -u origin trunk"* ]]
  [[ "$output" != *"git push -u origin main"* ]]
}

@test "print_next_steps: advertises the versioned health URL" {
  make_repo main
  run_banner
  [ "$status" -eq 0 ]
  [[ "$output" == *"http://localhost:8000/v1/health"* ]]
}

@test "print_next_steps: does not abort when the branch cannot be resolved" {
  # No git repo at INSTALL_DIR — rev-parse fails; set -e must not kill the run.
  run_banner
  [ "$status" -eq 0 ]
  [[ "$output" == *"<your-branch>"* ]]
}
