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

@test "prompt_project_name: uses PROJECT_NAME from environment without prompting" {
  run bash -c "source '$INSTALL_SH'; export PROJECT_NAME='env-app'; INPUT_FD=/dev/null; prompt_project_name 2>&1; echo \"\$PROJECT_NAME\""
  [ "$status" -eq 0 ]
  [ "${lines[-1]}" = "env-app" ]
  [[ "$output" != *"Enter project name"* ]]
}

@test "prompt_project_name: environment value wins over stdin" {
  run bash -c "source '$INSTALL_SH'; export PROJECT_NAME='env-app'; INPUT_FD=/dev/stdin; prompt_project_name <<< 'stdin-app' >/dev/null 2>&1; echo \"\$PROJECT_NAME\""
  [ "$status" -eq 0 ]
  [ "${lines[-1]}" = "env-app" ]
}

@test "prompt_project_name: dies on invalid PROJECT_NAME instead of re-prompting" {
  run bash -c "source '$INSTALL_SH'; export PROJECT_NAME='Bad Name'; INPUT_FD=/dev/stdin; prompt_project_name <<< 'good-name'"
  [ "$status" -ne 0 ]
  [[ "$output" == *"PROJECT_NAME"* ]]
}

@test "prompt_project_name: dies on empty PROJECT_NAME" {
  run bash -c "source '$INSTALL_SH'; export PROJECT_NAME=''; INPUT_FD=/dev/stdin; prompt_project_name <<< 'good-name'"
  [ "$status" -ne 0 ]
  [[ "$output" == *"PROJECT_NAME"* ]]
}

@test "prompt_project_name: dies with guidance when no env var and no TTY" {
  run bash -c "source '$INSTALL_SH'; INPUT_FD=/nonexistent/tty; prompt_project_name"
  [ "$status" -ne 0 ]
  [[ "$output" == *"PROJECT_NAME"* ]]
  [[ "$output" == *"GIT_USER_EMAIL"* ]]
}
