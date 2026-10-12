#!/usr/bin/env bash
# Usage: next-version.sh <current X.Y.Z> <auto|patch|minor|major>
# For `auto`, reads the commit messages since the last release on stdin,
# NUL-separated (git log --format=%B%x00), and bumps per Conventional Commits.
set -euo pipefail
# shellcheck source=tools/release/lib.sh
source "$(dirname "$0")/lib.sh"

current="${1:-}"
bump="${2:-auto}"
is_version "$current" || { echo "Not a version: '$current' (expected X.Y.Z)" >&2; exit 1; }

if [ "$bump" = auto ]; then
  bump=""
  while IFS= read -r -d '' msg; do
    header="${msg%%$'\n'*}"
    [ -n "$header" ] || continue
    [ -n "$bump" ] || bump="patch"
    if [[ "$header" =~ ^[a-z]+(\([^\)]*\))?!: ]] || grep -qE '^BREAKING[ -]CHANGE:' <<<"${msg#"$header"}"; then
      bump=major
      break
    fi
    [[ "$header" =~ ^feat(\([^\)]*\))?: ]] && bump=minor
  done
  [ -n "$bump" ] || { echo "No commits since the last release; nothing to release" >&2; exit 1; }
fi

IFS=. read -r major minor patch <<<"$current"
case "$bump" in
  major) echo "$((major + 1)).0.0" ;;
  minor) echo "$major.$((minor + 1)).0" ;;
  patch) echo "$major.$minor.$((patch + 1))" ;;
  *) echo "Unknown bump: '$bump' (expected auto, patch, minor or major)" >&2; exit 1 ;;
esac
