#!/usr/bin/env bats

load '../install/helpers/stubs'

TASK="${BATS_TEST_DIRNAME}/../../mise/tasks/github/setup"

# A fake gh: answers the reads the task makes and records every write payload.
# EXISTING_RULESETS: "<id>\t<name>" lines; MISSING_BRANCH: a branch that 404s;
# SECRETS: secret names.
setup() {
  setup_stub_dir
  stub gh '
case "$*" in
  "repo view"*) echo acme/app ;;
  "api user"*) echo tester ;;
  "api repos/acme/app/branches/"*)
    [[ "$*" == *"/branches/${MISSING_BRANCH:-none}"* ]] && exit 1 || exit 0 ;;
  "api repos/acme/app/rulesets --jq"*) printf "%b" "${EXISTING_RULESETS:-}" ;;
  "secret list"*) printf "%s\n" ${SECRETS:-} ;;
  *"--input -"*) { echo "## $*"; cat; echo; } >> "$STUB_DIR/payloads" ;;
esac'
}

teardown() {
  teardown_stub_dir
}

@test "creates the four rulesets when none exist" {
  run "$TASK"
  [ "$status" -eq 0 ]
  [ "$(grep -c '^## api -X POST repos/acme/app/rulesets ' "$STUB_DIR/payloads")" -eq 4 ]
  for name in develop main "release branches" "release tags"; do
    grep -q "\"name\":\"$name\"" "$STUB_DIR/payloads"
  done
}

@test "updates rulesets that already exist instead of duplicating them" {
  EXISTING_RULESETS='11\tdevelop\n22\trelease tags\n' run "$TASK"
  [ "$status" -eq 0 ]
  grep -q '^## api -X PUT repos/acme/app/rulesets/11 ' "$STUB_DIR/payloads"
  grep -q '^## api -X PUT repos/acme/app/rulesets/22 ' "$STUB_DIR/payloads"
  [ "$(grep -c '^## api -X POST' "$STUB_DIR/payloads")" -eq 2 ]
}

@test "main allows merge commits only and requires CI and PR checks" {
  run "$TASK"
  [ "$status" -eq 0 ]
  main_payload="$(grep -A20 '"name":"main"' "$STUB_DIR/payloads")"
  [[ "$main_payload" == *'"allowed_merge_methods":["merge"]'* ]]
  [[ "$main_payload" == *'"context":"policy"'* ]]
  [[ "$main_payload" == *'"context":"main"'* ]]
}

@test "makes develop the default branch and enables auto-merge" {
  run "$TASK"
  [ "$status" -eq 0 ]
  grep -q 'api -X PATCH repos/acme/app -f default_branch=develop -F allow_auto_merge=true' "$STUB_DIR/gh.calls"
}

@test "REQUIRED_APPROVALS sets the review count" {
  REQUIRED_APPROVALS=0 run "$TASK"
  [ "$status" -eq 0 ]
  grep -q '"required_approving_review_count":0' "$STUB_DIR/payloads"
}

@test "fails before changing anything when a git flow branch is missing" {
  MISSING_BRANCH=main run "$TASK"
  [ "$status" -ne 0 ]
  [[ "$output" == *"git push -u origin main develop"* ]]
  [ ! -f "$STUB_DIR/payloads" ]
}

@test "reminds about RELEASE_TOKEN only when it is missing" {
  run "$TASK"
  [[ "$output" == *"RELEASE_TOKEN"* ]]
  SECRETS="RELEASE_TOKEN OTHER" run "$TASK"
  [[ "$output" != *"gh secret set RELEASE_TOKEN"* ]]
}
