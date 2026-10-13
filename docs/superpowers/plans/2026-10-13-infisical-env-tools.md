# Infisical Env Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `mise run env:push` / `env:check` plus `env-push` / `env-check` skills that push each app's `.env` to Infisical (`/apps/<app>`, `# @shared` keys stored once in `/shared` and referenced) and check keys against `.env.example`, locally or remotely.

**Architecture:** Bash mise file tasks in `mise/tasks/env/` share `tools/env/lib.sh` (dotenv/example parsing, shared-marker validation, Infisical CLI wrappers). All key/value maps are JSON handled by jq (bash 3.2 has no associative arrays); values travel through environment variables, never argv or output. A fake `infisical` backed by a JSON state file drives a plain-bash test suite.

**Tech Stack:** bash 3.2+/5, jq, `infisical` CLI (0.43.x), shellcheck, mise file tasks, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-13-infisical-env-tools-design.md`

## Global Constraints

- Tasks: executable bash, `#!/usr/bin/env bash`, `#MISE description="…"` header, `set -euo pipefail`, 2-space indent, quoted variables.
- Tasks source the lib with `source "$(git rev-parse --show-toplevel)/tools/env/lib.sh"` preceded by `# shellcheck source=tools/env/lib.sh`.
- Without `.infisical.json` at the repo root every task prints `Infisical is not configured (no .infisical.json); skipping` and exits 0, before any other work.
- Never print secret values: output and errors name keys only. Never put values in argv (pass them to jq via environment variables).
- Push never deletes remote keys; validation happens before any write.
- Must run on bash 3.2 (macOS `/bin/bash`): no `declare -A`, no `mapfile`, no `"${arr[@]}"` of a possibly-empty array under `set -u`.
- shellcheck must be clean with both the local version and **0.9.0** (CI's Ubuntu version): `docker run --rm -v "$PWD:/mnt" -w /mnt koalaman/shellcheck:v0.9.0 -x <files>`. Avoid `A && B || C`.
- No new dependencies. Never `npm`/`npx`/`yarn`. Never print or commit a real `.env` (fixtures in test sandboxes are fine).
- No git commits, pushes or branches during implementation — the user handles git.
- Plan-time refinement of the spec: the lib has no `run` helper — `env:push` exits after printing the diff under `--dry-run`, before any write.

## Review Focus

1. Real `infisical` JSON shapes may differ from the fake (`export --format=json` items as `key/value` or `secretKey/secretValue`; `folders get -o json` items as `name` or `folderName`) → the lib normalizes both; verified against a real project only by the user (Task 4 Step 7).
2. `infisical secrets set --file <x>.yaml` must store `${dev.shared.KEY}` literally (a dotenv file could be variable-expanded by the CLI's parser) → the plan writes YAML with JSON-quoted values; real-project check in Task 4 Step 7.
3. Errors swallowed in conditional contexts (`if ! folder_exists …` disables `set -e` inside) → every CLI call inside such functions ends with `|| exit 1`; pinned by `test_push_explains_login_on_auth_failure` and `test_check_remote_explains_login_on_auth_failure`.
4. Values leaking into output (diffs, notes, errors, `secrets set` output) → `test_push_never_prints_values`, `test_check_never_prints_values`.
5. Hand-edited `.env` files: leading spaces, `export`, quotes, `#` inside values, duplicates → `test_lib_dotenv_get_parses_values`.

---

### Task 1: Lib, fake infisical, test harness, `env:test`

**Files:**
- Create: `tools/env/lib.sh`
- Create: `tools/env/test/infisical` (executable)
- Create: `tools/env/test/run.sh` (executable)
- Create: `mise/tasks/env/test` (executable)

**Interfaces:**
- Produces (`tools/env/lib.sh`):
  - `ENV_ROOT` — repo root
  - `die <msg>` → stderr `error: <msg>`, exit 1
  - `require_infisical_config` → prints the skip message and `exit 0` when `$ENV_ROOT/.infisical.json` is absent
  - `require_infisical_cli` → dies when `infisical` is not on PATH
  - `list_apps` → app names (dirs `apps/*/` containing `.env.example`), one per line, sorted
  - `normalize_line <line>` → sets global `LINE` (leading whitespace and `export ` removed)
  - `example_keys <app>` → `KEY<TAB>shared|local` per key line of `apps/<app>/.env.example`, file order
  - `dotenv_keys <file>` → keys defined in a dotenv file, one per line
  - `dotenv_get <file> <key>` → prints the value (last definition wins); returns 3 when absent; dies on a multi-line/unterminated quoted value
  - `all_example_keys` → `app<TAB>KEY<TAB>kind` for every app
  - `shared_marker_problems` → one line per inconsistent key: `KEY is @shared in apps/a but not in apps/b`
  - `join_lines <lines>` → `a, b, c`; `sorted` (stdin → `LC_ALL=C sort -u`); `minus <sorted lines> <sorted lines>` → lines of $1 not in $2
  - `shared_ref <env> <key>` → `${<env>.shared.<KEY>}`
  - `infisical_run <args…>` → runs `infisical`, stdout only; on failure prints its stderr and dies with `infisical <a1> <a2> failed; check --env and run: infisical login (or set INFISICAL_TOKEN)`
  - `folder_exists <env> <path>` (return 1 when missing), `ensure_folder <env> <path>` (creates missing segments)
  - `remote_object <env> <path>` → `{"KEY":"raw value"}` (references unexpanded), `{}` when the folder is missing
- Produces (tests): `tools/env/test/run.sh [filter]`; sandbox per case with apps `api` and `web` (fixtures below); helpers `expect_eq`, `expect_contains`, `expect_not_contains`, `expect_fail <substring> <cmd…>`, `run_fails <cmd…>` (output in `$OUT`), `expect_call`, `expect_no_call`, `remote_value <env> <path> <key>` (`<unset>` when absent), `state_set <env> <path> <key> <value>`, `state_del <env> <path> <key>`, `expect_no_secrets <output>`. New tests are `test_*` functions inserted **above the final `main "$@"` line**.
- Fake `infisical` state (`$INFISICAL_STATE`): `{"folders": {"<env>": ["/apps", "/apps/api"]}, "secrets": {"<env>": {"<path>": {"KEY": "value"}}}}`; log `$INFISICAL_LOG`; `FAKE_INFISICAL_FAIL=1` fails every call.

- [ ] **Step 1: Write the fake `infisical`** — `tools/env/test/infisical`, `chmod +x`:

```bash
#!/usr/bin/env bash
# Test double for the infisical CLI, backed by the JSON file $INFISICAL_STATE:
#   {"folders": {"<env>": ["/apps", "/apps/api"]},
#    "secrets": {"<env>": {"<path>": {"KEY": "value"}}}}
# Implements only the calls tools/env/lib.sh makes and logs argv to
# $INFISICAL_LOG. FAKE_INFISICAL_FAIL=1 makes every call fail like an
# expired login.
set -euo pipefail
printf '%s\n' "$*" >>"$INFISICAL_LOG"
if [ "${FAKE_INFISICAL_FAIL:-0}" = 1 ]; then
  echo "error: unauthorized, please log in" >&2
  exit 1
fi

cmd="" env=dev path=/ name="" file=""
while [ $# -gt 0 ]; do
  case "$1" in
    --env | --path | --name | --file | --format | -o)
      opt="$1" val="$2"
      shift 2
      ;;
    --*=*)
      opt="${1%%=*}" val="${1#*=}"
      shift
      ;;
    -*)
      shift
      continue
      ;;
    *)
      cmd="$cmd $1"
      shift
      continue
      ;;
  esac
  case "$opt" in
    --env) env="$val" ;;
    --path) path="$val" ;;
    --name) name="$val" ;;
    --file) file="$val" ;;
  esac
done

state() { jq -c "$@" "$INFISICAL_STATE"; }

save() {
  local tmp
  tmp="$(mktemp)"
  jq "$@" "$INFISICAL_STATE" >"$tmp"
  mv "$tmp" "$INFISICAL_STATE"
}

require_folder() {
  if [ "$path" != / ] \
    && ! state -e --arg e "$env" --arg p "$path" 'any((.folders[$e] // [])[]; . == $p)' >/dev/null; then
    echo "error: folder $path not found in $env" >&2
    exit 1
  fi
}

case "$cmd" in
  " secrets folders get")
    require_folder
    state --arg e "$env" --arg p "$path" '[(.folders[$e] // [])[]
      | select((sub("/[^/]+$"; "") | if . == "" then "/" else . end) == $p)
      | {name: sub(".*/"; "")}]'
    ;;
  " secrets folders create")
    require_folder
    save --arg e "$env" --arg f "${path%/}/$name" '.folders[$e] = (((.folders[$e] // []) + [$f]) | unique)'
    ;;
  " export")
    require_folder
    state --arg e "$env" --arg p "$path" '(.secrets[$e][$p] // {}) | to_entries | map({key, value})'
    ;;
  " secrets set")
    require_folder
    while IFS= read -r line || [ -n "$line" ]; do
      [ -n "$line" ] || continue
      save --arg e "$env" --arg p "$path" --arg k "${line%%: *}" --argjson v "${line#*: }" \
        '.secrets[$e][$p][$k] = $v'
    done <"$file"
    echo "secrets set (values masked)"
    ;;
  *)
    echo "fake infisical: unsupported command:$cmd" >&2
    exit 2
    ;;
esac
```

- [ ] **Step 2: Write the harness and the lib tests** — `tools/env/test/run.sh`, `chmod +x`:

```bash
#!/usr/bin/env bash
# shellcheck disable=SC2016 # tests compare literal Infisical references like '${dev.shared.KEY}'
# Tests for the env:* mise tasks: tools/env/test/run.sh [name-filter]
# Each case runs in a throwaway git repo with apps api and web and the fake
# infisical in this directory. No network, no Infisical.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TESTS="$ROOT/tools/env/test"
OUT=""

setup() {
  SANDBOX="$(mktemp -d)"
  trap 'rm -rf "$SANDBOX"' EXIT
  mkdir -p "$SANDBOX/bin"
  cp "$TESTS/infisical" "$SANDBOX/bin/infisical"
  export PATH="$SANDBOX/bin:$PATH"
  export INFISICAL_LOG="$SANDBOX/infisical.log" INFISICAL_STATE="$SANDBOX/state.json"
  export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
  unset FAKE_INFISICAL_FAIL
  : >"$INFISICAL_LOG"
  echo '{"folders": {}, "secrets": {}}' >"$INFISICAL_STATE"

  git init -q "$SANDBOX/repo"
  cd "$SANDBOX/repo"
  mkdir -p apps/api apps/web tools mise/tasks
  cp -R "$ROOT/tools/env" tools/
  cp -R "$ROOT/mise/tasks/env" mise/tasks/
  echo '{"workspaceId": "test"}' >.infisical.json
  cat >apps/api/.env.example <<'EOF'
# Database
DATABASE_URL=postgres://localhost/app   # @shared
JWT_ACCESS_SECRET=                      # @shared
API_PORT=8000
EOF
  cat >apps/api/.env <<'EOF'
DATABASE_URL="postgres://db-secret-1/app"
export JWT_ACCESS_SECRET=jwt-secret-1 # local note
API_PORT=8001
EOF
  cat >apps/web/.env.example <<'EOF'
JWT_ACCESS_SECRET=   # @shared
AUTH_SECRET=
EOF
  cat >apps/web/.env <<'EOF'
JWT_ACCESS_SECRET='jwt-secret-1'
AUTH_SECRET=auth-secret-1
EOF
}

expect_eq() {
  [ "$1" = "$2" ] || { echo "expected '$2', got '$1'"; return 1; }
}

expect_contains() { # <output> <substring>
  grep -qF -- "$2" <<<"$1" || { echo "expected '$2' in:"; echo "$1"; return 1; }
}

expect_not_contains() { # <output> <substring>
  if grep -qF -- "$2" <<<"$1"; then
    echo "did not expect '$2' in:"
    echo "$1"
    return 1
  fi
}

expect_fail() { # <substring of the output> <cmd…>
  local want="$1" out
  shift
  if out="$("$@" 2>&1)"; then
    echo "expected failure: $*"
    echo "$out"
    return 1
  fi
  expect_contains "$out" "$want"
}

run_fails() { # <cmd…> — expects a non-zero exit; output in $OUT
  if OUT="$("$@" 2>&1)"; then
    echo "expected failure: $*"
    echo "$OUT"
    return 1
  fi
}

expect_call() {
  grep -qF -- "$1" "$INFISICAL_LOG" || { echo "infisical not called with: $1"; cat "$INFISICAL_LOG"; return 1; }
}

expect_no_call() {
  if grep -qF -- "$1" "$INFISICAL_LOG"; then
    echo "infisical unexpectedly called with: $1"
    cat "$INFISICAL_LOG"
    return 1
  fi
}

remote_value() { # <env> <path> <key>
  jq -r --arg e "$1" --arg p "$2" --arg k "$3" '.secrets[$e][$p][$k] // "<unset>"' "$INFISICAL_STATE"
}

state_set() { # <env> <path> <key> <value>
  local tmp
  tmp="$(mktemp)"
  jq --arg e "$1" --arg p "$2" --arg k "$3" --arg v "$4" '.secrets[$e][$p][$k] = $v' "$INFISICAL_STATE" >"$tmp"
  mv "$tmp" "$INFISICAL_STATE"
}

state_del() { # <env> <path> <key>
  local tmp
  tmp="$(mktemp)"
  jq --arg e "$1" --arg p "$2" --arg k "$3" 'del(.secrets[$e][$p][$k])' "$INFISICAL_STATE" >"$tmp"
  mv "$tmp" "$INFISICAL_STATE"
}

expect_no_secrets() { # <output> — none of the fixture secret values may appear
  local secret
  for secret in db-secret-1 jwt-secret-1 auth-secret-1; do
    expect_not_contains "$1" "$secret"
  done
}

# --- lib ---

test_lib_dotenv_get_parses_values() {
  source tools/env/lib.sh
  cat >"$SANDBOX/t.env" <<'EOF'
  export A="x # y"
B=a#b
C=  spaced  # note
D=
E='single $quoted'
B=last-wins
EOF
  expect_eq "$(dotenv_get "$SANDBOX/t.env" A)" "x # y"
  expect_eq "$(dotenv_get "$SANDBOX/t.env" B)" "last-wins"
  expect_eq "$(dotenv_get "$SANDBOX/t.env" C)" "spaced"
  expect_eq "$(dotenv_get "$SANDBOX/t.env" D)" ""
  expect_eq "$(dotenv_get "$SANDBOX/t.env" E)" 'single $quoted'
}

test_lib_dotenv_get_missing_key_returns_3() {
  source tools/env/lib.sh
  local rc=0
  dotenv_get apps/api/.env NOPE >/dev/null || rc=$?
  expect_eq "$rc" 3
}

test_lib_dotenv_get_rejects_multiline() {
  source tools/env/lib.sh
  printf 'CERT="line1\nline2"\n' >"$SANDBOX/m.env"
  expect_fail "CERT has a multi-line" dotenv_get "$SANDBOX/m.env" CERT
}

test_lib_example_keys_marks_shared() {
  source tools/env/lib.sh
  expect_eq "$(example_keys api)" "$(printf 'DATABASE_URL\tshared\nJWT_ACCESS_SECRET\tshared\nAPI_PORT\tlocal')"
}

test_lib_list_apps_needs_example() {
  mkdir -p apps/docs
  source tools/env/lib.sh
  expect_eq "$(list_apps)" "$(printf 'api\nweb')"
}

test_lib_marker_problems() {
  source tools/env/lib.sh
  expect_eq "$(shared_marker_problems)" ""
  printf 'JWT_ACCESS_SECRET=\nAUTH_SECRET=\n' >apps/web/.env.example
  expect_eq "$(shared_marker_problems)" "JWT_ACCESS_SECRET is @shared in apps/api but not in apps/web"
}

test_runner_fails_when_no_test_matches() {
  expect_fail "no tests match" "$TESTS/run.sh" zzz_no_such_test
}

main() {
  local filter="${1:-}" name out status pass=0 failed=0
  out="$(mktemp)"
  for name in $(declare -F | awk '{print $3}' | grep '^test_'); do
    [[ "$name" == *"$filter"* ]] || continue
    (
      set -e
      setup
      "$name"
    ) >"$out" 2>&1
    status=$?
    if [ "$status" -eq 0 ]; then
      pass=$((pass + 1))
      echo "ok - $name"
    else
      failed=$((failed + 1))
      echo "not ok - $name"
      sed 's/^/    /' "$out"
    fi
  done
  rm -f "$out"
  if [ $((pass + failed)) -eq 0 ]; then
    echo "no tests match '$filter'"
    return 1
  fi
  echo "$pass passed, $failed failed"
  [ "$failed" -eq 0 ]
}

main "$@"
```

- [ ] **Step 3: Write `mise/tasks/env/test`** (`chmod +x`):

```bash
#!/usr/bin/env bash
#MISE description="Shellcheck and test the env:* tasks: env:test [name-filter]"
set -euo pipefail
shellcheck -x tools/env/lib.sh tools/env/test/run.sh tools/env/test/infisical mise/tasks/env/*
tools/env/test/run.sh "$@"
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `tools/env/test/run.sh test_lib`
Expected: 6 `not ok` (`tools/env/lib.sh: No such file or directory`).

- [ ] **Step 5: Write `tools/env/lib.sh`**

```bash
#!/usr/bin/env bash
# Shared helpers for the env:* mise tasks. Source, do not execute.
# Values read from .env files and Infisical are never printed or passed as
# arguments; jq receives them through environment variables.

ENV_ROOT="$(git rev-parse --show-toplevel)"
KEY_RE='^([A-Za-z_][A-Za-z0-9_]*)=(.*)$'
SHARED_RE='#.*@shared'

die() {
  echo "error: $*" >&2
  exit 1
}

# Infisical is opt-in: without .infisical.json every env task is a no-op.
require_infisical_config() {
  if [ ! -f "$ENV_ROOT/.infisical.json" ]; then
    echo "Infisical is not configured (no .infisical.json); skipping"
    exit 0
  fi
}

require_infisical_cli() {
  command -v infisical >/dev/null 2>&1 \
    || die "infisical CLI not found; install it: https://infisical.com/docs/cli/overview"
}

# App names (apps/<name>/ with a .env.example), one per line.
list_apps() {
  local dir
  for dir in "$ENV_ROOT"/apps/*/; do
    if [ -f "$dir.env.example" ]; then
      basename "$dir"
    fi
  done
}

# Sets LINE to a dotenv line without leading whitespace and `export `.
normalize_line() {
  LINE="${1#"${1%%[![:space:]]*}"}"
  LINE="${LINE#export }"
}

# KEY<TAB>shared|local for each key in apps/<app>/.env.example, in file order.
example_keys() {
  local line key rest kind
  while IFS= read -r line || [ -n "$line" ]; do
    normalize_line "$line"
    [[ "$LINE" =~ $KEY_RE ]] || continue
    key="${BASH_REMATCH[1]}"
    rest="${BASH_REMATCH[2]}"
    kind=local
    if [[ "$rest" =~ $SHARED_RE ]]; then
      kind=shared
    fi
    printf '%s\t%s\n' "$key" "$kind"
  done <"$ENV_ROOT/apps/$1/.env.example"
}

# Keys defined in a dotenv file, one per line.
dotenv_keys() {
  local line
  while IFS= read -r line || [ -n "$line" ]; do
    normalize_line "$line"
    if [[ "$LINE" =~ $KEY_RE ]]; then
      printf '%s\n' "${BASH_REMATCH[1]}"
    fi
  done <"$1"
}

# Prints the value of <key> in a dotenv file (the last definition wins).
# Returns 3 when the key is absent; dies on a multi-line quoted value.
dotenv_get() {
  local file="$1" want="$2" line value="" found=0 q
  while IFS= read -r line || [ -n "$line" ]; do
    normalize_line "$line"
    [[ "$LINE" =~ $KEY_RE ]] || continue
    [ "${BASH_REMATCH[1]}" = "$want" ] || continue
    value="${BASH_REMATCH[2]}"
    value="${value#"${value%%[![:space:]]*}"}"
    q="${value:0:1}"
    if [ "$q" = '"' ] || [ "$q" = "'" ]; then
      value="${value:1}"
      case "$value" in
        *"$q"*) value="${value%%"$q"*}" ;;
        *) die "$file: $want has a multi-line or unterminated quoted value, which is not supported" ;;
      esac
    else
      value="${value%%[[:space:]]#*}"
      value="${value%"${value##*[![:space:]]}"}"
    fi
    found=1
  done <"$file"
  [ "$found" = 1 ] || return 3
  printf '%s' "$value"
}

# app<TAB>KEY<TAB>shared|local for every app's .env.example.
all_example_keys() {
  local app key kind
  while IFS= read -r -u 3 app; do
    while IFS=$'\t' read -r -u 4 key kind; do
      printf '%s\t%s\t%s\n' "$app" "$key" "$kind"
    done 4< <(example_keys "$app")
  done 3< <(list_apps)
}

# "apps/a, apps/b": apps whose .env.example declares <key> as <kind>.
apps_with() { # <rows> <key> <kind>
  awk -F'\t' -v k="$2" -v t="$3" '$2 == k && $3 == t { printf "%sapps/%s", (n++ ? ", " : ""), $1 }' <<<"$1"
}

# One line per key that is @shared in one app's .env.example but not another's.
shared_marker_problems() {
  local rows key
  rows="$(all_example_keys)"
  for key in $(cut -f2,3 <<<"$rows" | LC_ALL=C sort -u | cut -f1 | uniq -d); do
    printf '%s is @shared in %s but not in %s\n' "$key" \
      "$(apps_with "$rows" "$key" shared)" "$(apps_with "$rows" "$key" local)"
  done
}

# Joins non-empty lines into "a, b, c".
join_lines() {
  grep . <<<"$1" | paste -sd, - | sed 's/,/, /g'
}

sorted() {
  LC_ALL=C sort -u
}

# Lines of sorted list $1 that are not in sorted list $2.
minus() {
  LC_ALL=C comm -23 <(printf '%s\n' "$1") <(printf '%s\n' "$2") | grep . || true
}

# The Infisical reference an app folder holds for a @shared key.
shared_ref() { # <env> <key>
  # shellcheck disable=SC2016 # a literal Infisical reference, not a shell expansion
  printf '${%s.shared.%s}' "$1" "$2"
}

# Runs the infisical CLI (stdout only); on failure shows its error and how to log in.
infisical_run() {
  local out err
  err="$(mktemp)"
  if ! out="$(infisical "$@" 2>"$err")"; then
    cat "$err" >&2
    rm -f "$err"
    die "infisical $1 $2 failed; check --env and run: infisical login (or set INFISICAL_TOKEN)"
  fi
  rm -f "$err"
  printf '%s\n' "$out"
}

# Sub-folder names of <path> in <env>, one per line.
folder_names() { # <env> <path>
  local out
  out="$(infisical_run secrets folders get --env "$1" --path "$2" -o json)" || exit 1
  jq -r '.[]? | (.name // .folderName // empty)' <<<"$out"
}

# Walks <path> one folder at a time. With `create`, creates missing folders;
# otherwise returns 1 at the first missing one. CLI errors always exit.
walk_folders() { # <env> <path> [create]
  local env="$1" rest="${2#/}" parent=/ seg names
  while [ -n "$rest" ]; do
    seg="${rest%%/*}"
    if [ "$seg" = "$rest" ]; then rest=""; else rest="${rest#*/}"; fi
    names="$(folder_names "$env" "$parent")" || exit 1
    if ! grep -qxF -- "$seg" <<<"$names"; then
      [ "${3:-}" = create ] || return 1
      infisical_run secrets folders create --env "$env" --path "$parent" --name "$seg" --silent >/dev/null || exit 1
    fi
    parent="${parent%/}/$seg"
  done
}

folder_exists() { walk_folders "$1" "$2"; }

ensure_folder() { walk_folders "$1" "$2" create; }

# Raw secrets of <env>:<path> as {"KEY": "value"} with references unexpanded;
# {} when the folder does not exist.
remote_object() { # <env> <path>
  local out
  if ! folder_exists "$1" "$2"; then
    echo '{}'
    return 0
  fi
  out="$(infisical_run export --format=json --env "$1" --path "$2" --expand=false --include-imports=false --silent)" || exit 1
  jq -c 'map({key: (.key // .secretKey), value: (.value // .secretValue)}) | from_entries' <<<"$out"
}
```

- [ ] **Step 6: Run tests and both shellchecks**

Run: `chmod +x tools/env/test/run.sh tools/env/test/infisical mise/tasks/env/test && mise run env:test`
Expected: shellcheck silent; `7 passed, 0 failed`.
Run: `docker run --rm -v "$PWD:/mnt" -w /mnt koalaman/shellcheck:v0.9.0 -x tools/env/lib.sh tools/env/test/run.sh tools/env/test/infisical mise/tasks/env/*; echo "exit $?"`
Expected: `exit 0`, no findings.
Run (bash 3.2): `mkdir -p "$TMPDIR/b32" && ln -sf /bin/bash "$TMPDIR/b32/bash" && PATH="$TMPDIR/b32:$PATH" tools/env/test/run.sh; rm -rf "$TMPDIR/b32"`
Expected: `7 passed, 0 failed`.

- [ ] **Step 7: Stop — no commit** (the user handles git).

---

### Task 2: `env:push`

**Files:**
- Create: `mise/tasks/env/push` (executable)
- Modify: `tools/env/test/run.sh` (insert tests above `main "$@"`)

**Interfaces:**
- Consumes (Task 1): `ENV_ROOT`, `die`, `require_infisical_config`, `require_infisical_cli`, `list_apps`, `example_keys`, `dotenv_keys`, `dotenv_get` (rc 3 = absent), `shared_marker_problems`, `join_lines`, `sorted`, `minus`, `shared_ref`, `infisical_run`, `ensure_folder`, `remote_object`.
- Produces: `mise run env:push [--env <slug>] [--app <name>] [--dry-run]`. Output per folder (`/shared` first): indented `+ KEY[ (shared ref)]`, `~ KEY (value changed)`, `! KEY (only on remote, kept)`, notes `extra (not pushed): …`, `empty, not pushed: KEY`, `missing in .env, not pushed: KEY`, or `no changes`; then `N to write, 0 deleted`; under `--dry-run` then `dry run: nothing written`; after writing `Pushed N secret(s) to <env>`.

- [ ] **Step 1: Write the failing tests** (insert above `main "$@"`)

```bash
# --- env:push ---

test_push_skips_without_infisical_json() {
  rm .infisical.json
  local out
  out="$(mise/tasks/env/push)"
  expect_contains "$out" "Infisical is not configured (no .infisical.json); skipping"
  expect_eq "$(wc -c <"$INFISICAL_LOG" | tr -d ' ')" 0
}

test_push_first_run_creates_layout() {
  local out shared_line api_line
  out="$(mise/tasks/env/push)"
  expect_contains "$out" "+ DATABASE_URL (shared ref)"
  expect_contains "$out" "7 to write, 0 deleted"
  expect_contains "$out" "Pushed 7 secret(s) to dev"
  expect_eq "$(remote_value dev /shared DATABASE_URL)" "postgres://db-secret-1/app"
  expect_eq "$(remote_value dev /shared JWT_ACCESS_SECRET)" "jwt-secret-1"
  expect_eq "$(remote_value dev /apps/api DATABASE_URL)" '${dev.shared.DATABASE_URL}'
  expect_eq "$(remote_value dev /apps/api JWT_ACCESS_SECRET)" '${dev.shared.JWT_ACCESS_SECRET}'
  expect_eq "$(remote_value dev /apps/api API_PORT)" "8001"
  expect_eq "$(remote_value dev /apps/web JWT_ACCESS_SECRET)" '${dev.shared.JWT_ACCESS_SECRET}'
  expect_eq "$(remote_value dev /apps/web AUTH_SECRET)" "auth-secret-1"
  shared_line="$(grep -n 'secrets set .*--path /shared' "$INFISICAL_LOG" | cut -d: -f1)"
  api_line="$(grep -n 'secrets set .*--path /apps/api' "$INFISICAL_LOG" | cut -d: -f1)"
  [ "$shared_line" -lt "$api_line" ] || { echo "/shared must be written before /apps/api"; cat "$INFISICAL_LOG"; return 1; }
}

test_push_uses_the_env_slug() {
  mise/tasks/env/push --env staging >/dev/null
  expect_eq "$(remote_value staging /apps/api DATABASE_URL)" '${staging.shared.DATABASE_URL}'
  expect_eq "$(remote_value dev /apps/api DATABASE_URL)" "<unset>"
}

test_push_second_run_is_a_noop() {
  mise/tasks/env/push >/dev/null
  : >"$INFISICAL_LOG"
  local out
  out="$(mise/tasks/env/push)"
  expect_contains "$out" "0 to write, 0 deleted"
  expect_contains "$out" "no changes"
  expect_no_call "secrets set"
  expect_no_call "folders create"
}

test_push_updates_changed_values_and_keeps_remote_only_keys() {
  mise/tasks/env/push >/dev/null
  sed -i.bak 's/^API_PORT=.*/API_PORT=9000/' apps/api/.env
  rm apps/api/.env.bak
  state_set dev /apps/api LEGACY_FLAG on
  local out
  out="$(mise/tasks/env/push)"
  expect_contains "$out" "~ API_PORT (value changed)"
  expect_contains "$out" "! LEGACY_FLAG (only on remote, kept)"
  expect_contains "$out" "1 to write, 0 deleted"
  expect_eq "$(remote_value dev /apps/api API_PORT)" "9000"
  expect_eq "$(remote_value dev /apps/api LEGACY_FLAG)" "on"
}

test_push_rejects_shared_value_conflict() {
  printf 'JWT_ACCESS_SECRET=other-jwt\nAUTH_SECRET=auth-secret-1\n' >apps/web/.env
  expect_fail "@shared JWT_ACCESS_SECRET differs between apps/api/.env and apps/web/.env" mise/tasks/env/push
  expect_no_call "secrets set"
  expect_no_call "folders create"
}

test_push_rejects_inconsistent_markers() {
  printf 'JWT_ACCESS_SECRET=\nAUTH_SECRET=\n' >apps/web/.env.example
  expect_fail "JWT_ACCESS_SECRET is @shared in apps/api but not in apps/web" mise/tasks/env/push
  expect_no_call "secrets set"
}

test_push_dry_run_writes_nothing() {
  local before out
  before="$(cat "$INFISICAL_STATE")"
  out="$(mise/tasks/env/push --dry-run)"
  expect_contains "$out" "7 to write, 0 deleted"
  expect_contains "$out" "dry run: nothing written"
  expect_no_call "secrets set"
  expect_no_call "folders create"
  expect_eq "$(cat "$INFISICAL_STATE")" "$before"
}

test_push_single_app() {
  rm apps/api/.env
  mise/tasks/env/push --app web >/dev/null
  expect_eq "$(remote_value dev /apps/web AUTH_SECRET)" "auth-secret-1"
  expect_eq "$(remote_value dev /shared JWT_ACCESS_SECRET)" "jwt-secret-1"
  expect_eq "$(remote_value dev /shared DATABASE_URL)" "<unset>"
  expect_eq "$(remote_value dev /apps/api API_PORT)" "<unset>"
}

test_push_unknown_app_fails() {
  expect_fail "unknown app 'nope'" mise/tasks/env/push --app nope
}

test_push_requires_env_file() {
  rm apps/web/.env
  expect_fail "apps/web/.env not found; create it from apps/web/.env.example" mise/tasks/env/push
  expect_no_call "secrets set"
}

test_push_reports_extra_empty_and_missing_keys() {
  printf 'DATABASE_URL=postgres://db-secret-1/app\nAPI_PORT=\nEXTRA_FLAG=1\n' >apps/api/.env
  local out
  out="$(mise/tasks/env/push --dry-run)"
  expect_contains "$out" "extra (not pushed): EXTRA_FLAG"
  expect_contains "$out" "empty, not pushed: API_PORT"
  expect_contains "$out" "missing in .env, not pushed: JWT_ACCESS_SECRET"
}

test_push_explains_login_on_auth_failure() {
  export FAKE_INFISICAL_FAIL=1
  expect_fail "infisical login" mise/tasks/env/push
}

test_push_never_prints_values() {
  local out
  out="$(mise/tasks/env/push --dry-run 2>&1)$(mise/tasks/env/push 2>&1)$(mise/tasks/env/push 2>&1)"
  expect_no_secrets "$out"
}
```

- [ ] **Step 2: Run to verify they fail**

Run: `tools/env/test/run.sh test_push`
Expected: 14 `not ok` (`mise/tasks/env/push: No such file or directory`).

- [ ] **Step 3: Write `mise/tasks/env/push`** (`chmod +x`)

```bash
#!/usr/bin/env bash
#MISE description="Push apps/*/.env to Infisical (/apps/<app>; @shared keys via /shared): env:push [--env <slug>] [--app <name>] [--dry-run]"
# Keys come from each app's .env.example, values from apps/<app>/.env.
# Remote-only keys are kept. Values are never printed.
set -euo pipefail
# shellcheck source=tools/env/lib.sh
source "$(git rev-parse --show-toplevel)/tools/env/lib.sh"

require_infisical_config

usage="usage: mise run env:push [--env <slug>] [--app <name>] [--dry-run]"
env=dev only="" dry_run=0
while [ $# -gt 0 ]; do
  case "$1" in
    --env)
      [ $# -ge 2 ] || die "$usage"
      env="$2"
      shift 2
      ;;
    --app)
      [ $# -ge 2 ] || die "$usage"
      only="$2"
      shift 2
      ;;
    --dry-run)
      dry_run=1
      shift
      ;;
    *) die "unknown argument '$1'; $usage" ;;
  esac
done
require_infisical_cli

apps="$(list_apps)"
[ -n "$apps" ] || die "no apps/*/.env.example found"
if [ -n "$only" ] && ! grep -qxF -- "$only" <<<"$apps"; then
  die "unknown app '$only' (apps: $(join_lines "$apps"))"
fi

markers="$(shared_marker_problems)"
[ -z "$markers" ] || die "inconsistent @shared markers in .env.example:"$'\n'"$markers"

desired='{}'    # {"<folder>": {"KEY": "value"}}
shared='{}'     # {"KEY": {"value": "…", "app": "<first app that set it>"}}
shared_keys=""  # @shared keys of the selected apps, one per line
notes=""        # "<folder><TAB><note>" lines

note() { notes+="$1"$'\t'"$2"$'\n'; }

put() { # <folder> <key> <value>
  desired="$(F="$1" K="$2" V="$3" jq -c '.[env.F][env.K] = env.V' <<<"$desired")"
}

while IFS= read -r -u 3 app; do
  if [ -z "$only" ] || [ "$app" = "$only" ]; then selected=1; else selected=0; fi
  file="$ENV_ROOT/apps/$app/.env"
  folder="/apps/$app"
  if [ ! -f "$file" ]; then
    if [ "$selected" = 0 ]; then continue; fi
    die "apps/$app/.env not found; create it from apps/$app/.env.example"
  fi
  if [ "$selected" = 1 ]; then
    desired="$(F="$folder" jq -c '.[env.F] //= {}' <<<"$desired")"
  fi
  while IFS=$'\t' read -r -u 4 key kind; do
    rc=0
    value="$(dotenv_get "$file" "$key")" || rc=$?
    if [ "$rc" = 3 ]; then
      if [ "$selected" = 1 ]; then note "$folder" "missing in .env, not pushed: $key"; fi
      continue
    elif [ "$rc" != 0 ]; then
      exit "$rc"
    fi
    if [ -z "$value" ]; then
      if [ "$selected" = 1 ]; then note "$folder" "empty, not pushed: $key"; fi
      continue
    fi
    if [ "$kind" = shared ]; then
      first="$(K="$key" jq -r '.[env.K].app // empty' <<<"$shared")"
      if [ -z "$first" ]; then
        shared="$(K="$key" V="$value" A="$app" jq -c '.[env.K] = {value: env.V, app: env.A}' <<<"$shared")"
      elif ! K="$key" V="$value" jq -e '.[env.K].value == env.V' <<<"$shared" >/dev/null; then
        die "@shared $key differs between apps/$first/.env and apps/$app/.env; make the values equal"
      fi
      if [ "$selected" = 1 ]; then
        put "$folder" "$key" "$(shared_ref "$env" "$key")"
        shared_keys+="$key"$'\n'
      fi
    elif [ "$selected" = 1 ]; then
      put "$folder" "$key" "$value"
    fi
  done 4< <(example_keys "$app")
  if [ "$selected" = 1 ]; then
    extra="$(minus "$(dotenv_keys "$file" | sorted)" "$(example_keys "$app" | cut -f1 | sorted)")"
    if [ -n "$extra" ]; then note "$folder" "extra (not pushed): $(join_lines "$extra")"; fi
  fi
done 3< <(list_apps)

if [ -n "$shared_keys" ]; then
  desired="$(SHARED="$shared" KEYS="$shared_keys" jq -c '
    . + {"/shared": ((env.SHARED | fromjson)
      | with_entries(select(.key as $k | env.KEYS | split("\n") | index($k)))
      | map_values(.value))}' <<<"$desired")"
fi

# shellcheck disable=SC2016 # a jq program, not shell
diff_program='(env.WANT | fromjson) as $w | (env.HAVE | fromjson) as $h
  | ( ($w | keys[]) as $k
      | if (($h | has($k)) | not) then
          "+ \($k)\(if ($w[$k] | startswith("${")) then " (shared ref)" else "" end)"
        elif $h[$k] != $w[$k] then "~ \($k) (value changed)"
        else empty end ),
    ( ($h | keys[]) as $k | select(($w | has($k)) | not) | "! \($k) (only on remote, kept)" )'
# shellcheck disable=SC2016 # a jq program, not shell
changes_program='(env.WANT | fromjson) as $w | (env.HAVE | fromjson) as $h
  | $w | with_entries(select($h[.key] != .value))'

plan_dir="$(umask 077 && mktemp -d)"
trap 'rm -rf "$plan_dir"' EXIT
total=0
writes=""
for folder in $(jq -r 'keys | map(select(. == "/shared")) + map(select(. != "/shared")) | .[]' <<<"$desired"); do
  want="$(F="$folder" jq -c '.[env.F]' <<<"$desired")"
  have="$(remote_object "$env" "$folder")"
  lines="$(WANT="$want" HAVE="$have" jq -nr "$diff_program")"
  echo "$folder"
  if [ -n "$lines" ]; then sed 's/^/  /' <<<"$lines"; else echo "  no changes"; fi
  awk -F'\t' -v f="$folder" '$1 == f { print "  " $2 }' <<<"$notes"
  changes="$(WANT="$want" HAVE="$have" jq -nc "$changes_program")"
  count="$(jq 'length' <<<"$changes")"
  if [ "$count" -gt 0 ]; then
    total=$((total + count))
    yaml="$plan_dir/$total.yaml"
    jq -r 'to_entries[] | "\(.key): \(.value | tojson)"' <<<"$changes" >"$yaml"
    writes+="$folder"$'\t'"$yaml"$'\n'
  fi
done
echo "$total to write, 0 deleted"

if [ "$dry_run" = 1 ]; then
  echo "dry run: nothing written"
  exit 0
fi
[ "$total" -gt 0 ] || exit 0

while IFS=$'\t' read -r -u 3 folder yaml; do
  ensure_folder "$env" "$folder"
  infisical_run secrets set --file "$yaml" --env "$env" --path "$folder" --silent >/dev/null
done 3<<<"${writes%$'\n'}"
echo "Pushed $total secret(s) to $env"
```

- [ ] **Step 4: Run tests and both shellchecks**

Run: `mise run env:test`
Expected: shellcheck silent; `21 passed, 0 failed`.
Run: `docker run --rm -v "$PWD:/mnt" -w /mnt koalaman/shellcheck:v0.9.0 -x tools/env/lib.sh tools/env/test/run.sh tools/env/test/infisical mise/tasks/env/*; echo "exit $?"` → `exit 0`.
Run the bash 3.2 suite as in Task 1 Step 6 → `21 passed, 0 failed`.

- [ ] **Step 5: Stop — no commit.**

---

### Task 3: `env:check`

**Files:**
- Create: `mise/tasks/env/check` (executable)
- Modify: `tools/env/test/run.sh` (insert tests above `main "$@"`)

**Interfaces:**
- Consumes (Task 1): `ENV_ROOT`, `die`, `require_infisical_config`, `require_infisical_cli`, `list_apps`, `example_keys`, `dotenv_keys`, `shared_marker_problems`, `join_lines`, `sorted`, `minus`, `shared_ref`, `remote_object`. Tests use `mise/tasks/env/push` (Task 2) to seed remote state.
- Produces: `mise run env:check [--remote] [--env <slug>] [--app <name>]`. Output: per app `apps/<app>` then indented `missing: …`, `extra: …`, `not a shared ref: …`, `shared missing: …` (comma-joined, sorted), or `ok`; optional `shared markers` section; final `✔ env matches .env.example` (exit 0) or `✖ N problems` (exit 1).

- [ ] **Step 1: Write the failing tests** (insert above `main "$@"`)

```bash
# --- env:check ---

test_check_skips_without_infisical_json() {
  rm .infisical.json
  local out
  out="$(mise/tasks/env/check)"
  expect_contains "$out" "skipping"
  out="$(mise/tasks/env/check --remote)"
  expect_contains "$out" "skipping"
  expect_eq "$(wc -c <"$INFISICAL_LOG" | tr -d ' ')" 0
}

test_check_local_ok() {
  local out
  out="$(mise/tasks/env/check)"
  expect_eq "$(grep -c '^  ok$' <<<"$out")" 2
  expect_contains "$out" "✔ env matches .env.example"
  expect_eq "$(wc -c <"$INFISICAL_LOG" | tr -d ' ')" 0
}

test_check_local_reports_missing_and_extra() {
  printf 'JWT_ACCESS_SECRET=jwt-secret-1\nOLD_FLAG=1\n' >apps/web/.env
  run_fails mise/tasks/env/check
  expect_contains "$OUT" "missing: AUTH_SECRET"
  expect_contains "$OUT" "extra: OLD_FLAG"
  expect_contains "$OUT" "✖ 2 problems"
}

test_check_local_without_env_file() {
  rm apps/web/.env
  run_fails mise/tasks/env/check --app web
  expect_contains "$OUT" "missing: AUTH_SECRET, JWT_ACCESS_SECRET"
  expect_not_contains "$OUT" "apps/api"
}

test_check_remote_ok_after_push() {
  mise/tasks/env/push >/dev/null
  local out
  out="$(mise/tasks/env/check --remote)"
  expect_contains "$out" "✔ env matches .env.example"
}

test_check_remote_reports_problems() {
  mise/tasks/env/push >/dev/null
  state_set dev /apps/api DATABASE_URL postgres://raw
  state_del dev /shared JWT_ACCESS_SECRET
  state_set dev /apps/web OLD_FLAG 1
  state_del dev /apps/web AUTH_SECRET
  run_fails mise/tasks/env/check --remote
  expect_contains "$OUT" "not a shared ref: DATABASE_URL"
  expect_contains "$OUT" "shared missing: JWT_ACCESS_SECRET"
  expect_contains "$OUT" "extra: OLD_FLAG"
  expect_contains "$OUT" "missing: AUTH_SECRET"
  expect_contains "$OUT" "✖ 5 problems"
}

test_check_reports_inconsistent_markers() {
  printf 'JWT_ACCESS_SECRET=\nAUTH_SECRET=\n' >apps/web/.env.example
  run_fails mise/tasks/env/check
  expect_contains "$OUT" "shared markers"
  expect_contains "$OUT" "JWT_ACCESS_SECRET is @shared in apps/api but not in apps/web"
}

test_check_remote_explains_login_on_auth_failure() {
  export FAKE_INFISICAL_FAIL=1
  expect_fail "infisical login" mise/tasks/env/check --remote
}

test_check_never_prints_values() {
  mise/tasks/env/push >/dev/null
  state_set dev /apps/api DATABASE_URL postgres://db-secret-1/app
  local out
  out="$(mise/tasks/env/check --remote 2>&1 || true)$(mise/tasks/env/check 2>&1 || true)"
  expect_no_secrets "$out"
}
```

- [ ] **Step 2: Run to verify they fail**

Run: `tools/env/test/run.sh test_check`
Expected: 9 `not ok`.

- [ ] **Step 3: Write `mise/tasks/env/check`** (`chmod +x`)

```bash
#!/usr/bin/env bash
#MISE description="Compare each app's .env.example keys with .env (default) or Infisical (--remote): env:check [--remote] [--env <slug>] [--app <name>]"
# Reports missing/extra keys and, remotely, @shared keys that are not
# references to /shared. Exits 1 on any problem. Never prints values.
set -euo pipefail
# shellcheck source=tools/env/lib.sh
source "$(git rev-parse --show-toplevel)/tools/env/lib.sh"

require_infisical_config

usage="usage: mise run env:check [--remote] [--env <slug>] [--app <name>]"
remote=0 env=dev only=""
while [ $# -gt 0 ]; do
  case "$1" in
    --remote)
      remote=1
      shift
      ;;
    --env)
      [ $# -ge 2 ] || die "$usage"
      env="$2"
      shift 2
      ;;
    --app)
      [ $# -ge 2 ] || die "$usage"
      only="$2"
      shift 2
      ;;
    *) die "unknown argument '$1'; $usage" ;;
  esac
done
if [ "$remote" = 1 ]; then require_infisical_cli; fi

apps="$(list_apps)"
[ -n "$apps" ] || die "no apps/*/.env.example found"
if [ -n "$only" ] && ! grep -qxF -- "$only" <<<"$apps"; then
  die "unknown app '$only' (apps: $(join_lines "$apps"))"
fi

problems=0
clean=1

report() { # <label> <keys, one per line>
  [ -n "$2" ] || return 0
  echo "  $1: $(join_lines "$2")"
  problems=$((problems + $(grep -c . <<<"$2")))
  clean=0
}

if [ "$remote" = 1 ]; then
  shared_have="$(remote_object "$env" /shared)"
fi

while IFS= read -r -u 3 app; do
  if [ -n "$only" ] && [ "$app" != "$only" ]; then continue; fi
  echo "apps/$app"
  clean=1
  want="$(example_keys "$app" | cut -f1 | sorted)"
  if [ "$remote" = 1 ]; then
    have_obj="$(remote_object "$env" "/apps/$app")"
    have="$(jq -r 'keys[]' <<<"$have_obj" | sorted)"
  elif [ -f "$ENV_ROOT/apps/$app/.env" ]; then
    have="$(dotenv_keys "$ENV_ROOT/apps/$app/.env" | sorted)"
  else
    have=""
  fi
  report missing "$(minus "$want" "$have")"
  report extra "$(minus "$have" "$want")"
  if [ "$remote" = 1 ]; then
    bad_ref="" shared_missing=""
    for key in $(example_keys "$app" | awk -F'\t' '$2 == "shared" { print $1 }'); do
      if K="$key" jq -e 'has(env.K)' <<<"$have_obj" >/dev/null \
        && ! K="$key" R="$(shared_ref "$env" "$key")" jq -e '.[env.K] == env.R' <<<"$have_obj" >/dev/null; then
        bad_ref+="$key"$'\n'
      fi
      if ! K="$key" jq -e 'has(env.K)' <<<"$shared_have" >/dev/null; then
        shared_missing+="$key"$'\n'
      fi
    done
    report "not a shared ref" "$bad_ref"
    report "shared missing" "$shared_missing"
  fi
  if [ "$clean" = 1 ]; then echo "  ok"; fi
done 3< <(list_apps)

markers="$(shared_marker_problems)"
if [ -n "$markers" ]; then
  echo "shared markers"
  sed 's/^/  /' <<<"$markers"
  problems=$((problems + $(grep -c . <<<"$markers")))
fi

if [ "$problems" = 0 ]; then
  echo "✔ env matches .env.example"
  exit 0
fi
echo "✖ $problems problems"
exit 1
```

- [ ] **Step 4: Run tests and both shellchecks**

Run: `mise run env:test` → shellcheck silent; `30 passed, 0 failed`.
Run the shellcheck 0.9.0 docker command from Task 2 Step 4 → `exit 0`.
Run the bash 3.2 suite as in Task 1 Step 6 → `30 passed, 0 failed`.

- [ ] **Step 5: Stop — no commit.**

---

### Task 4: Skills, docs, CI and end-to-end check

**Files:**
- Create: `.agents/skills/env-push/SKILL.md`, `.agents/skills/env-check/SKILL.md`
- Create: symlinks `.claude/skills/env-push` → `../../.agents/skills/env-push`, `.claude/skills/env-check` → `../../.agents/skills/env-check`
- Modify: `AGENTS.md` (*Environment variables* section, end)
- Modify: `CLAUDE.md` (`## Claude Code` list)
- Modify: `.github/workflows/pr-checks.yml` (new step before `- uses: pnpm/action-setup@v4`)
- Modify: `docs/superpowers/specs/2026-10-13-infisical-env-tools-design.md` (record refinements)

**Interfaces:**
- Consumes: `env:push` and `env:check` flags and messages exactly as produced in Tasks 2–3.

- [ ] **Step 1: Write `.agents/skills/env-push/SKILL.md`**

````markdown
---
name: env-push
description: Push each app's .env to Infisical with `mise run env:push` — /apps/<app> per app, keys marked `# @shared` in .env.example stored once in /shared and referenced from the apps. Use when the user asks to push, upload, sync or publish env vars or secrets to Infisical, or to share a variable between apps. Only applies when .infisical.json exists at the repo root.
---

# Push env to Infisical

**First:** if `.infisical.json` does not exist at the repo root, tell the
user Infisical is not configured for this repo (`infisical init` sets it up)
and stop.

## Layout (per Infisical environment)

```
/shared/<KEY>      = value                     # keys marked # @shared
/apps/<app>/<KEY>  = value                     # every other key
/apps/<app>/<KEY>  = ${<env>.shared.<KEY>}     # @shared keys reference /shared
```

Keys come from `apps/<app>/.env.example`, values from `apps/<app>/.env`.
Mark a shared key on its `.env.example` line in **every** app that uses it:

```
DATABASE_URL=postgres://localhost/app   # @shared
```

## Steps

1. `mise run env:check` — the user fixes missing keys in `.env` first.
2. `mise run env:push --env <slug> --dry-run` (default slug `dev`; `--app <name>`
   for one app). Show the user the diff.
3. Only after the user says yes: the same command without `--dry-run`. A yes
   covers that one run.
4. `mise run env:check --remote --env <slug>` to confirm.

Diff lines: `+ KEY` new, `~ KEY (value changed)`, `! KEY (only on remote, kept)`
— push never deletes. Notes: `extra (not pushed)`, `empty, not pushed`,
`missing in .env, not pushed`.

## Never

- Read, print, paste or edit `.env` files or secret values — the task reads
  them and its output never shows values.
- Set or delete secrets with raw `infisical` commands.
- Push to an environment the user did not name (the default is `dev`).

## Common failures

| Message | Fix |
|---|---|
| `Infisical is not configured` | No `.infisical.json`; nothing to do. |
| `infisical CLI not found` | Ask the user to install the Infisical CLI. |
| `run: infisical login` | Ask the user to run `infisical login` (or set `INFISICAL_TOKEN`) and check the `--env` slug. |
| `apps/<app>/.env not found` | The user creates it from `.env.example`. |
| `@shared KEY differs between …` | The user makes the value equal in every app's `.env`. |
| `KEY is @shared in apps/a but not in apps/b` | Mark the key `# @shared` in every app's `.env.example`, or in none. |
````

- [ ] **Step 2: Write `.agents/skills/env-check/SKILL.md`**

````markdown
---
name: env-check
description: Check that each app's env has exactly the keys its .env.example declares, with `mise run env:check` (local .env, the default) or `--remote` (Infisical, including @shared references). Use when the user asks to check, verify, compare or audit env vars or secrets, find missing or extra keys, or after changing a .env.example. Only applies when .infisical.json exists at the repo root.
---

# Check env keys

**First:** if `.infisical.json` does not exist at the repo root, tell the
user Infisical is not configured for this repo and stop.

| Want | Run |
|---|---|
| local `.env` vs `.env.example` | `mise run env:check [--app <name>]` |
| Infisical vs `.env.example` | `mise run env:check --remote [--env <slug>] [--app <name>]` |

Exit 0 means everything matches; exit 1 lists the problems per app. The
report names keys only, never values.

## Reading the report

| Line | Meaning | Fix |
|---|---|---|
| `missing: A, B` | in `.env.example`, not in the source | local: the user adds them to `.env`; remote: push (env-push skill) |
| `extra: C` | in the source, not in `.env.example` | add it to `.env.example` if it is real, otherwise remove it (remote: in the Infisical UI) |
| `not a shared ref: K` | a `@shared` key in `/apps/<app>` holds a value instead of `${<env>.shared.K}` | push rewrites it |
| `shared missing: K` | `/shared` has no `K` | push |
| `K is @shared in apps/a but not in apps/b` | the markers disagree | mark it `# @shared` in every app's `.env.example`, or in none |

## Never

- Read or print `.env` contents or secret values to investigate — the report
  already names the keys.
````

- [ ] **Step 3: Link the skills for Claude Code**

Run: `mkdir -p .claude/skills && ln -s ../../.agents/skills/env-push .claude/skills/env-push && ln -s ../../.agents/skills/env-check .claude/skills/env-check && head -2 .claude/skills/env-push/SKILL.md .claude/skills/env-check/SKILL.md`
Expected: both print `---` and their `name:` line.

- [ ] **Step 4: Update AGENTS.md and CLAUDE.md**

In `AGENTS.md`, at the end of the `## Environment variables` section (after the `- Web: …` bullet), add (blank line before):

```markdown
**Infisical (optional).** When `.infisical.json` exists at the repo root,
`mise run env:push [--env dev] [--dry-run]` pushes each app's `.env` to
Infisical under `/apps/<app>`; keys marked `# @shared` on their
`.env.example` line are stored once in `/shared` and referenced from the apps
(`${<env>.shared.KEY}`). `mise run env:check [--remote]` compares each
`.env.example` with `.env` or Infisical. Agents follow the `env-push` and
`env-check` skills (`.agents/skills/`). Without `.infisical.json` both tasks
do nothing.
```

In `CLAUDE.md`, append to the `## Claude Code` list:

```markdown
- `.claude/skills/env-push` and `.claude/skills/env-check` are symlinks to
  `.agents/skills/`, shared with other harnesses; edit the skills there.
```

- [ ] **Step 5: Run the env tests in CI**

In `.github/workflows/pr-checks.yml`, insert immediately before `      - uses: pnpm/action-setup@v4` (after the `Release version` step, and after a `Flow tasks` step if one exists):

```yaml
      - name: Env tasks
        run: |
          shellcheck -x tools/env/lib.sh tools/env/test/run.sh tools/env/test/infisical mise/tasks/env/*
          tools/env/test/run.sh
```

Run: `actionlint .github/workflows/pr-checks.yml` (or, if unavailable, `ruby -ryaml -e 'YAML.load_file(".github/workflows/pr-checks.yml")'`) → no output, exit 0.

- [ ] **Step 6: End-to-end check on this repo**

1. `mise run env:test` → `30 passed, 0 failed`, shellcheck silent.
2. `mise tasks ls | grep env:` → `env:check`, `env:push`, `env:test` with descriptions.
3. `mise run env:check` and `mise run env:push --dry-run` → each prints `Infisical is not configured (no .infisical.json); skipping`, exit 0 (this repo has no `.infisical.json`).

- [ ] **Step 7: Record refinements in the spec and the manual real-Infisical check**

In the spec, add a `## Plan-time refinements` section:

- No `run` helper: `env:push` exits after the diff under `--dry-run`, before any write.
- Writes use `infisical secrets set --file <tmp>.yaml` with JSON-quoted values so `${…}` references are stored literally; reads use `infisical export --format=json --expand=false --include-imports=false` and accept `key/value` or `secretKey/secretValue` items; folders are listed with `secrets folders get -o json` (`name` or `folderName`).
- Push also reports `missing in .env, not pushed: KEY`; `--app` writes `/shared` only for that app's `@shared` keys.
- Every script must also run on bash 3.2 and pass shellcheck 0.9.0.
- **Manual check against a real Infisical project (the user, once `infisical init` is done):** `mise run env:push --dry-run`, then `mise run env:push`, then `mise run env:check --remote`; in the Infisical UI confirm `/apps/<app>/<shared key>` shows the reference `${dev.shared.KEY}` (not an expanded value) and `/shared` holds the value.

- [ ] **Step 8: Stop — no commit.** Report Step 6 results.
