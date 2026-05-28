#!/usr/bin/env bats

load 'helpers/stubs'

INSTALL_SH="${BATS_TEST_DIRNAME}/../../install.sh"

setup() {
  setup_stub_dir
  WORK_DIR="$(mktemp -d "${BATS_TMPDIR:-/tmp}/install-work.XXXXXX")"
  export WORK_DIR
  # Simulate a cloned repo with existing .git
  mkdir -p "$WORK_DIR/.git"
  echo "old-history" > "$WORK_DIR/.git/HEAD"
  echo "hello" > "$WORK_DIR/hello.txt"
}

teardown() {
  teardown_stub_dir
  [ -d "${WORK_DIR:-}" ] && rm -rf "$WORK_DIR"
}

@test "git_init_fresh: removes old .git and creates new repo" {
  run bash -c "source '$INSTALL_SH'; INSTALL_DIR='$WORK_DIR'; GIT_USER_NAME='Test User'; GIT_USER_EMAIL='test@test.com'; PROJECT_NAME='test-project'; git_init_fresh"
  [ "$status" -eq 0 ]

  # New .git exists (is a directory)
  [ -d "$WORK_DIR/.git" ]
}

@test "git_init_fresh: sets local user.name and user.email" {
  run bash -c "source '$INSTALL_SH'; INSTALL_DIR='$WORK_DIR'; GIT_USER_NAME='Jane Doe'; GIT_USER_EMAIL='jane@example.com'; PROJECT_NAME='test-project'; git_init_fresh"
  [ "$status" -eq 0 ]

  run git -C "$WORK_DIR" config user.name
  [ "$output" = "Jane Doe" ]

  run git -C "$WORK_DIR" config user.email
  [ "$output" = "jane@example.com" ]
}

@test "git_init_fresh: creates initial commit" {
  run bash -c "source '$INSTALL_SH'; INSTALL_DIR='$WORK_DIR'; GIT_USER_NAME='Test'; GIT_USER_EMAIL='test@test.com'; PROJECT_NAME='test-project'; git_init_fresh"
  [ "$status" -eq 0 ]

  run git -C "$WORK_DIR" log --oneline
  [[ "$output" == *"feat: initialize"* ]]
}

@test "git_init_fresh: all files are tracked" {
  run bash -c "source '$INSTALL_SH'; INSTALL_DIR='$WORK_DIR'; GIT_USER_NAME='Test'; GIT_USER_EMAIL='test@test.com'; PROJECT_NAME='test-project'; git_init_fresh"
  [ "$status" -eq 0 ]

  run git -C "$WORK_DIR" status --porcelain
  [ "$output" = "" ]
}
