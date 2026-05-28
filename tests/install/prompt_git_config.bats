#!/usr/bin/env bats

load 'helpers/stubs'

INSTALL_SH="${BATS_TEST_DIRNAME}/../../install.sh"

@test "prompt_git_config: accepts valid name and email" {
  run bash -c "source '$INSTALL_SH'; INPUT_FD=/dev/stdin; prompt_git_config <<< $'John Doe\njohn@example.com' >/dev/null 2>&1; echo \"\${GIT_USER_NAME}|\${GIT_USER_EMAIL}\""
  [ "$status" -eq 0 ]
  [ "${lines[-1]}" = "John Doe|john@example.com" ]
}

@test "prompt_git_config: re-prompts on empty name" {
  run bash -c "source '$INSTALL_SH'; INPUT_FD=/dev/stdin; prompt_git_config <<< $'\nJane Doe\njane@example.com' >/dev/null 2>&1; echo \"\${GIT_USER_NAME}|\${GIT_USER_EMAIL}\""
  [ "$status" -eq 0 ]
  [ "${lines[-1]}" = "Jane Doe|jane@example.com" ]
}

@test "prompt_git_config: re-prompts on empty email" {
  run bash -c "source '$INSTALL_SH'; INPUT_FD=/dev/stdin; prompt_git_config <<< $'Jane Doe\n\njane@example.com' >/dev/null 2>&1; echo \"\${GIT_USER_NAME}|\${GIT_USER_EMAIL}\""
  [ "$status" -eq 0 ]
  [ "${lines[-1]}" = "Jane Doe|jane@example.com" ]
}
