#!/usr/bin/env bats

load 'helpers/stubs'

INSTALL_SH="${BATS_TEST_DIRNAME}/../../install.sh"

setup() {
  setup_stub_dir
  WORK_DIR="$(mktemp -d "${BATS_TMPDIR:-/tmp}/install-work.XXXXXX")"
  export WORK_DIR
  mkdir -p "$WORK_DIR/apps/api" "$WORK_DIR/apps/web"
}

teardown() {
  teardown_stub_dir
  [ -d "${WORK_DIR:-}" ] && rm -rf "$WORK_DIR"
}

@test "setup_env_file: copies each app's .env.example to .env" {
  echo "FOO=api" >"$WORK_DIR/apps/api/.env.example"
  echo "FOO=web" >"$WORK_DIR/apps/web/.env.example"

  run bash -c "INSTALL_DIR='$WORK_DIR'; source '$INSTALL_SH'; setup_env_file"
  [ "$status" -eq 0 ]
  run cat "$WORK_DIR/apps/api/.env"
  [ "$output" = "FOO=api" ]
  run cat "$WORK_DIR/apps/web/.env"
  [ "$output" = "FOO=web" ]
  [ ! -f "$WORK_DIR/.env" ]
}

@test "setup_env_file: leaves an existing app .env untouched" {
  echo "FOO=bar" >"$WORK_DIR/apps/api/.env.example"
  echo "EXISTING=1" >"$WORK_DIR/apps/api/.env"
  echo "FOO=web" >"$WORK_DIR/apps/web/.env.example"

  run bash -c "INSTALL_DIR='$WORK_DIR'; source '$INSTALL_SH'; setup_env_file"
  [ "$status" -eq 0 ]
  run cat "$WORK_DIR/apps/api/.env"
  [ "$output" = "EXISTING=1" ]
  run cat "$WORK_DIR/apps/web/.env"
  [ "$output" = "FOO=web" ]
}

@test "setup_env_file: skips gracefully when an app's .env.example is missing" {
  echo "FOO=web" >"$WORK_DIR/apps/web/.env.example"

  run bash -c "INSTALL_DIR='$WORK_DIR'; source '$INSTALL_SH'; setup_env_file"
  [ "$status" -eq 0 ]
  [[ "$output" == *"apps/api/.env.example not found"* ]]
  [ ! -f "$WORK_DIR/apps/api/.env" ]
  [ -f "$WORK_DIR/apps/web/.env" ]
}

@test "setup_env_file: auto-generates JWT secrets for api" {
  cat > "$WORK_DIR/apps/api/.env.example" <<'ENV'
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me
OTHER=unchanged
ENV

  run bash -c "INSTALL_DIR='$WORK_DIR'; source '$INSTALL_SH'; setup_env_file"
  [ "$status" -eq 0 ]

  run grep "^JWT_ACCESS_SECRET=" "$WORK_DIR/apps/api/.env"
  [ "$status" -eq 0 ]
  [[ "${output#*=}" != "change-me" ]]
  [ ${#output} -gt 30 ]

  run grep "^JWT_REFRESH_SECRET=" "$WORK_DIR/apps/api/.env"
  [[ "${output#*=}" != "change-me" ]]
}

@test "setup_env_file: auto-generates AUTH_SECRET for web" {
  echo "AUTH_SECRET=change-me" >"$WORK_DIR/apps/web/.env.example"

  run bash -c "INSTALL_DIR='$WORK_DIR'; source '$INSTALL_SH'; setup_env_file"
  [ "$status" -eq 0 ]

  run grep "^AUTH_SECRET=" "$WORK_DIR/apps/web/.env"
  [[ "${output#*=}" != "change-me" ]]
}

@test "setup_env_file: does not overwrite non-secret values" {
  cat > "$WORK_DIR/apps/api/.env.example" <<'ENV'
JWT_ACCESS_SECRET=change-me
API_PORT=8000
NODE_ENV=development
ENV

  run bash -c "INSTALL_DIR='$WORK_DIR'; source '$INSTALL_SH'; setup_env_file"
  [ "$status" -eq 0 ]

  run grep "^API_PORT=" "$WORK_DIR/apps/api/.env"
  [[ "$output" == "API_PORT=8000" ]]

  run grep "^NODE_ENV=" "$WORK_DIR/apps/api/.env"
  [[ "$output" == "NODE_ENV=development" ]]
}
