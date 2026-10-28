#!/usr/bin/env bash
# Sandbox copy of the tracked Sanity capture (nos-content-standard), plus the synthetic past-shows stub this gate needs: the tracked capture's
# pastShowsQuery result is [], so no real archive year exists in replay. The stub overwrites only that one key, in the COPY; the tracked set is never written.
set -euo pipefail
SRC=".agent/memory/project/specs/nos-content-standard/fixtures/sanity"
DEST=".tmp/sandbox/nos-archive-back-arrow-fixtures/sanity"
STUBS=".agent/memory/project/specs/nos-archive-back-arrow/goldens/fixture-stubs"
[ -d "$SRC" ] || { echo "the tracked Sanity fixture is missing: $SRC" >&2; exit 1; }
mkdir -p "$DEST"
rsync -a --delete "$SRC/" "$DEST/"
rsync -a "$STUBS/" "$DEST/"
