#!/usr/bin/env bash
# A5 — branding/ (Brad's active design workstream) is never modified by this
# feature. Checked against a checksum manifest of the actual on-disk tree
# taken when this contract was written (2026-10-08), NOT against a git
# commit: Brad's own branding/ workstream already had uncommitted changes in
# the working tree at that moment (the Eulophia-speciosa r1-r4.png deletions
# and the new Eulophia-speciosa-emblem.png addition — see `git status` at
# mission start) that are his, not this feature's, and a git-diff-against-a-
# commit version of this check would incorrectly flag them as a violation.
# The manifest captures "what's on disk right now" once, up front, so this
# check only ever fires on a change THIS feature actually makes.
set -euo pipefail

BASELINE=".agent/memory/project/specs/saoc-emblem-lockup/goldens/fixtures/branding-manifest-baseline.txt"

if [ ! -f "$BASELINE" ]; then
  echo "missing baseline: $BASELINE"
  exit 1
fi

if ! sha256sum -c "$BASELINE" --quiet; then
  echo "branding/ has changed since the baseline manifest was recorded — forbidden"
  exit 1
fi

# Also catch new files added under branding/ that the manifest (by
# definition) could never have recorded.
CURRENT_COUNT=$(find branding -type f | wc -l | tr -d ' ')
BASELINE_COUNT=$(wc -l < "$BASELINE" | tr -d ' ')
if [ "$CURRENT_COUNT" != "$BASELINE_COUNT" ]; then
  echo "branding/ file count changed ($BASELINE_COUNT -> $CURRENT_COUNT) — new or removed file, forbidden"
  exit 1
fi

echo "OK: branding/ unchanged since the baseline manifest"
