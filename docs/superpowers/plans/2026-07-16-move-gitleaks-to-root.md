# Move Gitleaks Script to Root Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relocate the existing executable Gitleaks helper from `apps/web/bin/gitleaks` to the repository root at `bin/gitleaks` without changing its behavior.

**Architecture:** This is a filesystem-only change. Git will record the existing script as a rename, preserving its contents and executable mode; no application, package, or task configuration changes are needed.

**Tech Stack:** Git, Bash, pnpm/Nx repository tooling

---

### Task 1: Move the executable helper

**Files:**
- Create through rename: `bin/gitleaks`
- Delete through rename: `apps/web/bin/gitleaks`

- [ ] **Step 1: Create the root bin directory**

Run from the worktree root:

```bash
mkdir -p bin
```

Expected: the root-level `bin/` directory exists.

- [ ] **Step 2: Move the tracked script with Git**

```bash
git mv apps/web/bin/gitleaks bin/gitleaks
```

Expected: Git stages the source path as removed and the root path as added, with the file contents unchanged.

- [ ] **Step 3: Verify the relocation and executable mode**

```bash
test ! -e apps/web/bin/gitleaks
test -x bin/gitleaks
cmp <(git show HEAD:apps/web/bin/gitleaks) bin/gitleaks
```

Expected: all commands succeed; the old path is absent, the new path is executable, and the file bytes match `HEAD`.

- [ ] **Step 4: Validate shell syntax and Git diff hygiene**

```bash
bash -n bin/gitleaks
git diff --check
git diff --summary --find-renames
```

Expected: syntax and whitespace checks succeed, and the diff summary identifies a rename from `apps/web/bin/gitleaks` to `bin/gitleaks`.

- [ ] **Step 5: Review the final change and commit it**

```bash
git status --short
git diff --cached --find-renames -- apps/web/bin/gitleaks bin/gitleaks
git diff --cached --check
git add -A -- apps/web/bin/gitleaks bin/gitleaks docs/superpowers/plans/2026-07-16-move-gitleaks-to-root.md
git commit -m "chore: move gitleaks helper to root"
```

Expected: the staged diff shows the intended script relocation plus this implementation plan, and the commit uses the repository's conventional commit format.

### Validation after implementation

- [ ] Run `pnpm test` from the worktree root. Expected: the baseline API and web test suites continue to pass because no application code changed.
- [ ] Re-run `git status --short --untracked-files=all`. Expected: the worktree is clean except for no generated files; the final commit contains the relocation.
