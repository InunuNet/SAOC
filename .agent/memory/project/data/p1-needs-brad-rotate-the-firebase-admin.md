# p1-needs-brad-rotate-the-firebase-admin

**[P1, needs Brad] Rotate the `FIREBASE_ADMIN_PRIVATE_KEY` service-account key**, exposed
  in an agent transcript on 2026-10-06 (`beta-password-wall` M1/F2 retry-1: per-line `sed`
  redaction on `.env.local` did not redact the multi-line key; most of the PEM was printed into
  the transcript). Blocked on `gcloud auth login` (reauth needed, non-interactive). Steps: create
  a new key, update `.env.local` and the Secret Manager `FIREBASE_ADMIN_PRIVATE_KEY` (real-newline
  PEM, unquoted in Secret Manager), roll out, prove admin auth works on beta, then delete the old
  key. See `needs-human.md` for the same item.
