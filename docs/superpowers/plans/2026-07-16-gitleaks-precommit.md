# Add Gitleaks to Pre-Commit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every commit run the repository-wide Gitleaks scan after the existing staged-file Biome checks.

**Architecture:** Extend the existing Husky pre-commit shell hook with a short-circuit command chain. `lint-staged` runs first; only after it succeeds does the root-level `tools/bin/gitleaks` helper run. Because the commands are joined with `&&`, either command returning non-zero blocks the commit.

**Tech Stack:** Husky, pnpm, lint-staged, Bash, Gitleaks

---

### Task 1: Chain Gitleaks into the pre-commit hook

**Files:**
- Modify: `.husky/pre-commit`
- Create: `docs/superpowers/plans/2026-07-16-gitleaks-precommit.md`

- [ ] **Step 1: Update the hook with the approved command chain**

Replace the current contents of `.husky/pre-commit` with exactly:

```bash
pnpm exec lint-staged && ./tools/bin/gitleaks detect --source . --redact
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
bash -n tools/bin/gitleaks
test "$(git show :.husky/pre-commit)" = "pnpm exec lint-staged && ./tools/bin/gitleaks detect --source . --redact"
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

### Task 2: Document Gitleaks pre-commit requirements

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-07-16-gitleaks-precommit-design.md`
- Modify: `docs/superpowers/plans/2026-07-16-gitleaks-precommit.md` (this file)

- [ ] **Step 1: Update `README.md` prerequisites to require Gitleaks or Docker**

Replace the Quick Install line "Docker is optional; install it separately if you plan to use \`mise run local:docker-up\` or integration tests." with wording that states Docker is required for the pre-commit Gitleaks scan (helper falls back to \`docker run\` when no local \`gitleaks\` binary is on PATH) and keeps the PostgreSQL / integration-tests mention.

Update the Prerequisites list to add a \`gitleaks\` entry noting the Docker fallback, and update the Docker entry to also reference the gitleaks helper fallback.

- [ ] **Step 2: Update `README.md` Tooling Git-hooks entry**

Change the line "**Git hooks**: Husky pre-commit (lint-staged + Biome), commit-msg (commitlint, conventional commits)" so it describes the hook as \`lint-staged\` (Biome) followed by the repository-wide Gitleaks command (\`./tools/bin/gitleaks detect --source . --redact\`).

- [ ] **Step 3: Update `CLAUDE.md` Tooling Git-hooks entry**

Change the line "**Git hooks**: Husky pre-commit runs lint-staged (Biome check), commit-msg runs commitlint (conventional commits)." to describe the pre-commit hook as \`lint-staged\` (Biome check) followed by the repository-wide Gitleaks scan (\`./tools/bin/gitleaks detect --source . --redact\`).

- [ ] **Step 4: Expand the design spec scope and validation**

Update \`docs/superpowers/specs/2026-07-16-gitleaks-precommit-design.md\` so the Scope section explicitly lists the \`README.md\`, \`CLAUDE.md\`, the spec itself, and the plan as in-scope documentation updates, and so the Validation section includes checks for those doc updates. The new wording must not contradict the added docs.

- [ ] **Step 5: Extend this implementation plan**

Add this Task 2 to the implementation plan so the documentation updates are tracked alongside Task 1.

- [ ] **Step 6: Stage, validate, and commit the documentation changes**

```bash
git add README.md CLAUDE.md \
        docs/superpowers/specs/2026-07-16-gitleaks-precommit-design.md \
        docs/superpowers/plans/2026-07-16-gitleaks-precommit.md

# the pre-commit hook must remain unchanged at HEAD
test "$(git show HEAD:.husky/pre-commit)" = "pnpm exec lint-staged && ./tools/bin/gitleaks detect --source . --redact"

# review only the four intended documentation files
git diff --cached --check
git diff --cached -- README.md CLAUDE.md \
        docs/superpowers/specs/2026-07-16-gitleaks-precommit-design.md \
        docs/superpowers/plans/2026-07-16-gitleaks-precommit.md

git commit -m "docs: document gitleaks pre-commit requirements"
```

Expected: the staged diff contains only the four documentation files listed above, the existing pre-commit hook is unchanged on disk and in \`HEAD\`, and the commit message follows the repository's conventional commit format.

### Final validation

- [ ] Run `git status --short --untracked-files=all` and confirm the worktree is clean.
- [ ] Confirm the pre-commit hook still blocks on a non-zero result because the two commands are joined with `&&`.
- [ ] Confirm `README.md` and `CLAUDE.md` accurately describe the new prerequisite (a local `gitleaks` binary, or Docker as the helper fallback) and reference `./tools/bin/gitleaks detect --source . --redact` in the Tooling Git-hooks entry.
- [ ] Confirm `docs/superpowers/specs/2026-07-16-gitleaks-precommit-design.md` Scope and Validation sections include the documentation updates without contradicting the implemented docs.
