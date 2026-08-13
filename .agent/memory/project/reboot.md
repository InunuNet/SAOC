# Reboot Context
_Generated: 2026-08-13T10:00Z_

## What happened last session
Fixed a 2-week silent deploy outage (/tickets prerendered against RUNTIME-only Firebase Admin creds), then found deployed Firestore writes had NEVER worked: FIREBASE_ADMIN_CLIENT_EMAIL secret held a stray 'Y' since 23 June, failing every OAuth exchange with 16 UNAUTHENTICATED. Wired missing PayFast sandbox secrets, fixed a trailing tab I introduced in MERCHANT_KEY, made CI mirror the App Hosting builder, and set up https://dev.saoc.co.za for local dev. Mission F1+F2 done, F4 reject-path proven by real rejected ITNs, F3 awaiting Brad's retry.
