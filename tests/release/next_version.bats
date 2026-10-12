#!/usr/bin/env bats

SCRIPT="${BATS_TEST_DIRNAME}/../../tools/release/next-version.sh"

# Commit messages arrive NUL-separated, as `git log --format=%B%x00` prints them.
commits() {
  local msg
  for msg in "$@"; do printf '%s\0' "$msg"; done
}

@test "auto: fix-only history bumps patch" {
  run bash -c "$(declare -f commits); commits 'fix: a' 'chore: b' | '$SCRIPT' 1.2.3 auto"
  [ "$status" -eq 0 ]
  [ "$output" = "1.2.4" ]
}

@test "auto: a feat bumps minor and resets patch" {
  run bash -c "$(declare -f commits); commits 'fix: a' 'feat(web): b' | '$SCRIPT' 1.2.3 auto"
  [ "$status" -eq 0 ]
  [ "$output" = "1.3.0" ]
}

@test "auto: a ! header bumps major" {
  run bash -c "$(declare -f commits); commits 'feat: a' 'refactor(api)!: b' | '$SCRIPT' 1.2.3 auto"
  [ "$status" -eq 0 ]
  [ "$output" = "2.0.0" ]
}

@test "auto: a BREAKING CHANGE footer bumps major" {
  run bash -c "$(declare -f commits); commits \$'fix: a\n\nBREAKING CHANGE: gone' | '$SCRIPT' 1.2.3 auto"
  [ "$status" -eq 0 ]
  [ "$output" = "2.0.0" ]
}

@test "auto: breaking text outside the footer does not bump major" {
  run bash -c "$(declare -f commits); commits \$'fix: mention BREAKING CHANGE: in prose' | '$SCRIPT' 1.2.3 auto"
  [ "$status" -eq 0 ]
  [ "$output" = "1.2.4" ]
}

@test "auto: fails when there are no commits" {
  run bash -c "printf '' | '$SCRIPT' 1.2.3 auto"
  [ "$status" -ne 0 ]
  [[ "$output" == *"No commits"* ]]
}

@test "explicit bumps ignore the history" {
  run "$SCRIPT" 1.2.3 patch </dev/null
  [ "$output" = "1.2.4" ]
  run "$SCRIPT" 1.2.3 minor </dev/null
  [ "$output" = "1.3.0" ]
  run "$SCRIPT" 1.2.3 major </dev/null
  [ "$output" = "2.0.0" ]
}

@test "rejects a non-semver current version" {
  run "$SCRIPT" v1.2 patch </dev/null
  [ "$status" -ne 0 ]
  [[ "$output" == *"Not a version"* ]]
}

@test "rejects an unknown bump" {
  run "$SCRIPT" 1.2.3 huge </dev/null
  [ "$status" -ne 0 ]
  [[ "$output" == *"Unknown bump"* ]]
}
