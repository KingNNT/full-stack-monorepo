#!/usr/bin/env bats

load 'helpers/stubs'

INSTALL_SH="${BATS_TEST_DIRNAME}/../../install.sh"

setup() {
  setup_stub_dir
}

teardown() {
  teardown_stub_dir
}

@test "detect_os: Darwin -> macos" {
  stub uname 'echo "Darwin"'
  run bash -c "source '$INSTALL_SH'; detect_os; echo \"\$OS\""
  [ "$status" -eq 0 ]
  [ "${lines[-1]}" = "macos" ]
}

@test "detect_os: Linux -> linux" {
  stub uname 'echo "Linux"'
  run bash -c "source '$INSTALL_SH'; detect_os; echo \"\$OS\""
  [ "$status" -eq 0 ]
  [ "${lines[-1]}" = "linux" ]
}

@test "detect_os: unknown OS exits non-zero with error message" {
  stub uname 'echo "Windows_NT"'
  run bash -c "source '$INSTALL_SH'; detect_os"
  [ "$status" -ne 0 ]
  [[ "$output" == *"Unsupported OS"* ]]
}
