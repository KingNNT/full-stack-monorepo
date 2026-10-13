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
  expect_eq "$(head -n1 <<<"$out")" "Infisical env: dev"
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

# --- review fixes ---

test_push_round_trips_special_characters() {
  local want='a"b\c: d #e$f'
  printf "DATABASE_URL=x\nJWT_ACCESS_SECRET=jwt-secret-1\nAPI_PORT='%s'\n" "$want" >apps/api/.env
  mise/tasks/env/push >/dev/null
  expect_eq "$(remote_value dev /apps/api API_PORT)" "$want"
  : >"$INFISICAL_LOG"
  expect_contains "$(mise/tasks/env/push)" "0 to write, 0 deleted"
}

test_push_shared_ref_label_needs_exact_reference() {
  printf 'DATABASE_URL=x\nJWT_ACCESS_SECRET=jwt-secret-1\nAPI_PORT=${other.ref}\n' >apps/api/.env
  local out
  out="$(mise/tasks/env/push --dry-run)"
  expect_contains "$out" "+ DATABASE_URL (shared ref)"
  expect_contains "$out" "+ API_PORT"
  expect_not_contains "$out" "+ API_PORT (shared ref)"
}

test_remote_export_ignores_personal_overrides() {
  mise/tasks/env/push >/dev/null
  : >"$INFISICAL_LOG"
  mise/tasks/env/check --remote >/dev/null
  expect_call "--secret-overriding=false"
}

test_folder_names_fails_on_unexpected_output() {
  source tools/env/lib.sh
  infisical_run() { echo '{"error": "nope"}'; }
  if (folder_names dev /) >/dev/null 2>&1; then
    echo "expected folder_names to fail on an object"
    return 1
  fi
}

test_folders_get_is_silent() {
  mise/tasks/env/push >/dev/null
  expect_call "secrets folders get --env dev --path / -o json --silent"
}

main "$@"
