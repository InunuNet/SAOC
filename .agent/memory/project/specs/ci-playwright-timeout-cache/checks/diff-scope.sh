#!/bin/bash
# Diff vs origin/main may touch only .github/workflows/ci.yml, docs, and this spec. ops/merge-when-green.sh stays with SAOC.
bad=$(git diff --name-only origin/main...HEAD | grep -v -E '^(\.github/workflows/ci\.yml|docs/[^/]*\.md|\.agent/memory/project/specs/ci-playwright-timeout-cache/)' || true)
if [ -n "$bad" ]; then echo "out-of-scope files:"; echo "$bad"; exit 1; fi
git diff origin/main...HEAD -- .github/workflows/ci.yml | grep -E '^[-+]' | grep -v -E '^(\+\+\+|---)' | grep -E '^-' && { echo "ci.yml: removed or changed lines not allowed, additions only except none"; exit 1; } || true
