#!/usr/bin/env bash
# Static checks for submit-signin-deadend. Usage: check.sh <case>. SAOC_ROOT overrides the repo root.
R="${SAOC_ROOT:-.}"
F="$R/components/events/SubmitEventForm.tsx"
case "$1" in
  no-plain-string-signin)
    # the three plain-string "sign in again" setServerError calls must be gone
    ! grep -E "setServerError\('[^']*sign in again" "$F" || { echo "FAIL a plain-string sign-in message still dead-ends"; exit 1; } ;;
  link-to-login)
    grep -q "next/link" "$F" && grep -q "/admin/login?next=/events/submit" "$F" || { echo "FAIL SubmitEventForm must link to /admin/login?next=/events/submit via next/link"; exit 1; } ;;
  wording-kept)
    grep -q "Your session expired" "$F" && grep -q "Failed to get auth token" "$F" && grep -q "Please sign in again" "$F" || { echo "FAIL existing wording must be kept"; exit 1; }
    ! grep -q -i -E "log in|login to|sign in here|click here" "$F" || { echo "FAIL new copy introduced"; exit 1; } ;;
  guard-login-route-and-next)
    test -f "$R/app/admin/login/page.tsx" || { echo "FAIL sign-in route missing"; exit 1; }
    "${TSX:-node_modules/.bin/tsx}" -e "import('$R/lib/safe-next-path.ts').then(m=>{ if(m.safeNextPath('/events/submit')!=='/events/submit'){console.error('FAIL next not honoured');process.exit(1)} })" ;;
  *) echo "unknown case $1"; exit 2 ;;
esac
echo "ok $1"
