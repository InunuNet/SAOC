# Security hardening

Branch `fix/security-hardening`. Closes the verified findings from the 2026-10-24 security review. No new email is sent and no user-facing copy changes. Nothing here is deployed.

## What changed, per finding

### M1 Public form abuse (contact, vendor apply)

- `app/api/contact/route.ts` and `app/api/vendors/apply/route.ts` are rate-limited per client IP: 5 attempts per hour (`lib/public-form-rate-limit.ts`). The 6th attempt in the window gets HTTP 429 with a `Retry-After` header (whole seconds) and the sponsor/newsletter copy "Too many attempts. Please try again later." The limit is consumed before `request.json()`, so a limited caller's body is never parsed.
- Keys are `contact:${ip}` and `vendor-apply:${ip}`, with the same `createAttemptStore` / `scopeAttemptsToRequest` / `consumeRateLimit` pattern the sponsor and newsletter routes use.
- Honeypot: a non-empty string in the body field `_hp` returns 201 `{ "success": true }`, writes nothing and sends nothing. `ContactForm` does not send `_hp` today; the server check is the backstop for direct callers (`isHoneypotHit` in `lib/request-guards.ts`).
- Contact input is validated by `lib/contact-input.ts`: every field must be a string, name/subject/message non-empty after trimming, email matching the existing pattern. A malformed JSON body is a 400, not a 500. The existing error strings are kept.
- Vendor apply: `validateVendorApplicationInput` already type-guards every field and caps lengths; a non-object or array body fails validation with 400.

#### Field caps

| Field | Max | Why |
|---|---|---|
| email | 254 | RFC 5321 maximum address length |
| name | 100 | generous for a personal name |
| subject | 200 | generous for a subject line |
| message | 5000 | the cap the route already had |

The caps stop log, database and email-payload bloat while leaving real input untouched.

### M2 Client IP

Every limiter key now uses `clientIpFromForwardedFor` (the second-to-last hop, appended by Google's front end) instead of the first hop, which a caller can spoof. Routes: `vendors/register`, `vendors/register/verify-code`, `vendors/[id]/proof-of-payment`, `vendors/[id]/marketing-asset`. Nothing under `app/` reads `x-forwarded-for` without the helper.

### M3 Event submission

`app/api/events/submit/route.ts` order: bearer token, `verifyIdToken(token, true)` (revocation checked), verified email (403 `Email not verified` otherwise; a bad token stays 401), per-uid rate limit (`event-submit:${uid}`, same 5 per hour), parse, `validateEventSubmission`, host society lookup.

- Field caps (`lib/event-submission-guard.ts`): title 150, venue 150, location 150, description 5000, hostSocietyId 64; every field must be a string.
- A supplied `hostSocietyId` must name an existing `society` document (the Sanity type name verified against `sanity/schemas/documents/society.ts`). The query is parameterised: `count(*[_type == "society" && _id == $id]) > 0` with `{ id }`. The check fails closed: a missing society or a failing lookup is 400 `Unknown host society`.

### M5 Uploads

- The proof-of-payment and marketing-asset routes derive a body limit from the 5 MiB file cap (`base64BodyLimitBytes`: base64 expansion plus 16 KiB for the JSON envelope, 7,006,892 bytes) and answer 413 `Request body too large.` from `Content-Length` before `request.json()`, also when the header is missing.
- The handlers check the file's magic bytes against the declared MIME type (`lib/upload-sniff.ts`: PDF, JPEG, PNG, WebP) after the size checks and before any storage write or existence lookup. A mismatch is 400 `File content does not match the declared type.`

### M6 CSV

`csvField` moved verbatim from `lib/newsletter.ts` to `lib/csv-field.ts` (formula leaders `= + - @ TAB CR` get a leading single quote; fields with quotes, commas or line breaks are quoted). The admin ticket export (`app/api/admin/export-csv/route.ts`) now uses it instead of its own escaper, which did not neutralise formulas. Newsletter CSV output is byte-identical.

### L1 Constant-time compares

`constantTimeStringEqual` in `lib/recovery-token.ts` is used for the Ozow hash, the PayFast signature, and the revalidate and draft secrets. In `lib/payments/*.ts` only the comparison changed; comparisons stay case-sensitive and `TICKETING_PAYMENTS_LIVE` stays `false`.

### L2 Open redirect

`app/api/draft/route.ts` redirects through `safeNextPath`: absolute URLs, `//host`, backslashes and control characters fall back to `/`.

### L3 Admin session

`POST /api/admin/session` answers 400 `Invalid request body` for a malformed or non-object body instead of throwing a 500. The `idToken` 400 is unchanged.

### Rules files

`firestore.rules` and `storage.rules` are committed as deny-all (the Firestore rule is what is deployed today). `firebase.json` does not reference either file yet and is not edited here. Deploying the rules is a separate step that needs Brad's approval.

## Known limits

- The limiter store is a known limit shared with sponsors and newsletter: it is per server instance and cleared on restart. Cloud Armor is the follow-up.
- The upload routes stay public and unauthenticated (capability model untouched): anyone with a submission id can upload against it. The magic-byte check only stops a mislabelled file, not an abusive caller.
- The draft route still uses the shared `SANITY_REVALIDATE_SECRET`, and disabling draft mode is still a GET.
- The honeypot is a backstop for direct callers; the contact form does not render the field.

## Out of scope

- Next version bump (another PR)
- CSP enforce flip
- Cloud Armor rate limit
- Admin self-signup
- Checkout stock-holding (L5)
- boothSize vs allocation (L6)
- L4 capability checks
- Deduplicating the PayFast and Ozow client-IP helpers onto `clientIpFromForwardedFor`
