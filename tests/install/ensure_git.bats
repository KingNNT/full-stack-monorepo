#!/usr/bin/env bats

load 'helpers/stubs'

INSTALL_SH="${BATS_TEST_DIRNAME}/../../install.sh"

setup() {
  setup_stub_dir
}

teardown() {
  teardown_stub_dir
}

@test "ensure_git: succeeds when git is installed" {
  stub git 'echo "git version 2.43.0"'

  run bash -c "OS=linux; source '$INSTALL_SH'; ensure_git"
  [ "$status" -eq 0 ]
  [[ "$output" == *"git version 2.43.0"* ]]
}

@test "ensure_git: on macOS, message mentions xcode-select" {
  run bash -c "$(isolate_path_snippet); OS=macos; source '$INSTALL_SH'; ensure_git"
  [ "$status" -ne 0 ]
  [[ "$output" == *"xcode-select --install"* ]]
}

@test "ensure_git: on Linux, message mentions package manager" {
  run bash -c "$(isolate_path_snippet); OS=linux; source '$INSTALL_SH'; ensure_git"
  [ "$status" -ne 0 ]
  [[ "$output" == *"apt install git"* ]]
}
