#!/usr/bin/env bats
# Tests for ensure_mise() and mise_install_tools() in install.sh

load 'helpers/stubs'

INSTALL_SH="${BATS_TEST_DIRNAME}/../../install.sh"

setup() {
  setup_stub_dir
}

teardown() {
  teardown_stub_dir
}

# --- ensure_mise tests --------------------------------------------------------

@test "ensure_mise: skips install when mise is already available" {
  stub mise "echo '2026.6.2 macos-arm64'"

  run bash -c "source '$INSTALL_SH'; ensure_mise"
  [ "$status" -eq 0 ]
  [[ "$output" == *"mise"*"2026.6.2"* ]]
}

@test "ensure_mise: logs 'Checking mise...' on startup" {
  stub mise "echo '2026.6.2 macos-arm64'"

  run bash -c "source '$INSTALL_SH'; ensure_mise"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Checking mise..."* ]]
}

@test "ensure_mise: installs mise via curl when not found" {
  FAKE_HOME="$(mktemp -d "${BATS_TMPDIR:-/tmp}/mise-test-home.XXXXXX")"
  export HOME="$FAKE_HOME"

  # Stub curl to simulate mise install script — writes a mise shim to $HOME/.local/bin.
  # Use absolute paths for coreutils because PATH is isolated to $STUB_DIR.
  stub curl "/bin/mkdir -p \$HOME/.local/bin; /bin/echo '#!/bin/bash' > \$HOME/.local/bin/mise; /bin/echo 'echo 2026.6.2' >> \$HOME/.local/bin/mise; /bin/chmod +x \$HOME/.local/bin/mise"
  stub sh "true"

  run bash -c "
    $(isolate_path_snippet)
    source '$INSTALL_SH'
    ensure_mise
  "
  [ "$status" -eq 0 ]
  [[ "$output" == *"Installing mise..."* ]]

  # Verify curl was actually called
  [ "$(call_count curl)" -ge 1 ]

  rm -rf "$FAKE_HOME"
}

@test "ensure_mise: adds ~/.local/bin to PATH after install" {
  FAKE_HOME="$(mktemp -d "${BATS_TMPDIR:-/tmp}/mise-test-home.XXXXXX")"
  export HOME="$FAKE_HOME"

  stub curl "/bin/mkdir -p \$HOME/.local/bin; /bin/echo '#!/bin/bash' > \$HOME/.local/bin/mise; /bin/echo 'echo 2026.6.2' >> \$HOME/.local/bin/mise; /bin/chmod +x \$HOME/.local/bin/mise"
  stub sh "true"

  run bash -c "
    $(isolate_path_snippet)
    source '$INSTALL_SH'
    ensure_mise
    echo \"PATH_CONTAINS=\$HOME/.local/bin:\$PATH\" >&2
  "
  [ "$status" -eq 0 ]

  # Verify ~/.local/bin is in PATH after the install
  [[ "$output" == *"$FAKE_HOME/.local/bin"* ]]

  rm -rf "$FAKE_HOME"
}

# --- mise_install_tools tests -------------------------------------------------

@test "mise_install_tools: runs mise install inside INSTALL_DIR" {
  FAKE_INSTALL_DIR="$(mktemp -d "${BATS_TMPDIR:-/tmp}/mise-install-dir.XXXXXX")"
  export INSTALL_DIR="$FAKE_INSTALL_DIR"

  # Stub mise to log that it was called (calls are recorded automatically by stub)
  stub mise "echo 'mise install stubbed'"

  run bash -c "source '$INSTALL_SH'; mise_install_tools"
  [ "$status" -eq 0 ]

  # Verify mise was called at least once
  [ "$(call_count mise)" -ge 1 ]

  rm -rf "$FAKE_INSTALL_DIR"
}

@test "mise_install_tools: logs node and pnpm versions after install" {
  FAKE_INSTALL_DIR="$(mktemp -d "${BATS_TMPDIR:-/tmp}/mise-install-dir.XXXXXX")"
  export INSTALL_DIR="$FAKE_INSTALL_DIR"

  stub mise "true"
  stub node "echo 'v22.1.0'"
  stub pnpm "echo '10.5.0'"

  run bash -c "source '$INSTALL_SH'; mise_install_tools"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Node v22.1.0"* ]]
  [[ "$output" == *"pnpm 10.5.0"* ]]

  rm -rf "$FAKE_INSTALL_DIR"
}

@test "mise_install_tools: trusts the cloned mise.toml by exact path before installing" {
  FAKE_INSTALL_DIR="$(mktemp -d "${BATS_TMPDIR:-/tmp}/mise-install-dir.XXXXXX")"
  export INSTALL_DIR="$FAKE_INSTALL_DIR"

  stub mise "true"
  stub node "echo 'v22.1.0'"
  stub pnpm "echo '10.5.0'"

  run bash -c "source '$INSTALL_SH'; mise_install_tools"
  [ "$status" -eq 0 ]

  # mise trust must be called with the specific cloned config path — not
  # `--all`, which would trust every config in the parent chain.
  [[ "$(calls_for mise)" == *"trust $FAKE_INSTALL_DIR/mise.toml"* ]]
  [[ "$(calls_for mise)" != *"--all"* ]]

  rm -rf "$FAKE_INSTALL_DIR"
}

@test "mise_install_tools: trusts the config before running install (call order)" {
  FAKE_INSTALL_DIR="$(mktemp -d "${BATS_TMPDIR:-/tmp}/mise-install-dir.XXXXXX")"
  export INSTALL_DIR="$FAKE_INSTALL_DIR"

  stub mise "true"
  stub node "echo 'v22.1.0'"
  stub pnpm "echo '10.5.0'"

  run bash -c "source '$INSTALL_SH'; mise_install_tools"
  [ "$status" -eq 0 ]

  local trust_line install_line
  trust_line="$(calls_for mise | grep -n '^trust ' | head -1 | cut -d: -f1)"
  install_line="$(calls_for mise | grep -n '^install$' | head -1 | cut -d: -f1)"

  [ -n "$trust_line" ]
  [ -n "$install_line" ]
  [ "$trust_line" -lt "$install_line" ]

  rm -rf "$FAKE_INSTALL_DIR"
}

@test "mise_install_tools: puts the mise shims dir on PATH after installing" {
  FAKE_INSTALL_DIR="$(mktemp -d "${BATS_TMPDIR:-/tmp}/mise-install-dir.XXXXXX")"
  export INSTALL_DIR="$FAKE_INSTALL_DIR"

  # Freshly installed tools resolve only through the shims dir in a shell that
  # never sourced `mise activate`. Without this, node/pnpm below would fail.
  stub mise 'if [ "$1" = "activate" ]; then echo "export PATH=\"/fake/shims:\$PATH\""; fi'
  stub node "echo 'v22.1.0'"
  stub pnpm "echo '10.5.0'"

  run bash -c "source '$INSTALL_SH'; mise_install_tools; echo \"FINAL_PATH=\$PATH\""
  [ "$status" -eq 0 ]

  [[ "$(calls_for mise)" == *"activate bash --shims"* ]]
  [[ "$output" == *"FINAL_PATH=/fake/shims:"* ]]

  rm -rf "$FAKE_INSTALL_DIR"
}

@test "mise_install_tools: runs mise install from inside INSTALL_DIR (not trust)" {
  FAKE_INSTALL_DIR="$(mktemp -d "${BATS_TMPDIR:-/tmp}/mise-install-dir.XXXXXX")"
  export INSTALL_DIR="$FAKE_INSTALL_DIR"

  # Record the cwd only for the `install` invocation, so this fails if the
  # `install` subshell's cwd ever regresses.
  stub mise 'if [ "$1" = "install" ]; then pwd > "$STUB_DIR/mise_install_pwd"; fi'
  stub node "echo 'v22.1.0'"
  stub pnpm "echo '10.5.0'"

  run bash -c "source '$INSTALL_SH'; mise_install_tools"
  [ "$status" -eq 0 ]

  local expected_pwd
  expected_pwd="$(cd "$FAKE_INSTALL_DIR" && pwd)"
  [ "$(cat "$STUB_DIR/mise_install_pwd")" = "$expected_pwd" ]

  rm -rf "$FAKE_INSTALL_DIR"
}
