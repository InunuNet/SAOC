#!/usr/bin/env bash
# Auth gate unchanged vs origin/main. Gate-bearing lines in each moved layout must be identical,
# lib/admin-auth.ts and every pre-existing admin API route must be byte-identical.
set -u
fail() { echo "FAIL[auth-gate]: $1" >&2; exit 1; }
# Executable gate calls only: comment lines and trailing comments are ignored, so dead code and
# comments may be removed. Each moved layout must keep every session/redirect line from main and
# its own capability string (the one it actually gates on).
GATE='getAdminSession\(|session\.ok|redirect\('
strip() { sed -E 's://.*$::' | grep -vE '^[[:space:]]*(\*|/\*)' | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//' | grep -v '^$'; }
pairs="app/admin/door/layout.tsx|app/admin/(shell)/door/layout.tsx|
app/admin/vendors/layout.tsx|app/admin/(shell)/vendors/layout.tsx|review-vendor-applications
app/admin/settings/layout.tsx|app/admin/(shell)/payments/layout.tsx|manage-payment-settings"
# Superseded by mission payment-gateway-settings: the payment gate moved from the settings layout to the
# payments layout (Brad instructed the move); /admin/settings is now general Settings, open to any admin.
while IFS='|' read -r old new cap; do
  test -f "$new" || fail "missing $new"
  a=$(git show "origin/main:$old" | strip | grep -E "$GATE" | grep -v '^import' | sort -u)
  b=$(strip < "$new" | grep -E "$GATE" | grep -v '^import' | sort -u)
  missing=$(comm -23 <(echo "$a") <(echo "$b"))
  test -z "$missing" || fail "$new lost gate lines: $missing"
  if [ -n "$cap" ]; then
    strip < "$new" | grep -q "hasCapability" || fail "$new: no hasCapability call"
    strip < "$new" | grep -q "'$cap'" || fail "$new: lost capability $cap"
  fi
done <<< "$pairs"
# dashboard and tickets pages keep the session redirect
for f in "app/admin/(shell)/page.tsx" "app/admin/(shell)/tickets/page.tsx"; do
  grep -q "getAdminSession" "$f" && grep -q "redirect('/admin/login')" "$f" || fail "$f lacks session gate"
done
git diff --quiet origin/main -- lib/admin-auth.ts app/api/admin/session app/api/admin/checkin app/api/admin/export-csv \
  app/api/admin/reconcile-orders app/api/admin/tickets app/api/admin/vendors || fail "pre-existing admin API or admin-auth changed"
# Superseded by mission payment-gateway-settings: app/api/admin/settings now carries audited writes, so
# it is no longer pinned byte-identical above; its gate (session then manage-payment-settings) is checked here.
for f in app/api/admin/settings/active-payment-gateway/route.ts app/api/admin/settings/ozow-sandbox-test-mode/route.ts; do
  grep -q "getAdminSession" "$f" && grep -q "'manage-payment-settings'" "$f" || fail "$f lost its gate"
done
test ! -f "app/admin/(shell)/settings/layout.tsx" || ! grep -q "manage-payment-settings" "app/admin/(shell)/settings/layout.tsx" || fail "settings must be open to any admin"
echo "PASS[auth-gate]"
