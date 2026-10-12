#!/usr/bin/env bash
# Shared helpers for the release scripts. Source, do not execute.

# Every package.json whose version moves with a release: one version for the repo.
# shellcheck disable=SC2034 # used by the scripts that source this file
VERSION_FILES=(package.json apps/api/package.json apps/web/package.json)

is_version() {
  [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

# Highest vX.Y.Z tag reachable from $1 (default HEAD); prints nothing if none.
latest_tag() {
  git tag --merged "${1:-HEAD}" --list 'v*' --sort=-v:refname \
    | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -n1 || true
}

# True when version $1 is strictly greater than version $2.
version_gt() {
  [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -n1)" = "$1" ]
}

read_version() {
  sed -nE 's/^[[:space:]]*"version":[[:space:]]*"([^"]*)".*/\1/p' "$1" | head -n1
}
