#!/usr/bin/env bash
# A1 — proves the /admin/settings chrome wrapper exists, in EITHER page.tsx or layout.tsx (both
# LAYOUT OPTION A and B from the golden are acceptable — see
# contracts/golden/admin-settings-deploy-and-chrome-fix-f1/page-structure.golden.tsx.txt).
# Requires the chrome imports AND their JSX usage to both be present in the SAME file, and
# variant="bar" (never "minimal") on the AdminNav usage. This is a necessary-but-not-sufficient
# check — A6 is what actually proves the fix works live; see the golden README for why.
set -euo pipefail

CANDIDATES=("app/admin/settings/page.tsx" "app/admin/settings/layout.tsx")
FOUND=""

for f in "${CANDIDATES[@]}"; do
  [ -f "$f" ] || continue
  if grep -Eq "import \{[^}]*UtilityBar[^}]*Header[^}]*Footer[^}]*\}[[:space:]]*from[[:space:]]*'@/components/chrome'|import \{[^}]*Header[^}]*UtilityBar[^}]*Footer[^}]*\}[[:space:]]*from[[:space:]]*'@/components/chrome'" "$f" \
    && grep -q "from '@/components/admin/AdminNav'" "$f" \
    && grep -q "<UtilityBar" "$f" \
    && grep -q "<Header" "$f" \
    && grep -q "<AdminNav" "$f" \
    && grep -q "<Footer" "$f"; then
    FOUND="$f"
    break
  fi
done

if [ -z "$FOUND" ]; then
  echo "FAIL: neither app/admin/settings/page.tsx nor app/admin/settings/layout.tsx imports and renders UtilityBar+Header+AdminNav+Footer together"
  exit 1
fi

if grep -q '<AdminNav' "$FOUND" && ! grep -A2 '<AdminNav' "$FOUND" | grep -q 'variant="bar"'; then
  echo "FAIL: $FOUND's <AdminNav usage is not variant=\"bar\""
  exit 1
fi

echo "PASS: $FOUND wraps /admin/settings in the full chrome stack with variant=\"bar\""
exit 0
