# Run Gitleaks in Pre-Commit

- **Date:** 2026-07-16
- **Status:** Approved design

## Goal

Run a full-repository Gitleaks scan automatically during every commit, after the existing staged-file Biome checks.

## Scope

Update `.husky/pre-commit` on the existing Gitleaks relocation branch so it runs:

```bash
pnpm exec lint-staged && ./bin/gitleaks detect --source . --redact
```

The command uses the root-level helper introduced by the relocation change. No changes are needed to the Gitleaks script, `.lintstagedrc.json`, package scripts, or application code.

## Behavior and Failure Handling

- `lint-staged` runs first and must succeed before Gitleaks starts.
- Gitleaks scans the entire repository (`--source .`) and redacts detected secret values in output (`--redact`).
- A non-zero exit status from either command prevents the commit.
- The command remains compatible with the helper's local-binary preference and Docker fallback.

## Validation

- Confirm `.husky/pre-commit` contains the exact chained command.
- Run `bash -n .husky/pre-commit` and `bash -n bin/gitleaks`.
- Exercise the hook with a safe staged change and confirm it reaches Gitleaks successfully when no secrets are present.
- Run `pnpm test`.
- Run `git diff --check` and verify only the hook, this design spec, and the implementation plan are changed.
