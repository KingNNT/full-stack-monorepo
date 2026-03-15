#!/usr/bin/env bats

# =============================================================================
# Integration tests for install.sh
# =============================================================================
# Run with: bun run test:install
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

setup() {
  # Create a temp working directory for each test
  TEST_WORK_DIR="$(mktemp -d)"

  # Create a fake template that mimics the real project structure
  TEMPLATE_DIR="$TEST_WORK_DIR/template"
  mkdir -p "$TEMPLATE_DIR"

  # package.json
  cat > "$TEMPLATE_DIR/package.json" << 'TMPL'
{
  "name": "backend-nestjs-application",
  "version": "0.0.1",
  "description": "",
  "author": "",
  "private": true,
  "license": "UNLICENSED",
  "scripts": {
    "build": "nest build",
    "start:dev": "nest start --watch",
    "prepare": "husky"
  }
}
TMPL

  # docker-compose.yml
  cat > "$TEMPLATE_DIR/docker-compose.yml" << 'TMPL'
name: backend-nestjs-application

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: inviduality_dev

  app:
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/inviduality_dev
TMPL

  # .env.example
  cat > "$TEMPLATE_DIR/.env.example" << 'TMPL'
DATABASE_URL=postgresql://postgres:password@localhost:5432/inviduality_dev
EVENTSTORE_CONNECTION_STRING=esdb://localhost:2113?tls=false
PORT=3000
TMPL

  # Init git so the template looks like a cloned repo
  git -C "$TEMPLATE_DIR" init -q
  git -C "$TEMPLATE_DIR" add .
  git -C "$TEMPLATE_DIR" commit -q -m "template"

  # Create a mock git that copies the template instead of cloning
  MOCK_BIN_DIR="$TEST_WORK_DIR/mock-bin"
  mkdir -p "$MOCK_BIN_DIR"

  cat > "$MOCK_BIN_DIR/git" << MOCK
#!/bin/bash
if [[ "\$1" == "clone" ]]; then
  # Extract the target directory (last argument)
  TARGET="\${@: -1}"
  cp -r "$TEMPLATE_DIR" "\$TARGET"
  exit 0
fi
# For all other git commands, use real git
exec "$(command -v git)" "\$@"
MOCK
  chmod +x "$MOCK_BIN_DIR/git"

  # Create a mock bun that skips bun install
  cat > "$MOCK_BIN_DIR/bun" << 'MOCK'
#!/bin/bash
# No-op for bun install during tests
exit 0
MOCK
  chmod +x "$MOCK_BIN_DIR/bun"

  # Copy install.sh to the working directory
  cp "$PROJECT_ROOT/install.sh" "$TEST_WORK_DIR/install.sh"
  chmod +x "$TEST_WORK_DIR/install.sh"
}

teardown() {
  rm -rf "$TEST_WORK_DIR"
}

# Helper: run install.sh with piped input and mocked git
run_install() {
  local project_name="${1:-my-test-api}"
  local input="$2"

  cd "$TEST_WORK_DIR"
  export PATH="$MOCK_BIN_DIR:$PATH"
  export INSTALL_TESTING=1

  echo "$input" | bash install.sh "$project_name"
}

# =============================================================================
# Tests
# =============================================================================

@test "installs with valid project name and customizes package.json" {
  local input="A test project description
John Doe
john@example.com
Y"

  run_install "my-cool-api" "$input"

  # package.json should have the new project name, description, and author
  run grep '"name": "my-cool-api"' "$TEST_WORK_DIR/my-cool-api/package.json"
  [ "$status" -eq 0 ]

  run grep '"description": "A test project description"' "$TEST_WORK_DIR/my-cool-api/package.json"
  [ "$status" -eq 0 ]

  run grep '"author": "John Doe <john@example.com>"' "$TEST_WORK_DIR/my-cool-api/package.json"
  [ "$status" -eq 0 ]
}

@test "customizes docker-compose.yml with correct project and DB names" {
  local input="My project
Jane Doe
jane@example.com
Y"

  run_install "awesome-api" "$input"

  # docker-compose.yml should have the new project name
  run grep 'name: awesome-api' "$TEST_WORK_DIR/awesome-api/docker-compose.yml"
  [ "$status" -eq 0 ]

  # Database name should be snake_case with _dev suffix
  run grep 'awesome_api_dev' "$TEST_WORK_DIR/awesome-api/docker-compose.yml"
  [ "$status" -eq 0 ]

  # Original template DB name should be gone
  run grep 'inviduality_dev' "$TEST_WORK_DIR/awesome-api/docker-compose.yml"
  [ "$status" -eq 1 ]
}

@test "customizes .env.example with correct DB name" {
  local input="My project
Dev User
dev@test.com
Y"

  run_install "my-api" "$input"

  run grep 'my_api_dev' "$TEST_WORK_DIR/my-api/.env.example"
  [ "$status" -eq 0 ]

  run grep 'inviduality_dev' "$TEST_WORK_DIR/my-api/.env.example"
  [ "$status" -eq 1 ]
}

@test "creates .env from .env.example" {
  local input="My project
Dev User
dev@test.com
Y"

  run_install "my-api" "$input"

  [ -f "$TEST_WORK_DIR/my-api/.env" ]

  # .env should have the customized DB name
  run grep 'my_api_dev' "$TEST_WORK_DIR/my-api/.env"
  [ "$status" -eq 0 ]
}

@test "removes install.sh after installation" {
  local input="My project
Dev User
dev@test.com
Y"

  run_install "my-api" "$input"

  [ ! -f "$TEST_WORK_DIR/my-api/install.sh" ]
}

@test "initializes a new git repository with initial commit" {
  local input="My project
Dev User
dev@test.com
Y"

  run_install "my-api" "$input"

  [ -d "$TEST_WORK_DIR/my-api/.git" ]

  # Should have exactly one commit
  run git -C "$TEST_WORK_DIR/my-api" log --oneline
  [ "$status" -eq 0 ]
  [ "${#lines[@]}" -eq 1 ]
  [[ "${lines[0]}" == *"chore: initial commit from NestJS template"* ]]
}

@test "rejects invalid project name passed as argument" {
  local input=""

  cd "$TEST_WORK_DIR"
  export PATH="$MOCK_BIN_DIR:$PATH"
  export INSTALL_TESTING=1

  run bash install.sh "Invalid-Name"
  [ "$status" -eq 1 ]
}

@test "rejects when target directory already exists" {
  local input="My project
Dev User
dev@test.com
Y"

  # Pre-create the directory
  mkdir -p "$TEST_WORK_DIR/my-api"

  cd "$TEST_WORK_DIR"
  export PATH="$MOCK_BIN_DIR:$PATH"
  export INSTALL_TESTING=1

  run bash install.sh "my-api"
  [ "$status" -eq 1 ]
}

@test "aborts when user declines confirmation" {
  local input="My project
Dev User
dev@test.com
n"

  cd "$TEST_WORK_DIR"
  export PATH="$MOCK_BIN_DIR:$PATH"
  export INSTALL_TESTING=1

  run bash -c "echo '$input' | bash install.sh my-api"
  [ "$status" -eq 0 ]

  # Project directory should not exist
  [ ! -d "$TEST_WORK_DIR/my-api" ]
}

@test "handles single-word project name correctly" {
  local input="Single word project
Dev User
dev@test.com
Y"

  run_install "myapi" "$input"

  run grep '"name": "myapi"' "$TEST_WORK_DIR/myapi/package.json"
  [ "$status" -eq 0 ]

  # snake_case of single word is the same
  run grep 'myapi_dev' "$TEST_WORK_DIR/myapi/docker-compose.yml"
  [ "$status" -eq 0 ]
}
