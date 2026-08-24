#!/usr/bin/env bash
# A1 (door-checkin-one-handed F1) — structural check on
# components/admin/DoorScannerClient.tsx:
#   1. No bare vh/vw utility or literal unit anywhere in the file (min-h-screen, h-screen,
#      w-screen, 100vh, 100vw, or any other *vh/*vw token that isn't part of dvh/dvw).
#   2. The root container uses a dvh-based height (min-h-dvh or equivalent).
#   3. The manual-entry <form> (containing the "Check In" submit button) is flex-none and
#      is NOT nested inside any element carrying overflow-y-auto / overflow-y-scroll /
#      overflow-auto / overflow-scroll.
#
# FAILS ON: any bare vh/vw class or literal unit present; no dvh-based root height; the
# manual-entry form found nested inside a scrollable ancestor; the form missing flex-none.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
FILE="$REPO_ROOT/components/admin/DoorScannerClient.tsx"

if [[ ! -f "$FILE" ]]; then
  echo "FAIL: $FILE not found"
  exit 1
fi

# 1. No bare vh/vw anywhere (dvh/dvw are fine — filter those tokens out).
bare_vh_vw="$(grep -noE '[A-Za-z0-9_-]*[vV][hHwW][A-Za-z0-9_-]*' "$FILE" \
  | grep -viE 'dvh|dvw' || true)"
if [[ -n "$bare_vh_vw" ]]; then
  echo "FAIL: bare vh/vw token(s) found in $FILE:"
  echo "$bare_vh_vw"
  exit 1
fi

if grep -qE 'min-h-screen|h-screen|w-screen' "$FILE"; then
  echo "FAIL: min-h-screen/h-screen/w-screen still present in $FILE"
  exit 1
fi

# 2. Root container is dvh-based.
if ! grep -qE 'min-h-dvh' "$FILE"; then
  echo "FAIL: no min-h-dvh (or equivalent dvh-based height) found on root container"
  exit 1
fi

# 3. The manual-entry form must not be nested inside any overflow-y-auto/scroll ancestor,
# and must carry flex-none. Structural JSX nesting isn't reliably greppable, so walk the
# tag tree in node, tracking div depth from each overflow-* opening tag to its matching
# close, and confirm the <form ...> tag start offset falls outside every such range.
node --input-type=module -e "
import { readFileSync } from 'node:fs';
const src = readFileSync('$FILE', 'utf8');

const formIdx = src.indexOf('<form');
if (formIdx === -1) {
  console.error('FAIL: no <form> element found in file');
  process.exit(1);
}

const formTagEnd = src.indexOf('>', formIdx);
const formOpenTag = src.slice(formIdx, formTagEnd + 1);
if (!/flex-none/.test(formOpenTag)) {
  console.error('FAIL: <form> element is missing flex-none in its className');
  process.exit(1);
}

// Find every div (or other element) opening tag carrying an overflow-y-auto/scroll or
// overflow-auto/scroll class, then walk forward counting nested <div ...> / </div> pairs
// (ignoring self-closing <div ... />) until depth returns to 0, to find that element's
// matching close offset.
const overflowClassRe = /overflow-(?:y-)?(?:auto|scroll)/;
const tagRe = /<(\/?)div\b([^>]*)>/g;
let match;
const scrollRanges = [];
const openStack = [];

while ((match = tagRe.exec(src)) !== null) {
  const isClose = match[1] === '/';
  const attrs = match[2];
  const selfClosing = /\/\s*$/.test(attrs);

  if (isClose) {
    const openEntry = openStack.pop();
    if (openEntry && openEntry.hasOverflow) {
      scrollRanges.push([openEntry.start, match.index]);
    }
    continue;
  }

  if (selfClosing) continue;

  openStack.push({ start: match.index, hasOverflow: overflowClassRe.test(attrs) });
}

for (const [start, end] of scrollRanges) {
  if (formIdx > start && formIdx < end) {
    console.error(\`FAIL: <form> at offset \${formIdx} is nested inside a scrollable ancestor spanning [\${start}, \${end}]\`);
    process.exit(1);
  }
}

console.log('PASS: manual-entry form is flex-none and not nested inside any scrollable ancestor');
process.exit(0);
"

echo "PASS: A1 — no bare vh/vw, dvh-based root, manual-entry form structurally pinned outside any scrollable ancestor"
