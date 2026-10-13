# Infisical env tools — design

Date: 2026-10-13

## Goal

Let a person or an AI agent push each app's env to Infisical in a fixed
structure, with variables shared between apps stored once and referenced,
and check that every app's env (local `.env` or Infisical) has exactly the
keys its `.env.example` declares.

## Context

- Apps live in `apps/<app>/` (today `api`, `web`), each with `.env.example`,
  `.env` (never committed, never printed — AGENTS.md hard rule 2) and
  `.env.test`.
- Nothing in the repo uses Infisical yet. Infisical is opt-in per project:
  `infisical init` writes `.infisical.json` at the repo root.
- The `infisical` CLI (checked with 0.43.121) can read raw values including
  references (`infisical secrets -o json --expand=false --path <p> --env <e>`),
  write in batch (`infisical secrets set --file <dotenv> --path <p> --env <e>`)
  and manage folders (`infisical secrets folders get|create`).
- Tooling convention: bash mise file tasks with a shared lib and a
  plain-bash test suite with fakes, as in `flow:*`
  (`mise/tasks/flow/`, `tools/flow/`).

## Decisions

- Opt-in: without `.infisical.json` at the repo root every task prints
  `Infisical is not configured (no .infisical.json); skipping` and exits 0;
  the skills check for the file first and stop if it is absent.
- Shared variables are declared in `.env.example` with a trailing
  `# @shared` comment on the key's line.
- Push writes values from `apps/<app>/.env`, shows a masked diff, updates
  changed values, and never deletes remote-only keys.
- Check reports missing/extra keys and, remotely, shared-ref problems;
  exits 1 on any problem. It is not wired into hooks or CI.
- Two skills (`env-push`, `env-check`) and two tasks (`env:push`,
  `env:check`), plus `env:test`.

## Infisical layout (per environment)

```
/shared/<KEY>        = <value>                       # every @shared key, once
/apps/<app>/<KEY>    = <value>                       # non-shared keys
/apps/<app>/<KEY>    = ${<env>.shared.<KEY>}         # @shared keys: reference
```

`<app>` is the directory name under `apps/`. `<env>` is the Infisical
environment slug passed with `--env` (default `dev`).

## Data rules

- Apps: every `apps/*/` directory that contains `.env.example`.
- `.env.example` is the source of truth for keys. A key line is
  `KEY=...` or `export KEY=...`; `KEY` matches `[A-Za-z_][A-Za-z0-9_]*`.
  A key is shared when its line ends with a comment containing `@shared`
  (`DATABASE_URL=   # @shared`). Blank and comment-only lines are ignored.
- `.env` parsing (`dotenv_get`): optional `export ` prefix; value is
  everything after the first `=`; surrounding matching `'` or `"` quotes are
  stripped; for unquoted values a ` #` and everything after it is dropped,
  then trailing whitespace. A value with an unclosed quote (multi-line) is an
  error naming the key. `.env.test` is never read.
- Push sends only keys declared in `.env.example`. Keys in `.env` but not in
  the example are reported as `extra (not pushed)`. Keys whose `.env` value
  is empty are reported as `empty, not pushed`.
- A key marked `@shared` must have the same value in every app that
  declares it; otherwise push fails before writing anything, naming the key
  and the apps (never the values).
- A key marked `@shared` in one app's example but declared without the
  marker in another app's example is a problem for both push (fail) and
  check (reported).
- Values are never printed: diffs and errors use key names only.

## Components

### `tools/env/lib.sh`

Sourced by the tasks. Provides:

- `die <msg>`, `run <cmd…>` (same semantics as `tools/flow/lib.sh`:
  `--dry-run` prints instead of executing)
- `require_infisical_config` — skip-and-exit-0 when `.infisical.json` is absent
- `require_infisical_cli` — die `infisical CLI not found; install it: https://infisical.com/docs/cli/overview` when missing
- `list_apps` — app names, one per line, sorted
- `example_keys <app>` — `KEY<TAB>shared|local` lines in file order
- `dotenv_get <file> <key>` — prints the parsed value; exit 1 when the key is
  absent; dies on a multi-line value
- `dotenv_keys <file>` — keys present in a dotenv file
- `remote_json <env> <path>` — `infisical secrets -o json --expand=false
  --silent --env <env> --path <path>`; dies with
  `infisical could not read <env>:<path>; run: infisical login (or set INFISICAL_TOKEN)`
  followed by the CLI's own error
- `remote_folder_exists <env> <parent> <name>` / `ensure_folder <env> <parent> <name>`
  (via `infisical secrets folders get|create`, creation through `run`)

### `mise run env:push [--env <slug>] [--app <name>] [--dry-run]`

1. `require_infisical_config`, `require_infisical_cli`, parse args
   (`--env` default `dev`; `--app` limits to one app, but shared keys it
   declares are still validated against every app that declares them).
2. For each selected app: fail if `apps/<app>/.env` is missing
   (`apps/<app>/.env not found; create it from .env.example`). Build the
   desired state: shared keys → `/shared`, others → `/apps/<app>`, shared
   keys in the app folder → `${<env>.shared.<KEY>}`.
3. Validate shared consistency (values equal, markers consistent). Any
   failure → die before any write.
4. Read the current remote state of `/shared` and each `/apps/<app>`
   (a missing folder counts as empty).
5. Print the diff per folder: `+ KEY` (new), `~ KEY (value changed)`,
   `! KEY (only on remote, kept)`, plus `extra (not pushed)` and
   `empty, not pushed` notes; then `N to write, 0 deleted`.
6. `--dry-run` stops here. Otherwise: ensure folders `/apps`, `/apps/<app>`,
   `/shared`; for each folder with changes write a temp dotenv
   (`umask 077`, `mktemp`, removed by an EXIT trap) containing only the `+`
   and `~` keys and run `infisical secrets set --file <tmp> --env <env>
   --path <folder> --silent` through `run`. `/shared` is written before the
   app folders so references resolve.

### `mise run env:check [--remote] [--env <slug>] [--app <name>]`

1. `require_infisical_config`; with `--remote` also `require_infisical_cli`.
2. Local (default): for each app compare `.env.example` keys with
   `apps/<app>/.env` keys (missing `.env` → every key missing).
3. Remote: compare `.env.example` keys with the keys in `/apps/<app>`; for
   each `@shared` key, the app's raw value must be exactly
   `${<env>.shared.<KEY>}` (else `not a shared ref: KEY`) and `/shared`
   must contain `KEY` (else `shared missing: KEY`).
4. Both modes report inconsistent `@shared` markers across apps.
5. Output per app: `missing: …`, `extra: …`, and the ref problems, or `ok`;
   final line `✔ env matches .env.example` or `✖ N problems`; exit 1 when
   N > 0. Never prints values.

### `mise run env:test`

`shellcheck -x` on `tools/env/**` and `mise/tasks/env/*`, then
`tools/env/test/run.sh [filter]`.

### Skills

`.agents/skills/env-push/SKILL.md` and `.agents/skills/env-check/SKILL.md`,
symlinked from `.claude/skills/env-push` and `.claude/skills/env-check`.

- Both start with: if `.infisical.json` is absent at the repo root, tell the
  user Infisical is not configured and stop.
- Both: never read, print or paste `.env` contents or secret values; use
  the tasks.
- `env-push`: run `env:check` (local) first; then `env:push --dry-run`,
  show the diff, run for real only after the user says yes (one yes covers
  one run); explain `@shared` and how to mark a key; never delete remote
  keys.
- `env-check`: when to use local vs `--remote`; how to read the report;
  fixes (add the key to `.env` from `.env.example`, push, mark `@shared`
  consistently).

### Docs and CI

- AGENTS.md *Environment variables*: one paragraph on `# @shared`, the
  Infisical layout and the two tasks.
- `.github/workflows/pr-checks.yml`: the existing "Flow tasks" step also
  runs shellcheck on the env files and `tools/env/test/run.sh`.

## Error handling

- Every failure exits non-zero with a message naming the fix; validation
  happens before any write.
- The CLI's own error text is passed through after our message; values are
  never echoed.
- Scripts run on bash 3.2 (macOS `/bin/bash`) and bash 5 (CI).

## Testing

Plain bash in `tools/env/test/run.sh`, same harness shape as
`tools/flow/test/run.sh`:

- Each case gets a temp repo dir with `apps/<app>/.env.example` and `.env`
  fixtures and (unless testing the skip) a `.infisical.json`.
- A fake `infisical` first on `PATH` keeps state in a JSON file
  (`{env: {path: {KEY: value}}, folders: […]}`) manipulated with jq;
  supports `secrets -o json --expand=false --env --path`,
  `secrets set --file --env --path`, `secrets folders get|create`; logs
  every call; can be told to fail reads (auth error).
- Cases:
  - no `.infisical.json` → push and check (local and remote) print the skip
    message and exit 0, no `infisical` calls
  - dotenv parsing: `export`, quotes, inline comments, empty value,
    multi-line value error
  - first push: creates `/apps/<app>` and `/shared`, writes values, writes
    `${dev.shared.KEY}` refs for shared keys, `/shared` written first
  - second push with no changes → `0 to write`, no `secrets set` call
  - changed value → `~ KEY`; remote-only key → `! KEY`, never deleted
  - shared value conflict and inconsistent markers → fail, no writes
  - `--dry-run` → diff printed, no `set`/`folders create` calls
  - `--app` limits writes to that app (and `/shared`)
  - values never appear in any output (assert on fixture values)
  - check local: missing, extra, ok, exit codes
  - check remote: missing, extra, not a shared ref, shared missing, ok
  - auth failure → clear message, exit 1
- Real Infisical: verifiable only after `infisical init`; on this repo the
  manual check covers the skip path.

## Plan-time refinements

- No `run` helper: `env:push` exits after the diff under `--dry-run`, before any write.
- Writes use `infisical secrets set --file <tmp>.yaml` with JSON-quoted keys and values so `${…}` references are stored literally; reads use `infisical export --format=json --expand=false --include-imports=false --secret-overriding=false` and accept `key/value` or `secretKey/secretValue` items; folders are listed with `secrets folders get -o json` (`name` or `folderName`).
- Push prints `Infisical env: <slug>` first and labels `(shared ref)` only for the exact `${<env>.shared.<KEY>}` value.
- Push also reports `missing in .env, not pushed: KEY`; `--app` writes `/shared` only for that app's `@shared` keys.
- Every script must also run on bash 3.2 and pass shellcheck 0.9.0.
- **Manual check against a real Infisical project (the user, once `infisical init` is done):** `mise run env:push --dry-run`, then `mise run env:push`, then `mise run env:check --remote`; in the Infisical UI confirm `/apps/<app>/<shared key>` shows the reference `${dev.shared.KEY}` (not an expanded value) and `/shared` holds the value.

## Out of scope

- Pulling env from Infisical into `.env`.
- Deleting remote keys, secret rotation, tags, personal secrets.
- `.env.test`.
- Wiring checks into git hooks or CI against real Infisical.
