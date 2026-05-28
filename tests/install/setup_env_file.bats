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

@test "setup_env_file: copies .env.example to .env when .env missing" {
  echo "FOO=bar" >"$WORK_DIR/.env.example"

  run bash -c "INSTALL_DIR='$WORK_DIR'; source '$INSTALL_SH'; setup_env_file"
  [ "$status" -eq 0 ]
  [ -f "$WORK_DIR/.env" ]
  run cat "$WORK_DIR/.env"
  [ "$output" = "FOO=bar" ]
}

@test "setup_env_file: leaves existing .env untouched" {
  echo "FOO=bar" >"$WORK_DIR/.env.example"
  echo "EXISTING=1" >"$WORK_DIR/.env"

  run bash -c "INSTALL_DIR='$WORK_DIR'; source '$INSTALL_SH'; setup_env_file"
  [ "$status" -eq 0 ]
  run cat "$WORK_DIR/.env"
  [ "$output" = "EXISTING=1" ]
}

@test "setup_env_file: skips gracefully when .env.example is missing" {
  run bash -c "INSTALL_DIR='$WORK_DIR'; source '$INSTALL_SH'; setup_env_file"
  [ "$status" -eq 0 ]
  [[ "$output" == *".env.example not found"* ]]
  [ ! -f "$WORK_DIR/.env" ]
}

@test "setup_env_file: auto-generates JWT_ACCESS_SECRET" {
  cat > "$WORK_DIR/.env.example" <<'ENV'
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me
AUTH_SECRET=change-me
OTHER=unchanged
ENV

  run bash -c "INSTALL_DIR='$WORK_DIR'; source '$INSTALL_SH'; setup_env_file"
  [ "$status" -eq 0 ]

  run grep "^JWT_ACCESS_SECRET=" "$WORK_DIR/.env"
  [ "$status" -eq 0 ]
  [[ "${output#*=}" != "change-me" ]]
  [ ${#output} -gt 30 ]
}

@test "setup_env_file: auto-generates JWT_REFRESH_SECRET" {
  cat > "$WORK_DIR/.env.example" <<'ENV'
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me
AUTH_SECRET=change-me
ENV

  run bash -c "INSTALL_DIR='$WORK_DIR'; source '$INSTALL_SH'; setup_env_file"
  [ "$status" -eq 0 ]

  run grep "^JWT_REFRESH_SECRET=" "$WORK_DIR/.env"
  [[ "${output#*=}" != "change-me" ]]
}

@test "setup_env_file: auto-generates AUTH_SECRET" {
  cat > "$WORK_DIR/.env.example" <<'ENV'
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me
AUTH_SECRET=change-me
ENV

  run bash -c "INSTALL_DIR='$WORK_DIR'; source '$INSTALL_SH'; setup_env_file"
  [ "$status" -eq 0 ]

  run grep "^AUTH_SECRET=" "$WORK_DIR/.env"
  [[ "${output#*=}" != "change-me" ]]
}

@test "setup_env_file: does not overwrite non-secret values" {
  cat > "$WORK_DIR/.env.example" <<'ENV'
JWT_ACCESS_SECRET=change-me
PORT=8000
NODE_ENV=development
ENV

  run bash -c "INSTALL_DIR='$WORK_DIR'; source '$INSTALL_SH'; setup_env_file"
  [ "$status" -eq 0 ]

  run grep "^PORT=" "$WORK_DIR/.env"
  [[ "$output" == "PORT=8000" ]]

  run grep "^NODE_ENV=" "$WORK_DIR/.env"
  [[ "$output" == "NODE_ENV=development" ]]
}
