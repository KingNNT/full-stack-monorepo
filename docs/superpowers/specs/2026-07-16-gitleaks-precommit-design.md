# Run Gitleaks in Pre-Commit

- **Date:** 2026-07-16
- **Status:** Approved design

## Goal

Run a full-repository Gitleaks scan automatically during every commit, after the existing staged-file Biome checks.

## Scope

Update `.husky/pre-commit` on the existing Gitleaks relocation branch so it runs:

```bash
pnpm exec lint-staged && ./tools/bin/gitleaks detect --source . --redact
```

The command uses the `tools/bin/gitleaks` helper introduced by the relocation change. No changes are needed to the Gitleaks script, `.lintstagedrc.json`, package scripts, or application code.

The hook requires either a local `gitleaks` binary on PATH or Docker (the helper falls back to `docker run zricethezav/gitleaks`). Contributor-facing docs must reflect that prerequisite so contributors understand the helper is mandatory at every commit. The following documentation updates are in scope and must agree with the implemented hook:

- `README.md` — change the prior "Docker is optional" wording so it states either a local `gitleaks` binary or Docker is required for the pre-commit secret scan; add a `gitleaks` line to the Prerequisites list; and update the Tooling Git-hooks entry to describe the hook as `lint-staged` (Biome) followed by the repository-wide Gitleaks command.
- `CLAUDE.md` — update the Tooling Git-hooks entry to describe the pre-commit hook as `lint-staged` (Biome check) followed by the repository-wide Gitleaks scan.
- `docs/superpowers/specs/2026-07-16-gitleaks-precommit-design.md` — this document; scope and validation reflect the documentation updates above.
- `docs/superpowers/plans/2026-07-16-gitleaks-precommit.md` — the implementation plan; tracked alongside the hook change so doc files are explicitly part of its scope.

## Behavior and Failure Handling

- `lint-staged` runs first and must succeed before Gitleaks starts.
- Gitleaks scans the entire repository (`--source .`) and redacts detected secret values in output (`--redact`).
- A non-zero exit status from either command prevents the commit.
- The command remains compatible with the helper's local-binary preference and Docker fallback.
- Without either a local `gitleaks` binary or Docker on PATH, the helper exits non-zero and the commit is blocked; no secret scan is skipped silently.

## Validation

- Confirm `.husky/pre-commit` contains the exact chained command.
- Run `bash -n .husky/pre-commit` and `bash -n tools/bin/gitleaks`.
- Exercise the hook with a safe staged change and confirm it reaches Gitleaks successfully when no secrets are present.
- Confirm `README.md` correctly states that either a local `gitleaks` binary or Docker is required for the pre-commit hook, and that the Tooling Git-hooks entry references `./tools/bin/gitleaks detect --source . --redact`.
- Confirm `CLAUDE.md` Tooling Git-hooks entry describes the pre-commit hook as `lint-staged` (Biome check) followed by the repository-wide Gitleaks scan.
- Run `pnpm test`.
- Run `git diff --check` and verify only the hook, this design spec, the implementation plan, `README.md`, and `CLAUDE.md` are changed.
