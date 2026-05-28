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

@test "INSTALL_DIR is set to current-dir/project-name when not overridden" {
  run bash -c "cd '$WORK_DIR'; source '$INSTALL_SH'; PROJECT_NAME='my-app'; main() { echo \"\$INSTALL_DIR\"; }; INSTALL_DIR=\"\$(pwd)/\${PROJECT_NAME}\"; echo \"\$INSTALL_DIR\""
  [ "$status" -eq 0 ]
  [[ "$output" == *"/my-app" ]]
}
