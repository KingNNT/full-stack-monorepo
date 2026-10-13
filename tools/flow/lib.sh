#!/usr/bin/env bash
# Shared helpers for the flow:* mise tasks. Source, do not execute.
# shellcheck source=tools/release/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/../release/lib.sh"

RELEASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../release" && pwd)"
FLOW_DRY_RUN="${FLOW_DRY_RUN:-0}"
FLOW_POLL_SECONDS="${FLOW_POLL_SECONDS:-3}"

# jq helpers for `gh --json` output: `checks` folds statusCheckRollup into
# pass | fail | pending | none; `review` maps an empty reviewDecision (no
# review required) to NONE.
# shellcheck disable=SC2034,SC2016 # used by the tasks that source this file; jq code, not shell
JQ_DEFS='
def checks: [.statusCheckRollup[]? | (.conclusion // .state // "")] as $c
  | if ($c | length) == 0 then "none"
    elif any($c[]; IN("FAILURE", "ERROR", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE")) then "fail"
    elif all($c[]; IN("SUCCESS", "NEUTRAL", "SKIPPED")) then "pass"
    else "pending" end;
def review: if (.reviewDecision // "") == "" then "NONE" else .reviewDecision end;
'

die() {
  echo "error: $*" >&2
  exit 1
}

# Runs a command that changes git or GitHub state; under --dry-run only prints it.
run() {
  if [ "$FLOW_DRY_RUN" = 1 ]; then
    printf '+'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

require_clean_tree() {
  [ -z "$(git status --porcelain)" ] \
    || die "the working tree has uncommitted changes; commit or stash them first"
}

fetch_origin() {
  git fetch origin --prune --tags --quiet \
    || die "could not fetch origin (network or SSH access?); try: git fetch origin"
}

# For read-only tasks: carry on with the local refs when origin is unreachable.
fetch_origin_or_warn() {
  git fetch origin --prune --tags --quiet 2>/dev/null \
    || echo "warning: could not fetch origin; showing local refs" >&2
}

has_main() {
  git rev-parse -q --verify refs/remotes/origin/main >/dev/null
}

require_main() {
  has_main || die "origin has no main branch; push it (git push -u origin main) and run: mise run github:setup"
}

require_gh() {
  gh auth status >/dev/null 2>&1 || die "gh is not authenticated; run: gh auth login"
}

# Open release/* or hotfix/* branches on origin, one per line.
open_branches() {
  git ls-remote --heads origin "refs/heads/$1/*" | sed 's|.*refs/heads/||'
}

# FLOW_COMMITLINT / FLOW_COMMITLINT_CHECK override the commands (tests). The
# install check runs by default only for the default commitlint.
commitlint_title() {
  local cmd check="${FLOW_COMMITLINT_CHECK:-}"
  [ -n "$check" ] || [ -n "${FLOW_COMMITLINT:-}" ] || check="pnpm exec commitlint --version"
  if [ -n "$check" ]; then
    read -ra cmd <<<"$check"
    "${cmd[@]}" >/dev/null 2>&1 || die "commitlint is not installed; run: pnpm install"
  fi
  read -ra cmd <<<"${FLOW_COMMITLINT:-pnpm exec commitlint}"
  printf '%s\n' "$1" | "${cmd[@]}" >&2 \
    || die "PR title '$1' is not a Conventional Commit: <type>(<scope>): <summary>"
}

# Next X.Y.Z after the latest tag on origin/main, from the commits on $1 since
# that tag — the same computation as release-start.yml. $2: auto (default),
# patch, minor or major. Callers check origin/main first (require_main).
next_version() {
  local ref="$1" bump="${2:-auto}" last current tmp rc=0
  git rev-parse -q --verify "$ref^{commit}" >/dev/null || die "'$ref' does not exist; fetch origin first"
  last="$(latest_tag origin/main)"
  current="${last#v}"
  current="${current:-0.0.0}"
  if [ "$bump" = auto ]; then
    # Through a file: next-version.sh stops reading at the first breaking
    # commit, and a pipe would then SIGPIPE git log.
    tmp="$(mktemp)"
    git log --no-merges --format=%B%x00 "${last:+$last..}$ref" >"$tmp" \
      || { rm -f "$tmp"; die "could not read the commits on $ref"; }
    "$RELEASE_DIR/next-version.sh" "$current" auto <"$tmp" || rc=$?
    rm -f "$tmp"
    return "$rc"
  else
    "$RELEASE_DIR/next-version.sh" "$current" "$bump" </dev/null
  fi
}

# Re-runs "$@" until it prints something, then prints that; gives up after 20 tries.
poll_for() {
  local out _
  for _ in $(seq 1 20); do
    if out="$("$@")" && [ -n "$out" ]; then
      echo "$out"
      return 0
    fi
    sleep "$FLOW_POLL_SECONDS"
  done
  return 1
}
