#!/usr/bin/env bash
# Shared helpers for the env:* mise tasks. Source, do not execute.
# Values read from .env files and Infisical are never printed or passed as
# arguments; jq receives them through environment variables.

ENV_ROOT="$(git rev-parse --show-toplevel)"
KEY_RE='^([A-Za-z_][A-Za-z0-9_]*)=(.*)$'
SHARED_RE='#.*@shared'

die() {
  echo "error: $*" >&2
  exit 1
}

# Infisical is opt-in: without .infisical.json every env task is a no-op.
require_infisical_config() {
  if [ ! -f "$ENV_ROOT/.infisical.json" ]; then
    echo "Infisical is not configured (no .infisical.json); skipping"
    exit 0
  fi
}

require_infisical_cli() {
  command -v infisical >/dev/null 2>&1 \
    || die "infisical CLI not found; install it: https://infisical.com/docs/cli/overview"
}

# App names (apps/<name>/ with a .env.example), one per line.
list_apps() {
  local dir
  for dir in "$ENV_ROOT"/apps/*/; do
    if [ -f "$dir.env.example" ]; then
      basename "$dir"
    fi
  done
}

# Sets LINE to a dotenv line without leading whitespace and `export `.
normalize_line() {
  LINE="${1#"${1%%[![:space:]]*}"}"
  LINE="${LINE#export }"
}

# KEY<TAB>shared|local for each key in apps/<app>/.env.example, in file order.
example_keys() {
  local line key rest kind
  while IFS= read -r line || [ -n "$line" ]; do
    normalize_line "$line"
    [[ "$LINE" =~ $KEY_RE ]] || continue
    key="${BASH_REMATCH[1]}"
    rest="${BASH_REMATCH[2]}"
    kind=local
    if [[ "$rest" =~ $SHARED_RE ]]; then
      kind=shared
    fi
    printf '%s\t%s\n' "$key" "$kind"
  done <"$ENV_ROOT/apps/$1/.env.example"
}

# Keys defined in a dotenv file, one per line.
dotenv_keys() {
  local line
  while IFS= read -r line || [ -n "$line" ]; do
    normalize_line "$line"
    if [[ "$LINE" =~ $KEY_RE ]]; then
      printf '%s\n' "${BASH_REMATCH[1]}"
    fi
  done <"$1"
}

# Prints the value of <key> in a dotenv file (the last definition wins).
# Returns 3 when the key is absent; dies on a multi-line quoted value.
dotenv_get() {
  local file="$1" want="$2" line value="" found=0 q
  while IFS= read -r line || [ -n "$line" ]; do
    normalize_line "$line"
    [[ "$LINE" =~ $KEY_RE ]] || continue
    [ "${BASH_REMATCH[1]}" = "$want" ] || continue
    value="${BASH_REMATCH[2]}"
    value="${value#"${value%%[![:space:]]*}"}"
    q="${value:0:1}"
    if [ "$q" = '"' ] || [ "$q" = "'" ]; then
      value="${value:1}"
      case "$value" in
        *"$q"*) value="${value%%"$q"*}" ;;
        *) die "$file: $want has a multi-line or unterminated quoted value, which is not supported" ;;
      esac
    else
      value="${value%%[[:space:]]#*}"
      value="${value%"${value##*[![:space:]]}"}"
    fi
    found=1
  done <"$file"
  [ "$found" = 1 ] || return 3
  printf '%s' "$value"
}

# app<TAB>KEY<TAB>shared|local for every app's .env.example.
all_example_keys() {
  local app key kind
  while IFS= read -r -u 3 app; do
    while IFS=$'\t' read -r -u 4 key kind; do
      printf '%s\t%s\t%s\n' "$app" "$key" "$kind"
    done 4< <(example_keys "$app")
  done 3< <(list_apps)
}

# "apps/a, apps/b": apps whose .env.example declares <key> as <kind>.
apps_with() { # <rows> <key> <kind>
  awk -F'\t' -v k="$2" -v t="$3" '$2 == k && $3 == t { printf "%sapps/%s", (n++ ? ", " : ""), $1 }' <<<"$1"
}

# One line per key that is @shared in one app's .env.example but not another's.
shared_marker_problems() {
  local rows key
  rows="$(all_example_keys)"
  for key in $(cut -f2,3 <<<"$rows" | LC_ALL=C sort -u | cut -f1 | uniq -d); do
    printf '%s is @shared in %s but not in %s\n' "$key" \
      "$(apps_with "$rows" "$key" shared)" "$(apps_with "$rows" "$key" local)"
  done
}

# Joins non-empty lines into "a, b, c".
join_lines() {
  grep . <<<"$1" | paste -sd, - | sed 's/,/, /g'
}

sorted() {
  LC_ALL=C sort -u
}

# Lines of sorted list $1 that are not in sorted list $2.
minus() {
  LC_ALL=C comm -23 <(printf '%s\n' "$1") <(printf '%s\n' "$2") | grep . || true
}

# The Infisical reference an app folder holds for a @shared key.
shared_ref() { # <env> <key>
  # shellcheck disable=SC2016 # a literal Infisical reference, not a shell expansion
  printf '${%s.shared.%s}' "$1" "$2"
}

# Runs the infisical CLI (stdout only); on failure shows its error and how to log in.
infisical_run() {
  local out err
  err="$(mktemp)"
  if ! out="$(infisical "$@" 2>"$err")"; then
    cat "$err" >&2
    rm -f "$err"
    die "infisical $1 $2 failed; check --env and run: infisical login (or set INFISICAL_TOKEN)"
  fi
  rm -f "$err"
  printf '%s\n' "$out"
}

# Sub-folder names of <path> in <env>, one per line.
folder_names() { # <env> <path>
  local out
  out="$(infisical_run secrets folders get --env "$1" --path "$2" -o json --silent)" || exit 1
  jq -r 'if type == "array" then .[] elif . == null then empty
    else error("unexpected output from infisical secrets folders get") end
    | (.name // .folderName // empty)' <<<"$out"
}

# Walks <path> one folder at a time. With `create`, creates missing folders;
# otherwise returns 1 at the first missing one. CLI errors always exit.
walk_folders() { # <env> <path> [create]
  local env="$1" rest="${2#/}" parent=/ seg names
  while [ -n "$rest" ]; do
    seg="${rest%%/*}"
    if [ "$seg" = "$rest" ]; then rest=""; else rest="${rest#*/}"; fi
    names="$(folder_names "$env" "$parent")" || exit 1
    if ! grep -qxF -- "$seg" <<<"$names"; then
      [ "${3:-}" = create ] || return 1
      infisical_run secrets folders create --env "$env" --path "$parent" --name "$seg" --silent >/dev/null || exit 1
    fi
    parent="${parent%/}/$seg"
  done
}

folder_exists() { walk_folders "$1" "$2"; }

ensure_folder() { walk_folders "$1" "$2" create; }

# Raw secrets of <env>:<path> as {"KEY": "value"} with references unexpanded;
# {} when the folder does not exist.
remote_object() { # <env> <path>
  local out
  if ! folder_exists "$1" "$2"; then
    echo '{}'
    return 0
  fi
  out="$(infisical_run export --format=json --env "$1" --path "$2" --expand=false --include-imports=false --secret-overriding=false --silent)" || exit 1
  jq -c 'map({key: (.key // .secretKey), value: (.value // .secretValue)}) | from_entries' <<<"$out"
}
