#!/bin/bash

# =============================================================================
# Test Helper - Sources install.sh functions without executing main
# =============================================================================

INSTALL_SCRIPT="${BATS_TEST_DIRNAME}/../install.sh"

# Source only function definitions from install.sh (everything before the final execution block)
load_install_functions() {
    eval "$(sed '/^# Run main/,$d' "$INSTALL_SCRIPT")"
}

# Create a temporary project directory structure that mimics the cloned template
setup_template_project() {
    local dir="$1"
    mkdir -p "$dir"

    # package.json
    cat > "$dir/package.json" <<'PKGJSON'
{
	"name": "shadcn-next-app",
	"version": "0.1.0",
	"private": true
}
PKGJSON

    # Makefile
    cat > "$dir/Makefile" <<'MAKEFILE'
# Makefile for shadcn-next-app Commands
include .env
MAKEFILE

    # makefiles/variables.mk
    mkdir -p "$dir/makefiles"
    cat > "$dir/makefiles/variables.mk" <<'VARSMK'
APP_NAME ?= shadcn-next-app
NODE_ENV ?= development
VARSMK

    # .env
    cat > "$dir/.env" <<'DOTENV'
APP_NAME=shadcn-next-app
NODE_ENV=development
DOTENV

    # .env.example
    cat > "$dir/.env.example" <<'DOTENVEX'
APP_NAME=shadcn-next-app
NODE_ENV=development
DOTENVEX

    # CLAUDE.md
    cat > "$dir/CLAUDE.md" <<'CLAUDEMD'
# shadcn-next-app

This is the shadcn-next-app project.
CLAUDEMD

    # AGENTS.md
    cat > "$dir/AGENTS.md" <<'AGENTSMD'
# shadcn-next-app Agents

Config for shadcn-next-app.
AGENTSMD

    # install.sh (will be removed during cleanup)
    touch "$dir/install.sh"
}
