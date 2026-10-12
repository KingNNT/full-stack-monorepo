#!/usr/bin/env bats

SCRIPT="${BATS_TEST_DIRNAME}/../../tools/release/check-release.sh"

setup() {
  REPO="$(mktemp -d)"
  cd "$REPO"
  git init -q -b main
  git config user.email t@example.com
  git config user.name t
  mkdir -p apps/api apps/web
  set_versions 1.0.0
  git add -A && git commit -qm "chore: init"
  git tag v1.0.0
  git checkout -qb release/1.1.0
}

teardown() {
  rm -rf "$REPO"
}

set_versions() {
  local f
  for f in package.json apps/api/package.json apps/web/package.json; do
    printf '{\n  "name": "x",\n  "version": "%s"\n}\n' "$1" > "$f"
  done
}

@test "passes when the version is bumped everywhere and main is merged in" {
  set_versions 1.1.0
  git commit -qam "chore(release): prepare v1.1.0"
  run "$SCRIPT" main
  [ "$status" -eq 0 ]
  [[ "$output" == *"v1.1.0"* ]]
}

@test "fails when the version was not bumped" {
  git commit -q --allow-empty -m "fix: a"
  run "$SCRIPT" main
  [ "$status" -ne 0 ]
  [[ "$output" == *"not newer"* ]]
}

@test "fails when package versions disagree" {
  set_versions 1.1.0
  printf '{\n  "version": "1.0.5"\n}\n' > apps/web/package.json
  git commit -qam "chore(release): prepare v1.1.0"
  run "$SCRIPT" main
  [ "$status" -ne 0 ]
  [[ "$output" == *"apps/web/package.json"* ]]
}

@test "fails when the base has commits the branch lacks" {
  set_versions 1.1.0
  git commit -qam "chore(release): prepare v1.1.0"
  git checkout -q main
  git commit -q --allow-empty -m "fix: hotfix on main"
  git checkout -q release/1.1.0
  run "$SCRIPT" main
  [ "$status" -ne 0 ]
  [[ "$output" == *"Merge main into"* ]]
}

@test "passes without any previous tag" {
  git tag -d v1.0.0 >/dev/null
  run "$SCRIPT" main
  [ "$status" -eq 0 ]
}
