#!/usr/bin/env bash
# Helpers for bats tests that shadow external commands via PATH.

setup_stub_dir() {
  STUB_DIR="$(mktemp -d "${BATS_TMPDIR:-/tmp}/install-stubs.XXXXXX")"
  export STUB_DIR
  export ORIGINAL_PATH="$PATH"
  export PATH="$STUB_DIR:$PATH"
}

teardown_stub_dir() {
  if [ -n "${STUB_DIR:-}" ] && [ -d "$STUB_DIR" ]; then
    rm -rf "$STUB_DIR"
  fi
  if [ -n "${ORIGINAL_PATH:-}" ]; then
    export PATH="$ORIGINAL_PATH"
  fi
}

# stub <command-name> <bash-body>
#
# Writes an executable shim under $STUB_DIR that, when called, runs <bash-body>.
# Because $STUB_DIR is prepended to PATH, the shim shadows the real command.
# Every invocation is appended (one line per call) to
# $STUB_DIR/<command>.calls so tests can assert call count and arguments.
stub() {
  local name="$1"
  local body="$2"
  local path="$STUB_DIR/$name"
  # Use an absolute shebang so the stub still works when a test isolates PATH
  # to $STUB_DIR only (an `/usr/bin/env bash` shebang would fail to resolve
  # `bash` via PATH lookup).
  cat >"$path" <<EOF
#!/bin/bash
echo "\$@" >> "$STUB_DIR/$name.calls"
$body
EOF
  chmod +x "$path"
}

# stub_missing <command-name>
#
# Makes `command -v <name>` fail by creating a stub that hides the real binary
# but, when executed, exits non-zero. Combined with the `has()` helper in
# install.sh which uses `command -v`, we need a different trick: we can't
# remove a command from PATH, only shadow it. The cleanest way is to use a
# subshell that clears PATH entries. Instead, we use `hash -r` + a guard via
# function override in the sourced test context.
#
# For simplicity this helper instead writes a shim that, when invoked, fails —
# callers should prefer `unstub_path` to test "command not installed" cases
# by clearing PATH to only $STUB_DIR.
stub_missing() {
  local name="$1"
  local path="$STUB_DIR/$name"
  cat >"$path" <<EOF
#!/usr/bin/env bash
exit 127
EOF
  chmod +x "$path"
}

# isolate_path_snippet
#
# Emits the shell snippet that, inside a `bash -c` block, restricts PATH
# to only $STUB_DIR so unstubbed commands appear missing to `has`/`command -v`.
# We do NOT mutate the bats parent shell's PATH, because `run bash -c ...`
# still needs to resolve `bash` itself.
isolate_path_snippet() {
  echo "export PATH='$STUB_DIR'"
}

# calls_for <command-name>
#
# Echoes the recorded invocations (one per line) of a stubbed command.
calls_for() {
  local name="$1"
  local file="$STUB_DIR/$name.calls"
  [ -f "$file" ] && cat "$file" || true
}

# call_count <command-name>
call_count() {
  local name="$1"
  local file="$STUB_DIR/$name.calls"
  if [ -f "$file" ]; then
    wc -l <"$file" | tr -d ' '
  else
    echo 0
  fi
}
