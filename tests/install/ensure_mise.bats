#!/usr/bin/env bats
# Tests for ensure_mise() in install.sh

load 'helpers/stubs'

INSTALL_SH="${BATS_TEST_DIRNAME}/../../install.sh"

setup() {
  setup_stub_dir
}

teardown() {
  teardown_stub_dir
}

@test "ensure_mise: skips install when mise is already available" {
  stub mise "echo '2026.6.2 macos-arm64'"

  run bash -c "source '$INSTALL_SH'; ensure_mise"
  [ "$status" -eq 0 ]
  [[ "$output" == *"mise"*"2026.6.2"* ]]
}

@test "ensure_mise: installs mise when not found" {
  # Use a temp HOME so the simulated install doesn't clobber the real mise binary.
  FAKE_HOME="$(mktemp -d "${BATS_TMPDIR:-/tmp}/mise-test-home.XXXXXX")"
  export HOME="$FAKE_HOME"

  # Stub curl to simulate mise install script — writes a mise shim to $HOME/.local/bin.
  # Use absolute paths for coreutils because PATH is isolated to $STUB_DIR.
  stub curl "/bin/mkdir -p \$HOME/.local/bin; /bin/echo '#!/bin/bash' > \$HOME/.local/bin/mise; /bin/echo 'echo 2026.6.2' >> \$HOME/.local/bin/mise; /bin/chmod +x \$HOME/.local/bin/mise"
  stub sh "true"

  # Isolate PATH so mise is not found initially; ensure_mise will add
  # $HOME/.local/bin to PATH after the simulated install.
  run bash -c "
    $(isolate_path_snippet)
    source '$INSTALL_SH'
    ensure_mise
  "
  [ "$status" -eq 0 ]

  # Cleanup temp HOME
  rm -rf "$FAKE_HOME"
}
