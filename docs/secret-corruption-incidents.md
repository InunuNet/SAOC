# Secret Manager Corruption — Three Incidents, One Defect Class

**Date range:** 2026-07-28 (F2), 2026-08-12 (F3 first, then F3 second). Escalated 2026-08-12 as a standing practice recommendation.

See also: `docs/f2-secret-runtime-investigation.md` (the F2 incident, documented mid-investigation in July; this doc connects all three and proposes the verification practice).

## The Defect Class

A secret value is extracted from `.env.local` or similar source via a pipeline (here: ad-hoc `node -e` with `dotenv`, or direct `grep`), written to Secret Manager, and then **no verification step checks that what was stored matches what was intended**. The extraction pipeline can silently decorate the value (prepend prose, append newline or whitespace), and that decorated value reaches the deployed backend, where it fails in a way that looks like a different problem entirely.

**Why this is dangerous:** The symptom appears far from the cause. An auth failure makes the bearer token look bad; a gateway misconfiguration makes the platform look bad; a hung transaction makes the database look bad. Meanwhile the real issue is in the stored bytes themselves. The failure mode is **silent data corruption, not a missing or denied resource.**

## Incident 1: F2 — `SANITY_REVALIDATE_SECRET` and `SANITY_API_TOKEN` (July 2026)

**Symptom:** `/api/revalidate` and `/api/draft` returned 401 on the deployed backend regardless of which secret value was sent — correct value, intentionally wrong value, no secret at all, all identical 401.

**Root cause, confirmed:** Both secrets were stored in Secret Manager with corrupted payloads: roughly 80–95 bytes of non-ASCII prose text, followed by a newline, followed by the real token.

**How corruption happened:** An ad-hoc `node -e` command used `require('dotenv').config()` without `quiet: true`, and its stdout was piped directly into `firebase apphosting:secrets:set`. The `dotenv` banner (Unicode glyphs `{0x87, 0x8c, 0x97, 0x98, 0xe2}` in the UTF-8 "◇" and "⌘" symbols, ending in a bare `\n`) printed to stdout, followed by whatever the script wrote next (the token). Since stdout was piped, no TTY was available to strip ANSI codes, so the raw UTF-8 prose reached the Secret Manager payload verbatim. Both secrets broke identically because both were extracted with the same broken `node -e` invocation in the same session.

**Fix:** Re-set both secrets using `printf '%s' "$TOKEN" | firebase apphosting:secrets:set <NAME> --project saoc-webapp --data-file=-` (never `echo`, which appends `\n`), then forced a rollout. App Hosting resolves secrets at Cloud Run revision creation time, not per-request, so a rollout is mandatory for the corrected secret to be picked up.

**Ruled out with direct evidence** (see `docs/f2-secret-runtime-investigation.md` for the full negative-control record):
- Build staleness / IAM propagation races (both real but separate from the payload corruption)
- The resolved runtime version (pnpm-lock.yaml held React 19.2.7 throughout)

## Incident 2: Parallel Finding During F3 Fix (August 12, 2026)

**Symptom:** `PAYFAST_SANDBOX_MERCHANT_KEY` was written to Secret Manager carrying a trailing tab — 14 bytes instead of 13 — which would have failed signature validation at PayFast. The tab was already present in `.env.local`; the extraction pipeline (`grep | cut`) copied it faithfully.

**How corruption happened:** Manual extraction from `.env.local` with `grep '^PAYFAST_SANDBOX_MERCHANT_KEY=' .env.local | cut -d= -f2` carried the value as-is from the file, including any trailing whitespace. The `.env.local` line had a stray tab; it was never validated after write.

**Fix:** Trimmed the value in both `.env.local` and Secret Manager version. The `.env.local` correction prevents future exports of the same corrupted value; the Secret Manager fix is what prevents the deployed gateway from using a malformed key.

## Incident 3: `FIREBASE_ADMIN_CLIENT_EMAIL` Corruption on Day 1 (August 12, 2026)

**Symptom:** Every Firebase Admin SDK write failed on the deployed backend. `POST /api/contact` → 500 in ~1.1s; `POST /api/tickets/checkout` → 500 in ~64s (same fault, retried 10× by the Firestore transaction). Page routes and Sanity reads were fine, so the deploy looked healthy.

**Root cause, proven not inferred:** The `FIREBASE_ADMIN_CLIENT_EMAIL` secret's latest version was 61 bytes ending `.comY\n` instead of the correct 59 bytes ending `.com` — a stray `Y` and newline. The Admin SDK signed its JWT with `iss: "...gserviceaccount.comY"`, Google could not find that service account, and the OAuth token exchange failed with gRPC `16 UNAUTHENTICATED` before Firestore, security rules, or IAM were ever reached.

**Proof:** Running the OAuth JWT-bearer exchange with the corrupted email and the real private key returned `400 invalid_grant: account not found`; the same key with the corrected email returned a valid access token with datastore scope.

**It was never a regression.** Secret version timestamps: v1 (correct) 2026-06-23T16:32:37Z, v2 (corrupted) 16:32:49Z — 12 seconds later, and before the private-key secret even existed. The payload had been wrong for **seven weeks**. Nothing surfaced it because `/api/contact` and `/api/tickets` never rendered in production until commit `4212e88` earlier today.

**Fix:** Wrote v1's exact 59 bytes as version 3 (verified by SHA-256 and byte length, never by printing the value) and forced a rollout.

**Ruled out with direct evidence:**
- Private key encoding/newlines (clean 1703-byte PEM, 27 real newlines)
- Service account IAM roles (`roles/firebase.sdkAdminServiceAgent` includes the needed datastore permissions)
- Firestore database existence/location (`(default)`, FIRESTORE_NATIVE, europe-west4, matching the backend)
- Firestore API enablement (ENABLED)
- Security rules (Admin SDK bypasses them, and the failure precedes any Firestore RPC)
- VPC/egress (clean fast rejection, not a hang)
- Key expiry/revocation (valid, not expired)

## The Shared Pattern

All three incidents follow the same shape:

1. A secret value is extracted via a pipeline that can decorate it (dotenv banner in F2, trailing tab in F2 parallel, stray `Y\n` in F3)
2. The decorated value reaches Secret Manager because no verification step ran after writing
3. The decorated value resolves at runtime because Secret Manager stores payloads exactly as-is
4. The application fails in a way that looks like a different problem (401, auth failure, transaction hang) until the root cause is traced back to the bytes themselves
5. The timestamp gap between corruption and discovery is weeks to months (F3 was corrupted 2026-06-23, discovered 2026-08-12)

## Standing Recommendation: Post-Write Verification

**Every secret write to Secret Manager must be followed immediately by a verification check:**

After any `firebase apphosting:secrets:set <NAME>` or equivalent, read back the secret version and verify:
1. **Byte length matches the intended value** — `wc -c` on both
2. **SHA-256 digest matches** — compute digest on the intended value in `.env.local` or from a known-good reference, then compare against the newly-stored version in Secret Manager
3. **No leading or trailing whitespace** — `strings` or `od` on the stored bytes
4. **Never print the secret value itself to any log, doc, or tool output** — use digest and byte count only

This check is a **candidate for a contract assertion** — a contract that runs after every secret write, confirming that what was stored is what was intended. Recommend schema:

```yaml
- id: A_SECRET_VERIFY
  description: Verify secret payload after writing
  command: |
    # Extract intended value from .env.local
    INTENDED="$(grep '^PAYFAST_SANDBOX_MERCHANT_KEY=' /path/to/.env.local | cut -d= -f2)"
    INTENDED_DIGEST="$(printf '%s' "$INTENDED" | shasum -a 256 | cut -d' ' -f1)"
    INTENDED_BYTES="$(printf '%s' "$INTENDED" | wc -c)"
    
    # Read from Secret Manager
    STORED="$(firebase apphosting:secrets:get PAYFAST_SANDBOX_MERCHANT_KEY ... | jq .secretVersion.data -r | base64 -d)"
    STORED_DIGEST="$(printf '%s' "$STORED" | shasum -a 256 | cut -d' ' -f1)"
    STORED_BYTES="$(printf '%s' "$STORED" | wc -c)"
    
    # Assert byte-for-byte match
    [[ "$INTENDED_DIGEST" == "$STORED_DIGEST" ]] || { echo "Digest mismatch"; exit 1; }
    [[ "$INTENDED_BYTES" == "$STORED_BYTES" ]] || { echo "Byte count mismatch"; exit 1; }
    
    # Assert no leading/trailing whitespace
    [[ "$STORED" == "$(echo "$STORED" | xargs)" ]] || { echo "Whitespace detected"; exit 1; }
```

Alternatively, if the Firebase CLI does not expose the stored value via a simple REST call, use `gcloud secrets versions access latest --data-file=-` (requires `gcloud` installed) or the Google Cloud REST API directly with the cached OAuth token from `~/.config/configstore/firebase-tools.json`.

## Mandatory: Rollout After Secret Change

**App Hosting resolves secret values at Cloud Run revision creation time, not per-request.** An already-running revision keeps serving whatever value it resolved at boot, even after the underlying secret in Secret Manager is updated. Without a new rollout after any secret change, the corrected secret sits in Secret Manager unused while production keeps serving the old value.

This is not optional — every secret fix must be followed by:
```bash
firebase apphosting:rollouts:create <BACKEND> --project <PROJECT> --git-branch main [--force]
```

(The `--force` flag is unnecessary if there is a new commit to deploy; if forcing a rebuild of an existing commit for the sole purpose of picking up a new secret, include it.)

## Also Addressed Today

**The `.env.local` file itself can be the source of corrupted values.** Incidents 2 and 3 both originated from `.env.local` entries that carried stray whitespace or wrong characters. Recommend:

1. **Trim at write time, not just at read time.** Secrets in `.env.local` should be typed cleanly or auto-trimmed on the line (e.g. `PAYFAST_SANDBOX_MERCHANT_KEY="4yp835jqpwbf1"`, no tabs or trailing spaces).
2. **Verify the source file itself.** Before extracting to Secret Manager, `od -c` or `xxd` the relevant line to confirm it is what you think it is.
3. **Verify after writing.** Use the post-write verification practice above to catch corruption before it reaches the deployed backend.

## References

- `docs/f2-secret-runtime-investigation.md` — detailed investigation of incident 1 (F2), including the false-trail hypotheses that were ruled out
- `docs/dotenv-supply-chain-f1.md` — the `dotenv` banner's technical details (UTF-8 glyphs, no ANSI codes when stdout is piped)
- `.agent/memory/project/learned.md` — "Verify Against Source Before Asserting" (2026-07-23) — broader principle on checking actual artefacts, not summaries
- Project backlog: "Secret verification guard as a candidate contract" — reference for the implementation of this recommendation
