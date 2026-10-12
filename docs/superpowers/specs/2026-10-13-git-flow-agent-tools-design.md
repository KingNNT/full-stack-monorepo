# Git flow agent tools — design

Date: 2026-10-13

## Goal

Let any coding agent (Claude Code, Codex, opencode, …) drive the repo's full
git flow — start branches, open PRs, cut and finish releases/hotfixes, handle
back-merges — with deterministic commands that follow the same rules CI
enforces, and with a human confirmation before every outward-facing step.

## Context

The git flow is already automated server-side (see
`docs/infrastructure.md#git-flow`):

- `feature/*`, `bugfix/*` → squash PR into `develop`
- `release-start.yml` (workflow_dispatch) cuts `release/X.Y.Z` or
  `hotfix/X.Y.Z`, bumps every `package.json`, opens the PR into `main`
- merging into `main` runs `release-finish.yml`: tag `vX.Y.Z`, GitHub
  Release, `chore/back-merge-vX.Y.Z` PRs into `develop` and open `release/*`
- `pr-checks.yml` enforces branch names/targets (`tools/release/check-branch.sh`),
  release versioning (`check-release.sh`) and a Conventional Commits PR title

Missing: an agent-side interface. Agents currently compose raw `git`/`gh`
commands and can pick the wrong base, merge method or title.

## Decisions

- Scope: the whole lifecycle (developer and release-manager steps).
- Multi-harness: logic lives in mise tasks + bash; a thin skill documents
  when to call which task.
- Namespace: `flow:*`.
- No MCP server, no per-step skills.

## Components

### Shared library — `tools/flow/lib.sh`

Sourced by every `flow:*` task. Sources `tools/release/lib.sh`. Provides:

- `die <msg>` — print to stderr, exit 1
- `require_clean_tree` — fail if `git status --porcelain` is non-empty
- `fetch_origin` — `git fetch origin --prune --tags`
- `open_branches <release|hotfix>` — remote `release/*` / `hotfix/*` heads
- `run <cmd…>` — executes the command, or prints `+ <cmd>` and skips it when
  `FLOW_DRY_RUN=1` (set by `--dry-run`); used for every mutating git/gh call
- `commitlint_title <title>` — pipes the title to `${FLOW_COMMITLINT:-pnpm exec commitlint}`

### Tasks — `mise/tasks/flow/*`

Executable bash, `#MISE description="…"` header, `set -euo pipefail`, same
style as existing tasks. Mutating tasks accept `--dry-run`.

#### `flow:start <type> <name> [--from <base>] [--dry-run]`

- Fails on a dirty tree; fetches origin.
- `name` is lowercased, non `[a-z0-9._-]` runs become `-`, leading/trailing
  `-` trimmed.
- Base by type:
  - `feature|refactor|chore|docs|test|ci|perf|style|build|revert` → `develop`
  - `bugfix` → `--from` if given (must be `develop` or an open
    `release/*`/`hotfix/*`), otherwise `develop`. When a release or hotfix
    branch is open and `--from` is absent, print a note naming it.
  - `release|hotfix` → fail, pointing to `flow:release`.
- Validates with `tools/release/check-branch.sh <branch> <base>`.
- `run git switch -c <branch> origin/<base>`; records the base with
  `git config branch.<branch>.flowBase <base>`. Does not push.

#### `flow:pr [--title <title>] [--body-file <file>] [--draft] [--dry-run]`

- Current branch must not be `main`, `develop`, `release/*`, `hotfix/*`.
- Base: `branch.<b>.flowBase`, else `develop`.
- Title: `--title`, else the header of the single commit ahead of
  `origin/<base>`; more than one commit without `--title` → fail asking for it.
  Zero commits ahead → fail.
- Runs `check-branch.sh` and `commitlint_title` before any network write.
- If a PR for the branch already exists (`gh pr view --json url`), print its
  URL and exit 0 after pushing new commits.
- `run git push -u origin <branch>`, then
  `run gh pr create --base <base> --head <branch> --title <title> (--body-file <file> | --body <commit list>) [--draft]`.

#### `flow:status` (read-only)

Prints sections:

1. Current branch and its `flowBase`.
2. Open `release/*` / `hotfix/*` branches and their PRs into `main`
   (`gh pr list --base main --json number,title,url,headRefName,reviewDecision,mergeable,statusCheckRollup`),
   with a one-word checks summary (pass/fail/pending).
3. Open back-merge PRs (`--head` prefix `chore/back-merge-v`).
4. Latest 3 runs each of `release-start.yml`, `release-finish.yml`,
   `deploy.yml` (`gh run list --workflow … --limit 3`).
5. Latest tag on `origin/main` and the next version `auto` would produce
   (same `git log … | next-version.sh` pipeline as `release-start.yml`), or
   "nothing to release".

#### `flow:release [release|hotfix] [--bump auto|patch|minor|major] [--version X.Y.Z] [--dry-run]`

- Defaults: `release`, `auto`.
- Preflight: no open branch of that kind; `RELEASE_TOKEN` present in
  `gh secret list`; `--version` passes `is_version` and `version_gt` against
  the latest tag on `origin/main`.
- Prints the expected version (computed like `flow:status`; hotfix + auto →
  patch).
- `run gh workflow run release-start.yml --ref develop -f kind=… -f bump=… [-f version=…]`.
- Not dry-run: finds the new run (`gh run list --workflow release-start.yml --limit 1 --json databaseId`
  after dispatch, retrying briefly), `gh run watch --exit-status`, then prints
  the PR URL (`gh pr list --base main`, the open `<kind>/*` head; none → fail).

#### `flow:finish [release|hotfix] [--dry-run]`

- Kind defaults to whichever single release/hotfix PR into `main` is open;
  both open without an argument → fail asking which.
- Requires: every check in `statusCheckRollup` successful,
  `reviewDecision` is `APPROVED` or empty (no review required, e.g. `REQUIRED_APPROVALS=0`), `mergeable == MERGEABLE`. Each failure has its
  own message.
- Runs `tools/release/check-release.sh origin/main` on a detached checkout of
  the PR head (`git worktree add` in a temp dir, removed on exit).
- `run gh pr merge <n> --merge --match-head-commit <sha>`, then
  `run git push origin --delete <head>`. Never `--squash`/`--rebase`.
- Not dry-run: waits for the `release-finish.yml` run on the merge commit
  (`gh run watch --exit-status`), then prints the tag, the Release URL and the
  back-merge PR URLs.

#### `flow:back-merge [--dry-run]`

- Lists open PRs whose head starts with `chore/back-merge-v`.
- For each: checks green, approved (or no review required) and `mergeable == MERGEABLE` and auto-merge not
  already enabled → `run gh pr merge <n> --merge`. Pending → report and skip.
  `CONFLICTING` → print the manual steps:
  `git switch chore/back-merge-vX.Y.Z && git merge origin/<base>`, resolve,
  commit, push; then re-run `flow:back-merge`. The task never resolves
  conflicts.

#### `flow:test`

Runs `shellcheck` on `tools/flow/**/*.sh` and `mise/tasks/flow/*`, then
`tools/flow/test/run.sh`.

### Skill — `.agents/skills/git-flow/SKILL.md`

Symlinked from `.claude/skills/git-flow` → `../../.agents/skills/git-flow`
(same pattern as `.claude/rules/*`).

- Frontmatter `name: git-flow`; description triggers on creating branches,
  opening PRs, releases, hotfixes, deploying to prod, back-merges, release
  status.
- Body (~100 lines):
  1. The four-line flow diagram and an intent → task table.
  2. Run `mise run flow:status` before any release step.
  3. Confirmation gate: `flow:start` may run when the user asked for a
     branch. `flow:pr`, `flow:release`, `flow:finish`, `flow:back-merge` run
     with `--dry-run` first; show the output; run for real only after the
     user agrees. AGENTS.md hard rule 3 still applies.
  4. Never: push directly to `develop`/`main`/`release/*`/`hotfix/*`; squash
     a PR into `main` or a back-merge; create, move or delete `v*` tags;
     resolve back-merge conflicts without showing the user.
  5. Common failures and fixes: missing `RELEASE_TOKEN`, release already
     open, red checks, missing approval, `gh auth login` needed.

### Docs

- `AGENTS.md`: a short "Git flow" block under *Common commands* listing the
  `flow:*` tasks and pointing to the skill and
  `docs/infrastructure.md#git-flow`. Hard rule 3 gains: "when asked, use
  `mise run flow:*`".
- `docs/infrastructure.md` *Cutting a release*: the CLI equivalent for each
  step (`flow:release`, `flow:finish`, `flow:back-merge`).

## Error handling

- Every failure exits non-zero with a message naming the fix.
- Network writes happen only after all local validation passes.
- `gh` not authenticated → `gh auth status` check in tasks that call `gh`,
  failing with "run: gh auth login".

## Testing

Plain bash, no new dependencies — `tools/flow/test/run.sh`:

- Each case builds a sandbox in `mktemp -d`: a bare repo as `origin` and a
  clone with `main`, `develop`, tag `v1.2.0`, and the three `package.json`
  files at the real paths; `tools/` is copied in.
- A fake `gh` first on `PATH` appends its argv to a log and returns canned
  JSON chosen per case via env/fixture files.
- `FLOW_COMMITLINT` points at a stub accepting `^[a-z]+(\(.+\))?!?: .+`.
- Cases:
  - start: base per type; bugfix with an open release + `--from`; rejects
    release/hotfix; invalid name; dirty tree.
  - pr: base from `flowBase`; bad title fails before push; existing PR prints
    URL; multiple commits without `--title` fails.
  - release: open release fails; missing `RELEASE_TOKEN` fails; correct
    `-f` inputs passed to `gh workflow run`.
  - finish: red checks / no approval fail; merge uses `--merge`, never
    `--squash`.
  - back-merge: merges only green PRs, with `--merge`; conflicting PR prints
    manual steps.
  - dry-run of every mutating task: no `git push`, `gh pr create`,
    `gh pr merge`, `gh workflow run` executed.
- CI: a step in `pr-checks.yml` job `policy` runs `shellcheck` and `tools/flow/test/run.sh`
  (before the Node setup; needs only git and bash).
- Final manual check on this repo: `mise run flow:status` and
  `mise run flow:start feature demo --dry-run`.

## Plan-time refinements (added during implementation)

- `flow:pr` finds an existing PR with `gh pr list --head <branch> --state open`
  and reports only OPEN PRs.
- `flow:finish` refuses to merge when the release branch name and the version
  in `package.json` differ (error contains "must match"), merges with
  `--match-head-commit`, and fails if no GitHub Release exists afterwards
  (Release-URL check).
- `flow:back-merge` skips PRs whose mergeability is not `MERGEABLE` (e.g.
  `UNKNOWN`: re-run shortly); skips with a warning when auto-merge uses a
  method other than MERGE ("auto-merge uses SQUASH"); reports a failed merge,
  continues, and exits non-zero at the end.
- Every script must also run on bash 3.2 (macOS `/bin/bash`).
- `next_version` verifies the ref first and feeds `git log` to
  `next-version.sh` through a temp file, not a pipe: it stops reading at the
  first breaking commit, and a pipe then SIGPIPEs `git log` (exit 141).
- `require_main`: `flow:release` and `flow:finish` fail with "origin has no
  main branch" when `origin/main` is missing; `flow:status` prints
  "unknown (origin/main missing)" for the tag and next release instead.
- `flow:finish` does not pass `--delete-branch` to `gh pr merge` (it would
  also force-delete the local branch and switch the checkout); it deletes the
  remote branch with `run git push origin --delete <head>` after the merge.
- `flow:pr` checks that commitlint runs before checking the title ("commitlint
  is not installed; run: pnpm install"); `FLOW_COMMITLINT_CHECK` overrides the
  check in tests.
- A failed fetch dies with "could not fetch origin"; `flow:status` only warns
  and shows local refs.
- `flow:release` dispatches with `--ref develop` and, after the run, finds the
  PR with `gh pr list --base main` filtered to `<kind>/` heads; none → fail.

## Out of scope

- An MCP server or per-step skills.
- Changing the GitHub workflows' behaviour.
- Auto-resolving merge conflicts.
