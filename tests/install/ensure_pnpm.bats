#!/usr/bin/env bats

load 'helpers/stubs'

INSTALL_SH="${BATS_TEST_DIRNAME}/../../install.sh"

setup() {
  setup_stub_dir
}

teardown() {
  teardown_stub_dir
}

@test "ensure_pnpm: returns OK when pnpm is already on PATH" {
  stub pnpm 'echo "9.0.0"'

  run bash -c "source '$INSTALL_SH'; ensure_pnpm"
  [ "$status" -eq 0 ]
  [[ "$output" == *"pnpm 9.0.0 OK"* ]]

  # corepack must not be touched when pnpm is already installed.
  [ ! -f "$STUB_DIR/corepack.calls" ]
}

@test "ensure_pnpm: dies when corepack is missing and pnpm absent" {
  run bash -c "$(isolate_path_snippet); source '$INSTALL_SH'; ensure_pnpm"
  [ "$status" -ne 0 ]
  [[ "$output" == *"corepack not found"* ]]
}

@test "ensure_pnpm: uses corepack to enable pnpm when missing" {
  # pnpm starts absent. corepack writes a pnpm shim into $STUB_DIR when
  # activated, simulating what `corepack prepare pnpm@latest --activate`
  # does in real life.
  # Use absolute paths for coreutils because PATH is isolated to $STUB_DIR
  # inside the subshell that invokes this stub.
  stub corepack '
if [ "$1" = prepare ]; then
  /bin/cat >"$STUB_DIR/pnpm" <<PNPM
#!/bin/bash
echo "9.0.0"
PNPM
  /bin/chmod +x "$STUB_DIR/pnpm"
fi
exit 0
'

  # Use an empty PATH (inside the subshell only) so `has pnpm` returns false
  # before corepack activates it. `hash -r` clears bash's command-lookup cache
  # so the pnpm shim that corepack writes mid-execution is discovered on the
  # next `pnpm --version` call.
  run bash -c "
    $(isolate_path_snippet)
    source '$INSTALL_SH'
    _corepack=\"\$STUB_DIR/corepack\"
    corepack() { \"\$_corepack\" \"\$@\"; local rc=\$?; hash -r; return \$rc; }
    export -f corepack
    ensure_pnpm
  "
  [ "$status" -eq 0 ]
  [[ "$output" == *"pnpm 9.0.0 installed"* ]]

  # corepack was invoked twice: `enable` and `prepare pnpm@latest --activate`.
  [ "$(call_count corepack)" -eq 2 ]
  local calls
  calls="$(cat "$STUB_DIR/corepack.calls")"
  [[ "$calls" == *"enable"* ]]
  [[ "$calls" == *"prepare pnpm@latest --activate"* ]]
}
