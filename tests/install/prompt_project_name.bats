#!/usr/bin/env bats

load 'helpers/stubs'

INSTALL_SH="${BATS_TEST_DIRNAME}/../../install.sh"

@test "prompt_project_name: accepts valid kebab-case name" {
  run bash -c "source '$INSTALL_SH'; INPUT_FD=/dev/stdin; prompt_project_name <<< 'my-saas-app' >/dev/null 2>&1; echo \"\$PROJECT_NAME\""
  [ "$status" -eq 0 ]
  [ "${lines[-1]}" = "my-saas-app" ]
}

@test "prompt_project_name: rejects name starting with digit" {
  run bash -c "source '$INSTALL_SH'; INPUT_FD=/dev/stdin; prompt_project_name <<< \$'1bad-name\ngood-name' >/dev/null 2>&1; echo \"\$PROJECT_NAME\""
  [ "$status" -eq 0 ]
  [ "${lines[-1]}" = "good-name" ]
}

@test "prompt_project_name: rejects name with spaces" {
  run bash -c "source '$INSTALL_SH'; INPUT_FD=/dev/stdin; prompt_project_name <<< \$'bad name\ngood-name' >/dev/null 2>&1; echo \"\$PROJECT_NAME\""
  [ "$status" -eq 0 ]
  [ "${lines[-1]}" = "good-name" ]
}

@test "prompt_project_name: rejects uppercase" {
  run bash -c "source '$INSTALL_SH'; INPUT_FD=/dev/stdin; prompt_project_name <<< \$'MyApp\nmy-app' >/dev/null 2>&1; echo \"\$PROJECT_NAME\""
  [ "$status" -eq 0 ]
  [ "${lines[-1]}" = "my-app" ]
}

@test "prompt_project_name: rejects empty input" {
  run bash -c "source '$INSTALL_SH'; INPUT_FD=/dev/stdin; prompt_project_name <<< \$'\nvalid-name' >/dev/null 2>&1; echo \"\$PROJECT_NAME\""
  [ "$status" -eq 0 ]
  [ "${lines[-1]}" = "valid-name" ]
}
