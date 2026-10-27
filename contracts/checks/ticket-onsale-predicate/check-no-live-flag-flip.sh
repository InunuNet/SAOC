#!/bin/sh
# A6 -- TICKETING_PAYMENTS_LIVE is still false and unreferenced by any env override.
set -e
grep -q '^const TICKETING_PAYMENTS_LIVE = false;$' lib/ticketing-test-mode.ts
! grep -rn "TICKETING_PAYMENTS_LIVE\s*=\s*true" lib app components --include='*.ts' --include='*.tsx'
! grep -q "variable: SITE_PUBLIC_LAUNCH" apphosting.yaml
echo "PASS A6 payments still not live"
