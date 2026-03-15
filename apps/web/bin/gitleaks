#!/bin/bash

# Copyright © Amazon.com and Affiliates: This deliverable is considered
# Developed Content as defined in the AWS Service Terms and the SOW between the parties dated MAR 07, 2025.

version="latest"

echo "Running gitleaks..."

# check if "gitleaks" is installed locally, otherwise use docker to run
if [ -x "$(command -v gitleaks)" ]; then
  scan=gitleaks
else
  scan="docker run --rm -i -v "${PWD}:/src" -w "/src" zricethezav/gitleaks:${version}"
fi

if [ $# -gt 0 ]; then
  # nosemgrep: bash.lang.correctness.unquoted-expansion.unquoted-variable-expansion-in-command
  exec $scan "${@}"
else
  # nosemgrep: bash.lang.correctness.unquoted-expansion.unquoted-variable-expansion-in-command
  exec $scan
fi
