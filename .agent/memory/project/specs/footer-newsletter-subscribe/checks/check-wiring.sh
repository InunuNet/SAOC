#!/usr/bin/env bash
# footer-newsletter-subscribe -- static wiring checks that must be sharp, one subcommand per assertion.
set -u
case "${1:-}" in
  r20-merged)
    # Footer wiring only after r20 lands: fail while an unmerged r20 branch is still on the remote.
    git rev-parse --verify -q origin/fix/nos-critique-r20 >/dev/null || exit 0
    git merge-base --is-ancestor origin/fix/nos-critique-r20 HEAD ;;
  route-uses-handler)
    for f in app/api/newsletter/subscribe/route.ts app/api/newsletter/unsubscribe/route.ts app/api/admin/newsletter/export-csv/route.ts; do
      test -f "$f" && grep -q "newsletter-handler" "$f" || { echo "missing/unwired: $f"; exit 1; }
    done
    grep -q "getAdminSession" app/api/admin/newsletter/export-csv/route.ts ;;
  no-client-admin-sdk)
    ! grep -q "firebase-admin" components/newsletter/NewsletterSignup.tsx && ! grep -q "firebase-admin" app/\(marketing\)/newsletter/unsubscribe/*.tsx ;;
  unsubscribe-get-no-write)
    # the page must not import the Admin SDK or the handler: GET is read-only and Firestore-free.
    ! grep -Eq "firebase-admin|newsletter-handler|initAdmin" app/\(marketing\)/newsletter/unsubscribe/page.tsx ;;
  signup-component)
    f=components/newsletter/NewsletterSignup.tsx
    head -5 "$f" | grep -q "'use client'" && grep -q 'aria-invalid' "$f" && grep -q 'aria-describedby' "$f" && grep -q 'aria-live' "$f" && grep -q '_hp' "$f" && grep -q "/api/newsletter/subscribe" "$f" ;;
  footers-wired)
    grep -q "NewsletterSignup" components/chrome/Footer.tsx && grep -q "NewsletterSignup" components/nos-chrome/NosFooter.tsx \
      && grep -q "saoc-footer" components/chrome/Footer.tsx && grep -q "nos-footer" components/nos-chrome/NosFooter.tsx ;;
  no-preventdefault-submit)
    ! grep -q "onSubmit={(e) => e.preventDefault()}" components/chrome/Footer.tsx components/nos-chrome/NosFooter.tsx ;;
  copy-register)
    f=components/chrome/newsletter-copy.ts
    test "$(grep -c 'PENDING-COMMITTEE-COPY' "$f")" -ge 2 && grep -q "You're subscribed." "$f" && grep -q "Enter a valid email address." "$f" && grep -q "Pending committee copy" docs/newsletter-subscribe.md ;;
  no-email-sent)
    # detects actual sending (calls/clients/imports), not the module name lib/resend-rate-limit.ts
    for f in lib/newsletter.ts lib/newsletter-handler.ts app/api/newsletter/subscribe/route.ts app/api/newsletter/unsubscribe/route.ts; do
      test -f "$f" || { echo "missing: $f"; exit 1; }
    done
    ! grep -Eq "sendEmail\(|resend\.emails|new Resend\(|from ['\"](@/lib/email|resend)['\"]|deliverConfirmationEmail" lib/newsletter.ts lib/newsletter-handler.ts app/api/newsletter/subscribe/route.ts app/api/newsletter/unsubscribe/route.ts ;;
  uses-client-ip)
    for f in app/api/newsletter/subscribe/route.ts app/api/newsletter/unsubscribe/route.ts; do
      grep -q "clientIpFromForwardedFor" "$f" || { echo "not using helper: $f"; exit 1; }
      ! grep -Eq "split\(['\"],['\"]\)\[0\]|\.at\(-1\)" "$f" || { echo "ad-hoc XFF parsing: $f"; exit 1; }
    done ;;
  timing-floor)
    f=app/api/newsletter/subscribe/route.ts
    n=$(grep -E "MIN_SUCCESS_RESPONSE_MS *=" "$f" | head -1 | sed -E "s/.*= *([0-9_]+).*/\1/" | tr -d _)
    test -n "$n" && test "$n" -ge 1000 && grep -qi "residual" docs/newsletter-subscribe.md ;;
  no-client-rules)
    ! grep -qs "newsletterSubscribers" firestore.rules ;;
  *) echo "usage: check-wiring.sh <subcommand>"; exit 2 ;;
esac
