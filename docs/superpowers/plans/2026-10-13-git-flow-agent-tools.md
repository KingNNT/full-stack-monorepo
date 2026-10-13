# Git Flow Agent Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `mise run flow:*` tasks plus a `git-flow` skill so any agent can drive the repo's full git flow with the same rules CI enforces.

**Architecture:** Bash mise file tasks in `mise/tasks/flow/` share `tools/flow/lib.sh`, which reuses `tools/release/*` (branch rules, version math). Every outward-facing command goes through `run`, which only prints under `--dry-run`. A thin skill in `.agents/skills/git-flow/` (symlinked into `.claude/skills/`) tells agents which task to call and where to ask the user.

**Tech Stack:** bash 5, git, gh CLI (`--json`/`--jq`), jq (tests), shellcheck, mise file tasks, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-13-git-flow-agent-tools-design.md`

## Global Constraints

- Tasks: executable bash, `#!/usr/bin/env bash`, `#MISE description="…"` header, `set -euo pipefail`, 2-space indent, quoted variables (matches `mise/tasks/**`).
- Tasks source the lib with `source "$(git rev-parse --show-toplevel)/tools/flow/lib.sh"` preceded by `# shellcheck source=tools/flow/lib.sh`.
- No new dependencies. Tests are plain bash; `gh` is faked; commitlint is stubbed via `FLOW_COMMITLINT`.
- Mutating calls (`git switch`, `git config`, `git push`, `gh pr create`, `gh pr merge`, `gh workflow run`) only through `run`.
- Never `--squash`/`--rebase` in `flow:finish` or `flow:back-merge`.
- Never `npm`/`npx`/`yarn`; never touch `.env*`.
- **No git commits, pushes or branches during implementation** — the user handles git. Where the TDD template says "commit", stop instead.
- All `shellcheck -x` runs from the repo root must be clean.

## Review Focus

1. Real `gh` JSON differs from the happy fixtures: `reviewDecision` is `""` when no review is required (`REQUIRED_APPROVALS=0`), and status contexts carry `state` instead of `conclusion` → must fold to `review:NONE` / `checks:pending`, and `NONE` must not block `flow:finish`. Test: Task 3 `test_status_folds_check_states`, Task 5 `test_finish_allows_no_required_review`.
2. Branch names typed by a person: capitals, punctuation, non-ASCII (`"Fix: Ñandú crash!!"`) → `bugfix/fix-and-crash`, no `sed: illegal byte sequence` on macOS. Test: Task 1 `test_start_slugifies_non_ascii`.
3. Running a task from a subdirectory or directly (not via mise) must still find the lib. Test: Task 1 `test_start_runs_from_subdirectory`.
4. A repo with no `v*` tag yet (fresh project from the template) → version base `0.0.0`, release computed from all commits. Test: Task 4 `test_release_without_any_tag`.
5. The real commitlint (config-conventional) is stricter than the stub (e.g. subject case). Covered by the manual check in Task 7 Step 6.

---

### Task 1: Shared lib, test harness and `flow:start`

**Files:**
- Create: `tools/flow/lib.sh`
- Create: `tools/flow/test/run.sh`
- Create: `tools/flow/test/gh`
- Create: `tools/flow/test/commitlint`
- Create: `mise/tasks/flow/start`
- Create: `mise/tasks/flow/test`

**Interfaces:**
- Produces (`tools/flow/lib.sh`, sourced; also sources `tools/release/lib.sh` → `is_version`, `latest_tag`, `version_gt`, `read_version`, `VERSION_FILES`):
  - `RELEASE_DIR` — absolute path of `tools/release`
  - `FLOW_DRY_RUN` (0/1), `FLOW_POLL_SECONDS` (default 3)
  - `JQ_DEFS` — jq defs `checks` (→ `pass|fail|pending|none`) and `review` (→ reviewDecision or `NONE`)
  - `die <msg>` → stderr `error: <msg>`, exit 1
  - `run <cmd…>` → runs it, or prints `+ <cmd %q-quoted>` when `FLOW_DRY_RUN=1`
  - `require_clean_tree`, `fetch_origin`, `require_gh`
  - `open_branches <release|hotfix>` → remote branch names, one per line
  - `commitlint_title <title>` → dies unless `${FLOW_COMMITLINT:-pnpm exec commitlint}` accepts it
  - `next_version <ref> [auto|patch|minor|major]` → prints `X.Y.Z` after the latest tag on `origin/main`; fails (stderr from `next-version.sh`) when nothing to release
  - `poll_for <cmd…>` → re-runs until it prints non-empty output, prints it; returns 1 after 20 tries
- Produces (tests): `tools/flow/test/run.sh [name-filter]`; helpers `gh_rule <argv-glob> <exit> <json> [once]`, `commit <msg>`, `open_remote_branch <branch>`, `expect_eq`, `expect_contains`, `expect_fail <substring> <cmd…>`, `expect_gh <substring>`, `expect_no_gh <substring>`, `expect_no_ref <ref>`. New test functions are named `test_*` and inserted **above the final `main "$@"` line**.
- Produces (git config): `branch.<branch>.flowBase` = base branch, read by `flow:pr`.

- [ ] **Step 1: Write the fake `gh`**

`tools/flow/test/gh` (chmod +x):

```bash
#!/usr/bin/env bash
# Test double for gh: appends its argv to $GH_LOG and answers from $GH_RULES.
# Rule line: <glob over argv>|<exit code>|<once or empty>|<json body>
# The first matching rule wins; a `once` rule is removed after it matches.
# With --jq, the body is filtered through jq -r like gh does.
set -euo pipefail
printf '%s\n' "$*" >>"$GH_LOG"

args=("$@")
jq_expr=""
for i in "${!args[@]}"; do
  if [ "${args[$i]}" = --jq ]; then
    jq_expr="${args[$((i + 1))]}"
  fi
done

n=0
while IFS= read -r line; do
  n=$((n + 1))
  pattern="${line%%|*}"
  rest="${line#*|}"
  code="${rest%%|*}"
  rest="${rest#*|}"
  once="${rest%%|*}"
  body="${rest#*|}"
  # shellcheck disable=SC2053 # the rule is a glob on purpose
  [[ "$*" == $pattern ]] || continue
  if [ "$once" = once ]; then
    sed -i.bak "${n}d" "$GH_RULES"
    rm -f "$GH_RULES.bak"
  fi
  if [ -n "$body" ]; then
    if [ -n "$jq_expr" ]; then
      printf '%s' "$body" | jq -r "$jq_expr"
    else
      printf '%s\n' "$body"
    fi
  fi
  exit "$code"
done <"$GH_RULES"
```

- [ ] **Step 2: Write the commitlint stub**

`tools/flow/test/commitlint` (chmod +x):

```bash
#!/usr/bin/env bash
# Test double for commitlint: accepts a Conventional Commits header on stdin.
read -r title
[[ "$title" =~ ^[a-z]+(\([a-z0-9._-]+\))?!?:\ .+ ]]
```

- [ ] **Step 3: Write the harness and the `flow:start` tests**

`tools/flow/test/run.sh` (chmod +x):

```bash
#!/usr/bin/env bash
# Tests for the flow:* mise tasks: tools/flow/test/run.sh [name-filter]
# Each case runs in a throwaway repo with a local bare origin, the fake gh in
# this directory and a commitlint stub. No network, no GitHub.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TESTS="$ROOT/tools/flow/test"

setup() {
  SANDBOX="$(mktemp -d)"
  trap 'rm -rf "$SANDBOX"' EXIT
  mkdir -p "$SANDBOX/bin"
  cp "$TESTS/gh" "$SANDBOX/bin/gh"
  export PATH="$SANDBOX/bin:$PATH"
  export GH_LOG="$SANDBOX/gh.log" GH_RULES="$SANDBOX/gh.rules"
  export FLOW_COMMITLINT="$TESTS/commitlint" FLOW_POLL_SECONDS=0
  export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
  export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com
  export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com
  : >"$GH_LOG"
  : >"$GH_RULES"
  gh_rule 'auth status*' 0 ''

  git init -q --bare "$SANDBOX/origin.git"
  git init -q -b main "$SANDBOX/repo"
  cd "$SANDBOX/repo"
  mkdir -p apps/api apps/web tools mise/tasks
  for f in package.json apps/api/package.json apps/web/package.json; do
    printf '{\n  "name": "x",\n  "version": "1.2.0"\n}\n' >"$f"
  done
  cp -R "$ROOT/tools/release" "$ROOT/tools/flow" tools/
  cp -R "$ROOT/mise/tasks/flow" mise/tasks/
  git add -A
  git commit -qm "chore: init"
  git tag -a v1.2.0 -m v1.2.0
  git remote add origin "$SANDBOX/origin.git"
  git push -q origin main v1.2.0
  git switch -qc develop
  git push -q -u origin develop
}

gh_rule() { # <argv glob> <exit code> <json body> [once]
  printf '%s|%s|%s|%s\n' "$1" "$2" "${4:-}" "$3" >>"$GH_RULES"
}

commit() { # <message>
  echo "$1" >>notes.txt
  git add notes.txt
  git commit -qm "$1"
}

open_remote_branch() { # <branch> — pushes develop's head as <branch>
  git push -q origin "develop:refs/heads/$1"
}

expect_eq() {
  [ "$1" = "$2" ] || { echo "expected '$2', got '$1'"; return 1; }
}

expect_contains() { # <output> <substring>
  grep -qF -- "$2" <<<"$1" || { echo "expected '$2' in:"; echo "$1"; return 1; }
}

expect_fail() { # <substring of the error> <cmd…>
  local want="$1" out
  shift
  if out="$("$@" 2>&1)"; then
    echo "expected failure: $*"
    echo "$out"
    return 1
  fi
  expect_contains "$out" "$want"
}

expect_gh() {
  grep -qF -- "$1" "$GH_LOG" || { echo "gh not called with: $1"; echo "gh calls:"; cat "$GH_LOG"; return 1; }
}

expect_no_gh() {
  if grep -qF -- "$1" "$GH_LOG"; then
    echo "gh unexpectedly called with: $1"
    cat "$GH_LOG"
    return 1
  fi
}

expect_no_ref() {
  if git rev-parse -q --verify "$1" >/dev/null; then
    echo "unexpected ref: $1"
    return 1
  fi
}

# --- flow:start ---

test_start_feature_branches_from_develop() {
  mise/tasks/flow/start feature "Add OAuth Login"
  expect_eq "$(git branch --show-current)" feature/add-oauth-login
  expect_eq "$(git config branch.feature/add-oauth-login.flowBase)" develop
  expect_eq "$(git rev-parse HEAD)" "$(git rev-parse origin/develop)"
}

test_start_joins_words_into_name() {
  mise/tasks/flow/start chore bump deps
  expect_eq "$(git branch --show-current)" chore/bump-deps
}

test_start_slugifies_non_ascii() {
  mise/tasks/flow/start bugfix "Fix: Ñandú crash!!"
  expect_eq "$(git branch --show-current)" bugfix/fix-and-crash
}

test_start_runs_from_subdirectory() {
  (cd apps && ../mise/tasks/flow/start feature x)
  expect_eq "$(git branch --show-current)" feature/x
}

test_start_bugfix_from_open_release() {
  open_remote_branch release/1.3.0
  mise/tasks/flow/start bugfix login-crash --from release/1.3.0
  expect_eq "$(git config branch.bugfix/login-crash.flowBase)" release/1.3.0
}

test_start_bugfix_notes_open_release() {
  open_remote_branch release/1.3.0
  local out
  out="$(mise/tasks/flow/start bugfix x 2>&1)"
  expect_contains "$out" "release/1.3.0"
  expect_eq "$(git config branch.bugfix/x.flowBase)" develop
}

test_start_bugfix_from_unknown_release_fails() {
  expect_fail "not an open release/hotfix branch" mise/tasks/flow/start bugfix x --from release/9.9.9
}

test_start_rejects_release_and_hotfix() {
  expect_fail "flow:release" mise/tasks/flow/start release 1.3.0
  expect_fail "flow:release" mise/tasks/flow/start hotfix urgent
}

test_start_rejects_unknown_type() {
  expect_fail "unknown type" mise/tasks/flow/start feat x
}

test_start_rejects_missing_or_empty_name() {
  expect_fail "usage" mise/tasks/flow/start feature
  expect_fail "empty" mise/tasks/flow/start feature '!!!'
}

test_start_only_bugfix_takes_from() {
  expect_fail "only bugfix takes --from" mise/tasks/flow/start feature x --from main
}

test_start_requires_clean_tree() {
  echo x >dirty.txt
  expect_fail "uncommitted" mise/tasks/flow/start feature x
}

test_start_existing_branch_fails() {
  git branch feature/x
  expect_fail "already exists" mise/tasks/flow/start feature x
}

test_start_dry_run_changes_nothing() {
  local out
  out="$(mise/tasks/flow/start feature x --dry-run)"
  expect_contains "$out" "+ git switch --no-track -c feature/x origin/develop"
  expect_eq "$(git branch --show-current)" develop
}

main() {
  local filter="${1:-}" name out status pass=0 failed=0
  out="$(mktemp)"
  for name in $(declare -F | awk '{print $3}' | grep '^test_'); do
    [[ "$name" == *"$filter"* ]] || continue
    (
      set -e
      setup
      "$name"
    ) >"$out" 2>&1
    status=$?
    if [ "$status" -eq 0 ]; then
      pass=$((pass + 1))
      echo "ok - $name"
    else
      failed=$((failed + 1))
      echo "not ok - $name"
      sed 's/^/    /' "$out"
    fi
  done
  rm -f "$out"
  echo "$pass passed, $failed failed"
  [ "$failed" -eq 0 ]
}

main "$@"
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `tools/flow/test/run.sh test_start`
Expected: every case `not ok` (`mise/tasks/flow/start: No such file or directory` — setup's `cp -R mise/tasks/flow` also fails until the directory exists).

- [ ] **Step 5: Write `tools/flow/lib.sh`**

```bash
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
# shellcheck disable=SC2034 # used by the tasks that source this file
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
  git fetch origin --prune --tags --quiet
}

require_gh() {
  gh auth status >/dev/null 2>&1 || die "gh is not authenticated; run: gh auth login"
}

# Open release/* or hotfix/* branches on origin, one per line.
open_branches() {
  git ls-remote --heads origin "refs/heads/$1/*" | sed 's|.*refs/heads/||'
}

commitlint_title() {
  local cmd
  read -ra cmd <<<"${FLOW_COMMITLINT:-pnpm exec commitlint}"
  printf '%s\n' "$1" | "${cmd[@]}" >&2 \
    || die "PR title '$1' is not a Conventional Commit: <type>(<scope>): <summary>"
}

# Next X.Y.Z after the latest tag on origin/main, from the commits on $1 since
# that tag — the same computation as release-start.yml. $2: auto (default),
# patch, minor or major.
next_version() {
  local ref="$1" bump="${2:-auto}" last current
  last="$(latest_tag origin/main)"
  current="${last#v}"
  current="${current:-0.0.0}"
  if [ "$bump" = auto ]; then
    git log --no-merges --format=%B%x00 "${last:+$last..}$ref" \
      | "$RELEASE_DIR/next-version.sh" "$current" auto
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
```

- [ ] **Step 6: Write `mise/tasks/flow/start`** (chmod +x)

```bash
#!/usr/bin/env bash
#MISE description="Start a branch off the right base: flow:start <type> <name> [--from <base>] [--dry-run]"
# Types and bases follow tools/release/check-branch.sh; release/* and hotfix/*
# come from flow:release instead. Records the base for flow:pr; does not push.
set -euo pipefail
# shellcheck source=tools/flow/lib.sh
source "$(git rev-parse --show-toplevel)/tools/flow/lib.sh"

usage="usage: mise run flow:start <type> <name> [--from <base>] [--dry-run]"
type="" name="" from=""
while [ $# -gt 0 ]; do
  case "$1" in
    --from)
      [ $# -ge 2 ] || die "--from needs a branch; $usage"
      from="$2"
      shift 2
      ;;
    --dry-run)
      FLOW_DRY_RUN=1
      shift
      ;;
    -*) die "unknown option '$1'; $usage" ;;
    *)
      if [ -z "$type" ]; then type="$1"; else name="${name:+$name }$1"; fi
      shift
      ;;
  esac
done
[ -n "$type" ] && [ -n "$name" ] || die "$usage"

case "$type" in
  release | hotfix) die "$type branches are cut by the Start release workflow; run: mise run flow:release $type" ;;
  bugfix) base="${from:-develop}" ;;
  feature | refactor | chore | docs | test | ci | perf | style | build | revert)
    [ -z "$from" ] || [ "$from" = develop ] || die "$type branches start from develop; only bugfix takes --from"
    base=develop
    ;;
  *) die "unknown type '$type'; use one of: feature, bugfix, refactor, chore, docs, test, ci, perf, style, build, revert" ;;
esac

slug="$(printf '%s' "$name" | LC_ALL=C tr '[:upper:]' '[:lower:]' \
  | LC_ALL=C sed -E 's/[^a-z0-9._-]+/-/g; s/^[-._]+//; s/[-._]+$//')"
[ -n "$slug" ] || die "name '$name' is empty once reduced to [a-z0-9._-]"
branch="$type/$slug"

require_clean_tree
fetch_origin

if [ "$type" = bugfix ]; then
  open="$(open_branches release; open_branches hotfix)"
  if [ "$base" != develop ]; then
    grep -qxF -- "$base" <<<"$open" \
      || die "'$base' is not an open release/hotfix branch (open: ${open:-none})"
  elif [ -n "$open" ]; then
    echo "note: open release/hotfix branch(es): ${open//$'\n'/, } — to fix one of them, pass --from <branch>" >&2
  fi
fi

"$RELEASE_DIR/check-branch.sh" "$branch" "$base" >/dev/null
if git rev-parse -q --verify "refs/heads/$branch" >/dev/null \
  || git rev-parse -q --verify "refs/remotes/origin/$branch" >/dev/null; then
  die "branch '$branch' already exists"
fi

run git switch --no-track -c "$branch" "origin/$base"
run git config "branch.$branch.flowBase" "$base"
[ "$FLOW_DRY_RUN" = 1 ] || echo "On $branch (base: $base). Commit your work, then: mise run flow:pr"
```

- [ ] **Step 7: Write `mise/tasks/flow/test`** (chmod +x)

```bash
#!/usr/bin/env bash
#MISE description="Shellcheck and test the flow:* tasks: flow:test [name-filter]"
set -euo pipefail
shellcheck -x tools/flow/lib.sh tools/flow/test/run.sh tools/flow/test/gh tools/flow/test/commitlint mise/tasks/flow/*
tools/flow/test/run.sh "$@"
```

- [ ] **Step 8: Run the tests and shellcheck**

Run: `chmod +x tools/flow/test/run.sh tools/flow/test/gh tools/flow/test/commitlint mise/tasks/flow/* && mise run flow:test test_start`
Expected: shellcheck silent; `14 passed, 0 failed`.

- [ ] **Step 9: Stop — no commit** (the user handles git).

---

### Task 2: `flow:pr`

**Files:**
- Create: `mise/tasks/flow/pr`
- Modify: `tools/flow/test/run.sh` (insert tests above `main "$@"`)

**Interfaces:**
- Consumes: `die`, `run`, `require_gh`, `fetch_origin`, `commitlint_title`, `RELEASE_DIR`, `branch.<b>.flowBase` (Task 1).
- Produces: `mise run flow:pr [--title <t>] [--body-file <f>] [--draft] [--dry-run]`.

- [ ] **Step 1: Write the failing tests** (insert above `main "$@"`)

```bash
# --- flow:pr ---

start_with_commit() {
  mise/tasks/flow/start feature x >/dev/null
  commit "feat(api): add x"
}

test_pr_opens_pr_into_flow_base() {
  start_with_commit
  gh_rule 'pr view*' 1 ''
  mise/tasks/flow/pr
  expect_eq "$(git rev-parse origin/feature/x)" "$(git rev-parse HEAD)"
  expect_gh "pr create --base develop --head feature/x --title feat(api): add x --body - feat(api): add x"
}

test_pr_bugfix_targets_release() {
  open_remote_branch release/1.3.0
  mise/tasks/flow/start bugfix crash --from release/1.3.0 >/dev/null
  commit "fix(web): stop crash"
  gh_rule 'pr view*' 1 ''
  mise/tasks/flow/pr
  expect_gh "pr create --base release/1.3.0 --head bugfix/crash"
}

test_pr_body_file_and_draft() {
  start_with_commit
  gh_rule 'pr view*' 1 ''
  printf '## Summary\n\n## Test plan\n' >"$SANDBOX/body.md"
  mise/tasks/flow/pr --body-file "$SANDBOX/body.md" --draft
  expect_gh "--body-file $SANDBOX/body.md --draft"
}

test_pr_bad_title_fails_before_push() {
  start_with_commit
  expect_fail "not a Conventional Commit" mise/tasks/flow/pr --title "Add stuff"
  expect_no_ref origin/feature/x
  expect_no_gh "pr create"
}

test_pr_multiple_commits_need_title() {
  start_with_commit
  commit "feat(api): more"
  gh_rule 'pr view*' 1 ''
  expect_fail "--title" mise/tasks/flow/pr
  mise/tasks/flow/pr --title "feat(api): add x and more"
  expect_gh "pr create --base develop --head feature/x --title feat(api): add x and more"
}

test_pr_no_commits_fails() {
  mise/tasks/flow/start feature x >/dev/null
  expect_fail "no commits ahead" mise/tasks/flow/pr
}

test_pr_existing_pr_prints_url() {
  start_with_commit
  gh_rule 'pr view*' 0 '{"url":"https://github.com/o/r/pull/7"}'
  local out
  out="$(mise/tasks/flow/pr)"
  expect_contains "$out" "https://github.com/o/r/pull/7"
  expect_no_gh "pr create"
}

test_pr_refuses_flow_branches() {
  expect_fail "not a working branch" mise/tasks/flow/pr
}

test_pr_dry_run_does_not_push() {
  start_with_commit
  gh_rule 'pr view*' 1 ''
  local out
  out="$(mise/tasks/flow/pr --dry-run)"
  expect_contains "$out" "+ git push -u origin feature/x"
  expect_contains "$out" "+ gh pr create --base develop --head feature/x"
  expect_no_ref origin/feature/x
  expect_no_gh "pr create"
}
```

- [ ] **Step 2: Run to verify they fail**

Run: `tools/flow/test/run.sh test_pr`
Expected: 9 `not ok` (`mise/tasks/flow/pr: No such file or directory`).

- [ ] **Step 3: Write `mise/tasks/flow/pr`** (chmod +x)

```bash
#!/usr/bin/env bash
#MISE description="Push the current branch and open its PR into the right base: flow:pr [--title <t>] [--body-file <f>] [--draft] [--dry-run]"
# The base is the one flow:start recorded (develop otherwise). Branch, target
# and title are checked locally with the same rules as the PR checks.
set -euo pipefail
# shellcheck source=tools/flow/lib.sh
source "$(git rev-parse --show-toplevel)/tools/flow/lib.sh"

usage="usage: mise run flow:pr [--title <t>] [--body-file <f>] [--draft] [--dry-run]"
title="" body_file=""
draft=()
while [ $# -gt 0 ]; do
  case "$1" in
    --title)
      [ $# -ge 2 ] || die "$usage"
      title="$2"
      shift 2
      ;;
    --body-file)
      [ $# -ge 2 ] || die "$usage"
      body_file="$2"
      shift 2
      ;;
    --draft)
      draft=(--draft)
      shift
      ;;
    --dry-run)
      FLOW_DRY_RUN=1
      shift
      ;;
    *) die "unknown argument '$1'; $usage" ;;
  esac
done

branch="$(git branch --show-current)"
[ -n "$branch" ] || die "detached HEAD; switch to your branch first"
case "$branch" in
  main | develop | release/* | hotfix/*)
    die "'$branch' is not a working branch; start one with: mise run flow:start <type> <name>"
    ;;
esac
[ -z "$body_file" ] || [ -f "$body_file" ] || die "--body-file '$body_file' does not exist"

require_gh
fetch_origin
base="$(git config "branch.$branch.flowBase" || echo develop)"
git rev-parse -q --verify "origin/$base" >/dev/null || die "base '$base' is not on origin; was it merged or deleted?"
"$RELEASE_DIR/check-branch.sh" "$branch" "$base" >/dev/null

ahead="$(git rev-list --count "origin/$base..HEAD")"
[ "$ahead" -gt 0 ] || die "no commits ahead of origin/$base; commit your work first"
if [ -z "$title" ]; then
  [ "$ahead" -eq 1 ] \
    || die "$ahead commits ahead of origin/$base; pass --title '<type>(<scope>): <summary>' (it becomes the squash commit)"
  title="$(git log -1 --format=%s)"
fi
commitlint_title "$title"

run git push -u origin "$branch"
if url="$(gh pr view "$branch" --json url --jq .url 2>/dev/null)" && [ -n "$url" ]; then
  echo "PR already open: $url"
  exit 0
fi
if [ -n "$body_file" ]; then
  body=(--body-file "$body_file")
else
  body=(--body "$(git log --reverse --format='- %s' "origin/$base..HEAD")")
fi
run gh pr create --base "$base" --head "$branch" --title "$title" "${body[@]}" "${draft[@]}"
```

- [ ] **Step 4: Run tests and shellcheck**

Run: `mise run flow:test`
Expected: shellcheck silent; `23 passed, 0 failed`.

- [ ] **Step 5: Stop — no commit.**

---

### Task 3: `flow:status`

**Files:**
- Create: `mise/tasks/flow/status`
- Modify: `tools/flow/test/run.sh` (insert above `main "$@"`)

**Interfaces:**
- Consumes: `JQ_DEFS`, `open_branches`, `latest_tag`, `next_version`, `require_gh`, `fetch_origin`.
- Produces: `mise run flow:status`; release PR lines formatted `#<n> <head> → <base>  checks:<c> review:<r> mergeable:<m>  <url>`.

- [ ] **Step 1: Write the failing tests**

```bash
# --- flow:status ---

test_status_shows_release_prs_and_next_version() {
  open_remote_branch release/1.3.0
  commit "feat(api): add x"
  git push -q origin develop
  gh_rule 'pr list --base main*' 0 '[{"number":5,"headRefName":"release/1.3.0","baseRefName":"main","reviewDecision":"APPROVED","mergeable":"MERGEABLE","url":"https://github.com/o/r/pull/5","statusCheckRollup":[{"conclusion":"SUCCESS"}]}]'
  local out
  out="$(mise/tasks/flow/status)"
  expect_contains "$out" "#5 release/1.3.0 → main  checks:pass review:APPROVED mergeable:MERGEABLE"
  expect_contains "$out" "latest tag: v1.2.0"
  expect_contains "$out" "next release (auto): v1.3.0"
}

test_status_folds_check_states() {
  gh_rule 'pr list --base main*' 0 '[{"number":5,"headRefName":"release/1.3.0","baseRefName":"main","reviewDecision":"","mergeable":"MERGEABLE","url":"u5","statusCheckRollup":[{"conclusion":"SUCCESS"},{"state":"PENDING"}]},{"number":6,"headRefName":"hotfix/1.2.1","baseRefName":"main","reviewDecision":"REVIEW_REQUIRED","mergeable":"CONFLICTING","url":"u6","statusCheckRollup":[{"conclusion":"SUCCESS"},{"conclusion":"FAILURE"}]},{"number":7,"headRefName":"feature/stray","baseRefName":"main","reviewDecision":"","mergeable":"MERGEABLE","url":"u7","statusCheckRollup":[]}]'
  local out
  out="$(mise/tasks/flow/status)"
  expect_contains "$out" "#5 release/1.3.0 → main  checks:pending review:NONE"
  expect_contains "$out" "#6 hotfix/1.2.1 → main  checks:fail review:REVIEW_REQUIRED mergeable:CONFLICTING"
  if grep -qF "#7" <<<"$out"; then echo "non-release PR listed"; return 1; fi
}

test_status_nothing_to_release() {
  local out
  out="$(mise/tasks/flow/status)"
  expect_contains "$out" "nothing to release"
}
```

- [ ] **Step 2: Run to verify they fail**

Run: `tools/flow/test/run.sh test_status`
Expected: 3 `not ok`.

- [ ] **Step 3: Write `mise/tasks/flow/status`** (chmod +x)

```bash
#!/usr/bin/env bash
#MISE description="Show git flow state: open releases and their PRs, back-merges, recent runs, next version"
set -euo pipefail
# shellcheck source=tools/flow/lib.sh
source "$(git rev-parse --show-toplevel)/tools/flow/lib.sh"

require_gh
fetch_origin

echo "== Branch"
branch="$(git branch --show-current)"
if [ -n "$branch" ]; then
  echo "$branch (base: $(git config "branch.$branch.flowBase" || echo unknown))"
else
  echo "detached HEAD"
fi

echo
echo "== Release/hotfix branches"
open="$(open_branches release; open_branches hotfix)"
echo "${open:-none}"
gh pr list --base main --state open \
  --json number,headRefName,baseRefName,reviewDecision,mergeable,statusCheckRollup,url \
  --jq "$JQ_DEFS"' .[] | select(.headRefName | test("^(release|hotfix)/"))
    | "#\(.number) \(.headRefName) → \(.baseRefName)  checks:\(checks) review:\(review) mergeable:\(.mergeable)  \(.url)"'

echo
echo "== Back-merge PRs"
back_merges="$(gh pr list --state open --limit 100 --json number,headRefName,baseRefName,statusCheckRollup,url \
  --jq "$JQ_DEFS"' .[] | select(.headRefName | startswith("chore/back-merge-v"))
    | "#\(.number) \(.headRefName) → \(.baseRefName)  checks:\(checks)  \(.url)"')"
echo "${back_merges:-none}"

echo
echo "== Recent runs"
for workflow in release-start.yml release-finish.yml deploy.yml; do
  echo "$workflow:"
  gh run list --workflow "$workflow" --limit 3 --json status,conclusion,headBranch,createdAt,url \
    --jq '.[] | "  \(.createdAt[:16]) \(.status)/\(if .conclusion == "" then "-" else .conclusion end) \(.headBranch)  \(.url)"' \
    || echo "  (unavailable)"
done

echo
echo "== Versions"
last="$(latest_tag origin/main)"
echo "latest tag: ${last:-none}"
if next="$(next_version origin/develop 2>/dev/null)"; then
  echo "next release (auto): v$next"
else
  echo "next release: nothing to release on develop"
fi
```

- [ ] **Step 4: Run tests and shellcheck**

Run: `mise run flow:test`
Expected: `26 passed, 0 failed`.

- [ ] **Step 5: Stop — no commit.**

---

### Task 4: `flow:release`

**Files:**
- Create: `mise/tasks/flow/release`
- Modify: `tools/flow/test/run.sh` (insert above `main "$@"`)

**Interfaces:**
- Consumes: `open_branches`, `latest_tag`, `is_version`, `version_gt`, `next_version`, `poll_for`, `run`, `die`.
- Produces: `mise run flow:release [release|hotfix] [--bump auto|patch|minor|major] [--version X.Y.Z] [--dry-run]`; prints `Starting <kind>/<X.Y.Z> from <base> …`.

- [ ] **Step 1: Write the failing tests**

```bash
# --- flow:release ---

release_rules() {
  gh_rule 'secret list*' 0 '[{"name":"RELEASE_TOKEN"}]'
}

test_release_dispatches_and_follows_the_run() {
  commit "feat(api): add x"
  git push -q origin develop
  release_rules
  gh_rule 'run list*' 0 '[{"databaseId":1}]' once
  gh_rule 'run list*' 0 '[{"databaseId":2}]'
  gh_rule 'pr list --head release/1.3.0*' 0 '[{"url":"https://github.com/o/r/pull/9"}]'
  local out
  out="$(mise/tasks/flow/release)"
  expect_gh "workflow run release-start.yml -f kind=release -f bump=auto"
  expect_gh "run watch 2 --exit-status"
  expect_contains "$out" "Starting release/1.3.0 from develop"
  expect_contains "$out" "https://github.com/o/r/pull/9"
}

test_release_hotfix_with_version() {
  release_rules
  local out
  out="$(mise/tasks/flow/release hotfix --version 1.2.1 --dry-run)"
  expect_contains "$out" "Starting hotfix/1.2.1 from main"
  expect_contains "$out" "+ gh workflow run release-start.yml -f kind=hotfix -f bump=auto -f version=1.2.1"
  expect_no_gh "workflow run"
}

test_release_hotfix_auto_bumps_patch() {
  release_rules
  local out
  out="$(mise/tasks/flow/release hotfix --dry-run)"
  expect_contains "$out" "Starting hotfix/1.2.1 from main"
  expect_contains "$out" "-f bump=patch"
}

test_release_without_any_tag() {
  git tag -d v1.2.0 >/dev/null
  git push -q origin :refs/tags/v1.2.0
  commit "feat(api): add x"
  git push -q origin develop
  release_rules
  local out
  out="$(mise/tasks/flow/release --dry-run)"
  expect_contains "$out" "Starting release/0.1.0 from develop (last release: none)"
}

test_release_fails_when_one_is_open() {
  open_remote_branch release/1.3.0
  release_rules
  expect_fail "already open" mise/tasks/flow/release
  expect_no_gh "workflow run"
}

test_release_fails_without_token() {
  commit "feat(api): add x"
  git push -q origin develop
  gh_rule 'secret list*' 0 '[]'
  expect_fail "RELEASE_TOKEN" mise/tasks/flow/release --dry-run
}

test_release_rejects_old_version() {
  release_rules
  expect_fail "not newer" mise/tasks/flow/release --version 1.2.0 --dry-run
}

test_release_nothing_to_release() {
  release_rules
  expect_fail "nothing to release" mise/tasks/flow/release --dry-run
}
```

- [ ] **Step 2: Run to verify they fail**

Run: `tools/flow/test/run.sh test_release`
Expected: 8 `not ok`.

- [ ] **Step 3: Write `mise/tasks/flow/release`** (chmod +x)

```bash
#!/usr/bin/env bash
#MISE description="Cut a release (from develop) or hotfix (from main) via the Start release workflow: flow:release [release|hotfix] [--bump auto|patch|minor|major] [--version X.Y.Z] [--dry-run]"
# The workflow creates the branch, bumps every package.json and opens the PR
# into main; pushing the branch deploys it to staging.
set -euo pipefail
# shellcheck source=tools/flow/lib.sh
source "$(git rev-parse --show-toplevel)/tools/flow/lib.sh"

usage="usage: mise run flow:release [release|hotfix] [--bump auto|patch|minor|major] [--version X.Y.Z] [--dry-run]"
kind=release bump=auto version=""
while [ $# -gt 0 ]; do
  case "$1" in
    release | hotfix)
      kind="$1"
      shift
      ;;
    --bump)
      [ $# -ge 2 ] || die "$usage"
      bump="$2"
      shift 2
      ;;
    --version)
      [ $# -ge 2 ] || die "$usage"
      version="$2"
      shift 2
      ;;
    --dry-run)
      FLOW_DRY_RUN=1
      shift
      ;;
    *) die "unknown argument '$1'; $usage" ;;
  esac
done
case "$bump" in
  auto | patch | minor | major) ;;
  *) die "--bump must be auto, patch, minor or major" ;;
esac

require_gh
fetch_origin

open="$(open_branches "$kind")"
[ -z "$open" ] || die "a $kind branch is already open: $open — finish it first: mise run flow:finish $kind"

if secrets="$(gh secret list --json name --jq '.[].name' 2>/dev/null)"; then
  grep -qx RELEASE_TOKEN <<<"$secrets" \
    || die "the RELEASE_TOKEN secret is missing; see docs/infrastructure.md#release-token"
else
  echo "warning: could not list secrets to check RELEASE_TOKEN (needs repo admin); continuing" >&2
fi

from=develop
[ "$kind" = release ] || from=main
last="$(latest_tag origin/main)"
current="${last#v}"
if [ -n "$version" ]; then
  is_version "$version" || die "--version '$version' is not X.Y.Z"
  version_gt "$version" "${current:-0.0.0}" || die "$version is not newer than the last release ${last:-none}"
  next="$version"
else
  [ "$kind" = release ] || [ "$bump" != auto ] || bump=patch
  next="$(next_version "origin/$from" "$bump")"
fi
echo "Starting $kind/$next from $from (last release: ${last:-none})"

latest_run() {
  gh run list --workflow release-start.yml --limit 1 --json databaseId --jq '.[0].databaseId // empty'
}
prev="$(latest_run)"

args=(workflow run release-start.yml -f "kind=$kind" -f "bump=$bump")
[ -z "$version" ] || args+=(-f "version=$version")
run gh "${args[@]}"
[ "$FLOW_DRY_RUN" = 1 ] && exit 0

new_run() {
  local id
  id="$(latest_run)"
  [ -n "$id" ] && [ "$id" != "$prev" ] && echo "$id"
}
run_id="$(poll_for new_run)" \
  || die "dispatched, but no new run showed up; check: gh run list --workflow release-start.yml"
gh run watch "$run_id" --exit-status
echo "Release PR: $(gh pr list --head "$kind/$next" --json url --jq '.[].url')"
echo "Staging deploys from $kind/$next. Verify it there, then: mise run flow:finish $kind"
```

- [ ] **Step 4: Run tests and shellcheck**

Run: `mise run flow:test`
Expected: `34 passed, 0 failed`.

- [ ] **Step 5: Stop — no commit.**

---

### Task 5: `flow:finish`

**Files:**
- Create: `mise/tasks/flow/finish`
- Modify: `tools/flow/test/run.sh` (insert above `main "$@"`)

**Interfaces:**
- Consumes: `JQ_DEFS`, `poll_for`, `run`, `die`, `require_gh`, `fetch_origin`; `tools/release/check-release.sh <base ref>`.
- Produces: `mise run flow:finish [release|hotfix] [--dry-run]`.

- [ ] **Step 1: Write the failing tests**

```bash
# --- flow:finish ---

prepare_release() { # pushes release/1.3.0 with every package.json bumped
  commit "feat(api): add x"
  git push -q origin develop
  git switch -qc release/1.3.0
  tools/release/set-version.sh 1.3.0
  git commit -qam "chore(release): prepare v1.3.0"
  git push -q origin release/1.3.0
  git switch -q develop
  git fetch -q origin
}

release_pr_rule() { # <check conclusion> <reviewDecision> <mergeable>
  gh_rule 'pr list --base main*' 0 "$(printf '[{"number":5,"headRefName":"release/1.3.0","headRefOid":"%s","reviewDecision":"%s","mergeable":"%s","url":"https://github.com/o/r/pull/5","statusCheckRollup":[{"conclusion":"%s"}]}]' \
    "$(git rev-parse origin/release/1.3.0)" "$2" "$3" "$1")"
}

test_finish_merges_with_merge_commit() {
  prepare_release
  release_pr_rule SUCCESS APPROVED MERGEABLE
  gh_rule 'pr view 5*' 0 '{"mergeCommit":{"oid":"abc123"}}'
  gh_rule 'run list --workflow release-finish.yml --commit abc123*' 0 '[{"databaseId":3}]'
  gh_rule 'release view v1.3.0*' 0 '{"url":"https://github.com/o/r/releases/tag/v1.3.0"}'
  gh_rule 'pr list --state open --head chore/back-merge-v1.3.0*' 0 '[{"url":"https://github.com/o/r/pull/6"}]'
  local out
  out="$(mise/tasks/flow/finish)"
  expect_gh "pr merge 5 --merge --delete-branch"
  expect_no_gh "--squash"
  expect_gh "run watch 3 --exit-status"
  expect_contains "$out" "releases/tag/v1.3.0"
  expect_contains "$out" "https://github.com/o/r/pull/6"
}

test_finish_allows_no_required_review() {
  prepare_release
  release_pr_rule SUCCESS "" MERGEABLE
  local out
  out="$(mise/tasks/flow/finish --dry-run)"
  expect_contains "$out" "+ gh pr merge 5 --merge --delete-branch"
}

test_finish_requires_green_checks() {
  prepare_release
  release_pr_rule FAILURE APPROVED MERGEABLE
  expect_fail "checks on #5 are fail" mise/tasks/flow/finish
  expect_no_gh "pr merge"
}

test_finish_requires_approval() {
  prepare_release
  release_pr_rule SUCCESS REVIEW_REQUIRED MERGEABLE
  expect_fail "needs an approving review" mise/tasks/flow/finish
  expect_no_gh "pr merge"
}

test_finish_requires_mergeable() {
  prepare_release
  release_pr_rule SUCCESS APPROVED CONFLICTING
  expect_fail "not mergeable (CONFLICTING)" mise/tasks/flow/finish
  expect_no_gh "pr merge"
}

test_finish_runs_release_check() {
  commit "feat(api): add x"
  git push -q origin develop
  open_remote_branch release/1.3.0
  git fetch -q origin
  release_pr_rule SUCCESS APPROVED MERGEABLE
  expect_fail "not newer" mise/tasks/flow/finish
  expect_no_gh "pr merge"
}

test_finish_without_pr_fails() {
  expect_fail "no open release/hotfix PR" mise/tasks/flow/finish
}

test_finish_dry_run_does_not_merge() {
  prepare_release
  release_pr_rule SUCCESS APPROVED MERGEABLE
  local out
  out="$(mise/tasks/flow/finish --dry-run)"
  expect_contains "$out" "+ gh pr merge 5 --merge --delete-branch"
  expect_no_gh "pr merge"
}
```

- [ ] **Step 2: Run to verify they fail**

Run: `tools/flow/test/run.sh test_finish`
Expected: 8 `not ok`.

- [ ] **Step 3: Write `mise/tasks/flow/finish`** (chmod +x)

```bash
#!/usr/bin/env bash
#MISE description="Merge the open release/hotfix PR into main and follow it to the tag: flow:finish [release|hotfix] [--dry-run]"
# main only takes merge commits. release-finish.yml then tags vX.Y.Z (→ prod
# after the CodePipeline approval), publishes the Release and opens back-merges.
set -euo pipefail
# shellcheck source=tools/flow/lib.sh
source "$(git rev-parse --show-toplevel)/tools/flow/lib.sh"

usage="usage: mise run flow:finish [release|hotfix] [--dry-run]"
kind=""
while [ $# -gt 0 ]; do
  case "$1" in
    release | hotfix)
      kind="$1"
      shift
      ;;
    --dry-run)
      FLOW_DRY_RUN=1
      shift
      ;;
    *) die "unknown argument '$1'; $usage" ;;
  esac
done

require_gh
fetch_origin

heads="${kind:-release|hotfix}"
prs="$(gh pr list --base main --state open \
  --json number,headRefName,headRefOid,reviewDecision,mergeable,statusCheckRollup,url \
  --jq "$JQ_DEFS"' .[] | select(.headRefName | test("^('"$heads"')/"))
    | [.number, .headRefName, .headRefOid, checks, review, .mergeable, .url] | @tsv')"
[ -n "$prs" ] || die "no open ${kind:-release/hotfix} PR into main; start one with: mise run flow:release"
[ "$(grep -c . <<<"$prs")" -eq 1 ] \
  || die "a release and a hotfix PR are both open; pass which: mise run flow:finish release|hotfix"
IFS=$'\t' read -r number head sha checks review mergeable url <<<"$prs"

[ "$checks" = pass ] || die "checks on #$number are $checks; wait for them or fix the branch: $url"
case "$review" in
  APPROVED | NONE) ;;
  *) die "#$number needs an approving review (review: $review): $url" ;;
esac
[ "$mergeable" = MERGEABLE ] \
  || die "#$number is not mergeable ($mergeable); bring origin/main into $head through a bugfix PR: $url"
[ "$(git rev-parse "origin/$head")" = "$sha" ] || die "origin/$head moved since the PR was read; re-run"

tmp="$(mktemp -d)"
trap 'git worktree remove --force "$tmp/wt" >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT
git worktree add -q --detach "$tmp/wt" "$sha"
(cd "$tmp/wt" && tools/release/check-release.sh origin/main)

run gh pr merge "$number" --merge --delete-branch
[ "$FLOW_DRY_RUN" = 1 ] && exit 0

version="${head#*/}"
merge_sha="$(gh pr view "$number" --json mergeCommit --jq .mergeCommit.oid)"
finish_run() {
  gh run list --workflow release-finish.yml --commit "$merge_sha" --limit 1 \
    --json databaseId --jq '.[0].databaseId // empty'
}
echo "Merged #$number; waiting for release-finish.yml"
run_id="$(poll_for finish_run)" \
  || die "release-finish.yml did not start for $merge_sha; check: gh run list --workflow release-finish.yml"
gh run watch "$run_id" --exit-status
echo "Released v$version: $(gh release view "v$version" --json url --jq .url)"
echo "Back-merge PRs:"
gh pr list --state open --head "chore/back-merge-v$version" --json url --jq '.[].url'
echo "Prod deploys from the tag after the CodePipeline approval. Next: mise run flow:back-merge"
```

- [ ] **Step 4: Run tests and shellcheck**

Run: `mise run flow:test`
Expected: `42 passed, 0 failed`.

- [ ] **Step 5: Stop — no commit.**

---

### Task 6: `flow:back-merge`

**Files:**
- Create: `mise/tasks/flow/back-merge`
- Modify: `tools/flow/test/run.sh` (insert above `main "$@"`)

**Interfaces:**
- Consumes: `JQ_DEFS`, `run`, `die`, `require_gh`.
- Produces: `mise run flow:back-merge [--dry-run]`.

- [ ] **Step 1: Write the failing tests**

```bash
# --- flow:back-merge ---

back_merge_pr() { # <number> <base> <check conclusion> <mergeable> <reviewDecision> <autoMergeRequest json>
  printf '{"number":%s,"headRefName":"chore/back-merge-v1.3.0","baseRefName":"%s","mergeable":"%s","reviewDecision":"%s","autoMergeRequest":%s,"url":"https://github.com/o/r/pull/%s","statusCheckRollup":[{"conclusion":"%s"}]}' \
    "$1" "$2" "$4" "$5" "$6" "$1" "$3"
}

test_back_merge_merges_green_prs_only() {
  gh_rule 'pr list --state open --limit 100*' 0 "[$(back_merge_pr 6 develop SUCCESS MERGEABLE APPROVED null),$(back_merge_pr 7 release/1.4.0 "" MERGEABLE APPROVED null)]"
  local out
  out="$(mise/tasks/flow/back-merge)"
  expect_gh "pr merge 6 --merge"
  expect_no_gh "pr merge 7"
  expect_no_gh "--squash"
  expect_contains "$out" "#7 → release/1.4.0: checks pending"
}

test_back_merge_conflict_prints_steps() {
  gh_rule 'pr list --state open --limit 100*' 0 "[$(back_merge_pr 6 develop SUCCESS CONFLICTING APPROVED null)]"
  local out
  out="$(mise/tasks/flow/back-merge)"
  expect_contains "$out" "git switch chore/back-merge-v1.3.0 && git merge origin/develop"
  expect_no_gh "pr merge"
}

test_back_merge_skips_auto_merge_and_unapproved() {
  gh_rule 'pr list --state open --limit 100*' 0 "[$(back_merge_pr 6 develop SUCCESS MERGEABLE APPROVED '{"mergeMethod":"MERGE"}'),$(back_merge_pr 7 release/1.4.0 SUCCESS MERGEABLE REVIEW_REQUIRED null)]"
  local out
  out="$(mise/tasks/flow/back-merge)"
  expect_contains "$out" "#6 → develop: auto-merge is on"
  expect_contains "$out" "#7 → release/1.4.0: needs an approving review"
  expect_no_gh "pr merge"
}

test_back_merge_none_open() {
  local out
  out="$(mise/tasks/flow/back-merge)"
  expect_contains "$out" "No open back-merge PRs"
}

test_back_merge_dry_run() {
  gh_rule 'pr list --state open --limit 100*' 0 "[$(back_merge_pr 6 develop SUCCESS MERGEABLE "" null)]"
  local out
  out="$(mise/tasks/flow/back-merge --dry-run)"
  expect_contains "$out" "+ gh pr merge 6 --merge"
  expect_no_gh "pr merge"
}
```

- [ ] **Step 2: Run to verify they fail**

Run: `tools/flow/test/run.sh test_back_merge`
Expected: 5 `not ok`.

- [ ] **Step 3: Write `mise/tasks/flow/back-merge`** (chmod +x)

```bash
#!/usr/bin/env bash
#MISE description="Merge green back-merge PRs with a merge commit (never squash): flow:back-merge [--dry-run]"
# A squashed back-merge leaves develop without main's history and the next
# release PR fails its check. Conflicts are left to a person.
set -euo pipefail
# shellcheck source=tools/flow/lib.sh
source "$(git rev-parse --show-toplevel)/tools/flow/lib.sh"

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)
      FLOW_DRY_RUN=1
      shift
      ;;
    *) die "unknown argument '$1'; usage: mise run flow:back-merge [--dry-run]" ;;
  esac
done

require_gh
prs="$(gh pr list --state open --limit 100 \
  --json number,headRefName,baseRefName,mergeable,reviewDecision,autoMergeRequest,statusCheckRollup,url \
  --jq "$JQ_DEFS"' .[] | select(.headRefName | startswith("chore/back-merge-v"))
    | [.number, .headRefName, .baseRefName, checks, review, .mergeable,
       (if .autoMergeRequest then "auto" else "manual" end), .url] | @tsv')"
[ -n "$prs" ] || { echo "No open back-merge PRs"; exit 0; }

while IFS=$'\t' read -r -u 3 number head base checks review mergeable auto url; do
  if [ "$mergeable" = CONFLICTING ]; then
    cat <<EOF
#$number $head → $base has conflicts; resolve them on $head, never on $base:
  git fetch origin && git switch $head && git merge origin/$base
  # fix the conflicts, then: git commit && git push
  then re-run: mise run flow:back-merge
EOF
  elif [ "$checks" != pass ]; then
    echo "#$number → $base: checks $checks; skipped ($url)"
  elif [ "$review" != APPROVED ] && [ "$review" != NONE ]; then
    echo "#$number → $base: needs an approving review; skipped ($url)"
  elif [ "$auto" = auto ]; then
    echo "#$number → $base: auto-merge is on; GitHub merges it ($url)"
  else
    run gh pr merge "$number" --merge
    [ "$FLOW_DRY_RUN" = 1 ] || echo "#$number → $base: merged"
  fi
done 3<<<"$prs"
```

- [ ] **Step 4: Run tests and shellcheck**

Run: `mise run flow:test`
Expected: `47 passed, 0 failed`.

- [ ] **Step 5: Stop — no commit.**

---

### Task 7: Skill, docs, CI and end-to-end check

**Files:**
- Create: `.agents/skills/git-flow/SKILL.md`
- Create: `.claude/skills/git-flow` (symlink → `../../.agents/skills/git-flow`)
- Modify: `AGENTS.md:18` (hard rule 3) and after `AGENTS.md:55` (`Short aliases` line)
- Modify: `CLAUDE.md` (Claude Code section)
- Modify: `docs/infrastructure.md` (*Releasing*, lines ~370-386)
- Modify: `.github/workflows/pr-checks.yml` (after the `Release version` step)
- Modify: `docs/superpowers/specs/2026-10-13-git-flow-agent-tools-design.md` (record the plan-time refinements)

**Interfaces:**
- Consumes: every `flow:*` task and its flags as defined in Tasks 1–6.

- [ ] **Step 1: Write the skill**

`.agents/skills/git-flow/SKILL.md`:

````markdown
---
name: git-flow
description: Drive this repo's git flow with the `mise run flow:*` tasks — start a feature/bugfix branch, open a PR into the right base, check release state, cut a release or hotfix, merge it to main (prod), and merge the back-merge PRs. Use whenever the user asks to create a branch, open or raise a PR, release, hotfix, ship or deploy to staging/prod, finish a release, back-merge, or asks what is in flight.
---

# Git flow

```
feature/*, bugfix/* ──PR (squash)──▶ develop
develop ──flow:release──▶ release/X.Y.Z ──PR (merge commit)──▶ main ──▶ tag vX.Y.Z ──▶ prod
main ──flow:release hotfix──▶ hotfix/X.Y.Z ──PR (merge commit)──▶ main ──▶ tag vX.Y.Z ──▶ prod
main ──back-merge PR (merge commit)──▶ develop (+ any open release/*)
```

Pushing `release/*` or `hotfix/*` deploys staging; the `vX.Y.Z` tag deploys
prod. Full rules: `docs/infrastructure.md#git-flow`.

## Intent → task

| The user wants to… | Run |
|---|---|
| see what is in flight, the next version | `mise run flow:status` |
| start work | `mise run flow:start <type> <name>` — type: feature, bugfix, refactor, chore, docs, test, ci, perf, style, build, revert |
| fix something on an open release/hotfix | `mise run flow:start bugfix <name> --from release/X.Y.Z` |
| open a PR | `mise run flow:pr [--title "<type>(<scope>): <summary>"] [--body-file <file>] [--draft]` |
| cut a release / hotfix | `mise run flow:release [release\|hotfix] [--bump auto\|patch\|minor\|major] [--version X.Y.Z]` |
| ship the release to prod | `mise run flow:finish [release\|hotfix]` |
| merge the back-merge PRs | `mise run flow:back-merge` |

## How to run them

1. Before `flow:release`, `flow:finish` or `flow:back-merge`, run
   `mise run flow:status` and tell the user what is open.
2. Confirmation gate — AGENTS.md hard rule 3 still applies:
   - `flow:start` may run once the user asked for the branch.
   - `flow:pr`, `flow:release`, `flow:finish` and `flow:back-merge` push,
     merge or start workflows. Run each with `--dry-run` first, show the
     output, and run it for real only after the user says yes. A yes covers
     that one run.
3. The PR title becomes the squash commit on `develop` and drives the next
   version: `feat` → minor, `fix`/other → patch, `!` → major. Pick the type
   from the change's intent.
4. Write the PR body to a temp file with `## Summary` and `## Test plan`
   sections and pass `--body-file`; without it the body is the commit list.
5. The tasks validate with the same scripts as CI (`tools/release/*`). When
   one fails, read the message, fix the cause and re-run — don't work around
   it with raw `git`/`gh`.

## Never

- Push directly to `develop`, `main`, `release/*` or `hotfix/*`, or create
  `release/*`/`hotfix/*` by hand — they come from `flow:release`.
- Squash a PR into `main` or a back-merge PR.
- Create, move or delete `v*` tags.
- Push a back-merge conflict resolution without showing the user the
  conflicting files and the resolution first.
- Merge a `feature/*` into a `release/*` or `hotfix/*`.

## Common failures

| Message | Fix |
|---|---|
| `gh is not authenticated` | Ask the user to run `! gh auth login`. |
| `RELEASE_TOKEN secret is missing` | A repo admin runs `gh secret set RELEASE_TOKEN` (`docs/infrastructure.md#release-token`). |
| `a release branch is already open` | Finish it (`flow:finish release`) or land fixes as `bugfix` PRs into it. |
| `checks on #N are fail` / `pending` | Wait, or fix the branch; `gh pr checks N` shows which check. |
| `needs an approving review` | Ask the user to get the PR approved. |
| `not mergeable (CONFLICTING)` on a release PR | Ask the user; usually a `bugfix/*` branch off the release that merges `origin/main`, PR'd into the release. |
| `is not a Conventional Commit` | Fix the title, e.g. `feat(web): add dark mode`. |
| `nothing to release` | No commits on `develop` since the last tag. |
| `commitlint: command not found` | Run `pnpm install` first. |
````

- [ ] **Step 2: Link it for Claude Code and check the link resolves**

Run: `mkdir -p .claude/skills && ln -s ../../.agents/skills/git-flow .claude/skills/git-flow && head -3 .claude/skills/git-flow/SKILL.md`
Expected: prints the frontmatter's `---` and `name: git-flow`.

- [ ] **Step 3: Update AGENTS.md and CLAUDE.md**

In `AGENTS.md`, replace:

```
3. **Never commit, push, or create branches** unless the user explicitly asks.
```

with:

```
3. **Never commit, push, or create branches** unless the user explicitly asks. When asked, use the `mise run flow:*` tasks (see *Git flow* below).
```

In `AGENTS.md`, after the line `Short aliases: \`mise run lint | test | typecheck\`.` insert (blank line before):

````markdown
**Git flow.** The `flow:*` tasks wrap branches, PRs and releases with the same
checks CI runs; those that push, merge or start a workflow take `--dry-run`.
Agents follow the `git-flow` skill (`.agents/skills/git-flow/SKILL.md`); the
flow itself is in [`docs/infrastructure.md`](docs/infrastructure.md#git-flow).

```bash
mise run flow:status                 # open releases, PRs, runs, next version
mise run flow:start feature <name>   # branch off the right base
mise run flow:pr                     # push + PR into that base
mise run flow:release [hotfix]       # Start release workflow → staging
mise run flow:finish                 # merge release PR → tag → prod
mise run flow:back-merge             # merge the back-merge PRs
```
````

In `CLAUDE.md`, append to the `## Claude Code` list:

```
- `.claude/skills/git-flow` is a symlink to `.agents/skills/git-flow`, shared
  with other harnesses; edit the skill there.
```

- [ ] **Step 4: Update docs/infrastructure.md *Releasing***

Make these four replacements:

- `1. **Actions → Start release → Run workflow**, kind \`release\`. The version` → `1. **Actions → Start release → Run workflow**, kind \`release\` (or \`mise run flow:release\`). The version`
- `3. Merge the PR with **Create a merge commit**. \`release-finish.yml\` tags` → `3. Merge the PR with **Create a merge commit** (or \`mise run flow:finish\`). \`release-finish.yml\` tags`
- `4. Merge the back-merge PRs with **Create a merge commit** — a squash leaves` → `4. Merge the back-merge PRs with **Create a merge commit** (or \`mise run flow:back-merge\`) — a squash leaves`
- `A hotfix is the same with kind \`hotfix\`: it branches from \`main\` and bumps the` → `A hotfix is the same with kind \`hotfix\` (\`mise run flow:release hotfix\`): it branches from \`main\` and bumps the`

Then, after the paragraph ending `both deploy to the same staging, so the last push wins.`, add:

```
`mise run flow:status` shows what is open, PR checks, recent runs and the next
version. Every `flow:*` task that pushes, merges or starts a workflow takes
`--dry-run`; agents follow `.agents/skills/git-flow/SKILL.md`.
```

- [ ] **Step 5: Run the flow tests in CI**

In `.github/workflows/pr-checks.yml`, after the `Release version` step (before `- uses: pnpm/action-setup@v4`), insert:

```yaml
      - name: Flow tasks
        run: |
          shellcheck -x tools/flow/lib.sh tools/flow/test/run.sh tools/flow/test/gh tools/flow/test/commitlint mise/tasks/flow/*
          tools/flow/test/run.sh
```

- [ ] **Step 6: End-to-end check on this repo**

Run each and confirm:

1. `mise run flow:test` → shellcheck silent, `47 passed, 0 failed`.
2. `mise tasks ls | grep flow:` → `flow:back-merge`, `flow:finish`, `flow:pr`, `flow:release`, `flow:start`, `flow:status`, `flow:test` with descriptions.
3. `mise run flow:status` → all five sections print (needs `gh auth login`; read-only).
4. `mise run flow:start feature demo --dry-run` → `+ git switch --no-track -c feature/demo origin/develop`; `git branch --show-current` still `develop`.
5. Real commitlint matches the stub on the common cases: `printf 'feat(web): add dark mode\n' | pnpm exec commitlint` exits 0; `printf 'Add dark mode\n' | pnpm exec commitlint` exits non-zero.
6. `actionlint .github/workflows/pr-checks.yml` if installed, otherwise `python3 -c 'import yaml,sys; yaml.safe_load(open(".github/workflows/pr-checks.yml"))'` → no error.

- [ ] **Step 7: Record the plan-time refinements in the spec**

In `docs/superpowers/specs/2026-10-13-git-flow-agent-tools-design.md`:

- `flow:pr` heading → `` #### `flow:pr [--title <title>] [--body-file <file>] [--draft] [--dry-run]` ``; replace the `--fill-verbose` bullet's `gh pr create` call with `run gh pr create --base <base> --head <branch> --title <title> (--body-file <file> | --body <commit list>) [--draft]`.
- `flow:finish`: `reviewDecision == APPROVED` → `reviewDecision` is `APPROVED` or empty (no review required, e.g. `REQUIRED_APPROVALS=0`).
- `flow:back-merge`: add "and approved (or no review required)" to the merge condition.
- Testing → CI bullet: the step also runs `shellcheck`.

- [ ] **Step 8: Stop — no commit.** Report the results of Step 6 to the user.
