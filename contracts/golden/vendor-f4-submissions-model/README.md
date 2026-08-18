# F4 (vendor-registration) — `vendorSubmissions` data model: decision record

## Scope boundary — what F4 is, and what it deliberately is NOT

F4 ships a pure data model: two new `types/index.ts` unions-plus-interface, and a pure
construction module `lib/vendor-submissions.ts` (validation + a builder), mirroring exactly
the split `lib/buyers.ts` (F5, ticketing-foundation) established between "type lives in
`types/index.ts`" (like `Order`) and "construction/validation logic lives in its own `lib/`
module, no Firebase Admin import, time always injected." **F4 does not write to Firestore**
(that's F5's `POST /api/vendors/register` route), **does not send an email** (also F5),
**does not build any admin UI** (F6), **does not decide the booth-fee payment path** (F7,
explicitly gated on an open question), and **does not add any verification logic** for the
regulatory permit fields (F9's job is to add a *non-verification notice* in the UI/copy — not
here, and not ever, per the mission brief).

## Field-by-field verification against the source document

The architect brief for F4 warned that a wrong field here propagates through F5-F8, and asked
this contract to verify the brief's 31-field list against Lee-Ann's own document, not trust
the brief's paraphrase. The source file is a `.docx`
(`South African Exhibitors.docx`, Drive file `1UKUdzZ9NAJHsqWHSV0mN9tnTrp6NE8I4`), fetched and
its `word/document.xml` extracted directly (not OCR, not a paraphrase) for this contract. Its
"2027 SAOC NATIONAL SHOW VENDOR REGISTRATION FORM" section numbers its fields 1-31 explicitly.

**The brief's five-section grouping matches the source document field-for-field**, with one
place the brief's summary is thinner than the source and two fields the source form contains
that neither the brief nor this contract models as data:

- **Field 18 ("Booth size / type preference")** — the brief's inline list says only "booth
  type"; the source form itself offers three named radio options (`Standard`, `Corner`,
  `End-of-row`). This contract models it as the closed union `VendorBoothType`, not a free-text
  string, because the form itself constrains it to exactly those three choices — a free-text
  field here would let a future editor introduce a fourth silently-uncounted booth-type value
  with no compile-time signal.
- **Field 10, "Social media handle(s)"** — the source form's own label is plural-permitting but
  is a single blank-line text field, not a repeatable list control (unlike field 11's checkbox
  grid, which the form does render as multiple discrete boxes). Modelled as a single optional
  `string`, matching the form's actual input shape, not the brief's "social handle" paraphrase
  or an assumed array.
- **The form's unnumbered Signature and Date lines**, appearing directly below field 31 ("I
  confirm I have read and agree to the Vendor Terms & Conditions...") — see "Judgement calls"
  below for why these are deliberately NOT modelled as VendorSubmission fields.

No other disagreement was found between the brief and the source document. The 8-option
vendor-category checkbox list (field 11), the 4-option payment-method checkbox list (field 29),
and every other field's presence/absence of an asterisk match the brief exactly.

## The 31 fields, as modelled

| # | Source form label | VendorSubmission field | Required? |
|---|---|---|---|
| 1 | Vendor / business name * | `businessName: string` | required |
| 2 | Trading name (if different) | `tradingName?: string` | optional |
| 3 | Contact person full name * | `contactPersonName: string` | required |
| 4 | Cell phone contact number * | `contactCellPhone: string` | required |
| 5 | Monitored email address * | `contactEmail: string` | required |
| 6 | Physical business address | `physicalAddress?: string` | optional |
| 7 | Business registration (CIPC) number | `cipcNumber?: string` | optional |
| 8 | VAT number (if applicable) | `vatNumber?: string` | optional |
| 9 | Website | `website?: string` | optional |
| 10 | Social media handle(s) | `socialMediaHandle?: string` | optional |
| 11 | Vendor category * (select all that apply) | `vendorCategory: VendorCategory[]` | required, non-empty |
| 12 | Brief description of products/plants to be sold * | `productDescription: string` | required |
| 13 | Phytosanitary certificate / import permit number | `phytosanitaryPermitNumber?: string` | optional, unvalidated |
| 14 | CITES permit number | `citesPermitNumber?: string` | optional, unvalidated |
| 15 | Food handling / health certificate number | `foodHandlingCertificateNumber?: string` | optional, unvalidated |
| 16 | List of food items to be sold | `foodItemList?: string` | optional |
| 17 | Number of booths required * | `boothCount: number` | required, positive integer |
| 18 | Booth size / type preference | `boothType?: VendorBoothType` | optional |
| 19 | Number of tables required | `tableCount?: number` | optional |
| 20 | Number of chairs required | `chairCount?: number` | optional |
| 21 | Power required? * | `powerRequired: boolean` | required |
| 22 | Electrical load required | `electricalLoad?: string` | optional |
| 23 | Water access required? | `waterRequired?: boolean` | optional |
| 24 | Number of staff attending per day | `staffPerDay?: number` | optional |
| 25 | Vehicle registration number(s) | `vehicleRegistrations?: string` | optional |
| 26 | Preferred load-in time slot | `loadInSlot?: string` | optional |
| 27 | Preferred load-out time slot | `loadOutSlot?: string` | optional |
| 28 | Short vendor bio (50-100 words) | `bio?: string` | optional — no asterisk in the source form |
| 29 | On-site payment methods accepted | `paymentMethodsAccepted?: VendorPaymentMethod[]` | optional — no asterisk |
| 30 | Booth fee payment reference / proof of payment | `paymentReference?: string` | optional |
| 31 | T&Cs confirmation checkbox * | `termsAccepted: boolean` | required, must be `true` |

Plus two system fields the mission brief adds on top of the form's own 31: `status:
VendorSubmissionStatus` (always `'submitted'` at creation) and `submittedAt: Date` (the
injected `now`, not `Date.now()`).

**The logo is not a form field.** Field 28's section explicitly instructs "Please also email a
high-resolution copy of your company logo, in addition to completing this form" — the brief
correctly excludes a file-upload field here; this contract confirms that instruction is in the
source document, not an assumption.

**The office-use block** ("Booth number allocated", "Payment received Yes/No", "Confirmed by")
sits below field 31 in the source form and is explicitly F6/F7 scope (booth allocation and
payment confirmation are admin actions taken *after* submission, not submitter-supplied data).
`VendorSubmission` as shipped by F4 has no `boothNumber`/`paymentReceived`/`confirmedBy`
fields; F6/F7 add them additively later.

## Judgement calls

**Signature and Date are not modelled as VendorSubmission fields.** The source document is a
paper-form template; a web submission has no handwritten signature to capture, and a
freeform "type your name here" text field would be legally meaningless while implying false
weight ("I signed this"). The digital equivalent already exists in the model without adding
new fields: `termsAccepted: true` is the affirmative act (the form's own checkbox, field 31),
and `submittedAt` is the date — recorded by the system at the moment of submission, not
self-reported by the submitter (a self-reported date field would let a submitter backdate their
own agreement, which `buildVendorSubmission()` deliberately forecloses for `status` and
`submittedAt` alike — see A5). This is a call the architect made, not one confirmed with
Lee-Ann/Brad; if a literal signature capture (e.g. a typed full legal name distinct from
`contactPersonName`) turns out to matter for the T&Cs' legal weight, that's a small additive
field for a future feature, not a defect in F4's 31-field count.

**`vendorCategory` and `paymentMethodsAccepted` are arrays of closed-union string literals, not
booleans-per-option.** The form renders both as independent checkboxes, which could be modelled
either way (a `VendorCategory[]` array, or nine separate boolean fields mirroring the
checkboxes 1:1). The array-of-closed-union form was chosen to match `Order`/`Ticket`'s existing
`types/index.ts` conventions (small closed-union string types, not boolean-flag fields) and
because it composes better with F6's future admin list/filter UI (`submission.vendorCategory.includes('food-retailer')`
reads better than nine separately-named booleans).

**`boothCount`, `tableCount`, `chairCount`, `staffPerDay` are `number`, not `string`.** The
source form is a paper/PDF-style form where every field is technically a text blank, but these
four are asked as counts ("Number of ___ required/attending") — modelling them as `number` lets
F5's route reject `"three"` at the validation boundary (fail-fast, not sanitize-and-continue)
and lets F6's admin UI sum/display them without a parse step. `boothCount` additionally requires
a positive integer (you cannot register for zero or a fractional booth); the other three counts
are optional and, if present, must be non-negative integers (0 tables/chairs/staff is a valid
answer; a negative or fractional one is not) — enforced by `validateVendorSubmissionInput()`,
proven for `boothCount` specifically by A3's `0`/`-1`/`1.5` cases.

**Why `lib/vendor-submissions.ts` is pure (no `firebase-admin` import), mirroring `lib/buyers.ts`
exactly, not `lib/orders.ts`'s Admin-SDK-importing pattern.** `orders.ts` is a *creation
primitive* that itself calls `getFirestore()` and writes documents (F2, ticketing-foundation) —
appropriate there because F2's brief was explicitly "the shared creation primitive." F4's brief,
by contrast, asks only for "a typed interface... a test submission... round-trips through
Firestore correctly" as the feature's own *validation* target, with the actual write explicitly
assigned to F5 ("`app/api/contact/route.ts`'s pattern... validate → `db.collection(...).add()`").
Keeping `lib/vendor-submissions.ts` pure means A1-A8 run with zero credentials and zero network,
the same reason `lib/buyers.ts` is pure — and `submittedAt` is typed `Date`, not
`firebase-admin/firestore`'s `Timestamp`, for the same reason `Buyer.createdAt` is `Date`: a JS
`Date` is what a pure module can produce without importing the Admin SDK, and the Firestore
Admin SDK accepts a plain `Date` at write time and stores it as a `Timestamp` automatically —
F5's route does not need to convert it.

## Why `buildVendorSubmission()` always forces `status: 'submitted'` and `submittedAt: now`

This is the single highest-value property in this contract, and the reason the architect brief
called out the status lifecycle as something "F6's review workflow builds on it — get the
states right now." A public, unauthenticated `POST /api/vendors/register` route (F5) accepts a
raw JSON body from an anonymous vendor. If `buildVendorSubmission()` naively spread the caller's
input (`{ ...input, status: input.status ?? 'submitted' }`), a submitter who happened to include
`"status": "approved"` in their POST body — whether by curiosity, by copying a leaked admin
export as a template, or by a client-side bug — would create a document that is, on its face,
already approved, with no admin ever having looked at it. `buildVendorSubmission()` closes this
by construction: `status` and `submittedAt` (and `id`, which does not exist until Firestore
assigns one) are never read from `input` at all — the function signature itself
(`VendorSubmissionDraft`, an `Omit<VendorSubmission, 'id' | 'status' | 'submittedAt'>`) makes
them structurally absent from the typed input, and A5 additionally proves this holds even when
a caller bypasses the type system with an `as any` cast to smuggle those keys into the raw
object at runtime — the exact shape a real malicious POST body would take, since HTTP bodies
arrive as `unknown` regardless of what the TypeScript signature says.

## Regulatory permit fields — collected, not validated (F9 scope note, recorded here for F4)

Fields 13-15 (phytosanitary/import permit, CITES permit, food handling certificate) are
free-text, optional, and carry zero validation logic in this feature — no format regex, no
cross-check against `vendorCategory` (a vendor who selects only `'books'` may still submit a
CITES number, or a `'rare-exotic-plants'` vendor may submit none), and no lookup against any
external registry. This is a deliberate posture, not an oversight: whether SAOC is even
*obliged* to verify these numbers is explicitly a show-committee question (mission F9), not an
engineering default, and per project coding rules the correct behaviour for unvalidated input is
"reject, don't sanitize-and-continue" — which means storing the value verbatim, not
silently reformatting or truncating it either. A6 proves both halves: no format rejection fires
on an arbitrary permit string, and a static grep confirms no verification/lookup function or
outbound HTTP call was added anywhere in `lib/vendor-submissions.ts`. F9 itself is scoped to
adding a *visible non-verification notice* in the F6 admin UI and F5/vendor-facing confirmation
copy — no code in F4 does that (there is no UI in F4), but F4 is what proves the absence of
verification logic those notices will describe.

## Zero-authorization property, mirrored from `ticketing-f5-buyers`

The mission brief for F4 explicitly asked this to "mirror F5-buyers' zero-authorisation
assertion." `ticketing-f5-buyers`'s A3/A4/A6 proved this by calling *real*
`resolveRoleCapabilitiesForShow()`/`hasCapability()` functions against a buyer token — meaningful
there because `lib/admin-auth.ts` already existed as the real decision function to call. F4 has
no equivalent live decision function to call against yet (F6, which builds the
`review-vendor-applications` capability and the admin list/approve/reject UI, hasn't shipped);
proving "this data model grants nothing" against a decision function that doesn't exist yet would
be vacuous. A7 instead proves the two things that are checkable *now*, before F6 exists, and that
F6 cannot retroactively violate without this contract catching it on re-run: (a) a built
`VendorSubmission`, at every status value including `'approved'`, carries no
admin/roles/capability-named key — the same "does the shape itself carry authorization meaning"
check `check-newsletter-consent-defaults.mjs`'s case (4) runs on `Buyer`; (b) a static read of
`lib/vendor-submissions.ts`'s own source text confirms it never imports `lib/admin-auth.ts` or
`lib/admin-roles.ts` — proving this module doesn't even have the *means* to consult or grant a
capability, the same "no import" proof the ticketing-f5-buyers README describes for why
`lib/buyers.ts` cannot itself be the authorization decision. When F6 ships and a real
`review-vendor-applications` capability exists, a future contract should add the
`ticketing-f5-buyers`-style A3/A4 pair (real token → real `hasCapability()` call) against F6's
actual gate — that pair does not belong to F4, which ships no gate to call.

## What this contract does NOT prove

- **No Firestore round trip.** A4's "round-trips ... correctly" (per the mission brief's "Done")
  is proven against the pure `buildVendorSubmission()` function's return value, not against a
  real `db.collection('vendorSubmissions').add()` write and read-back — F4 ships no Firestore
  I/O to test. F5's contract should add a live-Firestore round-trip check once the write path
  exists (offline-safe via the Firestore emulator or a controlled test project — not this
  contract's job to build that infrastructure).
- **No HTTP validation.** A3 calls `validateVendorSubmissionInput()` directly, not a real `POST
  /api/vendors/register` request — there is no route yet. F5's contract owns the HTTP-boundary
  proof (400 on invalid payload, 201 on valid, exactly one document written), mirroring how F5
  buyers' A5 owns the HTTP round trip that F4/F5(buyers)'s pure module split leaves to the route
  layer.
- **No live capability gate.** As described above under "Zero-authorization property" — F6 has
  not shipped a decision function yet for A7 to call.
