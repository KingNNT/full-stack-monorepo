---
name: env-check
description: Check that each app's env has exactly the keys its .env.example declares, with `mise run <env>:env:check` (<env> = local, dev, staging or prod; the env's local file by default) or `--remote` (the Infisical environment of the same name, including @shared references). Use when the user asks to check, verify, compare or audit env vars or secrets, find missing or extra keys, or after changing a .env.example. Only applies when .infisical.json exists at the repo root.
---

# Check env keys

**First:** if `.infisical.json` does not exist at the repo root, tell the
user Infisical is not configured for this repo and stop.

The task prefix is the environment: `local` checks `apps/<app>/.env`,
`dev` / `staging` / `prod` check `apps/<app>/.env.<env>`; `--remote` checks
the Infisical environment of the same name. Default to `local` when the user
names none.

| Want | Run |
|---|---|
| local file vs `.env.example` | `mise run <env>:env:check [--app <name>]` |
| Infisical vs `.env.example` | `mise run <env>:env:check --remote [--app <name>]` |

Exit 0 means everything matches; exit 1 lists the problems per app. The
report names keys only, never values.

## Reading the report

| Line | Meaning | Fix |
|---|---|---|
| `missing: A, B` | in `.env.example`, not in the source | local: the user adds them to the file (or pulls them, env-pull skill); remote: push (env-push skill) |
| `extra: C` | in the source, not in `.env.example` | add it to `.env.example` if it is real, otherwise the **user** removes it from the file (remote: in the Infisical UI) |
| `not a shared ref: K` | a `@shared` key in `/apps/<app>` holds a value instead of `${<env>.shared.K}` | push rewrites it |
| `shared missing: K` | `/shared` has no `K` | push |
| `K is @shared in apps/a but not in apps/b` | the markers disagree | mark it `# @shared` in every app's `.env.example`, or in none |

## Never

- Read, print or edit env files or secret values (AGENTS.md hard rule 2) —
  the report already names the keys.
