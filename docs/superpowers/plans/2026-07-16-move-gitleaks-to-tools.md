# Move Gitleaks Helper to tools/bin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relocate the existing executable Gitleaks helper from `bin/gitleaks` to the repository root at `tools/bin/gitleaks` without changing its behavior, and update every tracked reference in documentation.

**Architecture:** Git rename the tracked helper into the new location, preserving byte content and executable mode, then update each tracked reference so they all point at the new path. No other code, configuration, or workflows change.

**Tech Stack:** Git, Bash, Husky pre-commit hook, Gitleaks (helper script + binary)

---

### Task 1: Move the helper into tools/bin

**Files:**
- Rename: `bin/gitleaks` → `tools/bin/gitleaks`
- Modify: `.husky/pre-commit`
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-07-16-move-gitleaks-to-root-design.md`
- Modify: `docs/superpowers/specs/2026-07-16-gitleaks-precommit-design.md`
- Modify: `docs/superpowers/specs/2026-07-16-move-gitleaks-to-tools-design.md`
- Modify: `docs/superpowers/plans/2026-07-16-move-gitleaks-to-root.md`
- Modify: `docs/superpowers/plans/2026-07-16-gitleaks-precommit.md`
- Modify (Serena memory): `.serena/memories/web/core.md`

- [ ] **Step 1: Create the destination directory**

```bash
mkdir -p tools/bin
```

Expected: `tools/bin/` exists at the repo root.

- [ ] **Step 2: Rename the helper with Git**

```bash
git mv bin/gitleaks tools/bin/gitleaks
```

Expected: Git stages the rename, preserving executable mode and bytes.

- [ ] **Step 3: Verify the move and executable mode**

```bash
test ! -e bin/gitleaks
test -x tools/bin/gitleaks
test "$(git show HEAD:bin/gitleaks | sha256sum | cut -d' ' -f1)" = "$(sha256sum tools/bin/gitleaks | cut -d' ' -f1)"
```

Expected: old path absent; new path executable; SHA-256 of the previous-content view matches the working-tree file.

- [ ] **Step 4: Replace tracked references to the old helper path**

For each of the files below replace every occurrence of the old relative helper path with `./tools/bin/gitleaks` (commit paths `bin/gitleaks` → `tools/bin/gitleaks`):

- `.husky/pre-commit`
- `README.md`
- `CLAUDE.md`
- `docs/superpowers/specs/2026-07-16-move-gitleaks-to-root-design.md`
- `docs/superpowers/specs/2026-07-16-gitleaks-precommit-design.md`
- `docs/superpowers/specs/2026-07-16-move-gitleaks-to-tools-design.md`
- `docs/superpowers/plans/2026-07-16-move-gitleaks-to-root.md`
- `docs/superpowers/plans/2026-07-16-gitleaks-precommit.md`

Then run:

```bash
obsolete_helper_path='./bin/'gitleaks
test -z "$(git grep -nF "$obsolete_helper_path")"
```

Expected: no tracked occurrences remain.

- [ ] **Step 5: Update Serena memory mem:web/core**

Replace the line referencing `apps/web/bin/gitleaks` with text describing the new helper location:

- Remove: ``- Existing utility script of interest: `apps/web/bin/gitleaks`; no root `bin/` directory currently exists.``
- Replace with: ``- Gitleaks helper lives at `tools/bin/gitleaks` (relocated from `bin/gitleaks`).``

If `mem:web/core` is currently untracked, copy the replacement directly into the file under `.serena/memories/web/core.md` so the next onboarding run reads the updated text.

- [ ] **Step 6: Validate shell syntax and the hook file**

```bash
bash -n tools/bin/gitleaks
bash -n .husky/pre-commit
test "$(cat .husky/pre-commit)" = "pnpm exec lint-staged && ./tools/bin/gitleaks detect --source . --redact"
```

Expected: all commands succeed, and `.husky/pre-commit` contains exactly the new path.

- [ ] **Step 7: Run the pre-commit hook end-to-end**

```bash
bash .husky/pre-commit
```

Expected: lint-staged completes first; the helper runs at the new path; Gitleaks returns exit 0 with no leaks.

- [ ] **Step 8: Run the repository test suite**

```bash
pnpm test
```

Expected: API and web test targets continue to pass (no application code changed).

- [ ] **Step 9: Review and commit the implementation**

```bash
git diff --cached --check
git diff --summary --find-renames
git add -A -- bin/gitleaks tools/bin/gitleaks .husky/pre-commit README.md CLAUDE.md .serena/memories/web/core.md docs/superpowers
git commit -m "chore: move gitleaks helper to tools/bin"
```

Expected: the diff shows a 100% rename from `bin/gitleaks` to `tools/bin/gitleaks`, the reference updates listed above, the Serena memory edit, and the implementation plan. No unrelated files are staged.

### Final validation

- [ ] `git status --short --untracked-files=all` — only the plan file (if still untracked) may appear; otherwise clean.
- [ ] Define `obsolete_helper_path='./bin/'gitleaks` and confirm `git grep -nF "$obsolete_helper_path"` is empty.
- [ ] `git show HEAD~1:tools/bin/gitleaks 2>/dev/null` exits non-zero, confirming the old path never existed in HEAD.
