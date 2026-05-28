#!/usr/bin/env bats

load 'helpers/stubs'

INSTALL_SH="${BATS_TEST_DIRNAME}/../../install.sh"

setup() {
  setup_stub_dir
  WORK_ROOT="$(mktemp -d "${BATS_TMPDIR:-/tmp}/install-clone.XXXXXX")"
  export WORK_ROOT
  export TARGET="$WORK_ROOT/repo"
}

teardown() {
  teardown_stub_dir
  [ -d "${WORK_ROOT:-}" ] && rm -rf "$WORK_ROOT"
}

@test "clone_repo: dies when target directory already exists" {
  mkdir -p "$TARGET"
  run bash -c "INSTALL_DIR='$TARGET'; BRANCH=develop; USE_HTTPS=0; source '$INSTALL_SH'; clone_repo"
  [ "$status" -ne 0 ]
  [[ "$output" == *"Target directory already exists"* ]]
}

@test "clone_repo: uses HTTPS directly when USE_HTTPS=1" {
  # git stub succeeds and creates the target dir so the 'if' branch resolves.
  stub git 'mkdir -p "$5" && exit 0'

  run bash -c "INSTALL_DIR='$TARGET'; BRANCH=develop; USE_HTTPS=1; source '$INSTALL_SH'; clone_repo"
  [ "$status" -eq 0 ]

  # Verify git was called with the HTTPS URL and not the SSH URL.
  local calls
  calls="$(cat "$STUB_DIR/git.calls")"
  [[ "$calls" == *"https://github.com/KingNNT/full-stack-monorepo.git"* ]]
  [[ "$calls" != *"git@github.com"* ]]
}

@test "clone_repo: falls back to HTTPS after SSH clone fails" {
  # First call (SSH) fails; second call (HTTPS) succeeds.
  stub git '
count_file="$STUB_DIR/git.count"
n=$(cat "$count_file" 2>/dev/null || echo 0)
n=$((n + 1))
echo "$n" > "$count_file"
if [ "$n" -eq 1 ]; then
  exit 128
fi
mkdir -p "$5"
exit 0
'

  run bash -c "INSTALL_DIR='$TARGET'; BRANCH=develop; USE_HTTPS=0; source '$INSTALL_SH'; clone_repo"
  [ "$status" -eq 0 ]
  [[ "$output" == *"SSH clone failed"* ]]
  [[ "$output" == *"Falling back to HTTPS"* ]]

  # Two git invocations: one SSH attempt, one HTTPS fallback.
  [ "$(call_count git)" -eq 2 ]
  local calls
  calls="$(cat "$STUB_DIR/git.calls")"
  [[ "$calls" == *"git@github.com:KingNNT/full-stack-monorepo.git"* ]]
  [[ "$calls" == *"https://github.com/KingNNT/full-stack-monorepo.git"* ]]
}

@test "clone_repo: propagates failure when both SSH and HTTPS fail" {
  stub git 'exit 128'

  run bash -c "INSTALL_DIR='$TARGET'; BRANCH=develop; USE_HTTPS=0; source '$INSTALL_SH'; clone_repo"
  [ "$status" -ne 0 ]
}
