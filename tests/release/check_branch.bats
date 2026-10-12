#!/usr/bin/env bats

SCRIPT="${BATS_TEST_DIRNAME}/../../tools/release/check-branch.sh"

@test "feature and bugfix branches may target develop" {
  run "$SCRIPT" feature/add-login develop
  [ "$status" -eq 0 ]
  run "$SCRIPT" bugfix/null-user develop
  [ "$status" -eq 0 ]
}

@test "rejects an abbreviated or unknown branch type" {
  run "$SCRIPT" feat/add-login develop
  [ "$status" -ne 0 ]
  [[ "$output" == *"feat/add-login"* ]]
  run "$SCRIPT" my-branch develop
  [ "$status" -ne 0 ]
}

@test "rejects uppercase branch names" {
  run "$SCRIPT" feature/Add-Login develop
  [ "$status" -ne 0 ]
}

@test "only release and hotfix branches may target main" {
  run "$SCRIPT" release/1.2.0 main
  [ "$status" -eq 0 ]
  run "$SCRIPT" hotfix/1.2.1 main
  [ "$status" -eq 0 ]
  run "$SCRIPT" feature/add-login main
  [ "$status" -ne 0 ]
  [[ "$output" == *"main"* ]]
}

@test "release and hotfix names must carry a version" {
  run "$SCRIPT" release/next main
  [ "$status" -ne 0 ]
  run "$SCRIPT" hotfix/critical-auth main
  [ "$status" -ne 0 ]
}

@test "release and hotfix branches may not target develop" {
  run "$SCRIPT" release/1.2.0 develop
  [ "$status" -ne 0 ]
  [[ "$output" == *"back-merge"* ]]
  run "$SCRIPT" hotfix/1.2.1 develop
  [ "$status" -ne 0 ]
}

@test "release and hotfix branches take fixes but not features" {
  run "$SCRIPT" bugfix/typo release/1.2.0
  [ "$status" -eq 0 ]
  run "$SCRIPT" chore/back-merge-v1.2.1 release/1.3.0
  [ "$status" -eq 0 ]
  run "$SCRIPT" feature/add-login release/1.2.0
  [ "$status" -ne 0 ]
  run "$SCRIPT" feature/add-login hotfix/1.2.1
  [ "$status" -ne 0 ]
}

@test "any valid branch may target a non-flow branch (stacked PRs)" {
  run "$SCRIPT" feature/part-2 feature/part-1
  [ "$status" -eq 0 ]
}
