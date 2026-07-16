# Move Gitleaks Script to Root

- **Date:** 2026-07-16
- **Status:** Approved design

## Goal

Make the repository's Gitleaks helper available from the repository `tools/bin/` directory instead of the web application directory.

## Scope

Move `apps/web/bin/gitleaks` to `tools/bin/gitleaks` as an exact Git move. The script's contents and executable permission remain unchanged. The old path is removed; no compatibility wrapper is added because repository search found no references to the old location.

## Behavior

The relocated script continues to:

- use a locally installed `gitleaks` binary when available;
- fall back to the configured Docker image otherwise; and
- pass through any command-line arguments unchanged.

No package scripts, mise tasks, application code, or documentation need updating because the script is currently unreferenced.

## Validation

- Confirm Git recognizes the operation as a rename from `apps/web/bin/gitleaks` to `tools/bin/gitleaks`.
- Confirm `tools/bin/gitleaks` remains executable.
- Run `bash -n tools/bin/gitleaks` for shell syntax validation.
- Run `git diff --check` for whitespace errors.
- Ensure the old path no longer exists and the working tree contains only the intended change (apart from pre-existing untracked files).
