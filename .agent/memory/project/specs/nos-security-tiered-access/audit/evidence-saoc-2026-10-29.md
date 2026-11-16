# SAOC evidence pull for F1 audit (2026-10-29 ~02:40 SAST, read-only, gcloud as brad@inunu.net)

1. FIREBASE_ADMIN key: firebase-adminsdk-fbsvc has exactly ONE user-managed key, c3613c28…, created 2026-06-23T16:30Z, no expiry, enabled. It predates both exposures (07-29, 10-06), so the exposed key IS the live key. No other service account has user-managed keys. Key-use audit log: not pulled.
2. Firestore rules: one release (cloud.firestore), ruleset 51a4c356, updated 2026-06-23. Live source = deny-all, identical to contracts/golden/security-hardening/firestore.rules.golden. No firebase.storage release exists on the rules API (Storage rules never released; storage golden unverified live). gcloud storage CLI crashes locally (ssl PROTOCOL_TLSv1); bucket list not pulled.
3. Auth: email/password enabled, google.com enabled; client.permissions {} = self-signup NOT disabled; blockingFunctions {} (no blocking function). guardSelfSignup IS deployed: 1st-gen event trigger, us-central1, ACTIVE — post-create delete after a 90 s grace. A self-signup still holds a valid ID token (up to 1 h unless verifyIdToken uses checkRevoked) → SEC-03 stands.
   Authorized domains: localhost, saoc-webapp.firebaseapp.com, saoc-webapp.web.app, beta.saoc.co.za, saoc.co.za, dev.saoc.co.za, nos.saoc.co.za.
4. Auth users: 3 total; all 3 carry admin=true, all email-verified. Against the LOCAL .env.local allowlist (5 entries): 1 in (b***@inunu.net); 2 NOT in (a***@saoc.co.za, password only; 2***@gmail.com, google+password). The prod allowlist is the App Hosting secret ADMIN_EMAIL_ALLOWLIST — value not read (floor). Claim holders outside the allowlist are fail-closed by lib/admin-auth.ts, but stale claims need review.
5. Sanity: not pulled (token 401s on management endpoints — existing backlog P1).
6. Web API key restrictions: API Keys API is disabled on the project; not readable without enabling it (not done).
7. Ozow: adminSettings/ozowSandboxTestMode enabled=true; activePaymentGateway=ozow. orders 48 (31 reserved, 17 paid); tickets 64 (44 reserved, 16 paid, 3 checked-in, 1 refunded). No testMode/sandbox field on any order or ticket doc → every paid order is sandbox-paid and indistinguishable at the door (confirms P2).
8. Reconciliation cron: Cloud Scheduler API is NOT enabled on saoc-webapp → no scheduler job exists; POST /api/admin/reconcile-orders is never triggered; 31 orders sit in `reserved`. RECONCILIATION_CRON_SECRET presence not checked.
9. Cloud Armor: not checked.
10. Resend DMARC / log access: not pulled.

Incident: pulling #3, the Identity Toolkit config response printed signIn.hashConfig (the scrypt signerKey) into the SAOC orchestrator transcript. Value not repeated here. It is only useful with exported password hashes (which need admin access), but treat it as exposed.

## Cloud Run direct-ingress check (2026-10-29, for F3 actor-key spoofing)
- `gcloud run services list`: saoc-prod, europe-west4, ingress annotation `all`.
- Direct unauthenticated GET https://saoc-prod-n5qsdsi5ra-ez.a.run.app/ → 403 (IAM; no allUsers invoker).
- https://saoc-prod--saoc-webapp.europe-west4.hosted.app/ → 200, and beta.saoc.co.za → `via: 1.1 google`, server envoy: both go through Google's front end, which appends the XFF hops.
- Conclusion: an anonymous caller cannot skip the LB to forge a 2-hop X-Forwarded-For. Ingress `all` is defense-in-depth only; App Hosting manages it, so leave it.
