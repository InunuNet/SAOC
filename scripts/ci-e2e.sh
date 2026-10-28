#!/usr/bin/env bash
# Usage: bash scripts/ci-e2e.sh pnpm test:e2e   (the suite command is passed in as arguments, so
# the CI step still names it literally, which contract assertion A21 relies on).
#
# Runs the given E2E command and passes its exit status through unchanged.
set -uo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <e2e command...>" >&2
  exit 2
fi

"$@"
exit $?
