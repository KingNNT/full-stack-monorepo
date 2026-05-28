# Interactive Install Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform `install.sh` into an interactive scaffolding tool that clones the template into the current directory, prompts for project name + git identity, renames packages, auto-generates secrets, and creates a fresh git repo.

**Architecture:** Clone → in-place search-replace across text files → generate .env with secrets → git init. Single bash script, no external dependencies beyond git/node/pnpm.

**Tech Stack:** Bash 4+, bats for testing, `openssl` for secret generation, `git ls-files` for targeting non-binary files.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `install.sh` | Modify | Add interactive prompts, search-replace, git reset |
| `tests/install/prompt_project_name.bats` | Create | Tests for project name prompt + validation |
| `tests/install/prompt_git_config.bats` | Create | Tests for git name/email prompts |
| `tests/install/rename_project.bats` | Create | Tests for search-replace logic |
| `tests/install/generate_secrets.bats` | Create | Tests for secret generation in .env |
| `tests/install/git_init_fresh.bats` | Create | Tests for git reset + initial commit |
| `tests/install/install_dir.bats` | Create | Tests for current-dir install behavior |

---

## Replacement Targets

These are the exact strings that appear across the codebase and need replacing:

| Pattern | File(s) |
|---------|---------|
| `@fullstack-monorepo-app/` | `apps/api/package.json`, `apps/web/package.json` |
| `@fullstack-monorepo/` | `package.json`, `tsconfig.base.json` |
| `fullstack-monorepo` (literal) | `docker-compose.yml` (line 1: `name:`) |
| `fullstack_monorepo_dev` | `docker-compose.yml` (lines 9, 25), `.env.example` |

No `.ts`/`.tsx` files reference these strings — only config files.

---

### Task 1: Add `prompt_project_name` function

**Files:**
- Modify: `install.sh` (new function in Helpers section, after `has()`)
- Create: `tests/install/prompt_project_name.bats`

- [ ] **Step 1: Write the test file**

```bash
#!/usr/bin/env bats

load 'helpers/stubs'

INSTALL_SH="${BATS_TEST_DIRNAME}/../../install.sh"

setup() {
  setup_stub_dir
}

teardown() {
  teardown_stub_dir
}

@test "prompt_project_name: accepts valid kebab-case name" {
  stub read 'echo "my-saas-app"'
  run bash -c "source '$INSTALL_SH'; prompt_project_name; echo \"\$PROJECT_NAME\""
  [ "$status" -eq 0 ]
  [ "${lines[-1]}" = "my-saas-app" ]
}

@test "prompt_project_name: rejects name starting with digit" {
  # First read returns invalid, second returns valid
  cat > "$STUB_DIR/read" <<'SCRIPT'
#!/bin/bash
if [ ! -f "$STUB_DIR/read.calls" ]; then
  echo "1bad-name"
else
  echo "good-name"
fi
echo "$@" >> "$STUB_DIR/read.calls"
SCRIPT
  chmod +x "$STUB_DIR/read"

  run bash -c "source '$INSTALL_SH'; prompt_project_name; echo \"\$PROJECT_NAME\""
  [ "$status" -eq 0 ]
  [ "${lines[-1]}" = "good-name" ]
}

@test "prompt_project_name: rejects name with spaces" {
  cat > "$STUB_DIR/read" <<'SCRIPT'
#!/bin/bash
COUNT=$(wc -l < "$STUB_DIR/read.calls" 2>/dev/null || echo 0)
COUNT=$((COUNT + 1))
echo "$@" >> "$STUB_DIR/read.calls"
case "$COUNT" in
  1) echo "bad name" ;;
  2) echo "good-name" ;;
esac
SCRIPT
  chmod +x "$STUB_DIR/read"

  run bash -c "source '$INSTALL_SH'; prompt_project_name; echo \"\$PROJECT_NAME\""
  [ "$status" -eq 0 ]
  [ "${lines[-1]}" = "good-name" ]
}

@test "prompt_project_name: rejects uppercase" {
  cat > "$STUB_DIR/read" <<'SCRIPT'
#!/bin/bash
COUNT=$(wc -l < "$STUB_DIR/read.calls" 2>/dev/null || echo 0)
COUNT=$((COUNT + 1))
echo "$@" >> "$STUB_DIR/read.calls"
case "$COUNT" in
  1) echo "MyApp" ;;
  2) echo "my-app" ;;
esac
SCRIPT
  chmod +x "$STUB_DIR/read"

  run bash -c "source '$INSTALL_SH'; prompt_project_name; echo \"\$PROJECT_NAME\""
  [ "$status" -eq 0 ]
  [ "${lines[-1]}" = "my-app" ]
}

@test "prompt_project_name: rejects empty input" {
  cat > "$STUB_DIR/read" <<'SCRIPT'
#!/bin/bash
COUNT=$(wc -l < "$STUB_DIR/read.calls" 2>/dev/null || echo 0)
COUNT=$((COUNT + 1))
echo "$@" >> "$STUB_DIR/read.calls"
case "$COUNT" in
  1) echo "" ;;
  2) echo "valid-name" ;;
esac
SCRIPT
  chmod +x "$STUB_DIR/read"

  run bash -c "source '$INSTALL_SH'; prompt_project_name; echo \"\$PROJECT_NAME\""
  [ "$status" -eq 0 ]
  [ "${lines[-1]}" = "valid-name" ]
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx bats tests/install/prompt_project_name.bats`
Expected: FAIL (function `prompt_project_name` not defined)

- [ ] **Step 3: Implement `prompt_project_name` in `install.sh`**

Add after the `has()` function (after line 33):

```bash
prompt_project_name() {
  while true; do
    printf "==> Enter project name (kebab-case, e.g. my-saas-app): "
    local name
    read -r name
    if [[ "$name" =~ ^[a-z][a-z0-9-]*$ ]]; then
      PROJECT_NAME="$name"
      return 0
    fi
    warn "'$name' is not valid. Use lowercase letters, digits, and dashes. Must start with a letter."
  done
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx bats tests/install/prompt_project_name.bats`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add install.sh tests/install/prompt_project_name.bats
git commit -m "feat(install): add prompt_project_name with validation"
```

---

### Task 2: Add `prompt_git_config` function

**Files:**
- Modify: `install.sh` (new function after `prompt_project_name`)
- Create: `tests/install/prompt_git_config.bats`

- [ ] **Step 1: Write the test file**

```bash
#!/usr/bin/env bats

load 'helpers/stubs'

INSTALL_SH="${BATS_TEST_DIRNAME}/../../install.sh"

setup() {
  setup_stub_dir
}

teardown() {
  teardown_stub_dir
}

@test "prompt_git_config: accepts valid name and email" {
  cat > "$STUB_DIR/read" <<'SCRIPT'
#!/bin/bash
COUNT=$(wc -l < "$STUB_DIR/read.calls" 2>/dev/null || echo 0)
COUNT=$((COUNT + 1))
echo "$@" >> "$STUB_DIR/read.calls"
case "$COUNT" in
  1) echo "John Doe" ;;
  2) echo "john@example.com" ;;
esac
SCRIPT
  chmod +x "$STUB_DIR/read"

  run bash -c "source '$INSTALL_SH'; prompt_git_config; echo \"\$GIT_USER_NAME\"; echo \"\$GIT_USER_EMAIL\""
  [ "$status" -eq 0 ]
  [ "${lines[-2]}" = "John Doe" ]
  [ "${lines[-1]}" = "john@example.com" ]
}

@test "prompt_git_config: re-prompts on empty name" {
  cat > "$STUB_DIR/read" <<'SCRIPT'
#!/bin/bash
COUNT=$(wc -l < "$STUB_DIR/read.calls" 2>/dev/null || echo 0)
COUNT=$((COUNT + 1))
echo "$@" >> "$STUB_DIR/read.calls"
case "$COUNT" in
  1) echo "" ;;
  2) echo "Jane Doe" ;;
  3) echo "jane@example.com" ;;
esac
SCRIPT
  chmod +x "$STUB_DIR/read"

  run bash -c "source '$INSTALL_SH'; prompt_git_config; echo \"\$GIT_USER_NAME\"; echo \"\$GIT_USER_EMAIL\""
  [ "$status" -eq 0 ]
  [ "${lines[-2]}" = "Jane Doe" ]
  [ "${lines[-1]}" = "jane@example.com" ]
}

@test "prompt_git_config: re-prompts on empty email" {
  cat > "$STUB_DIR/read" <<'SCRIPT'
#!/bin/bash
COUNT=$(wc -l < "$STUB_DIR/read.calls" 2>/dev/null || echo 0)
COUNT=$((COUNT + 1))
echo "$@" >> "$STUB_DIR/read.calls"
case "$COUNT" in
  1) echo "Jane Doe" ;;
  2) echo "" ;;
  3) echo "jane@example.com" ;;
esac
SCRIPT
  chmod +x "$STUB_DIR/read"

  run bash -c "source '$INSTALL_SH'; prompt_git_config; echo \"\$GIT_USER_NAME\"; echo \"\$GIT_USER_EMAIL\""
  [ "$status" -eq 0 ]
  [ "${lines[-2]}" = "Jane Doe" ]
  [ "${lines[-1]}" = "jane@example.com" ]
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx bats tests/install/prompt_git_config.bats`
Expected: FAIL (function `prompt_git_config` not defined)

- [ ] **Step 3: Implement `prompt_git_config` in `install.sh`**

Add after `prompt_project_name`:

```bash
prompt_git_config() {
  while true; do
    printf "==> Enter your name (for git config, e.g. John Doe): "
    local name
    read -r name
    if [ -n "$name" ]; then
      GIT_USER_NAME="$name"
      break
    fi
    warn "Name cannot be empty."
  done

  while true; do
    printf "==> Enter your email (for git config, e.g. john@example.com): "
    local email
    read -r email
    if [ -n "$email" ]; then
      GIT_USER_EMAIL="$email"
      break
    fi
    warn "Email cannot be empty."
  done
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx bats tests/install/prompt_git_config.bats`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add install.sh tests/install/prompt_git_config.bats
git commit -m "feat(install): add prompt_git_config for name and email"
```

---

### Task 3: Add `rename_project` function (search-replace)

**Files:**
- Modify: `install.sh` (new function after `prompt_git_config`)
- Create: `tests/install/rename_project.bats`

- [ ] **Step 1: Write the test file**

```bash
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

@test "rename_project: replaces scoped package names in package.json" {
  mkdir -p "$WORK_DIR/apps/api" "$WORK_DIR/apps/web"
  echo '{"name":"@fullstack-monorepo-app/api"}' > "$WORK_DIR/apps/api/package.json"
  echo '{"name":"@fullstack-monorepo-app/web"}' > "$WORK_DIR/apps/web/package.json"
  echo '{"name":"@fullstack-monorepo/source"}' > "$WORK_DIR/package.json"

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

  run bash -c "source '$INSTALL_SH'; INSTALL_DIR='$WORK_DIR'; PROJECT_NAME='my-saas'; rename_project"
  [ "$status" -eq 0 ]

  run cat "$WORK_DIR/docker-compose.yml"
  [[ "$output" == *"name: my-saas"* ]]
  [[ "$output" == *"my_saas_dev"* ]]
}

@test "rename_project: skips pnpm-lock.yaml" {
  mkdir -p "$WORK_DIR"
  echo "fullstack-monorepo-app" > "$WORK_DIR/pnpm-lock.yaml"

  run bash -c "source '$INSTALL_SH'; INSTALL_DIR='$WORK_DIR'; PROJECT_NAME='my-saas'; rename_project"
  [ "$status" -eq 0 ]

  run cat "$WORK_DIR/pnpm-lock.yaml"
  [[ "$output" == *"fullstack-monorepo-app"* ]]
}

@test "rename_project: replaces in tsconfig.base.json customConditions" {
  mkdir -p "$WORK_DIR"
  echo '{"compilerOptions":{"customConditions":["@fullstack-monorepo/source"]}}' > "$WORK_DIR/tsconfig.base.json"

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

  run bash -c "source '$INSTALL_SH'; INSTALL_DIR='$WORK_DIR'; PROJECT_NAME='my-saas'; rename_project"
  [ "$status" -eq 0 ]

  run cat "$WORK_DIR/.env"
  [[ "$output" == *"my_saas_dev"* ]]
  [[ "$output" != *"fullstack_monorepo_dev"* ]]
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx bats tests/install/rename_project.bats`
Expected: FAIL (function `rename_project` not defined)

- [ ] **Step 3: Implement `rename_project` in `install.sh`**

Add after `prompt_git_config`:

```bash
rename_project() {
  log "Renaming project to $PROJECT_NAME..."

  local name_us
  name_us="${PROJECT_NAME//-/_}"

  # Build a find command that skips binary/blob dirs and lockfiles.
  # We use git ls-files when available (post-clone) for accuracy,
  # otherwise fall back to find with grep exclusion.
  local files
  if [ -d "$INSTALL_DIR/.git" ]; then
    files="$(cd "$INSTALL_DIR" && git ls-files)"
  else
    files="$(cd "$INSTALL_DIR" && find . -type f \
      ! -path './.git/*' \
      ! -path './node_modules/*' \
      ! -path './.nx/*' \
      ! -name 'pnpm-lock.yaml' \
      ! -name '*.png' ! -name '*.jpg' ! -name '*.jpeg' ! -name '*.gif' ! -name '*.ico' ! -name '*.woff2' ! -name '*.woff' ! -name '*.ttf' ! -name '*.eot' \
      | sed 's|^\./||')"
  fi

  local file
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    local filepath="$INSTALL_DIR/$file"

    # Skip binary files by checking for null bytes
    if grep -qIl '.' "$filepath" 2>/dev/null; then
      # Order matters: more specific patterns first
      sed -i.bak \
        -e "s|@fullstack-monorepo-app/|@${PROJECT_NAME}/|g" \
        -e "s|@fullstack-monorepo/|@${PROJECT_NAME}/|g" \
        -e "s|fullstack_monorepo_dev|${name_us}_dev|g" \
        -e "s|fullstack-monorepo|${PROJECT_NAME}|g" \
        "$filepath"
      rm -f "${filepath}.bak"
    fi
  done <<< "$files"

  # Also update APP_NAME in .env
  local env_file="$INSTALL_DIR/.env"
  if [ -f "$env_file" ]; then
    sed -i.bak "s|APP_NAME=.*|APP_NAME=${PROJECT_NAME}|" "$env_file"
    rm -f "${env_file}.bak"
  fi

  log "Project renamed to $PROJECT_NAME"
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx bats tests/install/rename_project.bats`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add install.sh tests/install/rename_project.bats
git commit -m "feat(install): add rename_project for search-replace scaffolding"
```

---

### Task 4: Rewrite `setup_env_file` to auto-generate secrets

**Files:**
- Modify: `install.sh` (replace existing `setup_env_file`)
- Modify: `tests/install/setup_env_file.bats` (add secret generation tests)

- [ ] **Step 1: Update the test file**

Replace the entire contents of `tests/install/setup_env_file.bats` with:

```bash
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx bats tests/install/setup_env_file.bats`
Expected: Some tests FAIL (secrets not auto-generated)

- [ ] **Step 3: Rewrite `setup_env_file` in `install.sh`**

Replace the existing `setup_env_file` function (lines 141-158) with:

```bash
setup_env_file() {
  log "Setting up .env..."
  local src="$INSTALL_DIR/.env.example"
  local dst="$INSTALL_DIR/.env"

  if [ ! -f "$src" ]; then
    warn ".env.example not found at $src — skipping"
    return 0
  fi
  if [ -f "$dst" ]; then
    warn ".env already exists — leaving it alone"
    return 0
  fi

  cp "$src" "$dst"

  # Auto-generate secrets
  local secret
  for var in JWT_ACCESS_SECRET JWT_REFRESH_SECRET AUTH_SECRET; do
    secret="$(openssl rand -base64 48 | tr -d '\n')"
    sed -i.bak "s|^${var}=.*|${var}=${secret}|" "$dst"
    rm -f "${dst}.bak"
  done

  log "Created $dst with auto-generated secrets"
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx bats tests/install/setup_env_file.bats`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add install.sh tests/install/setup_env_file.bats
git commit -m "feat(install): auto-generate secrets in .env during setup"
```

---

### Task 5: Add `git_init_fresh` function

**Files:**
- Modify: `install.sh` (new function after `rename_project`)
- Create: `tests/install/git_init_fresh.bats`

- [ ] **Step 1: Write the test file**

```bash
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
  run bash -c "source '$INSTALL_SH'; INSTALL_DIR='$WORK_DIR'; GIT_USER_NAME='Test User'; GIT_USER_EMAIL='test@test.com'; git_init_fresh"
  [ "$status" -eq 0 ]

  # New .git exists (is a directory)
  [ -d "$WORK_DIR/.git" ]
  # Old content is gone
  [ ! -f "$WORK_DIR/.git/HEAD" ] || [ "$(cat "$WORK_DIR/.git/HEAD")" != "old-history" ]
}

@test "git_init_fresh: sets local user.name and user.email" {
  run bash -c "source '$INSTALL_SH'; INSTALL_DIR='$WORK_DIR'; GIT_USER_NAME='Jane Doe'; GIT_USER_EMAIL='jane@example.com'; git_init_fresh"
  [ "$status" -eq 0 ]

  run git -C "$WORK_DIR" config user.name
  [ "$output" = "Jane Doe" ]

  run git -C "$WORK_DIR" config user.email
  [ "$output" = "jane@example.com" ]
}

@test "git_init_fresh: creates initial commit" {
  run bash -c "source '$INSTALL_SH'; INSTALL_DIR='$WORK_DIR'; GIT_USER_NAME='Test'; GIT_USER_EMAIL='test@test.com'; git_init_fresh"
  [ "$status" -eq 0 ]

  run git -C "$WORK_DIR" log --oneline
  [[ "$output" == *"Initial commit from template"* ]]
}

@test "git_init_fresh: all files are tracked" {
  run bash -c "source '$INSTALL_SH'; INSTALL_DIR='$WORK_DIR'; GIT_USER_NAME='Test'; GIT_USER_EMAIL='test@test.com'; git_init_fresh"
  [ "$status" -eq 0 ]

  run git -C "$WORK_DIR" status --porcelain
  [ "$output" = "" ]
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx bats tests/install/git_init_fresh.bats`
Expected: FAIL (function `git_init_fresh` not defined)

- [ ] **Step 3: Implement `git_init_fresh` in `install.sh`**

Add after `rename_project`:

```bash
git_init_fresh() {
  log "Initializing fresh git repository..."
  rm -rf "$INSTALL_DIR/.git"
  git init "$INSTALL_DIR"
  git -C "$INSTALL_DIR" config user.name "$GIT_USER_NAME"
  git -C "$INSTALL_DIR" config user.email "$GIT_USER_EMAIL"
  git -C "$INSTALL_DIR" add -A
  git -C "$INSTALL_DIR" commit -m "Initial commit from template"
  log "Git repository initialized with clean history"
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx bats tests/install/git_init_fresh.bats`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add install.sh tests/install/git_init_fresh.bats
git commit -m "feat(install): add git_init_fresh for clean repo setup"
```

---

### Task 6: Update `clone_repo` to install into current directory

**Files:**
- Modify: `install.sh` (update `clone_repo` and config section)
- Create: `tests/install/install_dir.bats`

- [ ] **Step 1: Write the test file**

```bash
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

@test "INSTALL_DIR defaults to ./<project-name> in current directory" {
  stub git 'exit 0'
  run bash -c "cd '$WORK_DIR'; source '$INSTALL_SH'; PROJECT_NAME='my-app'; clone_repo"
  [ "$status" -eq 0 ]
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx bats tests/install/install_dir.bats`
Expected: FAIL (clone_repo still uses old `$HOME/...` path)

- [ ] **Step 3: Update `install.sh` config section**

Remove the old `INSTALL_DIR` default and update `clone_repo`. In the Config section, change:

```bash
INSTALL_DIR="${INSTALL_DIR:-$HOME/nestjs-nextjs-monorepo}"
```

to:

```bash
# INSTALL_DIR is set dynamically after prompt_project_name runs.
# It defaults to ./<PROJECT_NAME> relative to the working directory.
INSTALL_DIR="${INSTALL_DIR:-}"
```

Update `clone_repo` to use `INSTALL_DIR` which is now set to `./<PROJECT_NAME>` in `main()`. The function itself stays the same — the change is in how `INSTALL_DIR` gets its value.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx bats tests/install/install_dir.bats`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add install.sh tests/install/install_dir.bats
git commit -m "feat(install): install into current directory as ./<project-name>"
```

---

### Task 7: Wire up `main()` with the new interactive flow

**Files:**
- Modify: `install.sh` (rewrite `main()`)

- [ ] **Step 1: Rewrite `main()` function**

Replace the existing `main()` function with:

```bash
main() {
  log "nestjs-nextjs-monorepo project scaffolder"
  detect_os
  log "OS: $OS"
  ensure_git
  ensure_node
  ensure_pnpm
  check_docker

  # Interactive prompts
  prompt_project_name
  prompt_git_config

  # Set install directory to ./<project-name> in current working directory
  INSTALL_DIR="$(pwd)/${PROJECT_NAME}"

  # Validate target directory
  if [ -e "$INSTALL_DIR" ]; then
    die "Target directory already exists: $INSTALL_DIR
Remove it or choose a different project name, then re-run."
  fi

  clone_repo
  rename_project
  setup_env_file
  git_init_fresh
  install_deps
  print_next_steps
}
```

- [ ] **Step 2: Update `print_next_steps` to use project name**

Replace the existing `print_next_steps` function with:

```bash
print_next_steps() {
  cat <<EOF

==> Done! Your project '$PROJECT_NAME' is ready.

  cd $INSTALL_DIR

  # Start the full stack with Docker (recommended):
  make up
  make db-migrate
  make db-seed

  # Or run locally without Docker:
  pnpm dev

  App:  http://localhost:3000
  API:  http://localhost:8000

  Git config set locally:
    user.name:  $GIT_USER_NAME
    user.email: $GIT_USER_EMAIL

  To push to your own remote:
    git remote set-url origin <your-repo-url>
    git push -u origin main

EOF
}
```

- [ ] **Step 3: Remove the old `BRANCH`, `USE_HTTPS`, `REPO_SSH`, `REPO_HTTPS` constants if no longer needed, or keep them for clone_repo**

The `clone_repo` function still uses `BRANCH`, `USE_HTTPS`, `REPO_SSH`, `REPO_HTTPS` — keep those constants. But remove `INSTALL_DIR` from the Config section since it's now set dynamically in `main()`.

Also update the header comment (lines 1-11) to reflect the new interactive behavior:

```bash
#!/usr/bin/env bash
#
# Interactive project scaffolding tool for KingNNT/nestjs-nextjs-monorepo.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/KingNNT/nestjs-nextjs-monorepo/develop/install.sh | bash
#
# The script will prompt for:
#   1. Project name (kebab-case) — used for directory name, package names, DB name
#   2. Your name — for local git config
#   3. Your email — for local git config
#
# Env vars:
#   BRANCH        Branch to check out (default: develop)
#   USE_HTTPS     Set to 1 to force HTTPS clone (default: try SSH then HTTPS)
```

- [ ] **Step 4: Run all install tests**

Run: `npx bats tests/install/`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add install.sh
git commit -m "feat(install): wire up interactive main flow with prompts and rename"
```

---

### Task 8: Run full test suite and fix `clone_repo.bats`

**Files:**
- Modify: `tests/install/clone_repo.bats` (update for new `INSTALL_DIR` behavior)

The existing `clone_repo.bats` tests set `INSTALL_DIR` explicitly, so they should still work. But verify and fix any issues.

- [ ] **Step 1: Run all tests**

Run: `npx bats tests/install/`
Expected: All tests PASS

- [ ] **Step 2: Fix any failing tests**

If `clone_repo.bats` fails because `INSTALL_DIR` is no longer defaulting to `$HOME/...`, update the test to pass `INSTALL_DIR` explicitly (which the tests already do).

- [ ] **Step 3: Commit any fixes**

```bash
git add tests/install/clone_repo.bats
git commit -m "test(install): update clone_repo tests for new INSTALL_DIR behavior"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All design requirements have corresponding tasks (prompts, validation, search-replace, secret generation, git reset, current-dir install)
- [x] **Placeholder scan:** No TBD/TODO/fill-in-later — all steps have complete code
- [x] **Type consistency:** Variable names consistent across tasks (`PROJECT_NAME`, `GIT_USER_NAME`, `GIT_USER_EMAIL`, `INSTALL_DIR`)
