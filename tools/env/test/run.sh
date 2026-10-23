#!/usr/bin/env bash
# shellcheck disable=SC2016 # tests compare literal Infisical references like '${local.shared.KEY}'
# Tests for the <env>:env:* mise tasks: tools/env/test/run.sh [name-filter]
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
  export PATH="$SANDBOX/bin:$PATH" INFISICAL_BIN="$SANDBOX/bin/infisical"
  export INFISICAL_LOG="$SANDBOX/infisical.log" INFISICAL_STATE="$SANDBOX/state.json"
  export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
  unset FAKE_INFISICAL_FAIL FAKE_INFISICAL_SESSION INFISICAL_UNIVERSAL_AUTH_CLIENT_ID INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET INFISICAL_PROJECT_ID
  export INFISICAL_TOKEN=env-token
  : >"$INFISICAL_LOG"
  echo '{"folders": {}, "secrets": {}}' >"$INFISICAL_STATE"

  git init -q "$SANDBOX/repo"
  cd "$SANDBOX/repo"
  mkdir -p apps/api apps/web tools mise/tasks
  cp -R "$ROOT/tools/env" tools/
  for e in local rpi dev staging prod; do
    mkdir -p "mise/tasks/$e"
    cp -R "$ROOT/mise/tasks/$e/env" "mise/tasks/$e/"
  done
  echo '{"workspaceId": "test"}' >.infisical.json
  cat >apps/api/.env.example <<'EOF'
# Database
DATABASE_URL=postgres://localhost/app   # @shared
JWT_ACCESS_SECRET=                      # @shared
API_PORT=8000
EOF
  cat >apps/api/.env.local <<'EOF'
DATABASE_URL="postgres://db-secret-1/app"
export JWT_ACCESS_SECRET=jwt-secret-1 # local note
API_PORT=8001
EOF
  cat >apps/web/.env.example <<'EOF'
JWT_ACCESS_SECRET=   # @shared
AUTH_SECRET=
EOF
  cat >apps/web/.env.local <<'EOF'
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
  dotenv_get apps/api/.env.local NOPE >/dev/null || rc=$?
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

test_lib_assert_stamps() {
  source tools/env/lib.sh
  printf '# infisical-env=local\nA=1\n' >apps/api/.env
  expect_fail "apps/web/.env is missing" assert_stamps local
  printf 'B=1\n' >apps/web/.env
  expect_fail "apps/web/.env has no # infisical-env=<env> line" assert_stamps local
  printf '# infisical-env=rpi\nB=1\n' >apps/web/.env
  expect_fail "apps/web/.env was pulled from 'rpi'" assert_stamps local
  printf '# infisical-env=local\nB=1\n' >apps/web/.env
  assert_stamps local
}

test_lib_env_file() {
  source tools/env/lib.sh
  expect_eq "$(env_file local api)" "apps/api/.env.local"
  expect_eq "$(env_file rpi web)" "apps/web/.env.rpi"
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

# --- push ---

test_push_skips_without_infisical_json() {
  rm .infisical.json
  local out
  out="$(mise/tasks/local/env/push)"
  expect_contains "$out" "Infisical is not configured (no .infisical.json); skipping"
  expect_eq "$(wc -c <"$INFISICAL_LOG" | tr -d ' ')" 0
}

test_push_first_run_creates_layout() {
  local out shared_line api_line
  out="$(mise/tasks/local/env/push)"
  expect_contains "$out" "+ DATABASE_URL (shared ref)"
  expect_contains "$out" "7 to write, 0 deleted"
  expect_contains "$out" "Pushed 7 secret(s) to local"
  expect_eq "$(remote_value local /shared DATABASE_URL)" "postgres://db-secret-1/app"
  expect_eq "$(remote_value local /shared JWT_ACCESS_SECRET)" "jwt-secret-1"
  expect_eq "$(remote_value local /apps/api DATABASE_URL)" '${local.shared.DATABASE_URL}'
  expect_eq "$(remote_value local /apps/api JWT_ACCESS_SECRET)" '${local.shared.JWT_ACCESS_SECRET}'
  expect_eq "$(remote_value local /apps/api API_PORT)" "8001"
  expect_eq "$(remote_value local /apps/web JWT_ACCESS_SECRET)" '${local.shared.JWT_ACCESS_SECRET}'
  expect_eq "$(remote_value local /apps/web AUTH_SECRET)" "auth-secret-1"
  shared_line="$(grep -n 'secrets set .*--path /shared' "$INFISICAL_LOG" | cut -d: -f1)"
  api_line="$(grep -n 'secrets set .*--path /apps/api' "$INFISICAL_LOG" | cut -d: -f1)"
  [ "$shared_line" -lt "$api_line" ] || { echo "/shared must be written before /apps/api"; cat "$INFISICAL_LOG"; return 1; }
}

test_push_staging_uses_its_file_and_slug() {
  cp apps/api/.env.local apps/api/.env.staging
  sed -i.bak 's/^API_PORT=.*/API_PORT=7000/' apps/api/.env.staging
  rm apps/api/.env.staging.bak
  cp apps/web/.env.local apps/web/.env.staging
  mise/tasks/staging/env/push >/dev/null
  expect_eq "$(remote_value staging /apps/api DATABASE_URL)" '${staging.shared.DATABASE_URL}'
  expect_eq "$(remote_value staging /apps/api API_PORT)" "7000"
  expect_eq "$(remote_value local /apps/api DATABASE_URL)" "<unset>"
}

test_push_staging_requires_its_file() {
  expect_fail "apps/api/.env.staging not found; create it from apps/api/.env.example" mise/tasks/staging/env/push
  expect_no_call "secrets set"
}

test_push_rejects_unknown_environment() {
  expect_fail "unknown environment 'qa' (environments: local, rpi, dev, staging, prod)" tools/env/push qa
}

test_push_second_run_is_a_noop() {
  mise/tasks/local/env/push >/dev/null
  : >"$INFISICAL_LOG"
  local out
  out="$(mise/tasks/local/env/push)"
  expect_contains "$out" "0 to write, 0 deleted"
  expect_contains "$out" "no changes"
  expect_no_call "secrets set"
  expect_no_call "folders create"
}

test_push_updates_changed_values_and_keeps_remote_only_keys() {
  mise/tasks/local/env/push >/dev/null
  sed -i.bak 's/^API_PORT=.*/API_PORT=9000/' apps/api/.env.local
  rm apps/api/.env.local.bak
  state_set local /apps/api LEGACY_FLAG on
  local out
  out="$(mise/tasks/local/env/push)"
  expect_contains "$out" "~ API_PORT (value changed)"
  expect_contains "$out" "! LEGACY_FLAG (only on remote, kept)"
  expect_contains "$out" "1 to write, 0 deleted"
  expect_eq "$(remote_value local /apps/api API_PORT)" "9000"
  expect_eq "$(remote_value local /apps/api LEGACY_FLAG)" "on"
}

test_push_rejects_shared_value_conflict() {
  printf 'JWT_ACCESS_SECRET=other-jwt\nAUTH_SECRET=auth-secret-1\n' >apps/web/.env.local
  expect_fail "@shared JWT_ACCESS_SECRET differs between apps/api/.env.local and apps/web/.env.local" mise/tasks/local/env/push
  expect_no_call "secrets set"
  expect_no_call "folders create"
}

test_push_rejects_inconsistent_markers() {
  printf 'JWT_ACCESS_SECRET=\nAUTH_SECRET=\n' >apps/web/.env.example
  expect_fail "JWT_ACCESS_SECRET is @shared in apps/api but not in apps/web" mise/tasks/local/env/push
  expect_no_call "secrets set"
}

test_push_dry_run_writes_nothing() {
  local before out
  before="$(cat "$INFISICAL_STATE")"
  out="$(mise/tasks/local/env/push --dry-run)"
  expect_eq "$(head -n1 <<<"$out")" "Infisical env: local"
  expect_contains "$out" "7 to write, 0 deleted"
  expect_contains "$out" "dry run: nothing written"
  expect_no_call "secrets set"
  expect_no_call "folders create"
  expect_eq "$(cat "$INFISICAL_STATE")" "$before"
}

test_push_single_app() {
  rm apps/api/.env.local
  mise/tasks/local/env/push --app web >/dev/null
  expect_eq "$(remote_value local /apps/web AUTH_SECRET)" "auth-secret-1"
  expect_eq "$(remote_value local /shared JWT_ACCESS_SECRET)" "jwt-secret-1"
  expect_eq "$(remote_value local /shared DATABASE_URL)" "<unset>"
  expect_eq "$(remote_value local /apps/api API_PORT)" "<unset>"
}

test_push_rpi_uses_its_file_and_slug() {
  cp apps/api/.env.local apps/api/.env.rpi
  cp apps/web/.env.local apps/web/.env.rpi
  mise/tasks/rpi/env/push >/dev/null
  expect_eq "$(remote_value rpi /apps/api DATABASE_URL)" '${rpi.shared.DATABASE_URL}'
  expect_eq "$(remote_value rpi /apps/web AUTH_SECRET)" "auth-secret-1"
}

test_push_ignores_plain_env_file() {
  printf 'API_PORT=1\n' >apps/api/.env
  mise/tasks/local/env/push >/dev/null
  expect_eq "$(remote_value local /apps/api API_PORT)" "8001"
}

test_push_rejects_unsupported_env_files() {
  touch apps/api/.env.production apps/web/.env.qa apps/web/.env.test apps/web/.env.pull.abc
  expect_fail "not supported: apps/api/.env.production, apps/web/.env.qa; env files must be .env.<env> for local, rpi, dev, staging, prod" mise/tasks/local/env/push
  expect_no_call "secrets set"
}

test_push_unknown_app_fails() {
  expect_fail "unknown app 'nope'" mise/tasks/local/env/push --app nope
}

test_push_requires_env_file() {
  rm apps/web/.env.local
  expect_fail "apps/web/.env.local not found; create it from apps/web/.env.example" mise/tasks/local/env/push
  expect_no_call "secrets set"
}

test_push_reports_extra_empty_and_missing_keys() {
  printf 'DATABASE_URL=postgres://db-secret-1/app\nAPI_PORT=\nEXTRA_FLAG=1\n' >apps/api/.env.local
  local out
  out="$(mise/tasks/local/env/push --dry-run)"
  expect_contains "$out" "extra (not pushed): EXTRA_FLAG"
  expect_contains "$out" "+ API_PORT (empty)"
  expect_contains "$out" "missing in .env.local, not pushed: JWT_ACCESS_SECRET"
}

test_push_stores_empty_value_as_sentinel() {
  printf 'DATABASE_URL=postgres://db-secret-1/app\nJWT_ACCESS_SECRET=jwt-secret-1\nAPI_PORT=\n' >apps/api/.env.local
  mise/tasks/local/env/push >/dev/null
  expect_eq "$(remote_value local /apps/api API_PORT)" "__EMPTY__"
  expect_contains "$(mise/tasks/local/env/push)" "0 to write"
}

test_push_explains_credentials_on_auth_failure() {
  export FAKE_INFISICAL_FAIL=1
  expect_fail "INFISICAL_TOKEN" mise/tasks/local/env/push
}

test_push_uses_token_and_project_from_env() {
  mise/tasks/local/env/push >/dev/null
  expect_call "token=env-token"
  expect_call "--projectId test"
  export INFISICAL_PROJECT_ID=other
  : >"$INFISICAL_LOG"
  mise/tasks/local/env/push >/dev/null
  expect_call "--projectId other"
  expect_no_call "--projectId test"
}

test_push_logs_in_with_universal_auth_from_env() {
  unset INFISICAL_TOKEN
  export INFISICAL_UNIVERSAL_AUTH_CLIENT_ID=id INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET=secret
  mise/tasks/local/env/push >/dev/null
  expect_call "login --method=universal-auth --plain --silent"
  expect_call "token=ua-token"
  expect_no_call "token=env-token"
}

test_push_env_token_takes_precedence_over_host_login() {
  export FAKE_INFISICAL_SESSION=1
  mise/tasks/local/env/push >/dev/null
  expect_call "token=env-token"
  expect_no_call "token=session"
  expect_no_call "login status"
}

test_push_falls_back_to_host_login() {
  unset INFISICAL_TOKEN
  export FAKE_INFISICAL_SESSION=1
  mise/tasks/local/env/push >/dev/null
  expect_call "login status --json --silent"
  expect_call "token=session"
}

test_push_fails_without_env_credentials_or_host_login() {
  unset INFISICAL_TOKEN
  expect_fail "no Infisical credentials in the environment and no host login" mise/tasks/local/env/push
  expect_no_call "secrets"
}

test_push_rejects_half_universal_auth() {
  unset INFISICAL_TOKEN
  export FAKE_INFISICAL_SESSION=1 INFISICAL_UNIVERSAL_AUTH_CLIENT_ID=id
  expect_fail "set both INFISICAL_UNIVERSAL_AUTH_CLIENT_ID" mise/tasks/local/env/push
}

test_push_fails_without_project() {
  echo '{}' >.infisical.json
  expect_fail "no Infisical project" mise/tasks/local/env/push
}

test_push_never_prints_values() {
  local out
  out="$(mise/tasks/local/env/push --dry-run 2>&1)$(mise/tasks/local/env/push 2>&1)$(mise/tasks/local/env/push 2>&1)"
  expect_no_secrets "$out"
}

# --- check ---

test_check_skips_without_infisical_json() {
  rm .infisical.json
  local out
  out="$(mise/tasks/local/env/check)"
  expect_contains "$out" "skipping"
  out="$(mise/tasks/local/env/check --remote)"
  expect_contains "$out" "skipping"
  expect_eq "$(wc -c <"$INFISICAL_LOG" | tr -d ' ')" 0
}

test_check_local_ok() {
  local out
  out="$(mise/tasks/local/env/check)"
  expect_eq "$(grep -c '^  ok$' <<<"$out")" 2
  expect_contains "$out" "✔ env matches .env.example"
  expect_eq "$(wc -c <"$INFISICAL_LOG" | tr -d ' ')" 0
}

test_check_local_reports_missing_and_extra() {
  printf 'JWT_ACCESS_SECRET=jwt-secret-1\nOLD_FLAG=1\n' >apps/web/.env.local
  run_fails mise/tasks/local/env/check
  expect_contains "$OUT" "missing: AUTH_SECRET"
  expect_contains "$OUT" "extra: OLD_FLAG"
  expect_contains "$OUT" "✖ 2 problems"
}

test_check_local_without_env_file() {
  rm apps/web/.env.local
  run_fails mise/tasks/local/env/check --app web
  expect_contains "$OUT" "missing: AUTH_SECRET, JWT_ACCESS_SECRET"
  expect_not_contains "$OUT" "apps/api"
}

test_check_remote_ok_after_push() {
  mise/tasks/local/env/push >/dev/null
  local out
  out="$(mise/tasks/local/env/check --remote)"
  expect_contains "$out" "✔ env matches .env.example"
}

test_check_remote_reports_problems() {
  mise/tasks/local/env/push >/dev/null
  state_set local /apps/api DATABASE_URL postgres://raw
  state_del local /shared JWT_ACCESS_SECRET
  state_set local /apps/web OLD_FLAG 1
  state_del local /apps/web AUTH_SECRET
  run_fails mise/tasks/local/env/check --remote
  expect_contains "$OUT" "not a shared ref: DATABASE_URL"
  expect_contains "$OUT" "shared missing: JWT_ACCESS_SECRET"
  expect_contains "$OUT" "extra: OLD_FLAG"
  expect_contains "$OUT" "missing: AUTH_SECRET"
  expect_contains "$OUT" "✖ 5 problems"
}

test_check_reports_inconsistent_markers() {
  printf 'JWT_ACCESS_SECRET=\nAUTH_SECRET=\n' >apps/web/.env.example
  run_fails mise/tasks/local/env/check
  expect_contains "$OUT" "shared markers"
  expect_contains "$OUT" "JWT_ACCESS_SECRET is @shared in apps/api but not in apps/web"
}

test_check_remote_explains_credentials_on_auth_failure() {
  export FAKE_INFISICAL_FAIL=1
  expect_fail "INFISICAL_TOKEN" mise/tasks/local/env/check --remote
}

test_check_local_needs_no_credentials() {
  unset INFISICAL_TOKEN
  mise/tasks/local/env/check >/dev/null
}

test_pull_fails_without_env_credentials_or_host_login() {
  unset INFISICAL_TOKEN
  expect_fail "no host login" mise/tasks/local/env/pull
}

test_check_never_prints_values() {
  mise/tasks/local/env/push >/dev/null
  state_set local /apps/api DATABASE_URL postgres://db-secret-1/app
  local out
  out="$(mise/tasks/local/env/check --remote 2>&1 || true)$(mise/tasks/local/env/check 2>&1 || true)"
  expect_no_secrets "$out"
}

# --- review fixes ---

test_push_round_trips_special_characters() {
  local want='a"b\c: d #e$f'
  printf "DATABASE_URL=x\nJWT_ACCESS_SECRET=jwt-secret-1\nAPI_PORT='%s'\n" "$want" >apps/api/.env.local
  mise/tasks/local/env/push >/dev/null
  expect_eq "$(remote_value local /apps/api API_PORT)" "$want"
  : >"$INFISICAL_LOG"
  expect_contains "$(mise/tasks/local/env/push)" "0 to write, 0 deleted"
}

test_push_shared_ref_label_needs_exact_reference() {
  printf 'DATABASE_URL=x\nJWT_ACCESS_SECRET=jwt-secret-1\nAPI_PORT=${other.ref}\n' >apps/api/.env.local
  local out
  out="$(mise/tasks/local/env/push --dry-run)"
  expect_contains "$out" "+ DATABASE_URL (shared ref)"
  expect_contains "$out" "+ API_PORT"
  expect_not_contains "$out" "+ API_PORT (shared ref)"
}

test_remote_export_ignores_personal_overrides() {
  mise/tasks/local/env/push >/dev/null
  : >"$INFISICAL_LOG"
  mise/tasks/local/env/check --remote >/dev/null
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
  mise/tasks/local/env/push >/dev/null
  expect_call "secrets folders get --env local --path / -o json --silent"
}

test_check_staging_reads_its_file() {
  printf 'AUTH_SECRET=x\n' >apps/web/.env.staging
  run_fails mise/tasks/staging/env/check --app web
  expect_contains "$OUT" "apps/web/.env.staging"
  expect_contains "$OUT" "missing: JWT_ACCESS_SECRET"
}

# --- pull ---

# Pull writes apps/<app>/.env; start it as a copy of the pushed .env.local.
seed_dotenv() {
  cp apps/api/.env.local apps/api/.env
  cp apps/web/.env.local apps/web/.env
}

test_pull_skips_without_infisical_json() {
  rm .infisical.json
  expect_contains "$(mise/tasks/local/env/pull)" "skipping"
  expect_eq "$(wc -c <"$INFISICAL_LOG" | tr -d ' ')" 0
}

test_pull_after_push_is_a_noop() {
  mise/tasks/local/env/push >/dev/null
  seed_dotenv
  local before out
  out="$(mise/tasks/local/env/pull)"
  expect_contains "$out" "stamp: none -> local"
  expect_contains "$out" "0 to write"
  before="$(cat apps/api/.env)"
  out="$(mise/tasks/local/env/pull)"
  expect_contains "$out" "0 to write"
  expect_not_contains "$out" "stamp:"
  expect_eq "$(grep -c '^  no changes$' <<<"$out")" 2
  expect_eq "$(cat apps/api/.env)" "$before"
}

test_pull_stamps_first_line_and_replaces_old_stamp() {
  cp apps/api/.env.local apps/api/.env.rpi
  cp apps/web/.env.local apps/web/.env.rpi
  mise/tasks/rpi/env/push >/dev/null
  mise/tasks/local/env/push >/dev/null
  mise/tasks/rpi/env/pull >/dev/null
  expect_eq "$(head -1 apps/api/.env)" "# infisical-env=rpi"
  mise/tasks/local/env/pull >/dev/null
  expect_eq "$(head -1 apps/api/.env)" "# infisical-env=local"
  expect_eq "$(grep -c '^# infisical-env=' apps/api/.env)" 1
}

test_pull_keeps_dollar_in_values() {
  mise/tasks/local/env/push >/dev/null
  state_set local /apps/api API_PORT 'pa$word$1'
  state_set local /shared JWT_ACCESS_SECRET 'jwt$HOME'
  mise/tasks/local/env/pull >/dev/null
  source tools/env/lib.sh
  expect_eq "$(dotenv_get apps/api/.env API_PORT)" 'pa$word$1'
  expect_eq "$(dotenv_get apps/web/.env JWT_ACCESS_SECRET)" 'jwt$HOME'
  expect_no_call "--expand=true"
}

test_pull_turns_empty_sentinel_into_empty_value() {
  mise/tasks/local/env/push >/dev/null
  state_set local /apps/api API_PORT __EMPTY__
  state_set local /shared JWT_ACCESS_SECRET __EMPTY__
  mise/tasks/local/env/pull >/dev/null
  expect_contains "$(cat apps/api/.env)" $'\nAPI_PORT=\n'
  expect_contains "$(cat apps/web/.env)" "JWT_ACCESS_SECRET="$'\n'
}

test_pull_resolves_other_references_through_expand() {
  mise/tasks/local/env/push >/dev/null
  jq '.folders.staging = ["/shared"]' "$INFISICAL_STATE" >"$SANDBOX/s" && mv "$SANDBOX/s" "$INFISICAL_STATE"
  state_set staging /shared AUTH_SECRET staging-auth
  state_set local /apps/web AUTH_SECRET '${staging.shared.AUTH_SECRET}'
  mise/tasks/local/env/pull --app web >/dev/null
  source tools/env/lib.sh
  expect_eq "$(dotenv_get apps/web/.env AUTH_SECRET)" "staging-auth"
  expect_call "--expand=true"
}

test_pull_fails_on_unresolvable_reference() {
  mise/tasks/local/env/push >/dev/null
  state_del local /shared JWT_ACCESS_SECRET
  run_fails mise/tasks/local/env/pull || return 1
  expect_contains "$OUT" "local:/apps/api has references that cannot be resolved: JWT_ACCESS_SECRET"
  [ ! -e apps/web/.env ] || { echo "pull must write nothing"; return 1; }
}

test_pull_resolves_shared_refs_into_missing_file() {
  mise/tasks/local/env/push >/dev/null
  local out
  out="$(mise/tasks/local/env/pull --app web)"
  expect_contains "$out" "+ JWT_ACCESS_SECRET"
  expect_contains "$out" "Pulled 2 secret(s) from local"
  source tools/env/lib.sh
  expect_eq "$(dotenv_get apps/web/.env JWT_ACCESS_SECRET)" "jwt-secret-1"
  expect_eq "$(dotenv_get apps/web/.env AUTH_SECRET)" "auth-secret-1"
  expect_contains "$(cat apps/web/.env)" "JWT_ACCESS_SECRET=jwt-secret-1"
}

test_pull_updates_values_and_keeps_other_lines() {
  mise/tasks/local/env/push >/dev/null
  seed_dotenv
  state_set local /apps/api API_PORT 9000
  printf '# keep me\nLOCAL_ONLY=1\n' >>apps/api/.env
  local out
  out="$(mise/tasks/local/env/pull)"
  expect_contains "$out" "~ API_PORT (value changed)"
  expect_contains "$out" "1 to write"
  source tools/env/lib.sh
  expect_eq "$(dotenv_get apps/api/.env API_PORT)" "9000"
  expect_eq "$(dotenv_get apps/api/.env LOCAL_ONLY)" "1"
  expect_contains "$(cat apps/api/.env)" "# keep me"
  expect_contains "$(cat apps/api/.env)" "export JWT_ACCESS_SECRET=jwt-secret-1 # local note"
}

test_pull_reports_missing_and_extra_remote_keys() {
  mise/tasks/local/env/push >/dev/null
  state_del local /apps/api API_PORT
  state_set local /apps/api LEGACY_FLAG on
  seed_dotenv
  local before
  before="$(cat apps/web/.env)"
  run_fails mise/tasks/local/env/pull || return 1
  expect_contains "$OUT" "missing on remote, not pulled: API_PORT"
  expect_contains "$OUT" "extra on remote (not pulled): LEGACY_FLAG"
  expect_contains "$OUT" "missing on Infisical local: apps/api: API_PORT"
  expect_contains "$OUT" "nothing written"
  expect_eq "$(cat apps/web/.env)" "$before"
}

test_pull_dry_run_writes_nothing() {
  mise/tasks/local/env/push >/dev/null
  seed_dotenv
  state_set local /apps/api API_PORT 9000
  local before out
  before="$(cat apps/api/.env)"
  out="$(mise/tasks/local/env/pull --dry-run)"
  expect_contains "$out" "~ API_PORT (value changed)"
  expect_contains "$out" "dry run: nothing written"
  expect_eq "$(cat apps/api/.env)" "$before"
}

test_pull_staging_writes_dotenv() {
  seed_dotenv
  cp apps/web/.env.local apps/web/.env.staging
  state_set staging /apps/web AUTH_SECRET staging-auth
  state_set staging /apps/web JWT_ACCESS_SECRET staging-jwt
  jq '.folders.staging = ["/apps", "/apps/web"]' "$INFISICAL_STATE" >"$SANDBOX/s" && mv "$SANDBOX/s" "$INFISICAL_STATE"
  local out
  out="$(mise/tasks/staging/env/pull --app web)"
  expect_contains "$out" "apps/web/.env"
  expect_contains "$out" "~ AUTH_SECRET (value changed)"
  source tools/env/lib.sh
  expect_eq "$(dotenv_get apps/web/.env AUTH_SECRET)" "staging-auth"
  expect_eq "$(dotenv_get apps/web/.env.staging AUTH_SECRET)" "auth-secret-1"
}

test_pull_rpi_writes_dotenv() {
  cp apps/api/.env.local apps/api/.env.rpi
  cp apps/web/.env.local apps/web/.env.rpi
  mise/tasks/rpi/env/push >/dev/null
  rm apps/api/.env.rpi apps/web/.env.rpi
  mise/tasks/rpi/env/pull >/dev/null
  source tools/env/lib.sh
  expect_eq "$(dotenv_get apps/api/.env DATABASE_URL)" "postgres://db-secret-1/app"
  expect_eq "$(dotenv_get apps/web/.env AUTH_SECRET)" "auth-secret-1"
  [ ! -e apps/api/.env.rpi ] || { echo "pull must not write .env.rpi"; return 1; }
}

test_pull_round_trips_special_characters() {
  mise/tasks/local/env/push >/dev/null
  local v1='a"b\c: d #e$f' v2="it's \$HOME" v3='p@ss/w0rd+=,'
  state_set local /apps/api API_PORT "$v1"
  state_set local /apps/web AUTH_SECRET "$v2"
  mise/tasks/local/env/pull >/dev/null
  source tools/env/lib.sh
  expect_eq "$(dotenv_get apps/api/.env API_PORT)" "$v1"
  expect_eq "$(dotenv_get apps/web/.env AUTH_SECRET)" "$v2"
  state_set local /apps/web AUTH_SECRET "$v3"
  mise/tasks/local/env/pull >/dev/null
  expect_contains "$(cat apps/web/.env)" "AUTH_SECRET=$v3"
}

test_pull_rejects_unwritable_value() {
  mise/tasks/local/env/push >/dev/null
  state_set local /apps/api API_PORT "a'b\"c"
  expect_fail "cannot write API_PORT: the value has both quote types" mise/tasks/local/env/pull
}

test_pull_never_prints_values() {
  mise/tasks/local/env/push >/dev/null
  state_set local /apps/api API_PORT db-secret-1
  local out
  out="$(mise/tasks/local/env/pull --dry-run 2>&1)$(mise/tasks/local/env/pull 2>&1)"
  expect_no_secrets "$out"
}

main "$@"
