#!/usr/bin/env bash
# Auth gate unchanged vs origin/main. Gate-bearing lines in each moved layout must be identical,
# lib/admin-auth.ts and every pre-existing admin API route must be byte-identical.
set -u
fail() { echo "FAIL[auth-gate]: $1" >&2; exit 1; }
PAT='getAdminSession|hasCapability|redirect\(|session\.ok|decodedToken|NATIONAL_SHOW_ID|review-vendor-applications|manage-payment-settings|resolveShowWindowLookup'
pairs="app/admin/door/layout.tsx|app/admin/(shell)/door/layout.tsx
app/admin/vendors/layout.tsx|app/admin/(shell)/vendors/layout.tsx
app/admin/settings/layout.tsx|app/admin/(shell)/settings/layout.tsx"
while IFS='|' read -r old new; do
  test -f "$new" || fail "missing $new"
  a=$(git show "origin/main:$old" | grep -E "$PAT" | grep -v '^import' | sed 's/^[ \t]*//' | sort -u)
  b=$(grep -E "$PAT" "$new" | grep -v '^import' | sed 's/^[ \t]*//' | sort -u)
  # every gate line from main must still exist; the new file may add nothing weaker
  missing=$(comm -23 <(echo "$a") <(echo "$b"))
  test -z "$missing" || fail "$new lost gate lines: $missing"
done <<< "$pairs"
# dashboard and tickets pages keep the session redirect
for f in "app/admin/(shell)/page.tsx" "app/admin/(shell)/tickets/page.tsx"; do
  grep -q "getAdminSession" "$f" && grep -q "redirect('/admin/login')" "$f" || fail "$f lacks session gate"
done
git diff --quiet origin/main -- lib/admin-auth.ts app/api/admin/session app/api/admin/checkin app/api/admin/export-csv \
  app/api/admin/reconcile-orders app/api/admin/settings app/api/admin/tickets app/api/admin/vendors || fail "pre-existing admin API or admin-auth changed"
echo "PASS[auth-gate]"
