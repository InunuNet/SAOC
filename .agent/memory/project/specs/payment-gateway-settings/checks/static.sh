#!/usr/bin/env bash
# payment-gateway-settings static checks. Run from the project root: bash <this> <check>
set -u
fail() { echo "FAIL: $*" >&2; exit 1; }
PAY='app/admin/(shell)/payments'
SET='app/admin/(shell)/settings'
PANEL='components/admin/PaymentSettingsPanel.tsx'

case "${1:-}" in
  files)
    for f in "$PAY/layout.tsx" "$PAY/page.tsx" "$PAY/loading.tsx" "$PAY/error.tsx" "$PANEL" \
             lib/payment-mode.ts lib/payment-settings-audit.ts "$SET/page.tsx"; do
      [ -f "$f" ] || fail "missing $f"
    done ;;
  no-use-client-page)
    # payments page is a server component (reads state + audit server-side, hands plain data to the panel)
    grep -q "use client" "$PAY/page.tsx" && fail "$PAY/page.tsx must be a server component"
    grep -q "use client" "$PANEL" || fail "$PANEL must be a client component" ;;
  settings-open)
    # general Settings: no payment capability gate, no payment fetches, still requires a session
    [ -f "$SET/layout.tsx" ] && grep -q "manage-payment-settings" "$SET/layout.tsx" && fail "settings/layout.tsx still gates on manage-payment-settings"
    grep -rq "manage-payment-settings" "$SET" && fail "settings subtree references manage-payment-settings"
    grep -rq "api/admin/settings/" "$SET" && fail "settings subtree still calls the payment APIs"
    grep -rq "getAdminSession" "$SET" || fail "settings subtree never checks the admin session (page or layout)" ;;
  profile)
    f="$SET/page.tsx"
    grep -q "Profile" "$f" || fail "no Profile section"
    grep -q "sign_in_provider" "$f" || fail "sign-in provider not shown (decodedToken.firebase.sign_in_provider)"
    grep -qE "roles" "$f" || fail "roles/scope not shown"
    grep -qE "Sign out" "$f" || fail "no sign-out control"
    grep -q "useAdminSignOut\|signOutAdmin" "$f" components/admin/SettingsSignOut.tsx 2>/dev/null || fail "sign-out must reuse useAdminSignOut/signOutAdmin (no second sign-out path)"
    grep -rqE "Dashboard preferences|Preferences" "$f" && fail "invented a Dashboard preferences section; none exist in code" || true ;;
  dashboard-link)
    grep -q 'href="/admin/payments"' components/admin/dashboard/DashboardParts.tsx || fail "dashboard Payment settings link must point at /admin/payments"
    grep -q 'href="/admin/settings"' components/admin/dashboard/DashboardParts.tsx && fail "dashboard still links /admin/settings" || true ;;
  fixture-wiring)
    grep -q "payments" "app/admin-fixtures/[route]/page.tsx" || fail "admin-fixtures route map has no payments entry" ;;
  mode-ui)
    f="$PANEL"
    grep -q "SELECTABLE_PAYMENT_MODES" "$f" || fail "panel must derive selectable modes from lib/payment-mode"
    grep -qi "live" "$f" || fail "Live option is not rendered"
    grep -q "Live is not available" "$f" || fail "Live-disabled explanation missing"
    grep -q "credentials" "$f" || fail "Live-disabled explanation must name credentials"
    grep -q "Sandbox" "$f" || fail "Sandbox label missing"
    grep -q "disabled" "$f" || fail "Live control must be disabled"
    grep -q "R0.01" "$f" || fail "R0.01 option missing"
    grep -q "Recent changes" "$f" || grep -q "Recent changes" "$PAY/page.tsx" || fail "Recent changes list missing"
    grep -q "confirm(" "$f" || fail "gateway switch has no confirm dialog" ;;
  copy)
    grep -rq "Payment gateway settings" "$PAY" "$PANEL" || fail "page title 'Payment gateway settings' (Brad's words) missing"
    grep -q "Ozow sandbox test mode" "$PANEL" && fail "misleading 'Ozow sandbox test mode' label survives" || true ;;
  no-live)
    # 1. no live env names or live flags anywhere that ships
    grep -rnE "(OZOW|PAYFAST)_LIVE|PAYMENTS_LIVE_ENABLED|LIVE_ENABLED" app lib components apphosting.yaml && fail "live credential/flag name introduced"
    # 2. Ozow IsTest stays the hard constant 'true' and nothing sets it false
    grep -q "OZOW_IS_TEST = 'true'" lib/payments/ozow.ts || fail "OZOW_IS_TEST constant changed"
    grep -nE "IsTest['\"]?\s*:\s*(['\"]false|false)" lib/payments/ozow.ts lib/ozow.ts && fail "IsTest set false"
    # 3. PayFast adapter still posts only to the sandbox constants
    grep -q "PAYFAST_SANDBOX_HOST" lib/payfast.ts || fail "PayFast sandbox host constant gone"
    grep -nE "https://www\.payfast\.co\.za/eng/process|https://www\.payfast\.co\.za/eng/query" lib/payfast.ts lib/payments/payfast.ts && fail "PayFast live URL introduced"
    # 4. standing ticketing rule
    grep -q "TICKETING_PAYMENTS_LIVE = false" lib/ticketing-test-mode.ts || fail "TICKETING_PAYMENTS_LIVE no longer false"
    # 5. no new lib/app code reads a mode from Firestore or request to pick credentials
    grep -rnE "gatewayMode|paymentMode\b.*(get|doc)\(" app lib --include='*.ts' --include='*.tsx' && fail "a stored/request-driven mode is wired into payment code (M1 has none)" || true ;;
  legacy-checks)
    # pre-existing checks that pass on main today; they must keep passing (4 others already fail at baseline and are out of scope)
    for f in check-admin-route-gate check-banner-constant-used check-capability-owner-only check-order-field-optional \
             check-public-status-route-fails-closed check-reservation-outcome-expected-amount-sourcing \
             check-resolve-expected-gateway-amount check-resolve-initiate-amount check-shared-module-client-safe; do
      node "contracts/checks/ozow-sandbox-toggle-f1/$f.mjs" >/dev/null 2>&1 || fail "regression in legacy check $f"
    done ;;
  *) echo "usage: static.sh <files|no-use-client-page|settings-open|profile|dashboard-link|fixture-wiring|mode-ui|copy|no-live|legacy-checks>" >&2; exit 2 ;;
esac
echo "PASS[$1]"
