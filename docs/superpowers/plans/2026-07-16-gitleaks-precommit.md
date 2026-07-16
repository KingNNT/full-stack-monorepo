# Add Gitleaks to Pre-Commit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every commit run the repository-wide Gitleaks scan after the existing staged-file Biome checks.

**Architecture:** Extend the existing Husky pre-commit shell hook with a short-circuit command chain. `lint-staged` runs first; only after it succeeds does the root-level `bin/gitleaks` helper run. Because the commands are joined with `&&`, either command returning non-zero blocks the commit.

**Tech Stack:** Husky, pnpm, lint-staged, Bash, Gitleaks

---

### Task 1: Chain Gitleaks into the pre-commit hook

**Files:**
- Modify: `.husky/pre-commit`
- Create: `docs/superpowers/plans/2026-07-16-gitleaks-precommit.md`

- [ ] **Step 1: Update the hook with the approved command chain**

Replace the current contents of `.husky/pre-commit` with exactly:

```bash
pnpm exec lint-staged && ./bin/gitleaks detect --source . --redact
```

This keeps the existing Biome/lint-staged check first and adds a full-repository, redacted Gitleaks scan using the relocated helper.

- [ ] **Step 2: Stage the hook and this implementation plan**

```bash
git add .husky/pre-commit docs/superpowers/plans/2026-07-16-gitleaks-precommit.md
```

Expected: only the hook and implementation plan are staged.

- [ ] **Step 3: Validate shell syntax and the exact hook contents**

```bash
bash -n .husky/pre-commit
bash -n bin/gitleaks
test "$(git show :.husky/pre-commit)" = "pnpm exec lint-staged && ./bin/gitleaks detect --source . --redact"
```

Expected: all commands exit successfully, and the staged hook contains the exact approved command.

- [ ] **Step 4: Execute the staged pre-commit hook safely**

```bash
bash .husky/pre-commit
```

Expected: lint-staged completes first, the Gitleaks helper runs against the repository, and the command exits 0 when no secrets are detected. If the local Gitleaks binary is unavailable, the helper uses its Docker fallback.

- [ ] **Step 5: Run the repository test suite**

```bash
pnpm test
```

Expected: the API and web test targets pass; this hook-only change does not alter application behavior.

- [ ] **Step 6: Review and commit the implementation**

```bash
git diff --cached --check
git diff --cached -- .husky/pre-commit docs/superpowers/plans/2026-07-16-gitleaks-precommit.md
git commit -m "chore: run gitleaks in pre-commit"
```

Expected: the staged diff contains only the approved hook command and implementation plan, and the commit succeeds with the repository's conventional commit format.

### Final validation

- [ ] Run `git status --short --untracked-files=all` and confirm the worktree is clean.
- [ ] Confirm the pre-commit hook still blocks on a non-zero result because the two commands are joined with `&&`.
