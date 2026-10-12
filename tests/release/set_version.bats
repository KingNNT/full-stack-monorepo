#!/usr/bin/env bats

SCRIPT="${BATS_TEST_DIRNAME}/../../tools/release/set-version.sh"

setup() {
  REPO="$(mktemp -d)"
  cd "$REPO"
  mkdir -p apps/api apps/web
  printf '{\n  "name": "root",\n  "version": "0.0.0",\n  "devDependencies": {\n    "version": "1.0.0"\n  }\n}\n' > package.json
  printf '{\n  "name": "api",\n  "version": "0.0.1"\n}\n' > apps/api/package.json
  printf '{\n\t"name": "web",\n\t"version": "0.1.0"\n}\n' > apps/web/package.json
}

teardown() {
  rm -rf "$REPO"
}

@test "sets the version in every package.json, keeping indentation" {
  run "$SCRIPT" 1.4.0
  [ "$status" -eq 0 ]
  grep -q '^  "version": "1.4.0",$' package.json
  grep -q '^  "version": "1.4.0"$' apps/api/package.json
  grep -q $'^\t"version": "1.4.0"$' apps/web/package.json
}

@test "only touches the top-level version" {
  "$SCRIPT" 1.4.0
  grep -q '"version": "1.0.0"' package.json
}

@test "rejects a non-semver version" {
  run "$SCRIPT" 1.4
  [ "$status" -ne 0 ]
  grep -q '"version": "0.0.0"' package.json
}
