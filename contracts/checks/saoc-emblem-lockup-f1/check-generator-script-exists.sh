#!/usr/bin/env bash
# A1 — the Pillow-based asset generator exists, reads the approved emblem
# source from branding/ (read-only) and writes only under public/images/.
# Guards against: a generator that writes into branding/ (forbidden,
# Brad's active workstream) or that bypasses Pillow for some ad-hoc tool.
set -euo pipefail

SCRIPT="scripts/generate-saoc-emblem-web-assets.py"

if [ ! -f "$SCRIPT" ]; then
  echo "missing: $SCRIPT"
  exit 1
fi

grep -q "from PIL import" "$SCRIPT" || { echo "does not import Pillow"; exit 1; }
grep -q "SA Orchid Council/emblem/Eulophia-speciosa-emblem.png" "$SCRIPT" || {
  echo "does not read the approved source emblem"
  exit 1
}
grep -q "public/images/" "$SCRIPT" || { echo "does not write under public/images/"; exit 1; }

# The script must never open branding/ for writing. A simple, honest proxy:
# no .save(...) call anywhere in the file has "branding" in the same line.
if grep -n "\.save(" "$SCRIPT" | grep -qi "branding"; then
  echo "generator appears to save into branding/ — forbidden"
  exit 1
fi

echo "OK: $SCRIPT exists, Pillow-based, reads branding/ source, writes public/images/ only"
