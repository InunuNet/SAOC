#!/bin/bash
# Diff vs origin/main may touch only: the session route, one NEW helper lib/admin-session-body.ts, tests, docs, this spec.
bad=$(git diff --name-only origin/main...HEAD | grep -v -E '^(app/api/admin/session/route\.ts|lib/admin-session-body\.ts|docs/admin-access\.md|e2e/|tests/|\.agent/memory/project/specs/admin-session-body-cap/)' || true)
if [ -n "$bad" ]; then echo "out-of-scope files:"; echo "$bad"; exit 1; fi
test -f lib/admin-session-body.ts
