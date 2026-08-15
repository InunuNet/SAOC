# Reboot Context
_Generated: 2026-08-15T11:17Z_

## What happened last session
F4 (Google sign-in) shipped and gated 6/6 for admin-auth-hardening: GoogleAuthProvider on /admin/login with claim-first provisioning (email must go through admin-grant.ts before ADMIN_EMAIL_ALLOWLIST, closing the squatting race via Firebase's unconditional email-uniqueness rather than operator discipline). F5 (Microsoft+Apple) PARKED by user decision; F6 (human proof) remains. Confirmed a 4th instance of the weak-assertion defect class (A-STRUCT-02 substring-matched an endpoint literal) and fixed it with a proven-to-reject-broken-variant standard. Logged an orchestration failure (out-of-order messages caused 3 design reversals) and a near-miss where a human was pointed at an irreversible Identity Platform console setting that didn't apply.
