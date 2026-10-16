---
name: env-pull
description: Pull secrets from the Infisical environment of the same name into each app's .env with `mise run <env>:env:pull` (<env> = local, rpi, dev, staging or prod), @shared references resolved. Use when the user asks to pull, download, fetch or sync env vars or secrets from Infisical, or to set up a missing .env from Infisical. Only applies when .infisical.json exists at the repo root.
---

# Pull env from Infisical

**First:** if `.infisical.json` does not exist at the repo root, tell the
user Infisical is not configured for this repo (`infisical init` sets it up)
and stop.

## Environments

Every `<env>:env:pull` (`<env>` = `local`, `rpi`, `dev`, `staging`, `prod`)
reads the Infisical environment of the same name and writes
`apps/<app>/.env` — the only env file the apps load. It never writes
`.env.<env>` (those are push sources). Pulling another environment
overwrites the values pulled before, so confirm the environment first.

Only keys declared in `apps/<app>/.env.example` are pulled, from
`/apps/<app>` with `${<env>.shared.KEY}` references resolved. Pulled keys
overwrite their lines in place; other lines (comments, local-only keys) are
kept. A missing file starts from `.env.example`.

## Steps

1. If the user did not name an environment, ask which one.
2. `mise run <env>:env:pull --dry-run` (`--app <name>` for one app). Show the
   user the diff — `~ KEY (value changed)` lines overwrite local values.
3. Only after the user says yes: the same command without `--dry-run`. A yes
   covers that one run.
4. `mise run <env>:env:check` to confirm.

Diff lines: `+ KEY` (not in the file yet), `~ KEY (value changed)`. Notes:
`missing on remote, not pulled: KEY`, `extra on remote (not pulled): …`.

## Never

- Read, print, paste or edit env files or secret values — the task writes
  them and its output never shows values.
- Pull from an environment the user did not name.

## Common failures

| Message | Fix |
|---|---|
| `Infisical is not configured` | No `.infisical.json`; nothing to do. |
| `infisical CLI not found` | Ask the user to install the Infisical CLI. |
| `run: infisical login` | Ask the user to run `infisical login` (or set `INFISICAL_TOKEN`) and check that the Infisical environment exists. |
| `cannot write KEY: …` | The value has a newline or both quote types; the user sets that key by hand. |
| `KEY has a multi-line … quoted value` | The existing file has a multi-line value; the user fixes that line. |
