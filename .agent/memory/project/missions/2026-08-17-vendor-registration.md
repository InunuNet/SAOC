---
schema: athanor.mission/v1
slug: vendor-registration
goal: 'Build the 2027 National Show vendor/exhibitor-nursery programme from Lee-Ann''s
  "South African Exhibitors" brief: a public nursery showcase authored in Sanity, and
  a 31-field vendor registration submission pipeline in Firestore reusing the ticketing
  foundation''s roles and orders/positions patterns'
created_at: '2026-08-17T20:00:00.000000+00:00'
status: queued
queued_after: ticketing-foundation
cost_estimate:
  features: 11
  milestones: 3
  total_calls: 0
last_checkpoint: null
features:
- id: F1
  title: 'Naming disambiguation: rename this stream "vendors", not "exhibitors" —
    resolve collision with the existing judged-entry exhibitor content'
  inline_brief: 'The codebase already has a fully-shipped, unrelated feature called
    "exhibitor": `sanity/schemas/documents/showExhibitorInfo.ts` and `showExhibitorStep.ts`
    (singleton + steps behind `/national-show/exhibitors`, docs in
    `docs/show-exhibitor-info.md` and `docs/exhibitor-guide-for-editors.md`). That
    feature is the entry guide for SAOC members submitting *judged competition
    plants* — deadlines, staging, judging, eligibility. Lee-Ann''s doc uses
    "Exhibitors" for something entirely different: commercial nurseries selling
    plants from a trade booth. The source document''s own registration form calls
    them **"vendors"** ("2027 SAOC NATIONAL SHOW VENDOR REGISTRATION FORM"), which
    this mission adopts as the code-level name throughout — new Sanity types
    `vendorNursery` / `vendorRegistration` (or similar), new route
    `/national-show/vendors` (or `/national-show/exhibitors-showcase` if "vendors"
    reads wrong to Lee-Ann — her call, ask in F1), new Firestore collection
    `vendorSubmissions`. **The public marketing copy can still say "Exhibitors"**
    (Lee-Ann''s prose, verbatim, is not code) — only the internal schema/collection/route
    names change to avoid a second, colliding meaning of "exhibitor" in the same
    repo. **Done:** naming decision recorded (confirm with Lee-Ann/Brad whether the
    public-facing URL segment says "vendors" or something else), no new Sanity type
    or Firestore collection shares a name with the existing exhibitor-entry feature.'
  status: pending
  milestone: M1
- id: F2
  title: 'Sanity schema: `vendorNursery` document type for the public showcase listing'
  inline_brief: 'Editorial content, authored by Lee-Ann/committee, not user-submitted
    — belongs in Sanity, following the pattern of `sanity/schemas/documents/sponsor.ts`
    (closest existing analogue: a logo + name + external links document rendered in
    a grid). Fields per the source doc''s "Every nursery has" list: nursery logo
    (image), country (string), owner (string), short history (text), specialisation
    (text), plants they will bring (text or array of strings), website (url), social
    media (array of {platform, url} or free-text handles — match `sponsor.ts`''s
    existing link-object pattern if one exists). Optional "Available at the Show"
    tag set exactly as listed: species orchids, hybrids, miniatures, South American
    species, Asian species, growing supplies — a fixed `options.list` multi-select,
    not free text, so the future showcase page can filter/badge consistently. A
    document type (not one big array on a singleton), for the same reason
    `showExhibitorStep.ts`''s comment gives: the number of nurseries is exactly what
    changes most often, and each gets its own Studio URL and edit history. **Done:**
    schema compiles, a test document can be created with every field including the
    tag multi-select, preview shows nursery name + country.'
  status: pending
  milestone: M1
- id: F3
  title: Public showcase page `/national-show/vendors` rendering Lee-Ann's intro
    prose and the nursery grid
  inline_brief: 'Server Component, GROQ query against `vendorNursery`, following the
    existing marketing-page pattern (`app/(marketing)/national-show/exhibitors/page.tsx`
    for structure only — different content, different Sanity type). Renders Lee-Ann''s
    three intro paragraphs (transcribed verbatim from the source `.docx` — this is
    her copy, not to be rewritten, paraphrased, or "improved") followed by a grid/list
    of nurseries, each showing logo, country, owner, short history, specialisation,
    plants they will bring, website link, social links, and the "Available at the
    Show" tags if set. No brand colours/typography invented — plain structure only
    until a design handoff arrives (project rule: "No invented brand assets"). Loading
    and empty states required (zero nurseries seeded yet is the normal starting
    state, not an error). **Done:** page renders with zero, one, and several seeded
    nurseries; Lee-Ann''s prose appears unedited; mobile-first responsive per
    `.claude/rules/coding.md`.'
  status: pending
  milestone: M1
- id: F4
  title: 'Firestore `vendorSubmissions` collection: 31-field registration form data
    model'
  inline_brief: 'Submission pipeline, not editorial content — belongs in Firestore,
    following `app/api/contact/route.ts`''s pattern (validate → `db.collection(...).add()`
    → confirmation email, non-fatal on email failure). Model the five form sections
    as a typed interface in `types/index.ts` (mirroring how `Order`/`Ticket` are
    defined there): vendor & contact details (business name*, trading name,
    contact person*, cell*, monitored email*, physical address, CIPC number, VAT
    number, website, social handle), vendor category & products (category
    multi-select* — plant sales / product sales / rare-exotic plants / food retailer
    / hardware / books / art / other, product description*, phytosanitary/import
    permit number, CITES permit number, food handling certificate number, food item
    list), booth & logistics (booth count*, booth type, table count, chair count,
    power required* + electrical load, water required, staff per day, vehicle
    registration(s), load-in slot, load-out slot), marketing & programme (50-100
    word bio — logo is emailed separately per the form, NOT a form upload field,
    do not add a file-upload field the source form does not have), payment &
    agreement (accepted on-site payment methods, booth fee payment reference, T&Cs
    checkbox*, signature, date). Add a `status` field (`submitted` | `under-review`
    | `approved` | `rejected` — see F6 for whether this is used) and a
    `submittedAt` Timestamp. Fields marked `*` in the source form are required at
    validation time; the rest are optional. **Done:** type compiles, a test
    submission with only required fields succeeds, a test submission with a missing
    required field is rejected with a clear error, all 31 fields round-trip through
    Firestore correctly.'
  status: pending
  milestone: M1
- id: F5
  title: 'POST `/api/vendors/register` — public submission route, confirmation email'
  inline_brief: 'Direct structural copy of `app/api/contact/route.ts`: validate
    required fields, reject with 400 on missing/malformed data, `initAdmin()` +
    `getFirestore()`, write to `vendorSubmissions`, then a try/catch-isolated
    `sendEmail()` call (new template, e.g. `emails/VendorRegistrationConfirmation.tsx`,
    modelled on `emails/ContactConfirmation.tsx`) acknowledging receipt — email
    failure must not fail the submission, exactly as the contact route already
    does it. No PayFast integration in this route (see F6/F9 for the payment
    question). **Done:** route accepts a valid payload and returns 201, rejects
    invalid payloads with 400, writes exactly one `vendorSubmissions` document per
    valid request, confirmation email send failure does not affect the HTTP
    response.'
  status: pending
  milestone: M1
- id: F6
  title: 'Vendor application review workflow: new `review-vendor-applications`
    capability, admin list/approve/reject UI'
  inline_brief: 'Reuses the F3/F4 capability system from the ticketing-foundation
    mission wholesale — no new auth mechanism. Add one capability to
    `lib/admin-roles.ts`''s `CAPABILITIES` array: `review-vendor-applications`.
    Decide which role(s) hold it (recommend: `manager` and `owner`, not `door-staff`
    — this is back-office triage, not door operations; mirrors why `door-staff`
    is barred from `search-buyers`). New admin page (under `/admin`, gated via
    `lib/admin-auth.ts` + the new capability) listing `vendorSubmissions`
    documents with status, allowing an admin to move a submission to
    `approved`/`rejected` and, on approval, optionally create the corresponding
    public `vendorNursery` Sanity document (or leave that as a manual Studio step
    for Lee-Ann — **this is one of the open questions below, not a decision made
    here**). **Done:** capability exists in the fixed set, role bundle grants it
    per the decision above, admin list page requires the capability (verified with
    and without it, same pattern as F8''s `issue-comp` gate in ticketing-foundation),
    status transitions are recorded.'
  status: pending
  milestone: M2
- id: F7
  title: Booth fee payment path — offline EFT + proof-of-payment upload, booth number
    allocation field
  inline_brief: 'Depends on the open payment-path question below. Default
    recommendation (see Open Questions): offline EFT, not PayFast — the source
    form''s field 30 ("Booth fee payment reference / proof of payment") reads as a
    reference-number/receipt text field, not a payment-initiation flow, and the
    office-use block ("Payment received [Yes/No], Confirmed by ____") describes a
    human reconciling a bank statement, not a gateway webhook. If confirmed:
    `vendorSubmissions` gets a `paymentReference` string field (already covered by
    F4) plus an optional proof-of-payment file upload (Firebase Storage, not
    Firestore) attached to the submission; an admin manually flags
    `paymentReceived: boolean` and `boothNumber: string | null` in the F6 review
    UI, matching the form''s own office-use fields exactly. **This entire feature
    is gated on Brad/Lee-Ann answering the payment-path question — do not build
    against the PayFast assumption without that answer.** **Done:** payment
    reference and proof-of-payment fields exist per the confirmed path, office-use
    fields (booth number, payment received, confirmed by) are editable only by
    a capability-gated admin, never by the public submitter.'
  status: pending
  milestone: M2
- id: F8
  title: Vendor confirmation and booth-allocation email, sent on F6 approval
  inline_brief: 'Second email in this mission, sent from the F6 admin approval
    action (not from F5''s public route) via the same `lib/email.ts` `sendEmail()`
    helper. Confirms booth number (once allocated), booth type, and restates the
    vendor''s submitted logistics (staff count, power/water, load-in/out slots)
    so they can catch a data-entry error before show day. **Done:** email sends on
    approval, contains the allocated booth number and the vendor''s own submitted
    logistics for verification, uses the mocked-Resend fixture pattern from
    ticketing-foundation F11 if Resend is still unconfigured at build time.'
  status: pending
  milestone: M2
- id: F9
  title: Regulatory permit fields — collected, not validated; explicit non-verification
    note surfaced to the show committee
  inline_brief: 'The form collects a phytosanitary/import permit number, a CITES
    permit number, and a food handling certificate number as free-text fields
    (already covered by F4). This feature is scoped to make sure nobody
    downstream mistakes "the field exists" for "the number was checked": add a
    visible note on the F6 admin review UI next to these three fields stating
    they are unverified as submitted, and a corresponding note in the vendor-facing
    confirmation copy that permits remain the vendor''s legal responsibility. Do
    NOT build any verification/lookup integration — whether SAOC is even obliged
    to verify these is a show-committee question, not an engineering default (see
    Regulatory Note below). **Done:** admin UI and vendor-facing copy both carry
    the non-verification note; no verification logic exists anywhere in the
    codebase for these three fields.'
  status: pending
  milestone: M2
- id: F10
  title: Human proof — a real vendor submission end to end, from public form to
    admin approval to confirmation email
  inline_brief: 'A human (Brad or a tester) fills the public `/vendors/register`
    (or wherever F1 lands the route) form with realistic fixture data, submits it,
    confirms the `vendorSubmissions` document and confirmation email (F5), then
    logs in to `/admin` with a `review-vendor-applications` capability and moves
    the submission through approve → booth allocation → confirmation email (F6-F8).
    Mirrors the human-proof pattern used for ticketing (`ticketing-foundation` F12).
    **Done:** one real submission exists end to end, both emails were sent
    (or logged via mock if Resend is unconfigured), the admin approval path was
    exercised with a real capability-gated account, and a negative control confirms
    an account without `review-vendor-applications` is refused the review page.'
  status: pending
  milestone: M3
- id: F11
  title: POPIA/compliance flag recorded against this mission — no conversation opened
  inline_brief: 'This form collects materially more sensitive data than the ticket
    buyer flow it sits beside: CIPC and VAT numbers, cell phone numbers, physical
    business addresses, vehicle registration numbers, and multiple permit numbers.
    POPIA work on this project is currently deferred (see
    `.agent/memory/project/project_popia_deferred.md`) — this feature does NOT
    reopen that conversation with Lee-Ann or the committee. It exists to make the
    exposure legible before launch: record in `docs/` (a short compliance note,
    not a policy document) exactly which vendor-submission fields are
    business-registration/PII-sensitive, that they are stored in Firestore with
    no field-level encryption beyond Firestore''s platform-level encryption at
    rest, and that this mission is itself a reason to revisit the POPIA backlog
    item before go-live rather than after. **Done:** the note exists and is
    linked from the mission brief; no message is sent to Lee-Ann or Brad raising
    POPIA as a new topic — this is filing, not initiating.'
  status: pending
  milestone: M3
milestones:
- id: M1
  title: Data model and public showcase — editorial content live, submission pipeline
    accepting entries
  features:
  - F1
  - F2
  - F3
  - F4
  - F5
  status: pending
- id: M2
  title: Review workflow, payment path, and regulatory-field handling
  features:
  - F6
  - F7
  - F8
  - F9
  status: pending
- id: M3
  title: Human-proven end to end, compliance exposure recorded
  features:
  - F10
  - F11
  status: pending
---

# Mission: Vendor Registration — 2027 National Show Exhibitor Showcase and Booth Booking

## Status

**QUEUED, not started.** This mission is planning-only at the time of writing — no code, no
contract, no Sanity or Firestore document has been created for it. It is deliberately sequenced
to run **after** the in-flight `ticketing-foundation` mission completes, because it reuses that
mission's roles/capability system (`lib/admin-roles.ts`, `lib/admin-auth.ts`) and orders/positions
conventions directly, and building against a still-changing foundation would be wasted or
conflicting work.

## Source

Lee-Ann's "South African Exhibitors" document, Google Drive file
`1UKUdzZ9NAJHsqWHSV0mN9tnTrp6NE8I4` (owned by `2027national@gmail.com`, last modified 2026-07-11).
Read via `gws drive files get --params '{"fileId":"1UKUdzZ9NAJHsqWHSV0mN9tnTrp6NE8I4","alt":"media","supportsAllDrives":true}'` (it is an uploaded `.docx`, not a native Google Doc — `drive files export`
fails on it), then extracted from `word/document.xml`.

## What the document contains — two distinct deliverables

**1. A public-facing showcase.** Lee-Ann's own marketing prose (three paragraphs, transcribed
verbatim below — this is her copy and is not ours to rewrite) plus a per-nursery listing
structure: logo, country, owner, short history, specialisation, plants they will bring, website,
social media, and an optional "Available at the Show" tag set (species orchids, hybrids,
miniatures, South American species, Asian species, growing supplies).

> *Showcasing the Finest in South African Orchid Growing*
>
> The 2027 South African National Orchid Show will proudly showcase the country's leading orchid
> growers, specialist nurseries, orchid societies and commercial exhibitors, bringing together an
> exceptional collection of South Africa's finest orchids under one roof.
>
> Visitors will have the opportunity to meet the passionate individuals and organisations whose
> dedication, knowledge and years of experience have helped shape South Africa's vibrant orchid
> community. From internationally recognised breeders and award-winning exhibitors to specialist
> species growers and emerging enthusiasts, the exhibition celebrates the remarkable diversity and
> excellence of orchid cultivation across the country.
>
> Exhibitors will present stunning displays of species and hybrid orchids, compete for prestigious
> national awards, and share their expertise through demonstrations, discussions and informal
> conversations throughout the event. The plant sales area will offer visitors the opportunity to
> purchase exceptional orchids, growing media, pots, accessories and specialist products directly
> from many of South Africa's most respected orchid nurseries.
>
> Whether you are building your first orchid collection or searching for a rare specimen to
> complete an established collection, the South African Exhibitors Pavilion offers a unique
> opportunity to learn from the country's leading growers while celebrating the innovation,
> craftsmanship and horticultural excellence that continue to place South African orchid growing
> on the international stage.

**2. A 31-field "2027 SAOC NATIONAL SHOW VENDOR REGISTRATION FORM"** in five sections: vendor &
contact details (including CIPC and VAT numbers), vendor category & products (multi-select
category, phytosanitary/import permit, CITES permit, food handling certificate, food item list),
booth & logistics (booth count/type, tables, chairs, power with electrical load, water, staff per
day, vehicle registrations, load-in/load-out slots), marketing & programme listing (50-100 word
bio, high-res logo emailed separately, not a form upload), and payment & agreement (on-site
payment methods, booth fee reference/proof of payment, T&Cs confirmation, signature, date). An
office-use block covers booth number allocation and payment confirmation.

## Naming collision (see F1)

The codebase already has a shipped, unrelated feature called "exhibitor":
`sanity/schemas/documents/showExhibitorInfo.ts` / `showExhibitorStep.ts`, behind
`/national-show/exhibitors`, documented in `docs/show-exhibitor-info.md` and
`docs/exhibitor-guide-for-editors.md`. That is the entry guide for SAOC members submitting judged
competition plants. Lee-Ann's "Exhibitors" means something different — commercial nurseries
selling from a trade booth, which the registration form itself calls "vendors". This mission
adopts **"vendor"** as the internal (schema/collection/route) name throughout to avoid a second,
colliding meaning of "exhibitor" in the same repo. Public-facing copy can keep saying "Exhibitors"
if that is what Lee-Ann and the committee prefer — that is a content decision, not a code one.

## Reuse — what this mission builds on

- **Roles and capabilities**: `lib/admin-auth.ts` (the single admin-authorisation gate:
  `admin:true` + `email_verified` + live allowlist check) and `lib/admin-roles.ts` (fixed
  `CAPABILITIES` array + `ROLE_TO_CAPABILITIES` map + `resolve()`). F6 adds exactly one new
  capability (`review-vendor-applications`) to the existing set — no new auth mechanism, no
  parallel permission system.
- **Orders/positions data-model conventions**: `lib/orders.ts` and the `Order`/`Ticket` shapes in
  `types/index.ts` (from `ticketing-foundation` F2) are the pattern to follow for
  `vendorSubmissions`'s status lifecycle (`submitted` → `approved`/`rejected`, mirroring
  `reserved` → `paid`/`cancelled`) even though vendor submissions are not a ticket purchase and
  should not literally live in the `orders`/`tickets` collections.
- **Contact-form submission pipeline**: `app/api/contact/route.ts` is the direct structural
  template for F5's `POST /api/vendors/register` — validate, write to Firestore, then a
  try/catch-isolated Resend send via `lib/email.ts`'s `sendEmail()`, non-fatal on email failure.
  `emails/ContactConfirmation.tsx` is the template pattern for the two new email components (F5,
  F8).
- **Sanity for editorial content**: `sanity/schemas/documents/sponsor.ts` is the closest existing
  analogue for F2's `vendorNursery` type (logo + name + external links, editor-authored, rendered
  in a grid). `showExhibitorStep.ts`'s "one document per item, not an array on a singleton"
  rationale applies directly to F2.

## CMS vs Firestore split — the call, not a menu of options

**The public nursery showcase (deliverable 1) is Sanity content. The vendor registration form
(deliverable 2) is a Firestore submission pipeline.** These are structurally different kinds of
data and must not be merged into one collection or one document type:

- The showcase listing is curated, editor-authored, publicly displayed, and changes rarely per
  entry (a nursery's bio doesn't change week to week) — exactly what Sanity is for, and exactly
  the pattern every other public-facing content type on this site already uses (societies,
  sponsors, judges).
- The registration form is a one-way public submission containing business-sensitive and
  regulatory data (CIPC/VAT numbers, permit numbers, vehicle registrations) that must never be
  publicly readable, needs a server-side validation boundary, and follows a review/approval
  workflow before any of it (if any of it) becomes public content. That is the contact-form
  pattern (`contactSubmissions` in Firestore), not the CMS pattern.

**They are linked, not merged**: F6's admin review UI, on approving a vendor submission, is where
a human decides whether and how much of that submission becomes a public `vendorNursery` Sanity
document — this mission does not auto-publish Firestore submission data straight into Sanity.

## Open questions — Lee-Ann or Brad must answer these

1. **Does the booth fee go through the same PayFast/gateway path as ticket sales, or is it
   handled offline by EFT with a proof-of-payment upload?**
   **Recommended default: offline EFT.** The form's field 30 ("Booth fee payment reference / proof
   of payment") and the office-use block ("Payment received [Yes/No], Confirmed by ____") read as
   a human reconciling a bank statement against a reference number, not a gateway-initiated
   checkout. Building a second PayFast integration for booth fees is real scope this brief does
   not assume without confirmation. Gates F7.
2. **Do vendor applications need an approval/allocation workflow before a listing goes public, or
   can any submitted nursery appear on the showcase automatically?**
   **Recommended default: approval required.** The form collects regulatory and business data that
   needs at minimum a sanity check (a nursery claiming a booth without paying, or listing
   protected-species claims without the permit number filled in) before it represents SAOC
   publicly. This is what F6 builds; confirm before M2 starts.
3. **Who allocates booth numbers — the show committee manually, in person, working from a floor
   plan, or does an admin tool need to assign them?**
   **Recommended default: manual allocation, admin tool just records the result.** The form's own
   office-use block ("Booth number allocated ____________") reads as a human writing a number down
   after physically planning the floor, not a system-generated assignment. F6/F7 build the
   recording field, not an allocation algorithm, unless this answer says otherwise.
4. **What should the public route/page be called** — `/national-show/vendors`,
   `/national-show/exhibitors-showcase`, or something else — given "Exhibitors" is already taken
   internally (see Naming collision above) but is Lee-Ann's own public-facing word for this?

## Regulatory note — permits collected, not validated

The phytosanitary/import permit number, CITES permit number, and food handling certificate number
are collected as free-text fields (F4) with no verification, lookup, or validation against any
external register (F9). **Whether SAOC is obliged to verify these numbers is a show-committee
question, not an engineering default** — this brief deliberately does not assume either "we must
verify" or "we don't need to." F9 only ensures the unverified status is visible to both the admin
reviewing the submission and the vendor who submitted it, so nobody downstream mistakes "the field
was filled in" for "the number was checked."

## POPIA / compliance flag

This form collects materially more sensitive data than the ticket-buyer flow already flagged
under the ticketing mission's standing security condition: CIPC business-registration numbers, VAT
numbers, cell phone numbers, physical business addresses, vehicle registration numbers, and
multiple permit numbers. POPIA work on this project is **currently deferred** (see
`.agent/memory/project/project_popia_deferred.md` in the assistant's memory — "back burner, don't
raise with Lee-Ann; revisit pre-launch"). This mission does not reopen that conversation. F11
exists purely to record, in the codebase's own documentation, that this mission is a concrete
reason the POPIA backlog item should be revisited before go-live — filing the flag, not raising
the topic with anyone.

## Hard constraints carried into this mission

- SAOC scope boundary: orchids in cultivation — growing, showing, selling. Nothing about wild
  orchid conservation; that is WOSA's separate organisation and site.
- No restructuring of existing routes, no invented brand assets, colours, or logos — plain
  structure only until a Claude Design handoff arrives.
- British English throughout.
- Nothing in this mission touches `lib/buyers.ts`, `types/index.ts`'s `Order`/`Ticket` types, or
  any file under `contracts/` belonging to the in-flight `ticketing-foundation` mission.
