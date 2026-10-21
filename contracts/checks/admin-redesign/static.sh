#!/usr/bin/env bash
# Static checks for mission admin-redesign. Usage: static.sh <case>. Exit 0 = pass.
set -u
fail() { echo "FAIL[$1]: $2" >&2; exit 1; }
ADMIN_TSX=$(find app/admin components/admin -name '*.tsx' 2>/dev/null)
TABLE_FILES=$(grep -l '<table' $ADMIN_TSX 2>/dev/null)
case "${1:-}" in
  routes)
    for f in "app/admin/(shell)/page.tsx" "app/admin/(shell)/tickets/page.tsx" "app/admin/(shell)/door/page.tsx" \
      "app/admin/(shell)/vendors/page.tsx" "app/admin/(shell)/vendors/applications/page.tsx" \
      "app/admin/(shell)/settings/page.tsx" "app/admin/login/page.tsx" "app/admin/(shell)/layout.tsx"; do
      test -f "$f" || fail routes "missing $f"
    done
    test ! -e app/admin/layout.tsx || fail routes "app/admin/layout.tsx must not exist (would wrap login)"
    test ! -e app/admin/page.tsx || fail routes "old app/admin/page.tsx still present"
    grep -q "Header" app/admin/login/layout.tsx || fail routes "login layout lost its public chrome"
    ;;
  no-public-chrome)
    hits=$(grep -rln "UtilityBar\|components/chrome" "app/admin/(shell)" components/admin 2>/dev/null)
    test -z "$hits" || fail no-public-chrome "public chrome referenced in: $hits"
    ;;
  no-admin-chip)
    ! grep -rnE 'className="eyebrow">Admin<|>ADMIN<|eyebrow">Admin' $ADMIN_TSX || fail no-admin-chip "ADMIN chip present"
    ;;
  tables-no-hscroll)
    test -n "$TABLE_FILES" || fail tables-no-hscroll "no table files found"
    for f in $TABLE_FILES; do
      ! grep -nE 'min-w-\[[0-9]+px\]|whitespace-nowrap|overflow-x-(auto|scroll)' "$f" || fail tables-no-hscroll "$f"
    done
    ;;
  tables-fixed)
    for f in $TABLE_FILES; do grep -q 'table-fixed' "$f" || fail tables-fixed "$f lacks table-fixed"; done
    ;;
  nav-aria-current)
    grep -rq 'aria-current' components/admin/shell || fail nav-aria-current "no aria-current in components/admin/shell"
    grep -rq 'min-h-\[44px\]\|h-11\|h-\[44px\]' components/admin/shell || fail nav-aria-current "no 44px touch target"
    ;;
  drawers-a11y)
    for f in components/admin/shell/MobileDrawer.tsx components/admin/DetailDrawer.tsx; do
      test -f "$f" || fail drawers-a11y "missing $f"
      grep -q "Escape" "$f" || fail drawers-a11y "$f: no Esc handling"
      grep -q "'Tab'" "$f" || grep -q '"Tab"' "$f" || grep -q "useFocusTrap" "$f" || fail drawers-a11y "$f: no focus trap"
      grep -q 'role="dialog"\|aria-modal' "$f" || fail drawers-a11y "$f: no dialog semantics"
    done
    grep -rq "overflow" components/admin/shell/MobileDrawer.tsx || fail drawers-a11y "mobile drawer must lock body scroll"
    grep -q "rgba(34, \?40, \?31, \?\.55)" components/admin/shell/MobileDrawer.tsx || fail drawers-a11y "scrim colour not the handoff value"
    ;;
  nav-config)
    f=lib/admin-nav-config.ts
    test -f $f || fail nav-config "missing $f"
    for s in "SHOW" "VENDORS" "COMMUNICATIONS" "SYSTEM" "Door scanner" "Newsletter" "available"; do grep -q "$s" $f || fail nav-config "$f lacks $s"; done
    grep -A3 -i "newsletter" $f | grep -q "available: false" || fail nav-config "Newsletter must default available: false"
    ;;
  copy)
    grep -rq "Quick actions" "app/admin/(shell)/page.tsx" || fail copy "Quick actions"
    grep -rq "Needs attention" "app/admin/(shell)/page.tsx" || fail copy "Needs attention"
    grep -rq "View site" components/admin || fail copy "View site"
    grep -rq "Edit this page" components/admin/AdminPill.tsx || fail copy "Edit this page"
    ;;
  pill)
    f=components/admin/AdminPill.tsx
    test -f $f || fail pill "missing"
    grep -q "'use client'" $f || fail pill "not a client component"
    grep -q "print:hidden" $f || fail pill "not hidden in print"
    grep -q "fixed" $f || fail pill "not fixed"
    ! grep -qE "draggable|onDrag|onPointerMove|onMouseMove|onTouchMove" $f || fail pill "pill must not be draggable"
    grep -q "/api/admin/whoami" $f || fail pill "does not use whoami"
    grep -q "startsWith('/admin')" $f || fail pill "must hide inside /admin"
    grep -q "AdminPill" "app/(marketing)/layout.tsx" || fail pill "not mounted in marketing layout"
    ! grep -qE "cookies\(|headers\(" "app/(marketing)/layout.tsx" || fail pill "marketing layout must stay static"
    test -f app/api/admin/whoami/route.ts || fail pill "no whoami route"
    grep -q "getAdminSession" app/api/admin/whoami/route.ts || fail pill "whoami not session-gated"
    grep -q "no-store" app/api/admin/whoami/route.ts || fail pill "whoami cacheable"
    grep -q "intent/edit" lib/studio-links.ts || fail pill "no studio link map"
    ;;
  no-admin-sdk-in-client)
    for f in $(grep -rl "^'use client'" components app 2>/dev/null); do
      ! grep -qE "firebase-admin|lib/firebase-admin|lib/admin-auth" "$f" || fail no-admin-sdk-in-client "$f"
    done
    ;;
  door)
    f=components/admin/DoorScannerClient.tsx
    grep -q "autoCapitalize=\"characters\"" $f || fail door "autocapitalize characters"
    grep -q "wakeLock" $f || fail door "no Screen Wake Lock"
    grep -q "Scan next" components/admin/DoorScannerClient.tsx components/admin/DoorResultBanner.tsx || fail door "Scan next"
    grep -qE "min-h-\[72px\]|h-\[72px\]" components/admin/DoorResultBanner.tsx || fail door "banner 72px"
    ;;
  fixtures-safe)
    f="app/admin-fixtures/[route]/page.tsx"
    test -f "$f" || fail fixtures-safe "missing fixture route"
    grep -q "ADMIN_FIXTURES" "$f" || fail fixtures-safe "no flag"
    grep -q "notFound" "$f" || fail fixtures-safe "no notFound"
    ! grep -rq "ADMIN_FIXTURES" apphosting.yaml apphosting*.yaml .env.local.example 2>/dev/null || fail fixtures-safe "flag present in deploy/env config"
    ! grep -rq "pathnameOverride" app components lib --include='*.tsx' --include='*.ts' -l 2>/dev/null | grep -v "admin-fixtures\|components/admin/shell" | grep -q . || fail fixtures-safe "pathnameOverride leaked"
    ;;
  list-order)
    # every admin list query orders newest-first server-side (Brad's failed test 2026-10-22)
    chk() { grep -rqE "orderBy\('$2', 'desc'\)" $1 || fail list-order "$1 lacks orderBy('$2','desc')"; }
    chk "app/admin/(shell)/tickets/page.tsx" purchasedAt
    chk "app/admin/(shell)/vendors/applications/page.tsx" submittedAt
    chk "app/admin/(shell)/vendors/page.tsx" submittedAt
    ! grep -nE "collection\([A-Za-z_'\"]*(VENDOR_APPLICATIONS_COLLECTION|VENDOR_SUBMISSIONS_COLLECTION|tickets)[A-Za-z_'\"]*\)\.get\(\)" "app/admin/(shell)/tickets/page.tsx" "app/admin/(shell)/vendors/applications/page.tsx" "app/admin/(shell)/vendors/page.tsx" || fail list-order "unordered .get() on a list collection"
    ;;
  titles)
    ! grep -rn "Vendor Applications" "app/admin/(shell)" components/admin lib/admin-nav-config.ts || fail titles "legacy shared title 'Vendor Applications' remains"
    grep -q ">Applications<\|'Applications'\|\"Applications\"" "app/admin/(shell)/vendors/applications/page.tsx" || fail titles "applications page lacks title Applications"
    grep -q ">Vendors<\|'Vendors'\|\"Vendors\"" "app/admin/(shell)/vendors/page.tsx" || fail titles "vendors page lacks title Vendors"
    ;;
  default-filter)
    f=components/admin/VendorApplicationReviewTable.tsx
    grep -qE "useState<[^>]*>\('(pending|all)'\)|defaultStatus.*'(pending|all)'" $f || fail default-filter "default status filter must be pending or all"
    ! grep -nE "\.sort\(|toSorted\(" $f || fail default-filter "table must not re-sort; server order is authoritative"
    ;;
  rulings)
    grep -rq "aria-sort" components/admin || fail rulings "Submitted column lacks aria-sort"
    grep -q "accent-soft" components/admin/AdminPill.tsx || fail rulings "pill dot must be accent-soft"
    b=components/admin/DoorResultBanner.tsx
    grep -q "bg-error" $b || fail rulings "invalid banner must use bg-error"
    grep -q "text-white" $b || fail rulings "banner text white"
    grep -q "bg-primary" $b || fail rulings "valid banner must use bg-primary"
    ! grep -nE "red-700|bg-red|text-red" $b || fail rulings "banner uses an off-token red"
    grep -rq "bg-accent" "app/admin/(shell)/page.tsx" components/admin || fail rulings "brass tile must be bg-accent"
    grep -rq "text-primary-800" "app/admin/(shell)/page.tsx" components/admin || fail rulings "brass tile text must be primary-800"
    ! grep -rnE "bg-accent[^\"]*text-(white|ivory)|text-(white|ivory)[^\"]*bg-accent" "app/admin/(shell)" components/admin || fail rulings "white/ivory text on brass tile"
    grep -rq "'paid'" "app/admin/(shell)/page.tsx" || fail rulings "Orders must count status paid"
    grep -q "purchasedAt', 'desc'" "app/admin/(shell)/tickets/page.tsx" || fail rulings "tickets newest-first"
    ;;
  *) fail usage "unknown case '${1:-}'";;
esac
echo "PASS[$1]"
