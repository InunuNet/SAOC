# Vendor Gated Registration Flow — M1 Checkpoint

**Contract:** `contracts/contract-vendor-gated-registration-flow.yaml` — M1 feature specs, constraints, and decision record. Full architectural reasoning, the two documented voice-note vs. written-doc contradictions, and what is deliberately out of scope: `contracts/golden/vendor-gated-registration-flow-f1/README.md`.

**Status:** M1 gated (11/11), QA-passed (re-verify), Codex GPT-5.5 cross-model-passed.

---

## Overview: Inverting the Registration Flow

The vendor registration flow was previously public-first: a vendor filled the full ~90-field registration form at `/national-show/vendors/register`, submitted to the database, and then underwent committee review. This is now inverted.

**New flow (M1):**

1. **Vendor Application** — public, short form at `/national-show/vendors/apply` (7 fields only)
2. **Committee Review** — admin staff review applications at `/admin/vendors/applications` (gated capability: `review-vendor-applications`)
3. **Approval Email** — if approved, a single-use token is issued and emailed
4. **Full Registration** — vendor accesses `/national-show/vendors/register` ONLY with a valid, unconsumed token
5. **Submission** — the full form submits to `vendorSubmissions` collection (unchanged from pre-M1)
6. **Payment** — M3 scope; stand booking fee, explicitly separate from ticket purchases

**Key structural change:** `vendorApplications` is a **new, separate Firestore collection**, not a status on `vendorSubmissions`. The two are permanently distinct entities. A vendor first creates an application, later (on approval) creates a submission. This separation is intentional and load-bearing.

---

## Firestore Collections

| Collection | Purpose | Schema |
|-----------|---------|--------|
| `vendorApplications` | Short public application stage (NEW, M1) | See [VendorApplication](#vendorapplication-shape) below |
| `vendorSubmissions` | Full registration form after approval (existing, now gated) | See `docs/vendor-registration.md`'s VendorSubmission |

---

## VendorApplication Shape

Each document in `vendorApplications` carries these fields (from `types/index.ts`):

**Submitter-supplied** (never system-set):
- `businessName: string` (required, max 200 chars)
- `tradingName?: string` (optional, max 200 chars)
- `contactPersonName: string` (required, max 150 chars)
- `contactEmail: string` (required, max 254 chars, email format validated)
- `contactCellPhone: string` (required, max 30 chars, phone format validated)
- `vendorCategory: VendorApplicationCategory[]` (required, non-empty; see [Categories](#vendor-categories-14-items) below)
- `indicativeBoothCount: number` (required, positive integer; "rough figure only" per the 26 Aug source doc)

**System-owned** (forced by `buildVendorApplication()`, never read from submitter input):
- `id: string` — Firestore document ID (auto-assigned)
- `status: VendorApplicationStatus` — `'pending'` on creation, later `'approved'` or `'declined'` by admin review
- `submittedAt: Timestamp` — UTC timestamp of application submit
- `reviewedBy?: string` — email of the admin who reviewed it (set on approve/decline)
- `reviewedAt?: Timestamp` — UTC timestamp of review decision
- `registrationTokenIssuedAt?: Timestamp` — UTC timestamp when the single-use token was minted (approval-only)
- `registrationTokenExpiresAt?: Timestamp` — UTC timestamp when that token expires (14 days default; see [Token TTL](#token-ttl-constants) below)
- `registrationTokenConsumedAt?: Timestamp` — UTC timestamp when the vendor successfully claimed the token by submitting the full form (or `null` if never claimed)

### Vendor Categories (14 items)

The application form uses a NEW 14-item category list (superseding the old 11-item `VENDOR_CATEGORIES` on `vendorSubmissions`, which is retained for backward compatibility but is STALE). The 14 items are sourced verbatim from the 26 Aug source doc's "VENDOR CATEGORY & PRODUCTS" section, in document order, with NO 'other' member:

1. orchids
2. cites-listed-plants
3. indoor-plants
4. succulents
5. rare-plants
6. exotic-plants
7. indigenous-plants
8. orchid-growing-supplies
9. greenhouse-hardware-infrastructure
10. fertilisers-growing-media
11. books-publications
12. art
13. ceramics
14. food-beverage-retailer

This list is defined in `lib/vendor-applications.ts` as `VENDOR_APPLICATION_CATEGORIES`, separate from the legacy `VENDOR_CATEGORIES` in `lib/vendor-submissions.ts` to prevent any regression against the old 11-item enum.

---

## Public Application Route — `POST /api/vendors/apply`

**Endpoint:** `app/api/vendors/apply/route.ts` (public, unauthenticated)

**Request body:**
```json
{
  "businessName": "Orchids Inc.",
  "tradingName": "OrchidsRUs",
  "contactPersonName": "Jane Doe",
  "contactEmail": "jane@example.com",
  "contactCellPhone": "+27 21 555 1234",
  "vendorCategory": ["orchids", "rare-plants"],
  "indicativeBoothCount": 2
}
```

**Validation:** Enforced by `validateVendorApplicationInput()` (from `lib/vendor-applications.ts`):
- All required fields present and non-empty
- String fields respect `maxLength` limits
- Email format matches `EMAIL_PATTERN`
- Phone format matches `PHONE_PATTERN`
- `vendorCategory` is a non-empty array with valid items only
- `indicativeBoothCount` is a positive integer

**Responses:**

| Status | Body | Meaning |
|--------|------|---------|
| 201 | `{ success: true, id: "abc123" }` | Application created; ID is a reference for the vendor |
| 400 | `{ error: "Invalid vendor application submission.", fieldErrors: [...] }` | Validation failed; returns array of field-error strings |
| 500 | `{ error: "Failed to save vendor application. Please try again." }` | Firestore write failed |

**Invariants:**
- `status` is always forced to `'pending'` on write, never accepting caller-supplied `'approved'` or `'declined'`
- No confirmation email is sent on application submit (M1 scope)
- No rate limiting on application submit (known M2 follow-up)
- `submittedAt` is always set to server-side `now`, never accepting a caller-supplied timestamp

---

## Admin Review Interface — `/admin/vendors/applications`

**Endpoint:** `app/admin/vendors/applications/page.tsx` (gated, capability: `review-vendor-applications`)

**UI:** Displays a table of all vendor applications with columns for:
- Business name
- Contact person
- Vendor category(ies)
- Current status (`pending` / `approved` / `declined`)
- Submitted date
- Review decision date (if reviewed)
- Action button (depends on status; see below)

**Table is read-only** — no inline status edits. Each action is a POST to the review endpoint (see below).

### Status Transitions

A strict state machine enforces valid transitions (all checked by `decideVendorApplicationTransition()` in `lib/vendor-application-review.ts`):

| From | To | Action | Allowed? |
|------|----|----|----------|
| `pending` | `approved` | POST with `action: 'approve'` | ✓ Yes |
| `pending` | `declined` | POST with `action: 'decline'` | ✓ Yes |
| `approved` | anything | (any action) | ✗ No (409) |
| `declined` | anything | (any action) | ✗ No (409) |
| `pending` | `pending` | (any action) | ✗ No (409) |

An attempt to transition outside these rules returns HTTP 409 (conflict) with error text.

---

## Admin Review Action — `POST /api/admin/vendors/applications/[id]/review`

**Endpoint:** `app/api/admin/vendors/applications/[id]/review/route.ts` (gated, capability: `review-vendor-applications`)

**Request body:**
```json
{ "action": "approve" }
// or
{ "action": "decline" }
```

### On Approval

1. **Validate transition:** Application must be `'pending'` (409 if not)
2. **Mint token:** `VENDOR_REGISTRATION_TOKEN_SECRET` env var is read; if unset, return 503 and leave application `pending` (fail-closed, operator-recoverable)
3. **Token generation:** A single-use HMAC token is minted with 14-day default TTL via `mintVendorRegistrationToken()`
4. **Write patch:** One atomic `update()` writes **all five approval fields** together:
   - `status: 'approved'`
   - `reviewedBy: string` (the approver's email)
   - `reviewedAt: Timestamp` (server-side now)
   - `registrationTokenIssuedAt: Timestamp` (server-side now)
   - `registrationTokenExpiresAt: Timestamp` (14 days from now, or custom TTL)
5. **Send email:** After the write succeeds, an approval confirmation email is sent (async, non-blocking; see [Approval Email](#approval-email-content) below)
6. **Response:** HTTP 200 with `{ success: true, status: 'approved' }`

**Critical invariant:** Token is minted BEFORE any Firestore write. If token minting fails, the application stays `pending` and is recoverable. An approved-but-no-token-issued state is impossible.

### On Decline

1. **Validate transition:** Application must be `'pending'` (409 if not)
2. **Write patch:** One atomic `update()` writes only three decline fields:
   - `status: 'declined'`
   - `reviewedBy: string` (the decliner's email)
   - `reviewedAt: Timestamp` (server-side now)
3. **No email:** Decline notification email is M2 scope; M1 does nothing (the vendor has no token to follow)
4. **Response:** HTTP 200 with `{ success: true, status: 'declined' }`

### Error Responses

| Status | Meaning |
|--------|---------|
| 401 | No admin session or session invalid |
| 403 | Session valid but caller lacks `review-vendor-applications` capability |
| 404 | Application ID does not exist |
| 409 | Invalid status transition (already approved/declined, or trying to approve an already-approved application) |
| 500 | Firestore write failed |
| 503 | Approval was requested but `VENDOR_REGISTRATION_TOKEN_SECRET` is unset (application left `pending`, operator-recoverable) |

---

## Approval Email

**Sent on:** Successful approval action only (not on decline)

**Recipients:** Vendor's `contactEmail` from the application

**Content:** Confirmation that the application was approved, plus a registration link containing the single-use token. Example:

```
Subject: Your SAOC National Show Vendor Application — Approved

Dear [contactPersonName],

Your vendor application for the 2027 SAOC National Show has been approved!

Please proceed with your full vendor registration using the link below. This link is unique to your business and expires in 14 days.

[Registration Link]

Business: [businessName]
Contact: [contactPersonName]

If you have any questions, please contact...
```

**Fallback for missing data:** If a field like `businessName` or `contactPersonName` is missing (should not happen in production), the email renders a fallback label (never the literal string "undefined").

**Email failure:** If Resend delivery fails, the error is logged but the approval is NOT rolled back. The status transition to `approved` commits regardless. This is intentional: the application is safely approved server-side; email is best-effort. The vendor can still use the token if they retrieve it via a resend flow (M2 scope).

---

## Token Mechanism

### Token Format and Generation

Tokens are signed HMACs with an embedded payload, structurally identical to the existing order-recovery token in `lib/recovery-token.ts`, but in a **separate trust domain** with its own secret.

**Token shape:** `${base64url(JSON.stringify({a: applicationId, e: expiresAtEpochMs}))}.${hmacSha256Hex}`

**Key points:**
- Payload key `a` (not `o`, which is used by order-recovery tokens) gives structural domain separation: a token minted by either module will fail to parse under the other module's expected shape, preventing accidental cross-domain token acceptance.
- Signature is SHA256-HMAC of the payload segment, hex-encoded.
- **ZERO authorization meaning** beyond "this applicationId's token is cryptographically valid and has not expired yet." The token itself confers no access to any resource. Every use site re-validates the underlying application state (approved status, unconsumed, etc.) before acting.
- Stateless by design: a replayable HMAC cannot be single-use by format alone. Single-use is enforced separately, via a Firestore `registrationTokenConsumedAt` timestamp (see below).

### Token Minting

**Function:** `mintVendorRegistrationToken()` from `lib/vendor-registration-token.ts`

**Input:**
- `applicationId: string` — the vendor application's document ID
- `secret: string` — `VENDOR_REGISTRATION_TOKEN_SECRET` env var value
- `now: Date` — current server time (injected, never read from `Date.now()` inside the function)
- `ttlMs?: number` — optional custom TTL; defaults to `VENDOR_REGISTRATION_TOKEN_DEFAULT_TTL_MS` (14 days = 1000 * 60 * 60 * 24 * 14 ms)

**Output:**
```ts
{
  token: string;
  expiresAt: Date; // now + ttlMs
}
```

### Token Verification

**Function:** `verifyVendorRegistrationToken()` from `lib/vendor-registration-token.ts`

**Input:**
- `token: string` — the token to verify
- `secret: string` — must match the secret used to mint it
- `now: Date` — current server time

**Output:** One of:
```ts
{ ok: true; applicationId: string; expiresAt: Date }
{ ok: false; reason: 'malformed' | 'bad-signature' | 'expired' }
```

**Malformed:** Covers any parsing failure (missing `.` separator, invalid base64, invalid JSON, missing/wrong keys, expiry not numeric, etc.). Never throws; all parse failures funnel into a single `'malformed'` reason.

**Bad signature:** Signature does not match the expected HMAC, or buffer-decode failed.

**Expired:** Current `now` is >= the token's expiry time (inclusive: a token that expired 1 millisecond ago is expired).

### Token TTL Constants

**`VENDOR_REGISTRATION_TOKEN_DEFAULT_TTL_MS`** from `lib/vendor-registration-token.ts`:
```ts
export const VENDOR_REGISTRATION_TOKEN_DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 14;
// 14 days in milliseconds
```

This is a **provisional engineering default, not a Council-approved figure**. It can be overridden per-mint via the `ttlMs` parameter, or globally by changing this constant. Any change should be documented with the Council's rationale.

### Single-Use Enforcement

**Single-use is NOT a property of the token format.** A stateless HMAC is replayable by construction. Single-use is enforced by Firestore application state:

1. **Claim:** Before a vendor can use a token to register, the application's `registrationTokenConsumedAt` field is set to a timestamp, **inside an atomic Firestore transaction** (see [Atomic Token Claim](#atomic-token-claim) below).
2. **Atomicity:** The read-check-write all happen in one transaction, so exactly one caller can win. Concurrent POSTs bearing the same valid token: the first to reach the transaction wins and sets `registrationTokenConsumedAt`; the loser's transaction reads the already-consumed state and fails before any write, returning HTTP 403.
3. **Release on failure:** If the registration form validation or write then fails, the claim is **released** back to `null` so a legitimate vendor can correct and retry without burning the token (see [Claim Release](#claim-release) below).

---

## Atomic Token Claim

**Module:** `lib/vendor-registration-token-claim.ts`

**Function:** `claimRegistrationToken()`

**Purpose:** Atomically claims a token so exactly one submission can use it. Called from `POST /api/vendors/register` BEFORE the actual registration form is processed.

**How it works:**
1. Opens a Firestore transaction via `db.runTransaction()`
2. Inside the transaction, reads the `vendorApplications/{id}` document
3. **Re-checks** (inside the transaction):
   - Document exists
   - `status === 'approved'`
   - `registrationTokenConsumedAt` is falsy (not yet consumed)
4. If all checks pass, writes `registrationTokenConsumedAt` to the claimed timestamp
5. Transaction commits atomically
6. Returns `true` for the single winner; `false` for every loser and every ineligible application

**Failure modes:**
- Application does not exist → `false`
- Application status is not `'approved'` → `false` (not yet approved, or already declined)
- Token already consumed → `false` (another vendor already registered with this link)
- Transaction itself fails (network, Firestore outage) → `false`, and the error is reported via `onError` callback

**Important:** The transaction is opened and closed here, NOT extended to wrap the registration form processing. Firestore transactions cannot be nested, and a transaction callback may be retried; wrapping the long, potentially retry-unsafe form submission would risk the submission being written multiple times. The transaction is narrow and cheap: read + check + single-field update, all on one document.

---

## Claim Release

**Function:** `releaseRegistrationTokenClaim()`

**Purpose:** Releases a claim when the registration form submission fails, so the vendor can correct and retry.

**How it works:**
1. Sets `registrationTokenConsumedAt` back to `null`
2. Never throws; errors are silently reported via optional `onError` callback
3. Returns `Promise<void>`

**When it's called:**
- Registration form validation fails (400)
- Rate limit is hit (429)
- Firestore write fails (500)

The claim is released BEFORE returning the error response to the vendor, so they can immediately retry the same link if they choose.

**Residual window:** Process death between claim and release leaves the token consumed. The vendor's link is burned, and an operator must manually reset it (`registrationTokenConsumedAt: null` in Firestore console). This is fail-closed (safer than a replayable token) and operator-recoverable.

---

## Gated Registration Form — `/national-show/vendors/register`

**Endpoint:** `app/(marketing)/national-show/vendors/register/page.tsx` and `app/api/vendors/register/route.ts`

### Page-Level Token Verification

The page (`page.tsx`) reads the `token` query parameter from the URL (e.g. `/national-show/vendors/register?token=...`) and verifies it client-side via `verifyVendorRegistrationToken()`. If the token is missing, expired, or malformed, the form does not render. Instead, a message is displayed: "This registration link is no longer valid."

This client-side check is a UX gate only — it does **not** authorize the submission.

### Route-Level Token Verification

The API route (`app/api/vendors/register/route.ts`) **re-verifies the token server-side** before accepting the submission. It never trusts the page-level check.

**Re-verification steps:**
1. Extract `token` from the request body JSON (optional field when coming from the form)
2. Verify the token via `verifyVendorRegistrationToken()`
3. If invalid (missing, expired, malformed), return HTTP 403 with a generic message (never distinguishing the failure reason)
4. If valid, extract the `applicationId` from the verified token
5. Proceed to [Atomic Token Claim](#atomic-token-claim)

**Generic 403 message:** "This registration link is no longer valid." Every failure mode — missing token, bad signature, expired, application not found, wrong status, already consumed — returns this same message. This prevents an attacker from enumerating the system state.

### Full Registration Form Processing

Once the token is verified and claimed, the form submission follows the existing F5 flow (unchanged from pre-M1):

1. Parse and validate the full registration payload (31 fields)
2. Check rate limit (IP-based)
3. Build a `vendorSubmissions` document
4. Write to Firestore
5. Send confirmation email (async, non-blocking; email failure is non-fatal)
6. Return HTTP 201 with `{ success: true, id: "..." }`

All existing F5 invariants still hold: write-before-email, rate-limit-shields-write, zero authorization meaning (successful response does not grant approval; submission status is `'submitted'`), no PII in logs.

---

## Environment Variables

### VENDOR_REGISTRATION_TOKEN_SECRET

**Name:** `VENDOR_REGISTRATION_TOKEN_SECRET`

**Purpose:** HMAC secret for signing and verifying vendor application approval tokens

**Type:** String; no format constraints (arbitrary bytes are fine)

**When it's read:**
- `app/api/admin/vendors/applications/[id]/review/route.ts` reads it when an approval action is attempted
- `app/api/vendors/register/route.ts` does NOT read it; only verification uses the secret, and verification happens on the client/page side

**If unset:**
- Approvals fail with HTTP 503 and the application stays `pending`
- Error message: "Cannot approve: VENDOR_REGISTRATION_TOKEN_SECRET is not configured, so no registration link can be issued. The application is unchanged and still pending."
- This is intentional fail-closed behavior: an operator must set the secret before any approvals can succeed
- Known M2 follow-up: a resend-approval flow so an operator can retry an approval without user intervention

**If modified (e.g., secret rotated):**
- All tokens minted with the old secret become unverifiable (new secret won't produce matching signatures)
- Existing `registrationTokenExpiresAt` values on applications are unaffected, but the links are invalid
- Vendors cannot register until new tokens are issued
- This is operator-recoverable via re-approval

**Never shared with other secrets:**
- Different secret from `RECOVERY_TOKEN_SECRET` (order recovery tokens)
- Deliberately separate trust domains, even though both are HMAC tokens
- Mixing or sharing secrets is not just architecturally unsound; it would violate the cryptographic domain separation designed into the token formats

---

## Known Open Issues and Residual Windows

### Two Documented Contradictions

These are flagged in the contract's golden README and must be resolved in M2:

1. **Cancellation policy:** Lee-Ann's 26 Aug voice note (verbal) says "vendors sign up ≥2 months out with no refund on cancellation." Her written T&Cs in the same 26 Aug source document say **"90 days"** (stated twice). The written document is what vendors sign, and the 90-day figure is binding. The voice note and written doc contradict; the engineer must not invent a third number.

2. **Electrical outlets and other equipment charges:** The voice note says "electrical outlets etc. carry no extra charge." The written source document lists specific items (tables, chairs, electrical outlets) with prices in rand, but **the rand figure is left blank** ("R….." placeholder). No invented figure has been added to match Lee-Ann's voice note; M2 scope must resolve this with the Council before pricing is finalized. See `lib/provisional-figures.ts`'s flagged-provisional pattern for how to block any build against unconfirmed numbers.

Both are recorded in project memory and in the contract. Do not resolve them in M1; they are M2 follow-up items and likely require Council discussion.

### Residual Windows (Fail-Closed, Operator-Recoverable)

Two narrow failure modes exist between token claim and claim release, where a token can be left consumed despite the subsequent submission failing:

1. **Process death between claim and release:** If the server process dies after `claimRegistrationToken()` returns `true` but before `releaseRegistrationTokenClaim()` is called, the token remains consumed. The vendor's link is burned. Recovery: an operator manually resets `registrationTokenConsumedAt` to `null` in Firestore and the vendor can retry.

2. **Ambiguous network failure after write commits:** If the registration form submission write completes server-side and a response is generated, but the network drops before the client receives it, the response may never land. The client retries the same token: the claim is already consumed (different network path), so the retry fails with 403. The submission was written (idempotency key matching prevents a second write). Recovery: an operator or vendor support flow must acknowledge the first submission succeeded and issue a resend link / new token if the original link is burned.

Both windows are extremely narrow and fail-closed (no data loss, no ghost submissions). They are operator-recoverable and acceptable for M1. Eliminating them entirely would require distributed consensus and is deferred to M3+ if ever needed.

---

## Source of Truth for Application Form Fields

The canonical specification for the short application form's 7 fields:

- **Business name** (required)
- **Trading name** (optional)
- **Contact person name** (required)
- **Contact email** (required)
- **Contact cell phone** (required)
- **Vendor category** (required, multi-select from 14-item list)
- **Indicative booth count** (required, positive integer)

This matches the contract's F1 design and is implemented in `lib/vendor-applications.ts` and `types/index.ts`. Do not add or remove fields from this list without reviewing the contract and the [Categorization](#vendor-categories-14-items) changes.

---

## Source of Truth for Full Registration Form Fields

**The 26 Aug source doc now supersedes the 25 Aug snapshot.** File location: `docs/leeann-source/2027-vendor-registration-form_2026-08-26.md`.

M1 does NOT touch the full registration form's field set; it only adds a gate in front of it. The 31-field form shipped pre-M1 is stale (it was built from an older document with only 5-6 sections vs. the real 18 sections and ~90 fields).

M2 scope is to rebuild the full form against the 26 Aug source doc, section by section, field by field. Until M2 ships, the form is behind the gate but not yet correct.

---

## CLAUDE.md Updates Required

The following sections in `CLAUDE.md` are now outdated and must be updated:

### App Structure Section

**Current (pre-M1):**
```
│   ├── national-show/     # Show overview + upcoming + archive/[year] + vendors showcase + vendors register form
```

**Should be (M1-updated):**
```
│   ├── national-show/     # Show overview + upcoming + archive/[year] + vendors showcase
│   │   ├── vendors/       # Vendor showcase page (public) + application form (public) + registration form (gated by token)
```

**Current:**
```
├── admin/                # Firebase Auth-gated admin (login, door check-in scanner, vendor review)
│   └── vendors/           # Vendor application review workflow (capability-gated: review-vendor-applications)
```

**Should be (M1-updated):**
```
├── admin/                # Firebase Auth-gated admin (login, door check-in scanner, vendor review)
│   └── vendors/           # Vendor management (reviews applications + manages full submissions)
│       ├── applications/  # Vendor applications (short form, gated: review-vendor-applications)
│       └── [default]      # Vendor submissions (full form, gated: review-vendor-applications)
```

**Current:**
```
│   ├── vendors/            # Vendor registration submission → Firestore `vendorSubmissions` (F5); proof-of-payment upload (F7)
```

**Should be (M1-updated):**
```
│   ├── vendors/            # Vendor application submission (short form) → Firestore `vendorApplications` (F1); full registration submission → Firestore `vendorSubmissions` (gated by F7 token)
```

### Collections Table

**Add a new row:**

| Collection | Purpose |
|-----------|---------|
| `vendorApplications` | Short vendor application stage (M1); status: pending/approved/declined. Single-use registration tokens are issued on approval and claimed on full-form submission. See [docs/vendor-gated-registration-flow.md](docs/vendor-gated-registration-flow.md) |

---

## Files Created/Modified (M1)

**New:**
- `lib/vendor-applications.ts` — application validation and building
- `lib/vendor-application-review.ts` — status transition logic
- `lib/vendor-registration-token.ts` — HMAC token mint/verify
- `lib/vendor-registration-token-claim.ts` — atomic single-use claim
- `lib/vendor-approval-confirmation.ts` — approval email template
- `app/(marketing)/national-show/vendors/apply/page.tsx` — public short form UI
- `app/api/vendors/apply/route.ts` — short form POST handler
- `app/admin/vendors/applications/page.tsx` — admin review listing
- `app/api/admin/vendors/applications/[id]/review/route.ts` — admin approval/decline action
- `emails/VendorApprovalConfirmation.tsx` — approval email template
- `types/index.ts` — new `VendorApplication*` types (additive-only)

**Modified:**
- `app/api/vendors/register/route.ts` — now gated by token claim and release
- `app/(marketing)/national-show/vendors/register/page.tsx` — now reads and validates token from URL
- `app/admin/vendors/layout.tsx` — routes subtree gate unchanged
- `app/admin/vendors/page.tsx` — unchanged; existing submission review
- `.env.local.example` — added `VENDOR_REGISTRATION_TOKEN_SECRET`

---

## Files NOT Changed (M1 Scope)

The following files are intentionally unchanged in M1. They are pre-M2 work:

- Full registration form field set (still 31 fields, from the old source doc; M2 will rebuild to ~90 fields)
- Vendor category enum on `VendorSubmission` (old 11 items; application uses new 14-item list; form change is M2)
- Stand booking payment API (M3 scope)
- Decline notification email (M2 scope)
- Resend-approval flow for burned tokens (M2 scope)
- Rate limiting on application submit (M2 scope)
- Cross-instance rate limiting for full registration (documented as unsolved; M3+ scope)

---

## Testing Notes

For detailed test cases, run assertions in `contracts/golden/vendor-gated-registration-flow-f1/README.md`.

**Key manual QA checkpoints:**
- Short application form submits to `vendorApplications` collection with `status: 'pending'`
- Admin can approve; token is minted, issued at, expires at timestamps are written, approval email is sent
- Admin can decline; no token, no email
- Approval email contains a link to `/national-show/vendors/register?token=...`
- Following the link on a new browser loads the registration form (token validates client-side)
- Submitting the registration form re-validates the token server-side and claims it atomically
- Concurrent submissions with the same token: one wins (claim succeeds), the other fails with 403
- Registration form validation errors release the claim so a retry is possible
- Expired tokens (past 14 days) are rejected with 403
- Tampered tokens (modified signature) are rejected with 403
- Submitting without a token returns 403

---

## M2: Full Registration Form Corrections

M2 (features F13-F21, gated and passed) corrects the full registration form against the 26 Aug source document. The application form (M1's short 7-field form) is unchanged.

### Field Set Changes

**New fields (F14):**

**Online Presence** — replaces the single deprecated `socialMediaHandle` field:
- `facebookHandle?: string`
- `instagramHandle?: string`
- `tiktokHandle?: string` (source document spelled this "Ticktok"; UI corrects to "TikTok")
- `youtubeHandle?: string`
- `otherSocialMediaHandle?: string`

**Booth Sizing** — replaces deprecated numeric `boothCount` field:
- `boothSize?: 'single' | 'double' | 'triple'` (required on submission; UI renders radio group with exact labels "Single Booth – 2.5m x 3m", "2 Booths (Double) – 5m x 3m", "3 Booths (Triple) – 7m x 3m")

**Electrical Equipment** — replaces deprecated `electricalLoad` / `electricalEquipmentList` / `electricalEquipmentContinuousOperation` / `electricalEquipmentContinuousDetails`:
- `electricalEquipmentEntries?: Array<{ equipment: string; quantity: number; wattage: string; runningTimePerDay: string }>` (repeating-row UI; max 20 rows; all row fields required when a row exists)

**Gas Equipment** — replaces deprecated `gasEquipmentType` / `gasFuelType` / `gasCylinderSize` / `gasCylinderCount`:
- `gasEquipmentEntries?: Array<{ equipmentType: string; gasType: string; cylinderSize: string; cylinderCount: number }>` (repeating-row UI; max 20 rows; gated to food retailers only; all row fields required when a row exists)

**Vehicle Registrations** — replaces deprecated `vehicleType` / `vehicleTypeOther` / `vehicleRegistrations` / `vehicleHeight` / `vehicleLength` / `trailerAttached`:
- `carRegistrationNumber?: string`
- `suvBakkieRegistrationNumber?: string`
- `panelVanRegistrationNumber?: string`
- `deliveryVanRegistrationNumber?: string`
- `truckRegistrationNumber?: string`
- `trailerRegistrationNumber?: string`
- `otherVehicleRegistrationNumber?: string`
- `otherVehicleDescription?: string` (paired with otherVehicleRegistrationNumber)

**Insurance Policy Numbers** — new optional fields alongside existing insurance status fields:
- `publicLiabilityInsurancePolicyNumber?: string`
- `productLiabilityInsurancePolicyNumber?: string`

**Food Vendor Certifications** — replaces deprecated `foodPreparationOnSite` / `foodCookingOnSite`:
- `foodVendorCertifications?: ('mobile-coa' | 'perishable-foodstuff-licence' | 'hawker-informal-trading-permit' | 'mobile-gas-compliance-certificate' | 'fire-safety-compliance' | 'vehicle-fitness-certificate')[]` (checklist; gated to food retailers)

**Marketing Assets** — new file-upload fields:
- `logoPath?: string | null` (optional image upload)
- `logoUploadedAt?: Date | null`
- `productPhoto1Path?: string | null`, `productPhoto2Path?: string | null`, `productPhoto3Path?: string | null` (three discrete upload slots; all optional on the submission model; source document requires 3 product photos, disclosed to vendor on success page and tracked for admin review, but not machine-enforced)
- `productPhoto1UploadedAt?: Date | null`, `productPhoto2UploadedAt?: Date | null`, `productPhoto3UploadedAt?: Date | null`
- `marketingPermission?: 'full' | 'listing-only'` (radio group; optional)

**Signature Block** — new field for T&Cs acceptance:
- `signatureFullName?: string` (free-text field, not Position or Business Name, which are read-only from existing fields)

**Bio Constraints (F15)** — existing `bio` field gains word-count validation:
- `bio?: string` now must be 150–200 words (counted as whitespace-separated runs, not characters) if supplied; omitting is still valid

### Deprecated-in-Place Fields (Still Present, Not Rendered)

Every field superseded by an M2 field shape change **remains in the `VendorSubmission` type** as optional and unchanged in type — nothing is deleted. These fields are present for backward compatibility with pre-M2 documents but are no longer used by the form:

- `boothCount` (superseded by `boothSize`)
- `electricalLoad`, `electricalEquipmentList`, `electricalEquipmentContinuousOperation`, `electricalEquipmentContinuousDetails` (superseded by `electricalEquipmentEntries`)
- `gasEquipmentType`, `gasFuelType`, `gasCylinderSize`, `gasCylinderCount` (superseded by `gasEquipmentEntries`)
- `vehicleType`, `vehicleTypeOther`, `vehicleRegistrations`, `vehicleHeight`, `vehicleLength`, `trailerAttached` (superseded by 7 discrete vehicle fields)
- `socialMediaHandle` (superseded by 5 platform-specific handles)
- `sellsLivePlants`, `livePlantTypes`, `livePlantTypesOther`, `plantsImportedForEvent`, `importCountryOfOrigin` (dropped by source document entirely)
- `foodPreparationOnSite`, `foodCookingOnSite` (superseded by `foodVendorCertifications`)
- `vendorCategoryOther` (superseded by F13's corrected 14-item category list; now deprecated-in-place, not removed)

**Why deprecate-in-place, not delete?**

1. `app/admin/vendors/page.tsx` (the submission review UI) must still render pre-M2 documents from testing/early approvals without crashing. Deleting a field from the type would break TypeScript.
2. Firestore writes are safer on deploy if the type still accepts old documents. A pre-M2 submission read from Firestore cannot fail to deserialize.
3. Migration is zero-cost: the old fields are simply not populated by the new form, and they may be silently retained on pre-M2 documents that predate this feature.

Full ledger: `contracts/golden/vendor-gated-registration-flow-m2/removed-field-ledger.expected.md` (machine-checked by assertion A28).

### Council-Blocked Items (Deliberately Unresolved)

**Stand fee** — Entirely removed from the 26 Aug source document. The source's "Booth Fees & Payment" section was deleted; no blank figure left behind. Stand booking payment is M3 scope and uses a separate `vendorStandOrders` collection, not part of `vendorSubmissions`.

**Tables/Chairs rate** — The 26 Aug source document states tables and chairs carry "an additional charge per table and per chair" but leaves the rand figure blank ("R …."). No invented figure is used. The form discloses "rate to be confirmed by the Show Organising Committee" alongside the input fields but does not pre-fill a price. This remains unresolved until the Council provides the actual figure. Assertion A65 proves both that the disclosure copy is present and that no price figure was invented.

**Cancellation policy** — The written T&Cs state **"90 days"** (stated twice under "Cancellation and Refunds"). Lee-Ann's voice note said "2 months," which conflicts. Per the mission's hard constraint, the **written document governs** — the form displays the 90-day clause verbatim and "2 months" does not appear anywhere in the code. Both are flagged in project memory and in the contract's golden README; resolution requires a human Council decision, not an engineering choice.

### Marketing Asset Upload Path

**New modules:**

- `lib/vendor-marketing-upload.ts` — Pure planning (no Firebase SDK): `planMarketingAssetUpload()` validates metadata and derives deterministic `vendor-marketing/{submissionId}/{slot}.{ext}` storage paths. Mirrors `lib/vendor-proof-of-payment.ts`'s (F7) exact structure.
- `lib/vendor-marketing-upload-handler.ts` — Pure orchestrator: `handleMarketingAssetUpload()` implements rate-limit-first, non-enumerable-existence, overwrite-not-refuse semantics. Fully injectable (no Firebase imports), proven without Firestore/Storage.
- `lib/vendor-marketing-upload-rate-limit.ts` — Rate-limit state and `decideMarketingAssetRateLimit()` decision logic.

**New route:**

- `POST /api/vendors/[id]/marketing-asset` — Public, unauthenticated, rate-limited (5 uploads per day per IP). Accepts one slot per request (`slot: 'logo' | 'product-photo-1' | 'product-photo-2' | 'product-photo-3'`); a second upload to the same slot overwrites the first without refusal or versioning.

**Upload specification:**

- MIME types allowed: `image/jpeg`, `image/png`, `image/webp` (images only; no PDF unlike F7's proof-of-payment)
- Max size: 5 MB per file (engineering limit, not Council-approved; same disclaimer as F7)
- Extension derived from validated `mimeType` only, **never from user-supplied filename** (same spoofed-extension defense as F7)
- Storage path: `vendor-marketing/{submissionId}/{slot}.{ext}` (deterministic; always recomputed and oversaved on retry)
- Response: Always HTTP 202 `{ accepted: true }` whether submission exists or not (non-enumerable existence; only side effects differ)

**Why uploads happen after submission:** Submission documents do not exist until after `POST /api/vendors/register` completes. Uploads target an already-submitted ID, so three discrete POST calls are necessary: register, then logo, then product photos (or any subset).

**Admin visibility:** The vendor review table (`/admin/vendors`) displays an N/3 progress badge on the product-photo uploads so committee members see at a glance which submissions still need photos before approving. There is no server-side enforcement: a vendor can complete registration without uploading any photos, and the submission is accepted as-is. The requirement for 3 product photographs (per the source document) is disclosed on the success page and tracked for human review, not machine-enforced.

### Security Properties (Fixed in This Session)

All three properties were defects in F7 (`lib/vendor-proof-of-payment-handler.ts`) and are now fixed in F18's `lib/vendor-marketing-upload-handler.ts`:

1. **Decoded byte length is the size authority** (not caller-supplied `sizeBytes`). The handler computes `Buffer.byteLength(fileBase64, 'base64')` and rejects any mismatch before any existence lookup or upload (lines 101–117 of vendor-marketing-upload-handler.ts). A caller cannot send `sizeBytes: 1` with an arbitrarily large base64 payload to bypass the cap.

2. **Rate limit runs before body parsing on both public upload routes.** Parsing large bodies before checking limits is a resource exhaustion hole. Both F7 and F18 rate-limit first via `decideRateLimit()` on the IP key, then record the attempt, then validate/upload (lines 61–76 of vendor-marketing-upload-handler.ts). A rate-limited caller never reaches planMarketingAssetUpload or file operations.

3. **Equipment rows projected to validated keys only (F14 equipment fields).** When building a submission from form input, both `buildVendorSubmission()` (in lib/vendor-submissions.ts) and the handler project repeating-table rows to their validated schema keys only. Forged extra keys in the array cannot be persisted. This prevents an attacker from smuggling undefined fields into Firestore via array-item fields (assertion A66 checks this).

### UI Changes (M2 Fieldsets)

The full registration form now renders:

- **VendorContactFieldset** — Online presence fields (5 new social handles) added alongside existing website field; VendorEmergencyContactFieldset folded in (no separate section heading).
- **VendorCategoryFieldset** — Food certification checklist (6 items, gated to food retailers only).
- **VendorBoothFieldset** — Radio group for booth size (3 fixed options); tables/chairs inputs kept with rate-TBD disclosure; electrical repeating-row editor; gas repeating-row editor (food retailers only); 7 discrete vehicle-registration text inputs.
- **VendorMarketingFieldset** — Bio textarea with live word-count indicator (150–200 word validation); logo + 3 product-photo upload controls; marketing-permission radio group (2 options).
- **New signature block** — Displays existing fields read-only (contactPosition, businessName) + new `signatureFullName` input + read-only `submittedAt` display + 6-point declaration list (verbatim from source) + full 14-clause T&Cs block (verbatim, including 90-day clause) + declaration checkbox.

---

## Next Steps (M3 and M4)

**M3** — Stand booking payment:
- Separate, explicit payment path for booth fees (not ticket purchases) via new `vendorStandOrders` collection
- Council-supplied booth-size pricing (currently all-null, 503-until-configured state)
- 30-day payment token; idempotent, cross-gateway-guarded settlement
- 90-day forfeiture notice displayed before payment submit

**M4** — Human-readable registration code (replacing M1's opaque HMAC token):
- Business-name-derived slug + 4-digit CSPRNG code (e.g. "Orchids-Inc-4821")
- Per-application transactional lockout; 5-attempt threshold + reissue escape hatch
- Approval mints code + convenience email link; vendor enters code on a simple 2-field form

---

## Related Documentation

- `docs/vendor-registration.md` — Pre-M1 flow (F1-F9); now documenting the old, ungated system; will be superseded or merged into this doc once M1 is live
- `contracts/golden/vendor-gated-registration-flow-f1/README.md` — Full decision record, every judgement call, why collections are separate, why the token is stateless-with-transactional-claim
- `contracts/contract-vendor-gated-registration-flow.yaml` — Contract spec with all features and M1-M3 breakdown
- `.env.local.example` — Environment variable setup, including `VENDOR_REGISTRATION_TOKEN_SECRET`
