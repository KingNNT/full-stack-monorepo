#!/usr/bin/env bash
# Usage: check-release.sh <base ref>   (e.g. origin/main)
# Run on a release/hotfix branch: the version is bumped consistently past the
# last release, and the branch already contains everything on the base.
set -euo pipefail
# shellcheck source=tools/release/lib.sh
source "$(dirname "$0")/lib.sh"

base="$1"

fail() {
  echo "::error::$1" >&2
  exit 1
}

version="$(read_version "${VERSION_FILES[0]}")"
is_version "$version" || fail "${VERSION_FILES[0]} version '$version' is not X.Y.Z"
for f in "${VERSION_FILES[@]:1}"; do
  [ "$(read_version "$f")" = "$version" ] || fail "$f version '$(read_version "$f")' differs from $version"
done

last="$(latest_tag "$base")"
last="${last#v}"
version_gt "$version" "${last:-0.0.0}" \
  || fail "Version $version is not newer than the last release v${last}; bump it with tools/release/set-version.sh"

git merge-base --is-ancestor "$base" HEAD \
  || fail "Merge $base into this branch first: the release must contain everything already released"

echo "Release v$version OK (previous: ${last:+v}${last:-none})"
