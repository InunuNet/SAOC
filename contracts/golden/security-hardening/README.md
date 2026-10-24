# security-hardening: exact behaviour

Branch `fix/security-hardening`. Fixtures in `fixtures/` are the authority; `contracts/checks/security-hardening/check.mts` drives the pure functions below with them. Dev implements the module names and signatures exactly. This PR sends NO new email and changes no user-facing copy.

## Shared limiter pattern (M1, M3)

The pattern already used by `app/api/sponsors/enquire/route.ts` and the newsletter routes: a module-scope `createAttemptStore(windowMs)` from `lib/newsletter-rate-store.ts`, `scopeAttemptsToRequest(store)` per request, `consumeRateLimit(deps, key, max, windowMs)` from `lib/newsletter-rate-limit.ts`. Over limit returns HTTP 429, body `{ "error": "Too many attempts. Please try again later." }` (the sponsor/newsletter copy), header `Retry-After` in whole seconds.

New `lib/public-form-rate-limit.ts` exports `PUBLIC_FORM_RATE_LIMIT_MAX_ATTEMPTS = 5` and `PUBLIC_FORM_RATE_LIMIT_WINDOW_MS = 3_600_000`, used by contact, vendor apply and event submit. The 6th attempt inside the window is denied, the 5th is allowed, and a second key is unaffected.

Keys: `contact:${ip}`, `vendor-apply:${ip}`, `event-submit:${uid}`; `ip` is `clientIpFromForwardedFor(request.headers.get('x-forwarded-for')) ?? 'unknown'`. The limit is consumed BEFORE `request.json()`, so a limited caller's body is never parsed.

Known limit (same as sponsors/newsletter): the store is per server instance and cleared on restart. Cloud Armor is the follow-up.

## M1 contact + vendor apply

- `app/api/contact/route.ts`: rate limit first, then parse (malformed JSON stays an error response, not a 500), then honeypot, then `validateContactInput`.
- Honeypot: body `_hp` is a non-empty string -> respond 201 `{ "success": true }`, write nothing, send nothing (the sponsor handler's behaviour). `ContactForm` does not send `_hp` today (a client-side drop); the server check is the backstop for direct callers. `isHoneypotHit(body: unknown): boolean` lives in `lib/request-guards.ts`.
- New `lib/contact-input.ts`: `CONTACT_FIELD_MAX_LENGTHS = { name: 100, email: 254, subject: 200, message: 5000 }` and `validateContactInput(raw: unknown): { ok: true; value: { name; email; subject; message } } | { ok: false; error: string }`. Every field must be `typeof === 'string'`; name/subject/message non-empty after trim; email matches the existing regex and is within 254. The existing error strings ('All fields are required.', 'Invalid email address.', 'Message must be under 5000 characters.') are kept; a new length error reuses the message-length wording for the field. Values are NOT trimmed in the returned value beyond what `buildContactSubmissionDoc` already does.
- Cap rationale: 254 is the RFC 5321 maximum address length; 100 for a personal name and 200 for a subject line are generous for real input while stopping log/DB/email-payload bloat; 5000 is the cap the route already had for message.
- `app/api/vendors/apply/route.ts`: same limiter and honeypot. `validateVendorApplicationInput` already has typeof and length handling (`FIELD_MAX_LENGTHS`); dev must confirm every field there is typeof-guarded and add anything missing, and must not change the vendor form copy. A non-object body is a 400.

## M2 client IP

Every route that keys a limiter on the client address uses `clientIpFromForwardedFor` (second-to-last hop). Routes: vendors/register, vendors/register/verify-code, vendors/[id]/proof-of-payment, vendors/[id]/marketing-asset. Fixture `xff-cases.json` includes spoofed first hops. Within `app/`, no line mentioning `x-forwarded-for` may lack `clientIpFromForwardedFor` (the `x-forwarded-host` reads are untouched). `lib/payfast.ts getClientIp` and `lib/payments/ozow.ts getOzowClientIp` already take the second-to-last hop for the ITN allow-list and are out of scope here; deduplicating them onto the helper is a follow-up.

## M3 events/submit

Order: bearer token -> `getAuth().verifyIdToken(token, true)` (revocation checked) -> `isVerifiedSubmitter(decoded)` (true only when `decoded.email_verified === true`; otherwise 403 `{ error: 'Email not verified' }`; bad token stays 401) -> per-uid rate limit -> parse -> `validateEventSubmission` -> `hostSocietyExists`.
New `lib/event-submission-guard.ts` exports:
- `EVENT_FIELD_MAX_LENGTHS = { title: 150, venue: 150, location: 150, description: 5000, hostSocietyId: 64 }`.
- `validateEventSubmission(raw: unknown, now: Date): { ok: true } | { ok: false; error: string; field: string }`: all fields typeof string (endDate/hostSocietyId optional), the existing rules (title required, kind in the allowed list, date a valid ISO future date, endDate not before date, venue/location required, description 20..5000), plus the caps. Same error strings as today for the existing rules.
- `isVerifiedSubmitter(decoded: { email_verified?: unknown }): boolean`.
- `hostSocietyExists(id: string, lookup: (id: string) => Promise<boolean>): Promise<boolean>`: false for empty id, false when lookup resolves false OR throws (fail closed), true only when lookup resolves true.
The route supplies a lookup backed by the Sanity client with a parameterised query `count(*[_type == "society" && _id == $id]) > 0` and `{ id }` params (never string interpolation). Verify the document type name against `sanity/schemas` before use. An unknown society returns 400 `{ error: 'Unknown host society', field: 'hostSocietyId' }`. When `hostSocietyId` is omitted the lookup is not called. Rate limit: key `event-submit:${uid}`, same constants.

## M5 uploads

- New `lib/request-guards.ts` also exports `base64BodyLimitBytes(maxDecodedBytes: number): number = Math.ceil(maxDecodedBytes / 3) * 4 + 16384` (base64 expansion plus a 16 KiB allowance for the JSON envelope: fileName, mimeType, sizeBytes) and `isBodyWithinLimit(contentLength: string | null, maxBytes: number): boolean`, false when the header is null, empty, non-numeric, non-integer, negative, or above `maxBytes`; true for 0..maxBytes.
- For 5 MiB (`PROOF_OF_PAYMENT_MAX_BYTES` / `MARKETING_ASSET_MAX_BYTES`) the limit is 7_006_892 bytes. Both routes derive it from their existing constant and answer 413 `{ error: 'Request body too large.' }` BEFORE `request.json()`, and also when Content-Length is missing.
- New `lib/upload-sniff.ts`: `sniffFileType(bytes: Uint8Array): 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | null` (PDF `%PDF-` at 0; JPEG `FF D8 FF`; PNG `89 50 4E 47 0D 0A 1A 0A`; WebP `RIFF` at 0 and `WEBP` at 8; anything shorter or else null) and `matchesDeclaredMime(bytes, mime): boolean` (true only when the sniffed type equals `mime`). Pure, no I/O.
- `lib/vendor-proof-of-payment-handler.ts` and `lib/vendor-marketing-upload-handler.ts` call `matchesDeclaredMime` on the decoded bytes, after the existing size checks and before any storage write. A mismatch is 400 `{ error: 'File content does not match the declared type.' }`. Existing responses are unchanged otherwise.
- Known limit, not changed here: the upload routes stay public and unauthenticated (the capability model is untouched). Anyone with a submission id can upload against it; the sniff only stops a mislabelled file, not an abusive caller.

## M6 CSV

New `lib/csv-field.ts` exports `csvField(value: string): string`, moved verbatim from `lib/newsletter.ts` (formula leaders `= + - @ TAB CR` get a leading single quote, then a field containing `"`, `,`, CR or LF is double-quoted with inner quotes doubled). `lib/newsletter.ts` imports it and no longer defines it; `app/api/admin/export-csv/route.ts` deletes `escapeField` and uses `csvField`. Newsletter CSV output stays byte-identical. See `csv-cases.json`.

## L1 constant-time compares

`lib/recovery-token.ts` gains `constantTimeStringEqual(a: string, b: string): boolean` = `constantTimeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))`: equal strings true, different strings false, different lengths false without throwing. Used at: `lib/payments/ozow.ts` (the `!== receivedHash` hash compare), `lib/payments/payfast.ts` (the `!== receivedSignature` compare), `app/api/revalidate/route.ts` and `app/api/draft/route.ts` (secret compares; `provided`/`secret` may be null so null stays "no match"). Comparison-only: in `lib/payments/*.ts` the diff may remove only the two compare lines and add the import and the replacement, nothing else; compare semantics stay case-sensitive. `TICKETING_PAYMENTS_LIVE` stays `false`.

## L2 / L3

- `app/api/draft/route.ts`: `redirect(safeNextPath(searchParams.get('slug'), '/'))`. `https://evil.example`, `//evil.example`, `\evil` and control characters all fall back to `/`. The shared secret and the GET-based disable-draft are left as they are (README follow-ups).
- `app/api/admin/session/route.ts`: `request.json()` inside try/catch; a bad or non-object body returns 400 `{ error: 'Invalid request body' }`, never 500. The existing `idToken` 400 is unchanged.

## Rules files

Commit `firestore.rules` and `storage.rules` equal to `firestore.rules.golden` / `storage.rules.golden` (deny-all; the Firestore one is what is deployed today). `firebase.json` is NOT edited: it does not reference them yet. Deploying rules is a separate step that needs Brad's approval.

## docs/security-hardening.md (the PR README)

Must contain: what changed per finding, the caps with the justifications above, the honeypot behaviour, the known limits (per-instance limiter, public upload capability model, shared draft secret, GET disable-draft), the note that `firebase.json` does not reference the rules files, and a heading `## Out of scope` listing: Next bump (another PR), CSP enforce flip, Cloud Armor rate limit, admin self-signup, checkout stock-holding (L5), boothSize vs allocation (L6), L4 capability checks, and deduplicating the payfast/ozow IP helpers.

## Triad

No new email is sent, so `gws_inbox_check` is declared non-required (InunuNet/Athanor#1467). The deployed-site browser check is `required: false` for the same reason (no page changed); the rules are not deployed.
