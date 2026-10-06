# Reboot Context
_Generated: 2026-10-06T19:29Z_

## What happened last session
Closed out beta-password-wall mission (M1 gate green, F1 11/11, F2 17/17 incl. codex/browser/gws triad). Recorded retry-1 lessons: CDN-replay auth-bypass fix (Cache-Control private/no-store + marker Set-Cookie, since Cloud CDN never stores Set-Cookie and Next overwrites Vary), a CURL_HOME scoping hazard that false-FAILed an unauthenticated check, and a credential-exposure incident where per-line sed on .env.local missed the multi-line FIREBASE_ADMIN_PRIVATE_KEY, printing most of the PEM into an agent transcript. Added backlog items for key rotation (needs Brad, gcloud auth login blocked) and a stale contract-f2.yaml A13 prose fix; logged the key exposure to needs-human.md.
