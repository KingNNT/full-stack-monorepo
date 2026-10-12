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
  run_banner
  [ "$status" -eq 0 ]
  [[ "$output" == *"mise run local:docker:up"* ]]
  [[ "$output" == *"mise run local:db:migrate"* ]]
  [[ "$output" == *"mise run local:db:seed"* ]]
  [[ "$output" != *"make up"* ]]
  [[ "$output" != *"make db-migrate"* ]]
  [[ "$output" != *"make db-seed"* ]]
}

@test "print_next_steps: says 'git remote add', not 'set-url' (no origin exists)" {
  run_banner
  [ "$status" -eq 0 ]
  [[ "$output" == *"git remote add origin"* ]]
  [[ "$output" != *"git remote set-url"* ]]
}

@test "print_next_steps: pushes both git flow branches, then configures GitHub" {
  run_banner
  [ "$status" -eq 0 ]
  [[ "$output" == *"git push -u origin main develop"* ]]
  [[ "$output" == *"mise run github:setup"* ]]
  [[ "$output" == *"gh secret set RELEASE_TOKEN"* ]]
}

@test "print_next_steps: advertises the versioned health URL" {
  run_banner
  [ "$status" -eq 0 ]
  [[ "$output" == *"http://localhost:8000/v1/health"* ]]
}
