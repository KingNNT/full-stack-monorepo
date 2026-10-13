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
  expect_fail "" git config branch.feature/x.flowBase
}

test_start_fails_when_origin_unreachable() {
  git remote set-url origin "$SANDBOX/missing.git"
  expect_fail "could not fetch origin" mise/tasks/flow/start feature x
}

# --- flow:pr ---

start_with_commit() {
  mise/tasks/flow/start feature x >/dev/null
  commit "feat(api): add x"
}

test_pr_opens_pr_into_flow_base() {
  start_with_commit
  mise/tasks/flow/pr
  expect_eq "$(git rev-parse origin/feature/x)" "$(git rev-parse HEAD)"
  expect_gh "pr list --head feature/x --state open"
  expect_gh "pr create --base develop --head feature/x --title feat(api): add x --body - feat(api): add x"
}

test_pr_bugfix_targets_release() {
  open_remote_branch release/1.3.0
  mise/tasks/flow/start bugfix crash --from release/1.3.0 >/dev/null
  commit "fix(web): stop crash"
  mise/tasks/flow/pr
  expect_gh "pr create --base release/1.3.0 --head bugfix/crash"
}

test_pr_body_file_and_draft() {
  start_with_commit
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
  gh_rule 'pr list --head feature/x --state open*' 0 '[{"url":"https://github.com/o/r/pull/7"}]'
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
  local out
  out="$(mise/tasks/flow/pr --dry-run)"
  expect_contains "$out" "+ git push -u origin feature/x"
  expect_contains "$out" "+ gh pr create --base develop --head feature/x"
  expect_no_ref origin/feature/x
  expect_no_gh "pr create"
}

test_pr_missing_commitlint_is_not_a_bad_title() {
  start_with_commit
  export FLOW_COMMITLINT_CHECK=false
  expect_fail "commitlint is not installed; run: pnpm install" mise/tasks/flow/pr
  expect_no_ref origin/feature/x
}

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

delete_origin_main() {
  git push -q origin :main
}

test_status_without_origin_main() {
  delete_origin_main
  local out
  out="$(mise/tasks/flow/status 2>&1)"
  expect_contains "$out" "latest tag: unknown (origin/main missing)"
  expect_contains "$out" "next release: unknown (origin/main missing)"
  if grep -qF "fatal:" <<<"$out"; then echo "git noise in output:"; echo "$out"; return 1; fi
}

test_status_warns_when_origin_unreachable() {
  git remote set-url origin "$SANDBOX/missing.git"
  local out
  out="$(mise/tasks/flow/status 2>&1)"
  expect_contains "$out" "warning: could not fetch origin; showing local refs"
  expect_contains "$out" "latest tag: v1.2.0"
}

test_status_rejects_unknown_arguments() {
  expect_fail "usage: mise run flow:status" mise/tasks/flow/status --bogus
}

test_status_survives_failing_pr_list() {
  gh_rule 'pr list --base main*' 1 ''
  local out
  out="$(mise/tasks/flow/status)"
  expect_contains "$out" "  (unavailable)"
  expect_contains "$out" "latest tag: v1.2.0"
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
  if [ $((pass + failed)) -eq 0 ]; then
    echo "no tests match '$filter'"
    return 1
  fi
  echo "$pass passed, $failed failed"
  [ "$failed" -eq 0 ]
}

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
  gh_rule 'pr list --base main --state open*' 0 '[{"url":"https://github.com/o/r/pull/8","headRefName":"hotfix/1.2.1"},{"url":"https://github.com/o/r/pull/9","headRefName":"release/1.3.0"}]'
  local out
  out="$(mise/tasks/flow/release)"
  expect_gh "workflow run release-start.yml --ref develop -f kind=release -f bump=auto"
  expect_gh "run watch 2 --exit-status"
  expect_contains "$out" "Starting release/1.3.0 from develop"
  expect_contains "$out" "Release PR: https://github.com/o/r/pull/9"
  if grep -qF "pull/8" <<<"$out"; then echo "hotfix PR listed"; return 1; fi
}

test_release_fails_when_no_pr_shows_up() {
  commit "feat(api): add x"
  git push -q origin develop
  release_rules
  gh_rule 'run list*' 0 '[{"databaseId":1}]' once
  gh_rule 'run list*' 0 '[{"databaseId":2}]'
  gh_rule 'pr list --base main --state open*' 0 '[]'
  expect_fail "release-start.yml finished but no release PR into main was found" mise/tasks/flow/release
}

test_release_survives_large_log_after_breaking_change() {
  local body i
  body="$(printf 'x%.0s' $(seq 1 110))"
  { # 800 empty fix: commits (~100KB of log), written in one go
    echo "reset refs/heads/develop"
    echo "from $(git rev-parse HEAD)"
    for i in $(seq 1 800); do
      printf 'commit refs/heads/develop\ncommitter test <test@example.com> %s +0000\ndata <<EOM\nfix: %s %s\nEOM\n\n' "$i" "$i" "$body"
    done
  } | git fast-import --quiet
  git commit --allow-empty -qm "feat!: x"
  git push -q origin develop
  release_rules
  local out
  out="$(mise/tasks/flow/release --dry-run)"
  expect_contains "$out" "Starting release/2.0.0"
}

test_release_without_origin_main() {
  commit "feat(api): add x"
  git push -q origin develop
  delete_origin_main
  release_rules
  expect_fail "origin has no main branch; push it (git push -u origin main) and run: mise run github:setup" \
    mise/tasks/flow/release --dry-run
  expect_no_gh "workflow run"
}

test_release_hotfix_with_version() {
  release_rules
  local out
  out="$(mise/tasks/flow/release hotfix --version 1.2.1 --dry-run)"
  expect_contains "$out" "Starting hotfix/1.2.1 from main"
  expect_contains "$out" "+ gh workflow run release-start.yml --ref develop -f kind=hotfix -f bump=auto -f version=1.2.1"
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
  expect_gh "pr merge 5 --merge --match-head-commit"
  expect_no_gh "--delete-branch"
  expect_no_gh "--squash"
  expect_gh "run watch 3 --exit-status"
  expect_contains "$out" "releases/tag/v1.3.0"
  expect_contains "$out" "https://github.com/o/r/pull/6"
  git fetch -q --prune origin
  expect_no_ref refs/remotes/origin/release/1.3.0
}

test_finish_allows_no_required_review() {
  prepare_release
  release_pr_rule SUCCESS "" MERGEABLE
  local out
  out="$(mise/tasks/flow/finish --dry-run)"
  expect_contains "$out" "+ gh pr merge 5 --merge --match-head-commit"
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
  expect_contains "$out" "+ gh pr merge 5 --merge --match-head-commit"
  expect_contains "$out" "+ git push origin --delete release/1.3.0"
  expect_no_gh "pr merge"
  git fetch -q --prune origin
  git rev-parse -q --verify refs/remotes/origin/release/1.3.0 >/dev/null
}

test_finish_unknown_mergeability_says_rerun() {
  prepare_release
  release_pr_rule SUCCESS APPROVED UNKNOWN
  expect_fail "GitHub is still computing mergeability for #5; re-run shortly" mise/tasks/flow/finish
  expect_no_gh "pr merge"
}

test_finish_two_prs_of_one_kind() {
  prepare_release
  gh_rule 'pr list --base main*' 0 '[{"number":5,"headRefName":"release/1.3.0","headRefOid":"a","reviewDecision":"","mergeable":"MERGEABLE","url":"u5","statusCheckRollup":[]},{"number":6,"headRefName":"release/1.4.0","headRefOid":"b","reviewDecision":"","mergeable":"MERGEABLE","url":"u6","statusCheckRollup":[]}]'
  expect_fail "more than one open release PR into main: #5 release/1.3.0, #6 release/1.4.0; close all but one" mise/tasks/flow/finish
  expect_no_gh "pr merge"
}

test_finish_without_origin_main() {
  prepare_release
  delete_origin_main
  release_pr_rule SUCCESS APPROVED MERGEABLE
  expect_fail "origin has no main branch" mise/tasks/flow/finish
  expect_no_gh "pr merge"
}

test_finish_rejects_branch_version_mismatch() {
  commit "feat(api): add x"
  git push -q origin develop
  git switch -qc release/1.3.0
  tools/release/set-version.sh 1.4.0
  git commit -qam "chore(release): prepare v1.4.0"
  git push -q origin release/1.3.0
  git switch -q develop
  git fetch -q origin
  release_pr_rule SUCCESS APPROVED MERGEABLE
  expect_fail "must match" mise/tasks/flow/finish
  expect_no_gh "pr merge"
}

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

test_back_merge_skips_unknown_mergeability() {
  gh_rule 'pr list --state open --limit 100*' 0 "[$(back_merge_pr 6 develop SUCCESS UNKNOWN APPROVED null)]"
  local out
  out="$(mise/tasks/flow/back-merge)"
  expect_contains "$out" "mergeability UNKNOWN"
  expect_no_gh "pr merge"
}

test_back_merge_continues_after_failed_merge() {
  gh_rule 'pr list --state open --limit 100*' 0 "[$(back_merge_pr 6 develop SUCCESS MERGEABLE APPROVED null),$(back_merge_pr 7 develop SUCCESS MERGEABLE APPROVED null)]"
  gh_rule 'pr merge 6*' 1 ''
  expect_fail "failed to merge" mise/tasks/flow/back-merge
  expect_gh "pr merge 7 --merge"
}

test_back_merge_warns_on_squash_auto_merge() {
  gh_rule 'pr list --state open --limit 100*' 0 "[$(back_merge_pr 6 develop SUCCESS MERGEABLE APPROVED '{"mergeMethod":"SQUASH"}')]"
  local out
  out="$(mise/tasks/flow/back-merge)"
  expect_contains "$out" "auto-merge uses SQUASH"
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

# --- runner ---

test_runner_fails_when_no_test_matches() {
  expect_fail "no tests match 'zzz-none'" "$TESTS/run.sh" zzz-none
}

main "$@"
