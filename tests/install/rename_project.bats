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

@test "rename_project: replaces scoped package names in package.json files" {
  mkdir -p "$WORK_DIR/apps/api" "$WORK_DIR/apps/web"
  echo '{"name":"@fullstack-monorepo-app/api"}' > "$WORK_DIR/apps/api/package.json"
  echo '{"name":"@fullstack-monorepo-app/web"}' > "$WORK_DIR/apps/web/package.json"
  echo '{"name":"@fullstack-monorepo/source"}' > "$WORK_DIR/package.json"

  cd "$WORK_DIR" && git init && git add -A && git commit -m "init" --quiet 2>/dev/null

  run bash -c "source '$INSTALL_SH'; INSTALL_DIR='$WORK_DIR'; PROJECT_NAME='my-saas'; rename_project"
  [ "$status" -eq 0 ]

  run cat "$WORK_DIR/apps/api/package.json"
  [[ "$output" == *'"@my-saas/api"'* ]]

  run cat "$WORK_DIR/apps/web/package.json"
  [[ "$output" == *'"@my-saas/web"'* ]]

  run cat "$WORK_DIR/package.json"
  [[ "$output" == *'"@my-saas/source"'* ]]
}

@test "rename_project: replaces DB name with underscores in docker-compose.yml" {
  mkdir -p "$WORK_DIR"
  cat > "$WORK_DIR/docker-compose.yml" <<'YAML'
name: fullstack-monorepo
services:
  postgres:
    environment:
      POSTGRES_DB: fullstack_monorepo_dev
YAML

  cd "$WORK_DIR" && git init && git add -A && git commit -m "init" --quiet 2>/dev/null

  run bash -c "source '$INSTALL_SH'; INSTALL_DIR='$WORK_DIR'; PROJECT_NAME='my-saas'; rename_project"
  [ "$status" -eq 0 ]

  run cat "$WORK_DIR/docker-compose.yml"
  [[ "$output" == *"name: my-saas"* ]]
  [[ "$output" == *"my_saas_dev"* ]]
}

@test "rename_project: skips pnpm-lock.yaml" {
  mkdir -p "$WORK_DIR"
  echo "@fullstack-monorepo-app lockfile content" > "$WORK_DIR/pnpm-lock.yaml"

  cd "$WORK_DIR" && git init && git add -A && git commit -m "init" --quiet 2>/dev/null

  run bash -c "source '$INSTALL_SH'; INSTALL_DIR='$WORK_DIR'; PROJECT_NAME='my-saas'; rename_project"
  [ "$status" -eq 0 ]

  run cat "$WORK_DIR/pnpm-lock.yaml"
  [[ "$output" == *"@fullstack-monorepo-app"* ]]
}

@test "rename_project: replaces in tsconfig.base.json customConditions" {
  mkdir -p "$WORK_DIR"
  echo '{"compilerOptions":{"customConditions":["@fullstack-monorepo/source"]}}' > "$WORK_DIR/tsconfig.base.json"

  cd "$WORK_DIR" && git init && git add -A && git commit -m "init" --quiet 2>/dev/null

  run bash -c "source '$INSTALL_SH'; INSTALL_DIR='$WORK_DIR'; PROJECT_NAME='my-saas'; rename_project"
  [ "$status" -eq 0 ]

  run cat "$WORK_DIR/tsconfig.base.json"
  [[ "$output" == *"@my-saas/source"* ]]
}

@test "rename_project: replaces in .env file" {
  mkdir -p "$WORK_DIR"
  cat > "$WORK_DIR/.env" <<'ENV'
POSTGRES_DB=fullstack_monorepo_dev
DATABASE_URL=postgresql://postgres:password@localhost:5432/fullstack_monorepo_dev
APP_NAME=shadcn-next-app
ENV

  cd "$WORK_DIR" && git init && git add -A && git commit -m "init" --quiet 2>/dev/null

  run bash -c "source '$INSTALL_SH'; INSTALL_DIR='$WORK_DIR'; PROJECT_NAME='my-saas'; rename_project"
  [ "$status" -eq 0 ]

  run cat "$WORK_DIR/.env"
  [[ "$output" == *"my_saas_dev"* ]]
  [[ "$output" != *"fullstack_monorepo_dev"* ]]
  [[ "$output" == *"APP_NAME=my-saas"* ]]
}
