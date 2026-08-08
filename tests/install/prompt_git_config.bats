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

@test "prompt_git_config: uses both values from environment without prompting" {
  run bash -c "source '$INSTALL_SH'; export GIT_USER_NAME='Env User' GIT_USER_EMAIL='env@example.com'; INPUT_FD=/dev/null; prompt_git_config >/dev/null 2>&1; echo \"\${GIT_USER_NAME}|\${GIT_USER_EMAIL}\""
  [ "$status" -eq 0 ]
  [ "${lines[-1]}" = "Env User|env@example.com" ]
}

@test "prompt_git_config: prompts only for the value missing from the environment" {
  run bash -c "source '$INSTALL_SH'; export GIT_USER_NAME='Env User'; INPUT_FD=/dev/stdin; prompt_git_config <<< 'typed@example.com' >/dev/null 2>&1; echo \"\${GIT_USER_NAME}|\${GIT_USER_EMAIL}\""
  [ "$status" -eq 0 ]
  [ "${lines[-1]}" = "Env User|typed@example.com" ]
}

@test "prompt_git_config: dies on empty GIT_USER_NAME" {
  run bash -c "source '$INSTALL_SH'; export GIT_USER_NAME='' GIT_USER_EMAIL='env@example.com'; INPUT_FD=/dev/stdin; prompt_git_config <<< 'Someone'"
  [ "$status" -ne 0 ]
  [[ "$output" == *"GIT_USER_NAME"* ]]
}

@test "prompt_git_config: dies on empty GIT_USER_EMAIL" {
  run bash -c "source '$INSTALL_SH'; export GIT_USER_NAME='Env User' GIT_USER_EMAIL=''; INPUT_FD=/dev/stdin; prompt_git_config <<< 'someone@example.com'"
  [ "$status" -ne 0 ]
  [[ "$output" == *"GIT_USER_EMAIL"* ]]
}

@test "prompt_git_config: dies with guidance when no env vars and no TTY" {
  run bash -c "source '$INSTALL_SH'; INPUT_FD=/nonexistent/tty; prompt_git_config"
  [ "$status" -ne 0 ]
  [[ "$output" == *"GIT_USER_NAME"* ]]
}
