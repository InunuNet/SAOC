#!/usr/bin/env bash
# Sandbox copy of the tracked Sanity fixture (the nos-content-standard capture). Gates and builds replay from the copy, never from the tracked set, and never live.
set -euo pipefail
SRC=".agent/memory/project/specs/nos-content-standard/fixtures/sanity"
DEST=".tmp/sandbox/nos-hub-tablet-serif-fixtures/sanity"
[ -d "$SRC" ] || { echo "the tracked Sanity fixture is missing: $SRC" >&2; exit 1; }
mkdir -p "$DEST"
rsync -a --delete "$SRC/" "$DEST/"
# Empty build-time stubs (goldens/fixture-stubs, values.json fixture.stubs); --ignore-existing so a real capture of the same key wins.
if [ "${HUB_SERIF_FIXTURE_STRICT:-}" = "1" ]; then node ".agent/memory/project/specs/nos-hub-tablet-serif/checks/gen-today-stub.mjs" "$SRC" "$DEST" --strict; else node ".agent/memory/project/specs/nos-hub-tablet-serif/checks/gen-today-stub.mjs" "$SRC" "$DEST"; fi
[ "${HUB_SERIF_FIXTURE_STRICT:-}" = "1" ] || rsync -a --ignore-existing ".agent/memory/project/specs/nos-hub-tablet-serif/goldens/fixture-stubs/" "$DEST/"
