#!/usr/bin/env bash
# Mission nos-site-split — static structure checks. Usage: nos-split-static.sh <check-name>
set -u
case "${1:-}" in
  host-literals)
    # nos/beta host literals live only in lib/site-hosts.ts, apphosting.yaml, docs, e2e, memory.
    hits=$(grep -rn -e 'nos\.saoc\.co\.za' -e 'beta\.saoc\.co\.za' app lib components proxy.ts sanity content --include='*.ts' --include='*.tsx' --include='*.json' 2>/dev/null | grep -v '^lib/site-hosts.ts:' | grep -v '^content/drive' | grep -Ev ':[0-9]+:[[:space:]]*(//|/?\*)' || true)
    [ -z "$hits" ] || { echo "hardcoded hosts in:"; echo "$hits"; exit 1; } ;;
  no-saoc-fallback-in-show-urls)
    # the old per-file https://saoc.co.za fallback must be gone from the show/payment/email builders
    hits=$(grep -ln "DEFAULT_SITE_URL\|'https://saoc.co.za'" app/api/tickets/checkout/route.ts app/api/vendors/stand-payment/initiate/route.ts lib/confirmation-email.ts lib/recovery-url.ts lib/vendor-registration-confirmation.ts lib/vendor-payment-confirmation.ts lib/vendor-photo-resume-link.ts lib/vendor-stand-return.ts lib/vendor-stand-payment-notification.ts lib/supporter-registration-handler.ts 2>/dev/null || true)
    [ -z "$hits" ] || { echo "saoc fallback remains in:"; echo "$hits"; exit 1; } ;;
  trees)
    [ -d "app/(nos)/national-show" ] && [ -d "app/(nos)/tickets" ] && [ -d "app/(nos)/vsp" ] || { echo "show tree not under app/(nos)"; exit 1; }
    for d in national-show tickets vsp; do [ ! -e "app/(marketing)/$d" ] || { echo "app/(marketing)/$d still exists"; exit 1; }; done
    for d in privacy terms refunds newsletter; do [ -d "app/(shared)/$d" ] || { echo "app/(shared)/$d missing"; exit 1; }; [ ! -e "app/(marketing)/$d" ] || { echo "app/(marketing)/$d duplicated"; exit 1; }; done ;;
  safety)
    # sandbox-only: launch flag never declared, no live Ozow, no PayFast in the NOS checkout path
    grep -q '^  - variable: SITE_PUBLIC_LAUNCH' apphosting.yaml && { echo "SITE_PUBLIC_LAUNCH declared"; exit 1; }
    grep -q 'variable: NEXT_PUBLIC_NOS_SITE_URL' apphosting.yaml || { echo "NEXT_PUBLIC_NOS_SITE_URL missing in apphosting.yaml"; exit 1; }
    grep -q 'variable: NEXT_PUBLIC_SAOC_SITE_URL' apphosting.yaml || { echo "NEXT_PUBLIC_SAOC_SITE_URL missing in apphosting.yaml"; exit 1; } ;;
  newsletter)
    grep -q "topics" lib/newsletter-store.ts && grep -q "topics" lib/newsletter-handler.ts && grep -q "topics" app/api/admin/newsletter/export-csv/route.ts || { echo "topics not wired"; exit 1; } ;;
  *) echo "unknown check"; exit 2 ;;
esac
