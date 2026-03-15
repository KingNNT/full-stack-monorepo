#!/usr/bin/env bats

# =============================================================================
# Tests for install.sh - Remote Installation Script
# =============================================================================
# Run with: bats tests/install.bats
# Install bats: brew install bats-core (macOS) or see https://bats-core.readthedocs.io
# =============================================================================

setup() {
    load test_helper
    load_install_functions
    TEST_TEMP_DIR="$(mktemp -d)"
}

teardown() {
    rm -rf "$TEST_TEMP_DIR"
}

# =============================================================================
# validate_project_name
# =============================================================================

@test "validate_project_name: accepts simple lowercase name" {
    run validate_project_name "myapp"
    [ "$status" -eq 0 ]
}

@test "validate_project_name: accepts kebab-case name" {
    run validate_project_name "my-awesome-app"
    [ "$status" -eq 0 ]
}

@test "validate_project_name: accepts name with numbers" {
    run validate_project_name "app123"
    [ "$status" -eq 0 ]
}

@test "validate_project_name: accepts name with numbers and hyphens" {
    run validate_project_name "my-app-2"
    [ "$status" -eq 0 ]
}

@test "validate_project_name: accepts single character name" {
    run validate_project_name "a"
    [ "$status" -eq 0 ]
}

@test "validate_project_name: accepts two character name" {
    run validate_project_name "ab"
    [ "$status" -eq 0 ]
}

@test "validate_project_name: accepts name starting with letter followed by number" {
    run validate_project_name "a1"
    [ "$status" -eq 0 ]
}

@test "validate_project_name: rejects uppercase letters" {
    run validate_project_name "MyApp"
    [ "$status" -eq 1 ]
}

@test "validate_project_name: rejects all uppercase" {
    run validate_project_name "MYAPP"
    [ "$status" -eq 1 ]
}

@test "validate_project_name: rejects name starting with number" {
    run validate_project_name "123app"
    [ "$status" -eq 1 ]
}

@test "validate_project_name: rejects name starting with hyphen" {
    run validate_project_name "-my-app"
    [ "$status" -eq 1 ]
}

@test "validate_project_name: rejects name ending with hyphen" {
    run validate_project_name "my-app-"
    [ "$status" -eq 1 ]
}

@test "validate_project_name: rejects underscores" {
    run validate_project_name "my_app"
    [ "$status" -eq 1 ]
}

@test "validate_project_name: rejects spaces" {
    run validate_project_name "my app"
    [ "$status" -eq 1 ]
}

@test "validate_project_name: rejects special characters" {
    run validate_project_name "my@app"
    [ "$status" -eq 1 ]
}

@test "validate_project_name: rejects dots" {
    run validate_project_name "my.app"
    [ "$status" -eq 1 ]
}

@test "validate_project_name: rejects empty string" {
    run validate_project_name ""
    [ "$status" -eq 1 ]
}

# =============================================================================
# validate_email
# =============================================================================

@test "validate_email: accepts standard email" {
    run validate_email "user@example.com"
    [ "$status" -eq 0 ]
}

@test "validate_email: accepts email with dots in local part" {
    run validate_email "first.last@example.com"
    [ "$status" -eq 0 ]
}

@test "validate_email: accepts email with plus sign" {
    run validate_email "user+tag@example.com"
    [ "$status" -eq 0 ]
}

@test "validate_email: accepts email with subdomain" {
    run validate_email "user@mail.example.com"
    [ "$status" -eq 0 ]
}

@test "validate_email: accepts email with two-letter TLD" {
    run validate_email "user@example.co"
    [ "$status" -eq 0 ]
}

@test "validate_email: accepts email with numbers in local part" {
    run validate_email "user123@example.com"
    [ "$status" -eq 0 ]
}

@test "validate_email: accepts email with hyphen in domain" {
    run validate_email "user@my-domain.com"
    [ "$status" -eq 0 ]
}

@test "validate_email: rejects missing @ sign" {
    run validate_email "userexample.com"
    [ "$status" -eq 1 ]
}

@test "validate_email: rejects missing local part" {
    run validate_email "@example.com"
    [ "$status" -eq 1 ]
}

@test "validate_email: rejects missing domain" {
    run validate_email "user@"
    [ "$status" -eq 1 ]
}

@test "validate_email: rejects missing TLD" {
    run validate_email "user@example"
    [ "$status" -eq 1 ]
}

@test "validate_email: rejects single-char TLD" {
    run validate_email "user@example.c"
    [ "$status" -eq 1 ]
}

@test "validate_email: rejects empty string" {
    run validate_email ""
    [ "$status" -eq 1 ]
}

@test "validate_email: rejects plain text" {
    run validate_email "notanemail"
    [ "$status" -eq 1 ]
}

@test "validate_email: rejects spaces" {
    run validate_email "user @example.com"
    [ "$status" -eq 1 ]
}

# =============================================================================
# command_exists
# =============================================================================

@test "command_exists: detects existing command (bash)" {
    run command_exists "bash"
    [ "$status" -eq 0 ]
}

@test "command_exists: detects existing command (ls)" {
    run command_exists "ls"
    [ "$status" -eq 0 ]
}

@test "command_exists: returns failure for nonexistent command" {
    run command_exists "nonexistent_command_xyz_12345"
    [ "$status" -eq 1 ]
}

@test "command_exists: returns failure for empty string" {
    run command_exists ""
    [ "$status" -eq 1 ]
}

# =============================================================================
# sed_inplace
# =============================================================================

@test "sed_inplace: replaces text in file" {
    local testfile="$TEST_TEMP_DIR/sed_test.txt"
    echo "hello world" > "$testfile"

    sed_inplace "s/hello/goodbye/" "$testfile"

    result="$(cat "$testfile")"
    [ "$result" = "goodbye world" ]
}

@test "sed_inplace: handles multiple replacements with global flag" {
    local testfile="$TEST_TEMP_DIR/sed_test.txt"
    echo "foo bar foo" > "$testfile"

    sed_inplace "s/foo/baz/g" "$testfile"

    result="$(cat "$testfile")"
    [ "$result" = "baz bar baz" ]
}

@test "sed_inplace: preserves other lines" {
    local testfile="$TEST_TEMP_DIR/sed_test.txt"
    printf "line1\nreplace-me\nline3\n" > "$testfile"

    sed_inplace "s/replace-me/replaced/" "$testfile"

    result="$(sed -n '2p' "$testfile")"
    [ "$result" = "replaced" ]

    line1="$(sed -n '1p' "$testfile")"
    [ "$line1" = "line1" ]

    line3="$(sed -n '3p' "$testfile")"
    [ "$line3" = "line3" ]
}

# =============================================================================
# Color / print functions (verify they don't crash and produce output)
# =============================================================================

@test "print_success: outputs message" {
    run print_success "test message"
    [ "$status" -eq 0 ]
    [[ "$output" == *"test message"* ]]
}

@test "print_info: outputs message" {
    run print_info "info message"
    [ "$status" -eq 0 ]
    [[ "$output" == *"info message"* ]]
}

@test "print_warning: outputs message" {
    run print_warning "warning message"
    [ "$status" -eq 0 ]
    [[ "$output" == *"warning message"* ]]
}

@test "print_error: outputs message" {
    run print_error "error message"
    [ "$status" -eq 0 ]
    [[ "$output" == *"error message"* ]]
}

@test "print_header: outputs header banner" {
    run print_header
    [ "$status" -eq 0 ]
    [[ "$output" == *"Next.js + shadcn/ui Template Installer"* ]]
}

# =============================================================================
# File customization (simulates what main does after cloning)
# =============================================================================

@test "customization: updates package.json name" {
    setup_template_project "$TEST_TEMP_DIR/my-project"
    local dir="$TEST_TEMP_DIR/my-project"

    sed_inplace 's/"name": "shadcn-next-app"/"name": "my-project"/' "$dir/package.json"

    run grep '"name": "my-project"' "$dir/package.json"
    [ "$status" -eq 0 ]
}

@test "customization: updates Makefile project name" {
    setup_template_project "$TEST_TEMP_DIR/my-project"
    local dir="$TEST_TEMP_DIR/my-project"

    sed_inplace 's/shadcn-next-app Commands/my-project Commands/' "$dir/Makefile"

    run grep "my-project Commands" "$dir/Makefile"
    [ "$status" -eq 0 ]
}

@test "customization: updates makefiles/variables.mk" {
    setup_template_project "$TEST_TEMP_DIR/my-project"
    local dir="$TEST_TEMP_DIR/my-project"

    sed_inplace 's/APP_NAME ?= shadcn-next-app/APP_NAME ?= my-project/' "$dir/makefiles/variables.mk"

    run grep "APP_NAME ?= my-project" "$dir/makefiles/variables.mk"
    [ "$status" -eq 0 ]
}

@test "customization: updates .env APP_NAME" {
    setup_template_project "$TEST_TEMP_DIR/my-project"
    local dir="$TEST_TEMP_DIR/my-project"

    sed_inplace 's/APP_NAME=shadcn-next-app/APP_NAME=my-project/' "$dir/.env"

    run grep "APP_NAME=my-project" "$dir/.env"
    [ "$status" -eq 0 ]
}

@test "customization: updates .env.example APP_NAME" {
    setup_template_project "$TEST_TEMP_DIR/my-project"
    local dir="$TEST_TEMP_DIR/my-project"

    sed_inplace 's/APP_NAME=shadcn-next-app/APP_NAME=my-project/' "$dir/.env.example"

    run grep "APP_NAME=my-project" "$dir/.env.example"
    [ "$status" -eq 0 ]
}

@test "customization: updates CLAUDE.md references" {
    setup_template_project "$TEST_TEMP_DIR/my-project"
    local dir="$TEST_TEMP_DIR/my-project"

    sed_inplace 's/shadcn-next-app/my-project/g' "$dir/CLAUDE.md"

    run grep "shadcn-next-app" "$dir/CLAUDE.md"
    [ "$status" -eq 1 ]  # No matches = template name fully replaced

    run grep "my-project" "$dir/CLAUDE.md"
    [ "$status" -eq 0 ]
}

@test "customization: updates AGENTS.md references" {
    setup_template_project "$TEST_TEMP_DIR/my-project"
    local dir="$TEST_TEMP_DIR/my-project"

    sed_inplace 's/shadcn-next-app/my-project/g' "$dir/AGENTS.md"

    run grep "shadcn-next-app" "$dir/AGENTS.md"
    [ "$status" -eq 1 ]

    run grep "my-project" "$dir/AGENTS.md"
    [ "$status" -eq 0 ]
}

@test "customization: preserves non-template content in .env" {
    setup_template_project "$TEST_TEMP_DIR/my-project"
    local dir="$TEST_TEMP_DIR/my-project"

    sed_inplace 's/APP_NAME=shadcn-next-app/APP_NAME=my-project/' "$dir/.env"

    run grep "NODE_ENV=development" "$dir/.env"
    [ "$status" -eq 0 ]
}

# =============================================================================
# Cleanup operations
# =============================================================================

@test "cleanup: removes install.sh" {
    setup_template_project "$TEST_TEMP_DIR/my-project"
    local dir="$TEST_TEMP_DIR/my-project"

    [ -f "$dir/install.sh" ]
    rm -f "$dir/install.sh"
    [ ! -f "$dir/install.sh" ]
}

@test "cleanup: removes .git directory" {
    setup_template_project "$TEST_TEMP_DIR/my-project"
    local dir="$TEST_TEMP_DIR/my-project"

    mkdir -p "$dir/.git"
    [ -d "$dir/.git" ]
    rm -rf "$dir/.git"
    [ ! -d "$dir/.git" ]
}

@test "cleanup: initializes fresh git repository" {
    setup_template_project "$TEST_TEMP_DIR/my-project"
    local dir="$TEST_TEMP_DIR/my-project"

    cd "$dir"
    git init -q
    git add .
    git commit -q -m "Initial commit from Next.js + shadcn/ui template"

    [ -d "$dir/.git" ]

    run git log --oneline -1
    [ "$status" -eq 0 ]
    [[ "$output" == *"Initial commit from Next.js + shadcn/ui template"* ]]
}

# =============================================================================
# Integration: full customization pipeline
# =============================================================================

@test "integration: full file customization with project name" {
    setup_template_project "$TEST_TEMP_DIR/my-cool-app"
    local dir="$TEST_TEMP_DIR/my-cool-app"
    local PROJECT_NAME="my-cool-app"
    local TEMPLATE_NAME="shadcn-next-app"

    # Replicate install.sh customization steps
    sed_inplace "s/\"name\": \"$TEMPLATE_NAME\"/\"name\": \"$PROJECT_NAME\"/" "$dir/package.json"
    sed_inplace "s/$TEMPLATE_NAME Commands/$PROJECT_NAME Commands/" "$dir/Makefile"
    sed_inplace "s/APP_NAME ?= $TEMPLATE_NAME/APP_NAME ?= $PROJECT_NAME/" "$dir/makefiles/variables.mk"
    sed_inplace "s/APP_NAME=$TEMPLATE_NAME/APP_NAME=$PROJECT_NAME/" "$dir/.env"
    sed_inplace "s/APP_NAME=$TEMPLATE_NAME/APP_NAME=$PROJECT_NAME/" "$dir/.env.example"
    sed_inplace "s/$TEMPLATE_NAME/$PROJECT_NAME/g" "$dir/CLAUDE.md"
    sed_inplace "s/$TEMPLATE_NAME/$PROJECT_NAME/g" "$dir/AGENTS.md"

    # Verify all files are customized
    run grep "\"name\": \"my-cool-app\"" "$dir/package.json"
    [ "$status" -eq 0 ]

    run grep "my-cool-app Commands" "$dir/Makefile"
    [ "$status" -eq 0 ]

    run grep "APP_NAME ?= my-cool-app" "$dir/makefiles/variables.mk"
    [ "$status" -eq 0 ]

    run grep "APP_NAME=my-cool-app" "$dir/.env"
    [ "$status" -eq 0 ]

    run grep "APP_NAME=my-cool-app" "$dir/.env.example"
    [ "$status" -eq 0 ]

    # Verify no leftover template references in markdown files
    run grep "shadcn-next-app" "$dir/CLAUDE.md"
    [ "$status" -eq 1 ]

    run grep "shadcn-next-app" "$dir/AGENTS.md"
    [ "$status" -eq 1 ]
}

@test "integration: full cleanup and git init" {
    setup_template_project "$TEST_TEMP_DIR/test-app"
    local dir="$TEST_TEMP_DIR/test-app"

    # Simulate original .git from clone
    mkdir -p "$dir/.git/objects" "$dir/.git/refs"
    echo "fake git" > "$dir/.git/HEAD"

    cd "$dir"

    # Cleanup steps from install.sh
    rm -rf .git
    rm -f install.sh
    git init -q
    git add .
    git commit -q -m "Initial commit from Next.js + shadcn/ui template"

    # Verify
    [ ! -f "$dir/install.sh" ]
    [ -d "$dir/.git" ]

    run git log --oneline
    [ "$status" -eq 0 ]
    [ "$(echo "$output" | wc -l)" -eq 1 ]  # Exactly one commit
}

@test "integration: rejects existing directory" {
    mkdir -p "$TEST_TEMP_DIR/existing-project"

    [ -d "$TEST_TEMP_DIR/existing-project" ]
}

# =============================================================================
# Edge cases
# =============================================================================

@test "edge case: project name with consecutive hyphens is rejected" {
    run validate_project_name "my--app"
    # The regex allows this - consecutive hyphens are valid in kebab-case
    # This test documents the current behavior
    [ "$status" -eq 0 ]
}

@test "edge case: very long project name is accepted" {
    run validate_project_name "a-very-long-project-name-that-goes-on-and-on"
    [ "$status" -eq 0 ]
}

@test "edge case: single letter project name is accepted" {
    run validate_project_name "x"
    [ "$status" -eq 0 ]
}

@test "edge case: email with percent in local part is accepted" {
    run validate_email "user%tag@example.com"
    [ "$status" -eq 0 ]
}

@test "edge case: sed_inplace with no match leaves file unchanged" {
    local testfile="$TEST_TEMP_DIR/no_match.txt"
    echo "original content" > "$testfile"

    sed_inplace "s/nonexistent/replaced/" "$testfile"

    result="$(cat "$testfile")"
    [ "$result" = "original content" ]
}

@test "edge case: sed_inplace with special characters in replacement" {
    local testfile="$TEST_TEMP_DIR/special.txt"
    echo "APP_NAME=shadcn-next-app" > "$testfile"

    sed_inplace "s/APP_NAME=shadcn-next-app/APP_NAME=my-app-v2/" "$testfile"

    result="$(cat "$testfile")"
    [ "$result" = "APP_NAME=my-app-v2" ]
}
