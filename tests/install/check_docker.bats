#!/usr/bin/env bats

load 'helpers/stubs'

INSTALL_SH="${BATS_TEST_DIRNAME}/../../install.sh"

setup() {
  setup_stub_dir
}

teardown() {
  teardown_stub_dir
}

@test "check_docker: succeeds when docker is installed" {
  stub docker 'echo "Docker version 25.0.1, build abc"'

  run bash -c "source '$INSTALL_SH'; check_docker"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Docker 25.0.1 OK"* ]]
}

@test "check_docker: warns but returns success when docker missing" {
  run bash -c "$(isolate_path_snippet); source '$INSTALL_SH'; check_docker"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Docker not found"* ]]
}
