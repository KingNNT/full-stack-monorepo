# Move Gitleaks Helper to tools/bin

- **Date:** 2026-07-16
- **Status:** Approved design

## Goal

Relocate the repository-wide Gitleaks helper from the root-level `bin/` directory to `tools/bin/`. This groups tool wrappers under a dedicated `tools/` namespace and prepares the layout for future helper scripts without further root directory churn.

## Scope

Move `bin/gitleaks` to `tools/bin/gitleaks` as an exact Git rename inside one commit. The script's contents and executable permission remain unchanged. The old `bin/gitleaks` path is removed; no compatibility wrapper is added.

In-scope documentation references (must reference the new path):

- `.husky/pre-commit` — `./bin/gitleaks detect --source . --redact` → `./tools/bin/gitleaks detect --source . --redact`
- `README.md` — prerequisites, optional Tooling Git-hooks entry, Quick Install Docker line, and Tooling Git-hooks entry that already reference `./bin/gitleaks`.
- `CLAUDE.md` — Tooling Git-hooks entry.
- `docs/superpowers/specs/2026-07-16-move-gitleaks-to-root-design.md` and `docs/superpowers/specs/2026-07-16-gitleaks-precommit-design.md` — replace `bin/gitleaks` references with `tools/bin/gitleaks` so historical records remain accurate.
- `docs/superpowers/plans/2026-07-16-move-gitleaks-to-root.md` and `docs/superpowers/plans/2026-07-16-gitleaks-precommit.md` — replace paths and validation commands that target the old helper location.
- Serena memory `mem:web/core` — remove the obsolete reference to `apps/web/bin/gitleaks` and mention the new helper location.

## Out of Scope

- The existing helper logic (local-binary preference, Docker fallback, arg pass-through) is unchanged.
- No application code, package scripts, mise tasks, CI workflows, or other tool entries are touched.
- No files outside the documented in-scope list are modified.

## Validation

- Confirm Git records the change as a rename from `bin/gitleaks` to `tools/bin/gitleaks` with 100% similarity.
- Confirm `tools/bin/gitleaks` remains executable and that the old path no longer exists.
- `bash -n tools/bin/gitleaks` and `bash -n .husky/pre-commit` pass.
- All tracked references to `./bin/gitleaks` are replaced; `git grep -nF "./bin/gitleaks"` finds no remaining occurrences in tracked files.
- `bash .husky/pre-commit` runs lint-staged and the relocated helper successfully (0 leaks).
- `pnpm test` — API and web test suites continue to pass without behavioral changes.
- Worktree is clean apart from the rename and the intentionally updated documentation files.
