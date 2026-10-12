#!/usr/bin/env bash
# Usage: set-version.sh <X.Y.Z> — writes the version into every package.json.
set -euo pipefail
# shellcheck source=tools/release/lib.sh
source "$(dirname "$0")/lib.sh"

is_version "${1:-}" || { echo "Not a version: '${1:-}' (expected X.Y.Z)" >&2; exit 1; }
for f in "${VERSION_FILES[@]}"; do
  sed -i.bak -E "1,/\"version\":/ s/(\"version\":[[:space:]]*\")[^\"]*\"/\1$1\"/" "$f"
  rm -f "$f.bak"
done
