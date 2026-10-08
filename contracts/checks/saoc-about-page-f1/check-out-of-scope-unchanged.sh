#!/usr/bin/env bash
# A3 — regression guard: components/chrome/** (a parallel emblem-lockup
# draft is actively editing it), app/globals.css, branding/** (Brad's active
# design workstream) and comms.md must stay byte-unchanged by THIS feature.
#
# Deliberately a checksum-manifest check against an on-disk baseline taken
# 2026-10-08 (goldens/fixtures/f1-out-of-scope-baseline-checksums.txt), NOT
# a git-diff-against-a-commit check: branding/ and comms.md already carried
# Brad's own uncommitted changes in the working tree before this feature
# started (the Eulophia-speciosa r1-r4.png deletions, comms.md's own
# updates), and components/chrome/** is being actively edited right now by
# a concurrent, unrelated emblem-lockup mission — a commit-diff version of
# this check would incorrectly flag either of those as this feature's
# violation. Same pattern as the sibling saoc-emblem-lockup mission's A4
# (check-branding-untouched.sh). Excludes .DS_Store (macOS Finder noise, not
# meaningful content).
set -euo pipefail

MANIFEST=".agent/memory/project/specs/saoc-about-page/goldens/fixtures/f1-out-of-scope-baseline-checksums.txt"

if [ ! -f "$MANIFEST" ]; then
  echo "FAIL: baseline checksum manifest not found at $MANIFEST" >&2
  exit 1
fi

mkdir -p .tmp/sandbox/about-page
CURRENT=".tmp/sandbox/about-page/f1-out-of-scope-current-checksums.txt"

{
  find components/chrome -type f -not -name '.DS_Store' -print0 2>/dev/null
  find branding -type f -not -name '.DS_Store' -print0 2>/dev/null
  printf '%s\0' "app/globals.css" "comms.md"
} | sort -z | xargs -0 shasum -a 256 > "$CURRENT"

if ! diff -u "$MANIFEST" "$CURRENT" > .tmp/sandbox/about-page/f1-out-of-scope-diff.txt 2>&1; then
  echo "FAIL: out-of-scope files changed since the 2026-10-08 baseline:" >&2
  cat .tmp/sandbox/about-page/f1-out-of-scope-diff.txt >&2
  exit 1
fi

echo "OK: components/chrome/**, app/globals.css, branding/** and comms.md all match the baseline manifest"
