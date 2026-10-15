#!/usr/bin/env bash
# A1/A2/A3 — the live lockup carries the W2 wordmark exactly, no W0 string
# survives in any shipped surface, and every OTHER lockup parameter is still
# the literal value it had at base f5622860. Run from the repo (worktree) root.
set -euo pipefail

F="components/chrome/SaocLockup.tsx"

grep -qF "const WORDMARK = 'South African Orchid Council';" "$F" || { echo "A2: WORDMARK is not exactly 'South African Orchid Council'"; exit 1; }

# A1 — W0 must not remain anywhere user-visible. Case-sensitive on purpose:
# "South African Orchid Council" does not contain "SA Orchid Council".
if grep -rnE "SA Orchid Council" components app lib sanity --include='*.ts' --include='*.tsx' --include='*.css'; then
  echo "A1: W0 'SA Orchid Council' still present (above)"; exit 1
fi

# A3 — parameters at their default-state values (app.js:46, metrics()/colours()).
for lit in \
  "tag: '#5a5f70'" "name: '#172a5c'" "rule: '#c9a200'" \
  "name: '#fbf8ea'" "tag: '#f0d35a'" "rule: 'rgba(255,255,255,0.35)'" \
  "const TAGLINE = 'Making a difference since 1968';" \
  'const ACCESSIBLE_LABEL = `South African Orchid Council — ${TAGLINE}`;' \
  "weight: '500'" "letterSpacing: '-0.005em'" "letterSpacing: '0.22em'" \
  "font-mono font-medium uppercase" \
  "w-[28px] h-[27px]" "text-[13px]" \
  "w-[89px] h-[86px]" "gap-[15px]" "h-[60px]" "gap-[9px]" "text-[35px]" "text-[11px]" \
  "w-[166px] h-[160px]" "w-[133px]" "text-[9px]" "mt-[12px]" "mt-[8px]" "mt-[9px]" \
  "saoc-emblem-footer-lapis-2x.png" "saoc-emblem-lockup-2x.png"; do
  grep -qF -- "$lit" "$F" || { echo "A3: lockup parameter changed or missing: $lit"; exit 1; }
done

# The artifact source itself is never edited; only the exporter wiring may change.
git diff --quiet f5622860 -- scripts/lockup-export-harness/app.js || { echo "A3: harness app.js (Brad's artifact) was modified"; exit 1; }
grep -qF "{ id:'W2', label:'South African Orchid Council', a:'South African Orchid Council' }" scripts/lockup-export-harness/app.js || { echo "A2: harness W2 entry missing"; exit 1; }

# Read-only trees untouched.
git diff --quiet f5622860 -- "branding/SA Orchid Council" design/design_handoff_saoc || { echo "branding/ or design handoff modified"; exit 1; }

echo "OK: W2 exact, no W0, other lockup parameters literal-identical, artifact + branding untouched"
