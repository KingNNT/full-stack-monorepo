---
name: env-push
description: Push each app's .env to Infisical with `mise run env:push` — /apps/<app> per app, keys marked `# @shared` in .env.example stored once in /shared and referenced from the apps. Use when the user asks to push, upload, sync or publish env vars or secrets to Infisical, or to share a variable between apps. Only applies when .infisical.json exists at the repo root.
---

# Push env to Infisical

**First:** if `.infisical.json` does not exist at the repo root, tell the
user Infisical is not configured for this repo (`infisical init` sets it up)
and stop.

## Layout (per Infisical environment)

```
/shared/<KEY>      = value                     # keys marked # @shared
/apps/<app>/<KEY>  = value                     # every other key
/apps/<app>/<KEY>  = ${<env>.shared.<KEY>}     # @shared keys reference /shared
```

Keys come from `apps/<app>/.env.example`, values from `apps/<app>/.env`.
Mark a shared key on its `.env.example` line in **every** app that uses it:

```
DATABASE_URL=postgres://localhost/app   # @shared
```

## Steps

1. `mise run env:check` — the user fixes missing keys in `.env` first.
2. If the user did not name an environment, ask which one. Then
   `mise run env:push --env <slug> --dry-run` (`--app <name>` for one app).
   Show the user the diff.
3. Only after the user says yes: the same command (with `--env <slug>`)
   without `--dry-run`. A yes covers that one run.
4. `mise run env:check --remote --env <slug>` to confirm.

Diff lines: `+ KEY` new (`+ KEY (shared ref)` for a @shared key), `~ KEY (value changed)`, `! KEY (only on remote, kept)`
— push never deletes. Notes: `extra (not pushed)`, `empty, not pushed`,
`missing in .env, not pushed`.

## Never

- Read, print, paste or edit `.env` files or secret values — the task reads
  them and its output never shows values.
- Set or delete secrets with raw `infisical` commands.
- Push without `--env <slug>`, or to an environment the user did not name
  — ask which one.

## Common failures

| Message | Fix |
|---|---|
| `Infisical is not configured` | No `.infisical.json`; nothing to do. |
| `infisical CLI not found` | Ask the user to install the Infisical CLI. |
| `run: infisical login` | Ask the user to run `infisical login` (or set `INFISICAL_TOKEN`) and check the `--env` slug. |
| `apps/<app>/.env not found` | The user creates it from `.env.example`. |
| `@shared KEY differs between …` | The user makes the value equal in every app's `.env`. |
| `KEY is @shared in apps/a but not in apps/b` | Mark the key `# @shared` in every app's `.env.example`, or in none. |
