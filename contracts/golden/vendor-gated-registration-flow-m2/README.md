# Golden: vendor-gated-registration-flow — M2 decision record

Mission `vendor-gated-registration-flow`, M2 (full registration form field-set correction).
Full milestone/feature breakdown lives in
`contracts/contract-vendor-gated-registration-flow.yaml` (features F13-F21). This README is
the decision record @dev implements against; @dev may not deviate from a decision recorded
here without flagging it back to the orchestrator. M1's own decision record (application/
review/token flow, out of scope here) lives at
`contracts/golden/vendor-gated-registration-flow-f1/README.md` — unrelated, do not confuse.

## Why now, and against what

Lee-Ann replaced `docs/leeann-source/2027-vendor-registration-form_2026-08-26.md` on 26 Aug;
the 25 Aug snapshot the live form was built against is now stale. The most visible defect —
the vendor category list — is demoed tomorrow morning, hence F13's independent priority.
Everything else (F14-F21) corrects the rest of the field set at a lower urgency.

## F13 is independently shippable — ship it alone if time runs short

F13 touches exactly three files (`lib/vendor-submissions.ts`, `types/index.ts`,
`components/vendors/VendorCategoryFieldset.tsx`) and has no dependency on F14-F21. If the
demo clock runs out, F13 alone fixes the one defect Brad specifically flagged as visible on
the live form. F14-F21 can ship in a later pass without F13 being blocked on them, and vice
versa.

## Reconciling the two category lists

M1 already introduced `VENDOR_APPLICATION_CATEGORIES` / `VendorApplicationCategory`
(`lib/vendor-applications.ts`) as the correct 14-item list for the new short application
stage. F13 makes the full form's `VENDOR_CATEGORIES` / `VendorCategory` match it byte-for-byte
in value and order (A24 enforces this with a diff). The two constants and two types stay
**structurally separate** — M1's rationale for keeping `vendorApplications` and
`vendorSubmissions` as permanently distinct entities applies here too: an application-stage
category selection and a full-registration category selection are different moments that
happen to currently share content. Do not collapse them into one shared exported constant;
keep two arrays with identical content, guarded by A24 so they cannot silently diverge again.

## Why this one enum may break (unlike everything else in M2)

The mission's hard constraint is that the M1 data model is additive-only and deploy-safe —
correct, and still true for every field-shape change in F14-F21 (repeating tables, split
vehicle fields, etc. are all additions with the old field deprecated-in-place, never removed
from the type). `VendorCategory`'s 14-item replacement is the **one deliberate exception**:
it is a genuine breaking rename of the union's members, not a widening. This is safe because
`vendorSubmissions` is a pre-launch collection — the gated flow (M1) means the full
registration form is reachable only via an emailed single-use token, and no token has ever
been issued outside testing. There are zero real documents anywhere with the old
`VendorCategory` values. If that ever stops being true (a real vendor has submitted before
this ships), stop and re-architect this as additive instead.

## Deprecate-in-place, never delete

Every field superseded by an M2 shape change (repeating tables replacing scalars, 7 typed
vehicle fields replacing one enum + one free-text field, per-platform Online Presence fields
replacing the single `socialMediaHandle`, and the four §3 fields the 26 Aug doc simply drops:
`sellsLivePlants`/`livePlantTypes`/`plantsImportedForEvent`/`importCountryOfOrigin` plus
`foodPreparationOnSite`/`foodCookingOnSite`) stays in `VendorSubmission` exactly as it is
today — same name, same type, still optional. The full list is
`contracts/golden/vendor-gated-registration-flow-m2/removed-field-ledger.expected.md`, and
A28 machine-checks it against the actual interface. Nothing is deleted because:

1. `types/index.ts`'s `VendorSubmission` is used by `app/admin/vendors/page.tsx` to render
   documents that may already exist from before M2 ships (the register form was public, briefly,
   before M1's gate landed — a handful of test/demo submissions exist in the dev Firestore
   project). Deleting a field would make those documents fail to typecheck against reads that
   destructure it.
2. F21 exists specifically to prove this in code, not just assert it in prose.

Only `VendorCategory` (F13, above) is the deliberate exception to this rule.

## The Ticktok typo

The source document itself spells the platform "Ticktok" throughout its Online Presence
section. This is the source's own typo, not a rendering artifact — verified by reading the
raw markdown directly. Per the orchestrator's explicit instruction: use the correct spelling
("TikTok") in the UI, and this paragraph is that flag. A30 enforces the correct spelling and
that "Ticktok" appears nowhere in `components/vendors/`.

## Why three fields, not an array

"Please attach 3 Product Photographs" is an exact-count requirement, not a maximum. Modeling
it as `productPhotoPaths: string[]` would need a separate runtime length-3 check that is easy
to accidentally weaken (e.g. a future edit changing `=== 3` to `<= 3` without anyone noticing,
since an array-shaped field reads as "however many the vendor uploaded"). Three discrete
optional fields (`productPhoto1Path`/`2Path`/`3Path`, each mirroring `logoPath`'s
string-or-null shape) make "exactly 3 slots" the literal shape of the data model — there is no
way to represent a 4th photo or a partial upload beyond what the UI's 3 fixed upload controls
allow. This mirrors the existing pattern of discrete named fields elsewhere in this schema
(the 7 vehicle fields, the emergency-contact 3-field group) rather than introducing the
codebase's first fixed-length-array convention for one feature.

## Table/chair rate: council-blocked, not provisional

The source document leaves the rand figure blank (`R …..` for both table and chair). This is
different from `lib/provisional-figures.ts`'s pattern, where every figure there is the
project's **own best-guess estimate** clearly flagged `provisional: true` because no client
source exists at all. Here, the client's own document exists and deliberately left the number
unfilled — inventing a figure would misrepresent something Lee-Ann/the committee has not yet
decided, on a document vendors are asked to sign as a binding agreement. F17's copy states
that a charge applies without stating an amount ("rate to be confirmed by the Show Organising
Committee"). This is council-blocked, not provisional — no follow-up feature auto-resolves it;
someone must give SAOC the actual number before it can go in.

## Gas equipment gating

The Gas and Oil Cooking & Heat-Producing Equipment table sits in the source document
immediately after the Food Vendors section and describes cooking/heat equipment. Rendering it
unconditionally would show an irrelevant table to a vendor selling books or ceramics. F17
gates it behind the existing `isFoodRetailer(state)` helper — the same gate already used for
the food-specific fields in `VendorCategoryFieldset.tsx`. This is a judgement call, not
explicit in the source (the source shows it as a form-wide section, not nested under Food
Vendors) — flagged here rather than guessed silently. If a non-food vendor genuinely needs gas
equipment (e.g. a heater at an indoor-plants booth), this gate would hide the table from them;
worth confirming with Lee-Ann before the next real vendor cohort registers.

## Food certification: checklist, not blanket attestation

**Ambiguity, not guessed silently.** The source's "I hereby certify that as a food vendor I
have the following certifications:" reads two ways: (a) a single blanket declaration listing
six things a food vendor is expected to hold (agree-to-all), or (b) a checklist where the
vendor marks which of the six they actually hold. The extracted markdown shows no visible
per-item checkbox glyphs, which is compatible with either reading (the source .docx's own
checkbox formatting doesn't survive extraction either way).

Chosen default: **(b), a checkbox subset** (`foodVendorCertifications:
VendorFoodCertification[]`), consistent with this schema's existing pattern for every other
multi-select in the form (vendor categories, live plant types, waste types) and more useful to
the committee on admin review (partial compliance is visible, not hidden behind one checkbox).
Flag this back to Brad/Lee-Ann before the next real cohort registers — if intent (a) is
correct, F19's UI needs one required checkbox instead of six, and a follow-up architect pass
is a five-minute change, not a rearchitecture.

## The signature block

Full Name/Position/Business Name/Signature/Date, per the source. Position and Business Name
are **not** re-collected as new fields — they already exist on the form
(`contactPosition`/`businessName`) and F20 renders them read-only in the signature block
rather than as a second editable input, avoiding two answers to the same question drifting
apart. Date is **not** a submitter-editable input — the form has no reason to let a vendor
backdate or postdate their own signature; F20 displays `submittedAt` after the fact, matching
`VendorSubmission`'s existing system-owned-timestamp posture. Full Name is genuinely new
(`signatureFullName`) rather than reusing `contactPersonName`, because the person who fills in
the contact-person field earlier in the form is not guaranteed to be the person legally
authorised to sign the agreement (e.g. an admin assistant completes the logistics, the
business owner signs) — collapsing them would silently misrepresent who agreed to the terms.
"Signature" itself is the typed `signatureFullName` value — this form has no canvas/drawn
signature capability, and none is being added in M2.

## The two flagged contradictions (both carried forward from M1, still unresolved in M2)

Per the mission's hard constraint, M2 does not resolve either. Both are implemented per the
**written** document, since that is what a vendor signs, and both stay flagged:

1. **Cancellation window**: the written T&Cs (F20) state 90 days; Lee-Ann's voice note said
   2 months. A36 checks the 90-day figure ships and that "2 months" does not leak in anywhere
   near the cancellation copy.
2. **Table/chair pricing**: the written document says tables/chairs are chargeable (rate
   blank); the voice note reportedly said "no extra charge." F17 ships the written document's
   posture (chargeable, rate TBD) per the same rule.

## What was never actually there

The orchestrator's brief listed "Supporting Documentation Checklist" and standalone "Booth
Fees & Payment" as sections to remove. Checked directly against the current live form's
components (`components/vendors/*.tsx`): neither exists today as a distinct rendered section
— there is no `VendorSupportingDocumentationFieldset.tsx` or `VendorBoothFeesFieldset.tsx`,
and no component renders that heading text. This is very likely a no-op for F20 (nothing to
remove), but F20's feature description says to confirm during implementation rather than
silently skip, in case a stray heading or paragraph exists somewhere this pass did not find
(e.g. inside `VendorPaymentFieldset.tsx`, not read in full during this architect pass).

## F21: the regression proof, not just the promise

Two fixture `VendorSubmission`-shaped objects back A38: one with every F15-deprecated field
populated and every F14 field absent (simulating a document that predates M2), one with every
F14 field populated and every deprecated field absent (simulating a fresh post-M2 submission).
Both must render through `app/admin/vendors/page.tsx` without throwing and without a
TypeScript error. This is the actual proof that "additive-only, deploy-safe" holds — a
promise in this README is not verification.

## What is explicitly out of scope for M2

- Resolving either flagged contradiction (see above) — needs a human decision, not an
  engineering one.
- The table/chair rand figure — council-blocked (see above).
- M3 (Stand Booking Payment) — untouched, unrelated Firestore fields.
- Rate limiting / confirmation email on `POST /api/vendors/apply` — that is F12 (already
  recorded as its own separate M2 placeholder in the parent contract, not part of F13-F21).
- Any change to the `vendorApplications` collection, `VendorApplicationCategory`, or the
  application/review/token flow — M1's surface, unrelated to this pass.
