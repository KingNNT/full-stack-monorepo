#!/usr/bin/env bats

load 'helpers/stubs'

INSTALL_SH="${BATS_TEST_DIRNAME}/../../install.sh"

setup() {
  setup_stub_dir
  WORK_DIR="$(mktemp -d "${BATS_TMPDIR:-/tmp}/install-work.XXXXXX")"
  export WORK_DIR
}

teardown() {
  teardown_stub_dir
  [ -d "${WORK_DIR:-}" ] && rm -rf "$WORK_DIR"
}

@test "resolve_install_dir sets INSTALL_DIR to \$(pwd)/<PROJECT_NAME> when INSTALL_DIR is unset" {
  run bash -c "cd '$WORK_DIR'; source '$INSTALL_SH'; PROJECT_NAME='my-app'; unset INSTALL_DIR; resolve_install_dir; echo \"\$INSTALL_DIR\""
  [ "$status" -eq 0 ]
  [[ "$output" == *"/my-app" ]]
}

@test "a caller-supplied INSTALL_DIR survives resolve_install_dir unchanged" {
  run bash -c "cd '$WORK_DIR'; source '$INSTALL_SH'; PROJECT_NAME='my-app'; INSTALL_DIR='/custom/path'; resolve_install_dir; echo \"\$INSTALL_DIR\""
  [ "$status" -eq 0 ]
  [ "$output" = "/custom/path" ]
}

@test "an empty INSTALL_DIR=\"\" falls back to default in resolve_install_dir" {
  run bash -c "cd '$WORK_DIR'; source '$INSTALL_SH'; PROJECT_NAME='my-app'; INSTALL_DIR=''; resolve_install_dir; echo \"\$INSTALL_DIR\""
  [ "$status" -eq 0 ]
  [[ "$output" == *"/my-app" ]]
}
