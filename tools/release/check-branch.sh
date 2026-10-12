#!/usr/bin/env bash
# Usage: check-branch.sh <head branch> <base branch>
# Enforces the git flow branch names and which branch may merge into which.
set -euo pipefail

head="$1"
base="$2"
types="feature|bugfix|hotfix|release|refactor|chore|docs|test|ci|perf|style|build|revert"

fail() {
  echo "::error::$1" >&2
  exit 1
}

[[ "$head" =~ ^($types)/[a-z0-9][a-z0-9._-]*$ ]] \
  || fail "Branch '$head' must be <type>/<kebab-case>, type one of: ${types//|/, }"

if [[ "$head" =~ ^(release|hotfix)/ ]] && ! [[ "$head" =~ ^(release|hotfix)/[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  fail "Branch '$head' must be named ${head%%/*}/X.Y.Z — start it with the 'Start release' workflow"
fi

case "$base" in
  main)
    [[ "$head" =~ ^(release|hotfix)/ ]] \
      || fail "Only release/* and hotfix/* branches merge into main (got '$head')"
    ;;
  develop)
    [[ "$head" =~ ^(release|hotfix)/ ]] \
      && fail "'$head' merges into main; develop gets it through the back-merge PR opened after the release"
    ;;
  release/* | hotfix/*)
    [[ "$head" =~ ^feature/ ]] \
      && fail "'$base' only takes fixes; merge '$head' into develop for the next release"
    ;;
esac

echo "Branch '$head' → '$base' OK"
