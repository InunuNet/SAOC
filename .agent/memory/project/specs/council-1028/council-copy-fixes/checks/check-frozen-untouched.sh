#!/usr/bin/env bash
# council-copy-fixes A5: Lee-Ann's Drive copies and their sha256-frozen mirrors are byte-identical to origin/main (the gates apply the council
# overrides at read time instead of editing frozen text).
set -u
BASE="${COUNCIL_DIFF_BASE:-origin/main}"
if ! git diff --quiet "$BASE"...HEAD -- content/drive-source content/drive-recovered docs/leeann-source .agent/memory/project/specs/nos-content-standard/goldens/sources .agent/memory/project/specs/nos-content-standard/fixtures; then
  echo "FAIL frozen-untouched: a frozen Drive copy, mirror or Sanity fixture changed:"
  git diff --stat "$BASE"...HEAD -- content/drive-source content/drive-recovered docs/leeann-source .agent/memory/project/specs/nos-content-standard/goldens/sources .agent/memory/project/specs/nos-content-standard/fixtures
  exit 1
fi
echo "PASS frozen-untouched"
