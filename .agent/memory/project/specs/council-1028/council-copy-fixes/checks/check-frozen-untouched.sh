#!/usr/bin/env bash
# council-copy-fixes A5: everything that holds Lee-Ann's words verbatim, or a record of them, is byte-identical to origin/main (the gates apply the council
# overrides at read time instead of editing frozen text). The list is copy-map.json frozenHistorical minus the two entries the mission legitimately edits
# (the council spec dir itself and docs/vendor-form-copy-20261007.md, A11), so docs/handover/, docs/leeann-source/ and every historical golden are covered.
set -u
BASE="${COUNCIL_DIFF_BASE:-origin/main}"
MAP=".agent/memory/project/specs/council-1028/council-copy-fixes/goldens/copy-map.json"
PATHS=()
while IFS= read -r p; do [ -n "$p" ] && PATHS+=("$p"); done < <(node -e "const m=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const skip=new Set(['.agent/memory/project/specs/council-1028/','docs/vendor-form-copy-20261007.md']);for(const p of m.frozenHistorical)if(!skip.has(p))console.log(p)" "$MAP")
[ "${#PATHS[@]}" -ge 10 ] || { echo "FAIL frozen-untouched: frozen path list unexpectedly short (${#PATHS[@]})"; exit 1; }
if ! git diff --quiet "$BASE"...HEAD -- "${PATHS[@]}"; then
  echo "FAIL frozen-untouched: a frozen Drive copy, mirror, historical record or Sanity fixture changed:"
  git diff --stat "$BASE"...HEAD -- "${PATHS[@]}"
  exit 1
fi
echo "PASS frozen-untouched (${#PATHS[@]} frozen paths)"
