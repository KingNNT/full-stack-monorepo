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
| `gh is not authenticated` | Ask the user to run `gh auth login`. |
| `RELEASE_TOKEN secret is missing` | A repo admin runs `gh secret set RELEASE_TOKEN` (`docs/infrastructure.md#release-token`). |
| `a release branch is already open` | Finish it (`flow:finish release`) or land fixes as `bugfix` PRs into it. |
| `checks on #N are fail` / `pending` | Wait, or fix the branch; `gh pr checks N` shows which check. |
| `needs an approving review` | Ask the user to get the PR approved. |
| `not mergeable (CONFLICTING)` on a release PR | Ask the user; usually a `bugfix/*` branch off the release that merges `origin/main`, PR'd into the release. |
| `is not a Conventional Commit` | Fix the title, e.g. `feat(web): add dark mode`. |
| `nothing to release` | No commits on `develop` since the last tag. |
| `commitlint is not installed` | Run `pnpm install`. |
| `branch and the version must match` | The release branch is broken; ask the user. |
| `mergeability UNKNOWN` | GitHub is still computing; re-run `flow:back-merge` in a minute. |
| `auto-merge uses SQUASH` | Ask the user to disable auto-merge on that PR, then re-run. |
