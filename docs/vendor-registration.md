# Vendor Registration — Features F1-F5

The vendor-registration milestone implements the public-facing vendor registration system for the 2027 SAOC National Show. This document covers F1-F5, all gated and QA-passed.

## Naming convention: Internal `vendor*` vs. public "Exhibitors" copy

The system uses internal identifiers `vendor*` throughout to distinguish commercial booth operators from the existing "exhibitors" feature (judges' competition entry guide at `/national-show/exhibitors`). Lee-Ann's source document titles the form "2027 SAOC NATIONAL SHOW **VENDOR** REGISTRATION FORM," and internal identifiers follow that convention:

| Concept | Internal name | Usage |
|---------|---|---|
| Public showcase document type | `vendorNursery` | Sanity schema (F2) |
| Registration submission type | `vendorSubmission` | Firestore document (F4, F5) |
| Firestore collection | `vendorSubmissions` | F5 write target |
| Public showcase route | `/national-show/vendors` | F3 page |
| Public submission API | `/api/vendors/register` | F5 HTTP endpoint |

Public-facing prose — "South African Exhibitors Pavilion" and Lee-Ann's four-paragraph intro — remains unchanged. This naming split prevents collision with the existing `showExhibitorInfo`/`showExhibitorStep` types and routes.

## Sanity schema — `vendorNursery`

`sanity/schemas/documents/vendorNursery.ts` defines the editor-managed vendor nursery showcase (not the registration submissions themselves). Editors add individual nursery documents in Studio; the `/national-show/vendors` page reads and displays them.

**Fields:**

| Field | Type | Required | Source |
|-------|------|----------|--------|
| `name` | `string` | yes | Implicit (used in preview + future showcase) |
| `logo` | `image` | no | "Nursery logo" |
| `country` | `string` | no | "Country" |
| `owner` | `string` | no | "Owner" |
| `history` | `text` | no | "Short history" |
| `specialisation` | `text` | no | "What they specialise in" |
| `plantsBrought` | `text` | no | "Plants they will bring" |
| `website` | `url` | no | "Website" |
| `socialMedia` | array of `{platform, url}` | no | "Social media" |
| `availableAtShow` | multi-select string | no | Fixed 6-tag set: Species orchids, Hybrids, Miniatures, South American species, Asian species, Growing supplies |

**Preview:** Displays nursery name + country in the Studio document list.

**Design rationale:** One document per nursery (not an array on a singleton) allows committee members to share individual nursery Studio links for review and maintains full edit history per nursery.

## Public showcase page — `/national-show/vendors`

**Route:** `app/(marketing)/national-show/vendors/page.tsx` (Server Component, `revalidate = 60`)

Fetches all `vendorNursery` documents from Sanity via `vendorNurseriesQuery` and renders:

1. **VendorIntro** — Lee-Ann's heading + four body paragraphs, verbatim.
2. **VendorGrid** — Responsive card grid of nurseries (name, logo, country, website, social links, availability tags). Shows empty state if no nurseries exist.
3. **VendorEmptyState** — Placeholder message when no nurseries have been added to Sanity yet.

**Loading state:** `loading.tsx` provides Suspense fallback skeleton matching the page layout.

## Vendor Submission Model — 31 fields, F4

`types/index.ts` defines `VendorSubmission` and related types. The model mirrors Lee-Ann's source registration form field-for-field.

**System-owned fields** (never submitter-supplied):
- `id: string` — Firestore document ID
- `status: VendorSubmissionStatus` — Closed union: `'submitted' | 'under-review' | 'approved' | 'rejected'`; always `'submitted'` on creation
- `submittedAt: Date` — System timestamp, never self-reported by submitter

**Section 1 — Business & Contact Details** (fields 1-10):
- `businessName: string` (required)
- `tradingName?: string`
- `contactPersonName: string` (required)
- `contactCellPhone: string` (required)
- `contactEmail: string` (required)
- `physicalAddress?: string`
- `cipcNumber?: string` (business registration)
- `vatNumber?: string`
- `website?: string`
- `socialMediaHandle?: string`

**Section 2 — Products & Regulatory Permits** (fields 11-16):
- `vendorCategory: VendorCategory[]` (required, non-empty; closed union: plant-sales, product-sales, rare-exotic-plants, food-retailer, hardware, books, art, other)
- `productDescription: string` (required)
- `phytosanitaryPermitNumber?: string` (unvalidated; collected only)
- `citesPermitNumber?: string` (unvalidated; collected only)
- `foodHandlingCertificateNumber?: string` (unvalidated; collected only)
- `foodItemList?: string`

**Section 3 — Booth & Logistics** (fields 17-27):
- `boothCount: number` (required, positive integer)
- `boothType?: VendorBoothType` (closed union: standard, corner, end-of-row)
- `tableCount?: number` (non-negative integer, if present)
- `chairCount?: number` (non-negative integer, if present)
- `powerRequired: boolean` (required)
- `electricalLoad?: string`
- `waterRequired?: boolean`
- `staffPerDay?: number` (non-negative integer, if present)
- `vehicleRegistrations?: string`
- `loadInSlot?: string`
- `loadOutSlot?: string`

**Section 4 — Bio & Payment** (fields 28-30):
- `bio?: string` (50-100 words)
- `paymentMethodsAccepted?: VendorPaymentMethod[]` (closed union: cash, card, eft, not-applicable)
- `paymentReference?: string`

**Section 5 — T&Cs** (field 31):
- `termsAccepted: boolean` (required; must be `true`)

### Construction & Validation

`lib/vendor-submissions.ts` provides pure, side-effect-free construction:

- **`VendorSubmissionDraft`** — The submitter-supplied shape: `Omit<VendorSubmission, 'id' | 'status' | 'submittedAt'>`. Structurally excludes system fields so a caller cannot smuggle them through the type system.
- **`validateVendorSubmissionInput(input: unknown)`** — Fail-fast validation against raw, untyped input (HTTP bodies arrive as `unknown`). Collects every error instead of returning on the first. Accepts values as-is; never sanitises or reformats.
- **`buildVendorSubmission(input: VendorSubmissionDraft, now: Date)`** — Constructs the document. **Always forces `status: 'submitted'` and `submittedAt: now`**, never reading these from input, so a public submitter cannot self-approve or backdate their submission.

**Important design property:** `buildVendorSubmission()` copies every field explicitly, field-by-field, never using spread (`{ ...input }`). This ensures status/submittedAt cannot survive from a type-system-bypassing input or an `as any` cast — the exact shape a malicious POST body would take.

### Regulatory permit fields — collected, not validated

Fields 13-15 (phytosanitary, CITES, food-handling certificates) are free-text, optional, and carry **zero validation logic**. No format regex, no cross-check against vendor category, no external-registry lookup. Values are stored verbatim. Validation (if the show committee requires it) is F9's scope, not F4.

## Registration API — `POST /api/vendors/register` (F5)

**Public, unauthenticated endpoint.** Accepts raw JSON body with the 31 vendor fields, validates, writes to Firestore, and sends a confirmation email.

### Request

```
POST /api/vendors/register
Content-Type: application/json

{
  "businessName": "Orchids Inc.",
  "contactPersonName": "Jane Doe",
  "contactCellPhone": "555-1234",
  "contactEmail": "jane@example.com",
  "vendorCategory": ["plant-sales", "rare-exotic-plants"],
  "productDescription": "Rare orchid specimens from South America.",
  "boothCount": 1,
  "powerRequired": true,
  "termsAccepted": true,
  // ... 25 more fields
}
```

### Response

**Success (201):**
```json
{ "success": true, "id": "abc123xyz" }
```

**Validation error (400):**
```json
{
  "error": "Invalid vendor registration submission.",
  "fieldErrors": [
    "businessName is required and must be a non-empty string",
    "vendorCategory contains invalid value(s): invalid-category"
  ]
}
```

**Rate limited (429):**
```json
{
  "error": "Too many vendor registration attempts. Please try again later.",
  "retryAfterMs": 3600000
}
```

**Server error (500):**
```json
{ "error": "Failed to save vendor registration. Please try again." }
```

### Implementation modules

**`lib/vendor-registration-handler.ts`** — Pure orchestrator (no Firebase Admin SDK, no Resend). Encapsulates the full request-handling sequence:

1. Check rate limit (via `decideVendorRegistrationRateLimit`).
2. Record attempt unconditionally (hammering keeps re-arming the window).
3. If rate-limited, return 429 **before parsing input**.
4. Validate input (call the real F4 `validateVendorSubmissionInput`).
5. Build submission (call the real F4 `buildVendorSubmission`).
6. Write to Firestore. If this fails, return 500 **without emailing**.
7. Send confirmation email via `deliverConfirmationEmailAfterCommit` (reuses the generic lib/confirmation-email.ts already shipped). Email failure is logged but **never changes the response**.
8. Return 201 with the generated submission ID.

**`lib/vendor-registration-rate-limit.ts`** — Rate-limit decision and storage:

- **Constants** (placeholder, not Council-approved):
  - `VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS = 3`
  - `VENDOR_REGISTER_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000` (1 hour)
- **`decideVendorRegistrationRateLimit()`** — Delegates to the real `decideRateLimit()` from `lib/resend-rate-limit.ts` (shared with F6's ticketing-foundation flows) with vendor-specific constants.
- **`createInMemoryVendorRegistrationRateLimitStore()`** — Module-level array wrapped in `getPriorAttempts()` / `recordAttempt()` methods. **Not persistent across cold starts or multiple Firebase App Hosting instances.**

**`lib/vendor-registration-confirmation.ts`** — Confirmation email:

- Renders `emails/VendorRegistrationConfirmation.tsx` (a plain receipt acknowledgement).
- Accepts `{ businessName, contactPersonName, contactEmail }`.
- Uses the real `lib/email.ts` via dependency injection (`deps.mailer`), same pattern as `lib/confirmation-email.ts`.
- **Contains no `console.*` or logging calls** — `businessName` and `contactEmail` are POPIA-relevant PII.

**`app/api/vendors/register/route.ts`** — Thin Next.js wrapper:

- Reads raw JSON body (400 on malformed JSON).
- Derives rate-limit key from `x-forwarded-for` header's first hop (documented best-effort abuse deterrent, **not a security boundary**; header is client-supplied and spoofable).
- Wires real Admin SDK write, real confirmation email, and in-memory rate-limit store into `handleVendorRegistration`'s dependencies.
- Translates `VendorRegistrationHandlerResult` to `NextResponse`; adds `Retry-After` header (seconds) on 429.

### Design decisions

**Write-before-email:** Firestore write always happens before email is attempted. Email failure is non-fatal and never causes the response to change — the submission already landed safely.

**Rate limit shields the write:** Rate-limit check happens before validation or Firestore access. A rate-limited caller never reaches the database or email system.

**No PII in logs:** No submission data (businessName, email, any field) is logged anywhere. Email module has static checks to enforce this.

**Zero authorisation meaning:** Successful response is `{ success: true, id }` only — never the full submission payload, never a status field, never any capability-granting key. The submission starts `'submitted'`, not `'approved'`.

**Rate-limit constants are placeholders:** The 3/hour and 1-hour window were chosen as reasonable defaults but are not Council-approved. These can be tuned by changing constants in `lib/vendor-registration-rate-limit.ts`.

## What is NOT yet built (F6-F11)

**F6 — Admin review workflow:** UI for listing, approving, and rejecting submissions. Creates the `review-vendor-applications` capability and status transitions.

**F7-F8 — Booth allocation & EFT payment:** How the booth fee is paid, how booth numbers are assigned, and the allocation-confirmation email.

**F9 — Regulatory permits:** Adds a non-verification notice to the confirmation copy and the admin review UI explaining what SAOC does (and does not) do with permit numbers. Whether SAOC is obliged to verify permit and certificate numbers is a decision for the show committee, not an engineering default.

**F10 — Human end-to-end proof:** Full round trip from submission through approval, with real Firestore and real email delivery.

**F11 — POPIA flag & audit log:** Any additional privacy/compliance tracking as required pre-launch.

## Named unproven seams (deferred to F10)

These three implementation details are placeholders; F10 owns proving them:

1. **Real Firestore write adapter** — `deps.write()` in the handler is tested against a fake; the real `getFirestore().collection(...).add()` in `route.ts` is not yet proven to round-trip correctly against a live Firebase project.
2. **Real Resend email delivery** — `deps.sendConfirmationEmail()` is tested against a fake; the real `sendEmail()` call with Resend credentials is not yet proven to deliver.
3. **Cross-instance rate limiting** — The in-memory store survives only within one warm server process. Multiple Firebase App Hosting instances will each have independent attempt counters — no shared state. Correcting this requires a Firestore-backed or distributed cache implementation, deferred to post-F5.

## Firestore collection schema

| Field | Type | Notes |
|-------|------|-------|
| `id` (auto) | string | Firestore document ID |
| `businessName` | string | Indexed for admin search |
| `contactPersonName` | string | — |
| `contactEmail` | string | Indexed for deduplication checks |
| `contactCellPhone` | string | — |
| `vendorCategory` | array of string | — |
| `productDescription` | string | — |
| `status` | string | Indexed; values: submitted, under-review, approved, rejected |
| `submittedAt` | Timestamp | Indexed; UTC |
| ... | ... | 23 more fields (all optional) |

---

## Integration checklist for QA/verification

- [ ] **Sanity schema** — `vendorNursery` renders correctly in Studio; name + country appear in document list preview.
- [ ] **Showcase page** — `/national-show/vendors` loads with Sanity fallback; displays nurseries grid when Sanity has documents; shows empty state when empty.
- [ ] **Registration form** — Form posts to `/api/vendors/register` and receives 201 with an ID on valid input.
- [ ] **Validation** — Malformed/missing required fields return 400 with `fieldErrors` array.
- [ ] **Rate limiting** — Four rapid requests from the same IP receive 429 on the fourth; `Retry-After` header is present.
- [ ] **Confirmation email** — Valid submission triggers a confirmation email to the registered address (requires real Resend key for F10).
- [ ] **Write-before-email** — If Firestore write succeeds but email fails, response is still 201 and submission is stored.
