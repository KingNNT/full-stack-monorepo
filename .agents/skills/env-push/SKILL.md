---
name: env-push
description: Push each app's env file to the Infisical environment of the same name with `mise run <env>:env:push` (<env> = local, dev, staging or prod) — /apps/<app> per app, keys marked `# @shared` in .env.example stored once in /shared and referenced from the apps. Use when the user asks to push, upload or publish env vars or secrets to Infisical, or to share a variable between apps. Only applies when .infisical.json exists at the repo root.
---

# Push env to Infisical

**First:** if `.infisical.json` does not exist at the repo root, tell the
user Infisical is not configured for this repo (`infisical init` sets it up)
and stop.

## Environments

The task prefix is the environment and the Infisical environment slug; each
reads its own git-ignored file:

| Task | Reads | Infisical env |
|---|---|---|
| `local:env:push` | `apps/<app>/.env` | `local` |
| `dev:env:push` | `apps/<app>/.env.dev` | `dev` |
| `staging:env:push` | `apps/<app>/.env.staging` | `staging` |
| `prod:env:push` | `apps/<app>/.env.prod` | `prod` |

The Infisical project must have an environment with that exact slug.

## Layout (per Infisical environment)

```
/shared/<KEY>      = value                     # keys marked # @shared
/apps/<app>/<KEY>  = value                     # every other key
/apps/<app>/<KEY>  = ${<env>.shared.<KEY>}     # @shared keys reference /shared
```

Keys come from `apps/<app>/.env.example`, values from the env's file.
Mark a shared key on its `.env.example` line in **every** app that uses it:

```
DATABASE_URL=postgres://localhost/app   # @shared
```

## Steps

1. If the user did not name an environment, ask which one.
2. `mise run <env>:env:check` — the user fixes missing keys in the file first.
3. `mise run <env>:env:push --dry-run` (`--app <name>` for one app). Show the
   user the diff.
4. Only after the user says yes: the same command without `--dry-run`. A yes
   covers that one run.
5. `mise run <env>:env:check --remote` to confirm.

Diff lines: `+ KEY` new (`+ KEY (shared ref)` for a @shared key), `~ KEY (value changed)`, `! KEY (only on remote, kept)`
— push never deletes. Notes: `extra (not pushed)`, `empty, not pushed`,
`missing in <file>, not pushed`.

## Never

- Read, print, paste or edit env files or secret values — the task reads
  them and its output never shows values.
- Set or delete secrets with raw `infisical` commands.
- Push to an environment the user did not name — ask which one. Treat
  `staging` and `prod` with extra care: show the dry run and wait for an
  explicit yes.

## Common failures

| Message | Fix |
|---|---|
| `Infisical is not configured` | No `.infisical.json`; nothing to do. |
| `infisical CLI not found` | Ask the user to install the Infisical CLI. |
| `run: infisical login` | Ask the user to run `infisical login` (or set `INFISICAL_TOKEN`) and check that the Infisical environment exists. |
| `apps/<app>/.env… not found` | The user creates it from `.env.example`, or pulls it (env-pull skill). |
| `@shared KEY differs between …` | The user makes the value equal in every app's file. |
| `KEY is @shared in apps/a but not in apps/b` | Mark the key `# @shared` in every app's `.env.example`, or in none. |
