---
schema: athanor.mission/v1
slug: ticketing-foundation
goal: 'Build the scalable ticketing foundation from docs/ticketing-system-foundation-spec.md:
  show-scoped ticket types, an orders/positions data model, a capability-based staff
  role system, a public buyer-account and lost-ticket-recovery layer that grants zero
  admin capability, and an end-to-end human-proven purchase-to-door-scan flow'
created_at: '2026-08-17T14:39:52.125721+00:00'
started_at: '2026-08-17T16:35:26.642255+00:00'
last_active_at: '2026-08-17T18:22:39.892348+00:00'
status: in_progress
cost_estimate:
  features: 14
  milestones: 3
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F5
  ts: '2026-08-17T19:03:32+00:00'
features:
- id: F1
  title: 'Resolve `show` document collision: extend archive type for sales fields,
    proving backward compatibility'
  inline_brief: '§4.1. **COLLISION DETECTED:** `sanity/schemas/documents/show.ts`
    already exists as the *past-show archive* type with fields `title`, `slug`, `year`,
    `date`, `location`, `status`, `heroImage`, `entries`, `exhibitors`, `awards`,
    `summary`, `gallery`, `results` (PDF), and `classes` array. The spec was written
    without noticing this. F1''s first deliverable is resolving the collision by choosing
    between two candidates: **(Recommended) Extend the existing `show` document**
    by adding sales-facing fields (`edition`, `startDate`, `endDate`, `venue`, `salesOpen`,
    `active` boolean) to the archive type. This unifies the concept — one `show` type,
    all sessions and queries have one answer to "which show type do I mean." Cost:
    any new required field must be optional-or-defaulted to avoid invalidating published
    archive documents. **(Alternative) Introduce `sellableShow`** (or distinct type
    name) for the ticket entity, leaving archive `show` unchanged. Cost: two similar
    names forever, but no published-document impact. **@architect sizes the archive-document
    impact (how many published docs exist, whether new fields break existing queries/views)
    and makes the decision on that evidence.** Then, add a required `show` reference
    field to `ticketType`. **CORRECTED 2026-08-17 (as built, gate 9/9, @qa PASS) —
    the two sentences that stood here were factually impossible and must not be re-derived:**
    they said the `nationalShow` singleton would become the first `show` document
    keeping `_id: nationalShow`, and that `NATIONAL_SHOW_ID` would resolve dynamically
    by querying `show` where `active === true`. Sanity `_id`s are unique per dataset
    regardless of `_type`, so a `show`-typed doc cannot take the singleton''s `_id`
    without retyping the singleton (which breaks 3 queries and 8+ surfaces, not additive).
    And `NATIONAL_SHOW_ID` is a pure **Firestore** showId scoping string — it never
    fetches a Sanity document, so making it dynamic would have put the 14 existing
    Firestore tickets at risk for no gain. The brief conflated two unrelated identifier
    spaces. **As actually built:** `NATIONAL_SHOW_ID` stays the literal `''nationalShow''`,
    untouched; the already-existing `show-19-2027` archive doc became the first sales-capable
    show via a one-time idempotent `setIfMissing` migration; and active-show selection
    is a separate concept — `show.active` + `lib/show-resolution.ts`''s `resolveActiveShow()`,
    failing closed to `null` on both zero and 2+ active shows. Decision record: `contracts/golden/ticketing-f1-show-collision/README.md`.
    **Done (behavioral, not grep):** Sanity schema compiles, the first `show` document
    exists (either extended or new type per decision), `ticketType` documents can
    be queried by their `show` reference, checkout route still resolves the active
    show correctly against fixture data, and a test contract verifies that every existing
    published `show` document (if any) still passes validation and appears in every
    existing query that fetched it before the change.'
  status: done
  milestone: M1
  started_at: '2026-08-17T16:35:26.642072+00:00'
  completed_at: '2026-08-17T17:02:22.088622+00:00'
- id: F2
  title: Orders collection, position-level `orderId`, `TicketStatus` gains `refunded`,
    gateway-neutral payment fields
  inline_brief: '§4.2–§4.3. Add an `orders` Firestore collection sitting between `show`
    and `tickets` (positions): `showId`, `buyerName`, `buyerEmail`, `amount` (ZAR),
    `status: ''reserved'' | ''paid'' | ''cancelled''`, `expiresAt`, `idempotencyKey`,
    `purchasedAt`, `gateway`, `gatewayPaymentId`, `pf_payment_id`. Move all current
    payment-facing fields from `tickets` to orders. Add `orderId` field to ticket
    documents (position), linking to the parent order. Add `''refunded''` to `TicketStatus`
    union in `types/index.ts`. Update `types/index.ts` Order interface. The position-level
    fields (`bookingRef`, `attendeeName`, `attendeeEmail`, `ticketType`, `status`,
    `checkedInAt`, `showId`) remain unchanged — `lib/checkin.ts` reads one position
    by `bookingRef` with no joins, and that read shape is untouched. **Done:** Firestore
    schema compiles, orders collection exists, a test order with one position can
    be created, position document has `orderId` reference, `status` field on position
    correctly reads as one of five values including `refunded` (**CORRECTED 2026-08-17,
    caught by @architect during contract design — the brief originally said ''four
    values.'' `TicketStatus` already had four members before F2** (`''reserved''`,
    `''paid''`, `''cancelled''`, `''checked-in''`) **so adding `''refunded''` makes
    five, not four. The miscount treated F2''s addition as if it started from zero
    instead of from the pre-existing union.**), and a position can still be fetched
    by `bookingRef` with all fields intact.'
  status: done
  milestone: M1
  started_at: '2026-08-17T17:02:22.088849+00:00'
  completed_at: '2026-08-17T17:35:54.000000+00:00'
- id: F3
  title: Fixed capability set and `lib/admin-roles.ts` role→capability mapping with
    behavioural contract assertions
  inline_brief: '§5.2–§5.3. Define the seven core capabilities: `view-admin-dashboard`,
    `scan-checkin`, `lookup-booking-ref`, `search-buyers`, `issue-comp`, `issue-refund`,
    `export-buyer-data`. Create `lib/admin-roles.ts` as a server-side TypeScript constant
    module containing a `ROLE_TO_CAPABILITIES` map: `door-staff = {scan-checkin, lookup-booking-ref}`,
    `manager = {view-admin-dashboard, scan-checkin, lookup-booking-ref, search-buyers,
    issue-comp, issue-refund, export-buyer-data}`, `owner = {all seven}`. **Contract
    must include BEHAVIOURAL assertions (real function calls, not source-greps):**
    (1) every capability in the fixed set is granted by at least one role, and no
    role bundle references a non-existent capability; (2) resolving an unrecognised
    role name (e.g. `''unknown-role''`) against the mapping returns the empty capability
    set via an actual `resolve()` call; (3) the critical negative control: resolving
    `door-staff` must NOT include `export-buyer-data` or `search-buyers`, tested by
    actually invoking the resolution function. **Done:** `lib/admin-roles.ts` is syntactically
    correct TypeScript, all contract assertions pass, no capability typos exist in
    any bundle, and a fresh AI session reading the test output can explain what each
    assertion checks without reading the source file.'
  status: done
  milestone: M1
  started_at: '2026-08-17T18:02:58.094169+00:00'
  completed_at: '2026-08-17T18:22:39.892165+00:00'
- id: F4
  title: '`roles` custom claim (per-show map), AND-only composition, revoke-on-mutate
    tooling, batch-grant tooling, date-window lapse, one-time admin migration'
  inline_brief: '§5.4–§5.6. Add a `roles` custom claim shape: `{showId: [role1, role2...],
    ''*'': [role3...]}`. Extend `lib/admin-auth.ts` to check: `admin:true AND capability(resolve(roles,
    S)) ⊇ {required capability}`, where `resolve()` looks up each role name in `lib/admin-roles.ts`
    and returns the union of their capabilities. Unknown role names resolve to empty
    set — fail-closed by construction. Extend `scripts/admin-grant.ts` with `--role
    <name>` (repeatable, validated against `lib/admin-roles.ts`) and `--show <showId|*>`
    (no defaults); `door-staff` and `manager` may only be granted scoped to a show,
    never `*`. Extend `scripts/admin-revoke.ts` with optional `--role <name> --show
    <showId|*>` for partial revocation, calling `revokeRefreshTokens()` on all revokes.
    Extend `scripts/admin-list.ts` to print full `roles` map per account and flag
    any held role names no longer present in `lib/admin-roles.ts`. Add date-window
    lapse evaluation to `lib/admin-auth.ts`: a per-show role grant is only honoured
    while `now` falls within that show''s `startDate`/`endDate` window, read via a
    short-TTL cached show lookup. One-time migration: every existing account holding
    `admin:true` is re-granted `roles: {''*'': [''owner'']}` in a single script run.
    **Done:** `admin-grant.ts` validates role names, `admin-revoke.ts` can revoke
    a single role at a single scope and calls `revokeRefreshTokens()`, `admin-list.ts`
    flags orphaned role names, a test account can be granted `manager` scoped to `nationalShow`
    and verified to hold it, a test account can be revoked the same role and verified
    to lose it, the one-time migration script runs without error, and date-window
    evaluation returns false for a grant outside the show''s dates.'
  status: done
  milestone: M1
  started_at: '2026-08-17T18:22:39.892348+00:00'
  completed_at: '2026-08-17T19:03:32+00:00'
- id: F5
  title: '`buyers/{uid}` collection with consent record, hard security boundary proven
    by HTTP assertion'
  inline_brief: '§8.2–§8.4. Add a Firestore `buyers` collection keyed by Firebase
    Auth `uid`, with fields: `email`, `displayName` (optional), `newsletterOptIn:
    {optedIn: boolean, optInAt: timestamp|null, source: string}`, `createdAt`. Add
    optional `buyerUid` field to orders (backfilled at account claim time). **The
    hard security boundary is load-bearing and must be proven by contract assertion,
    not a source-grep.** A freshly self-registered Firebase Auth account with a `buyers`
    document must resolve to the empty capability set when checked against `lib/admin-roles.ts`,
    and a real HTTP round trip to any `/api/admin/*` or `/admin/*` surface must refuse
    that account with the same `403 missing-capability` that any unauthenticated request
    receives. The assertion is: sign up as a public buyer, create a `buyers` document
    for that `uid`, then attempt `POST /api/admin/checkin` with that account''s session
    — must fail with `403`, not succeed, not return a different error code. **Done:**
    `buyers` collection exists, a test account can be created and a `buyers` doc written
    for it, the HTTP round trip against a running server with explicit `timeout_seconds`
    proves the account is refused everywhere, and no code path accidentally grants
    admin access based on `buyers` document existence.'
  status: pending
  milestone: M1
- id: F6
  title: Signed order-access recovery token on orders, rate-limited resend-my-tickets
    endpoint
  inline_brief: '§8.2. Add `recoveryToken` field (60-bit, HMAC-signed) to every order
    at creation time, stored server-side. It scopes to exactly one order and its buyer.
    In the confirmation email (built in F11), include a deep link: `https://saoc.co.za/tickets/recover?token=<signed>`.
    Unauthenticated `GET /tickets/recover?token=<signed>` resolves the token to the
    order document, displays all positions'' QR codes inline, and allows re-sending
    the full email. Add `POST /tickets/resend-my-tickets` (public, rate-limited 5/email/hour
    at IP and email level, no account required): takes an email address and re-sends
    the order-access link to that address. Both mechanisms respond identically whether
    the email matched an order or not — no enumeration oracle. Rate-limit hits are
    logged but don''t expose an error message; the response is always "check your
    email." **Done:** `recoveryToken` is generated and stored on orders, the token
    verifies correctly and resolves to the right order, unauthenticated GET to the
    recovery URL returns the order''s positions with QR codes, rate-limiting is enforced
    (sixth attempt in one hour is refused identically to others), and resend requests
    with non-existent emails return the same "check your email" response as real matches.'
  status: pending
  milestone: M1
- id: F7
  title: Check-in audit trail — `checkinAttempts` collection capturing every scan
    outcome
  inline_brief: '§7.3. Add a `checkinAttempts` Firestore collection, written on every
    scan attempt (admits and refusals alike): `bookingRef`, `showId`, `deviceId`,
    `outcome` (''admit'' / ''not-found'' / ''wrong-show'' / ''unpaid'' / ''already-checked-in''),
    `scannedAt`, `source` (''online'' / ''offline-queued''), `syncedAt` (null until
    offline entry is reconciled). Write happens on the same transaction as the admission
    decision in `lib/checkin.ts`, adding no new abort surface. The `source` and `syncedAt`
    fields preserve the correct shape for future offline reconciliation, even though
    offline mode itself ships later. **Done:** every scan (success or refusal) writes
    one `checkinAttempts` document, the outcome field correctly reflects what happened
    (not-found for missing booking ref, wrong-show for mismatched showId, etc.), and
    a test contract can query the collection and count outcomes by type.'
  status: pending
  milestone: M1
- id: F8
  title: 'Comp-ticket route bypassing PayFast, writing order/position pair with `gateway:
    ''comp''`'
  inline_brief: '§4.5. Add `POST /api/admin/tickets/comp` (gated on `issue-comp` capability).
    Route takes `showId`, `attendeeName`, `attendeeEmail`, `ticketType` in the request
    body. Writes one order (`status: ''paid''`, `amount: 0`, `gateway: ''comp''`,
    `gatewayPaymentId: null`, no `pf_payment_id`) and one position (`status: ''paid''`).
    Adds `compedBy: string` field to position recording the admin''s email for audit.
    Comps use the same order/position shape as paid purchases, not a separate differently-shaped
    document — the `gateway` field distinguishes them. The ITN route is NOT modified
    — amount-0 never enters it. **Done:** route requires `issue-comp` capability (verified
    by testing with and without it), comp orders can be created, a comp position correctly
    has `status: ''paid''` without ever touching PayFast, and the `compedBy` field
    records who issued it.'
  status: pending
  milestone: M1
- id: F9
  title: Demo ticket type (single general show admission) scoped to active show, marker-tagged
  inline_brief: '§6, §11. Create one `ticketType` document scoped to the real active
    `show`: `name: ''General Admission''` (or similar, Brad''s call) with a placeholder
    price (explicitly noted as not final, pending Council decision). Must be marker-tagged
    (e.g. a `demo: true` flag or naming convention like `[demo]` prefix) to prevent
    accidental presentation as real pricing to visitors. The demo data must be created
    in Sanity so it appears in the same `ticketType.show` reference query that checkout
    will use. **Rationale:** proving one ticket type end to end is the goal of the
    first run; additional tiers are seeded data against an unchanged schema, so introducing
    them later is a content change, not a migration. The single type must NOT be hardcoded
    in any code path — checkout already resolves by slug against a `GROQ` queried
    list, and that must stay true, so the one-type run is a data choice that leaves
    the multi-type code path exercised. A contract assertion verifies the demo type
    is present, has the demo marker, and fixture checkout can select it without error.
    **Done:** the ticket type exists and is queryable by show, the marker tag is present
    and machine-readable, fixture checkout correctly selects it by querying the list
    (not by hardcoded slug), and the one-type data choice leaves the multi-type code
    path exercised.'
  status: pending
  milestone: M2
- id: F10
  title: 'Folded ITN re-pin ceremony: signature fix, `break` fix, order/position two-write,
    email hookup'
  inline_brief: '§6, §11. This is the single authorized reopening of the sha256-pinned
    `app/api/tickets/itn/route.ts`. Four changes fold into one ceremony: (1) unwire
    the inbound-signature algorithm — `generateNotifySignature` / `buildPayfastNotifyParamString`
    already exist in `lib/payfast.ts` but are not called; (2) fix the `parseOrderedFields`
    `continue`-vs-`break` divergence; (3) add order/position two-write transaction
    — instead of flipping one ticket document, read the order, and if `reserved`,
    transactionally flip the order to `paid` AND flip its one child position to `paid`;
    (4) after successful transaction commit, make a try/catch-isolated call to a new
    `sendConfirmationEmail()` helper. Re-pin the file after commit using the documented
    ceremony. The route''s existing capacity check, idempotency, and booking-ref logic
    are untouched. **Done:** the signature verification passes with real ITN payloads
    from PayFast sandbox, both order and position documents transition to `paid` in
    one transaction, the confirmation email helper is called without blocking the
    payment response, and the new file hash is re-pinned.'
  status: pending
  milestone: M2
- id: F11
  title: QR generation at email-send time, confirmation email with all positions'
    QRs and recovery link
  inline_brief: '§6, §11. Create a `sendConfirmationEmail()` function (called from
    F10''s ITN route) that: (1) generates a 2D QR code for each position''s `bookingRef`
    as an inline data-URI PNG (not a hosted ticket page — avoids guessable-URL problem);
    (2) builds one confirmation email addressed to the order''s `buyerEmail`, listing
    all positions'' attendee names and embedding all positions'' QR codes inline;
    (3) includes the recovery URL from F6 as a clickable deep link ("Lose your ticket?
    Click here"); (4) sends the email via Resend (if configured). The `sendConfirmationEmail()`
    function is tested in isolation with fixture data. For now, Resend account does
    not exist — fixture test use a mock Resend client that logs the email payload
    instead. A real human receives a real email only after Brad configures Resend;
    until then, M2 proof will be a logged payload inspection. **Done:** QR generation
    produces valid 2D codes decodable by a standard barcode scanner, the confirmation
    email template compiles and formats correctly, the recovery link is present and
    includes the signed token, the Resend mock logs every sent email, and fixture
    tests pass without a real Resend account.'
  status: pending
  milestone: M2
- id: F12
  title: Human purchase-and-scan proof on deployed host, venue door-connectivity observation
    recorded
  inline_brief: '§6, §7.4, §11. A real human makes a sandbox ticket purchase on the
    deployed host using demo ticket types from F9, receives the confirmation email
    from F11 (via logged mock if Resend is not configured), extracts the QR code,
    and scans it at the door using the admin door scanner. The scanner admits the
    ticket. Verify that `checkedInAt` is written to the position document and an entry
    appears in `checkinAttempts` with `outcome: ''admit''`. A second scan is refused
    with `already-checked-in`. **Required exit criterion:** this milestone must explicitly
    observe and record door connectivity at the venue (The Hangar, Stellenbosch Flying
    Club). Have the tester load the venue''s actual network on a phone, attempt a
    scan online (must work), then enable aeroplane mode and attempt a scan (record
    what happens). Whatever the outcome, document it as an explicit deliverable —
    Cloud Logging entries showing the scan attempts, Firestore checkinAttempts collection
    showing attempt outcomes, and a human-written note on what connectivity was observed.
    This observation gates whether the full offline PWA will be built or whether the
    audit trail alone is sufficient. **Done:** a real order exists on the deployed
    host, a real scan admits one ticket and refuses a second, `checkedInAt` is written,
    audit trail entry is created, and the door connectivity observation is recorded.'
  status: pending
  milestone: M2
- id: F13
  title: Lee-Ann granted real per-show `manager` role, verified by HTTP round trips
    including negative control
  inline_brief: '§5.8, §11. Onboard Lee-Ann as a real `manager` for the 2027 show
    using the tooling from F4. Run `pnpm exec tsx scripts/admin-grant.ts leeann@example.com
    --role manager --show nationalShow`, verify the account is created and the claim
    is set. Add her email to `ADMIN_EMAIL_ALLOWLIST` in Firebase Secret Manager. Have
    her sign in via Google on the deployed host''s `/admin/login`. **Verification
    is real HTTP round trips:** (1) positive control: confirm she reaches `/admin/door`
    and can check a ticket in using F12''s admitted position; (2) positive control:
    confirm `GET /api/admin/export-csv?showId=nationalShow` succeeds; (3) negative
    control (scope, not capability): confirm a request for a different show id is
    refused with `wrong-show` or equivalent scope refusal. Both positive and negative
    outcomes must be asserted. This proves her grant is genuinely per-show. **Done:**
    Lee-Ann''s account exists in Firebase, she holds `admin:true` and `roles: {nationalShow:
    [''manager'']}`, she can perform manager-level actions on the 2027 show, and she
    is refused access to a different show, with both HTTP outcomes verified.'
  status: pending
  milestone: M3
- id: F14
  title: Lost-ticket recovery proven end-to-end by a human — test buyer recovers via
    resend form and signed link
  inline_brief: §8.2, §11. A test buyer makes a sandbox ticket purchase on the deployed
    host, receiving a confirmation email with the recovery link and resend form availability.
    Simulate loss of that email (delete it). Using the public `/tickets` page, find
    the "I lost my ticket" link or resend form, enter the buyer's email address, and
    receive a resend of the recovery email with the recovery link. Click the recovery
    link without logging in (unauthenticated access) and verify the page displays
    all positions' QR codes and attendee names. Re-send the email again from the recovery
    page and verify it arrives. **Done:** the resend form accepts an email address
    that matches an order and re-sends the recovery email within 2 minutes, the recovery
    page displays correct data without authentication, the signed token is valid,
    and re-send from the recovery page succeeds. This closes the gap that existed
    in the prior mission — loss of a ticket email is now recoverable by the buyer
    without contacting support.
  status: pending
  milestone: M3
milestones:
- id: M1
  title: 'Foundation: data model and security blueprint, proven by behavioural contract'
  features:
  - F1
  - F2
  - F3
  - F4
  - F5
  - F6
  - F7
  - F8
  status: pending
- id: M2
  title: A real ticket bought, emailed, and scanned at the door, with venue connectivity
    recorded
  features:
  - F9
  - F10
  - F11
  - F12
  status: pending
- id: M3
  title: Real staff onboarded with scoped access, and a real buyer recovers a lost
    ticket
  features:
  - F13
  - F14
  status: pending
---





# Mission: Ticketing Foundation — Data Model, Roles, and End-to-End Proof

## Context

Brad's words, 2026-08-17: *"I feel like we're patching this ticketing system in bits and pieces. We need a proper full plan and we build a fully working ticketing system that is scalable that we can then add additional features to. But we need the base ticketing workflow to be dialed in before we try expand it."* Plus: *"We're dealing with people's data here, so security is top priority all the time."*

The `docs/ticketing-system-foundation-spec.md` is approved and sets the target architecture for everything built in this mission. It reverses one key position from an earlier draft (the Order/Position model, adopted from pretix's reference design) and introduces per-show role scoping to handle the operational reality of "tons of door operators" turning over every show. The spec's Milestone structure (§11) is realized here, with three strictly sequenced milestones: **M1 (foundation model, zero user-visible change), M2 (end-to-end proof with human purchase-and-scan and venue connectivity observation), M3 (real staff onboarded and buyer self-recovery proven).**

The system currently works for exactly one show with binary admin/not-admin access. Multi-show and multi-tier support require changes to the data model that are expensive to retrofit once real transactions exist — this mission rebuilds the foundation against zero live tickets, so that 2027 starts with the right shape.

### Security Framing — Standing Rule for This Mission

> **We're dealing with people's data here, so security is top priority all the time.**

Every authorization assertion is a real HTTP round trip against a running server, with explicit `timeout_seconds`, and every assertion includes a negative control. A permission boundary that is merely declared in code but never tested is not a permission boundary — this project has shipped false-green assertions before (a gate that passed 24/24 while doing nothing, because every check was against a declaration instead of an outcome). Negative controls prove what we thought happens actually happens. Positive controls alone prove nothing.

---

## Decisions Made and Locked In

### 1. `door-staff` gets `lookup-booking-ref`, barred from `search-buyers` and `export-buyer-data`

A visitor arriving at the door with a dead phone battery is routine. The booking reference is on their printed ticket or in the email they can read aloud — refusing lookup entirely would escalate every such case to a manager on show morning. The reference-lookup half is safe (exact match, no enumeration); name/email browsing across the whole buyer list is the POPIA-sensitive half, and that stays barred (§5.2). This is precisely what the lookup split exists to make expressible: whether an answer is yes or no, it's a role-bundle change, not a capability redesign.

### 2. Comps bypass PayFast entirely

Comp (complimentary) tickets write the same order/position shape as a paid purchase, but with `gateway: 'comp'`, `amount: 0`, and no `pf_payment_id` — no amount-0 special case ever enters the pinned ITN route (§6, F10). This keeps the payment security boundary's scope exactly as it is today.

### 3. Resend is a hard external blocker Brad alone can clear

No Resend account exists in `.env.local` or `apphosting.yaml` today. F11 (confirmation email) is **blocked** until it does. Sequencing keeps email off the critical path: every M1 feature and F9/F10 must be completable while F11 is blocked. M2 builds and fixture-tests the email path regardless, logging the payload if Resend is unconfigured; real human receipt waits for Brad to provision Resend.

### 4. Demo tier names are placeholders, marker-tagged

`Day Visitor` and `Full Show — All Days` are explicit, labelled placeholders pending Council decision on real pricing. A placeholder that is not labelled as one becomes a fact — this project's own precedent is a venue placeholder ("CTICC") that spread across six fields before it was caught. F9 requires the marker tag to be machine-readable and present.

### 5. `show` document collision: extend existing archive type, not a new type

`sanity/schemas/documents/show.ts` already exists as the past-show archive — `title`, `slug`, `year`, `date`, `location`, `status`, `heroImage`, `entries`, `exhibitors`, `awards`, `summary`, `gallery`, `results`, `classes`. The spec's §4.1 assumed a fresh `show` type. F1's first deliverable is resolving this collision. **Decision:** extend the existing type by adding sales fields (`edition`, `startDate`, `endDate`, `venue`, `salesOpen`, `active`), not a second similarly-named type. One `show` concept means every query and future session has one obvious answer. Cost: new optional-or-defaulted fields to avoid invalidating published archive documents. @architect sizes that impact (how many archived docs, whether new fields break existing queries/views) and makes the final call on evidence, not on intuition.

### 6. One ticket type for the first run, not two

The spec's §11 suggested seeding two demo ticket types (`Day Visitor`, `Full Show`). **Brad's instruction:** prove one ticket type end to end first; additional tiers are data, not code, so they arrive later as a content change against the unchanged schema. Multiple ticket types are already supported (schema exists, code supports it, fixtures seed it) — this narrowing removes demo *data*, not machinery. Checkout already resolves by slug against a queried list, and that path stays exercised, so the one-type run is a data choice that leaves the multi-type code path ready to use immediately.

---

## Scope Discipline — Guardrails for This Mission

Carry these forward. They are standing constraints, verified against the `admin-auth-hardening` mission's equivalent section:

- **Never delete any Firestore document.** Deletion is Brad's call alone. If a record must stop being used, mark it as inactive.
- **`app/api/tickets/itn/route.ts` is sha256-pinned.** F10 is the single authorized reopening, via the documented re-pin ceremony. No other feature opens it.
- **`branding/`, `design spec/`, `design/Claude Design HTML/` are Brad's active workstream.** Leave them alone.
- **Every security assertion is a real HTTP round trip against a running server with an explicit `timeout_seconds`.** Every check needs a negative control. A test that cannot fail proves nothing. Source-greps do not count as proof.
- **Visual work is not done until a browser has seen it** — applies to F6's recovery page and any buyer-facing surface. Use BrowserAgent to capture screenshots and verify rendering.
- **SAOC-2027-ZNYT37Z88MSH** ("ITN Test", 2026-08-15) is unidentified and must not be touched, allowlisted, or deleted by any agent.

---

## Known Constraints

- **Session cookies last 5 days.** Role downgrade or revocation must explicitly call `revokeRefreshTokens()` to take effect immediately — waiting for natural expiry would leave the old claim valid for up to 5 days (F4 tooling is load-bearing here).
- **Firebase custom claims are capped at ~1000 bytes total.** Per-show role grants accumulate in the map; §5.7's "revoke event-specific roles after each show" practice keeps the map pruned (recommended operational discipline, not automatic).
- **No Resend account exists yet.** F11 builds and fixture-tests the email path; real sending waits for Brad to configure it (external blocker, not internal to this mission).
- **The `show` document's dates govern `door-staff` access by default.** An account granted `door-staff` for a show only holds that access while the show's dates are active — the date window is evaluated on every authorization check, via a short-TTL cached show lookup (F4 and F7.6's mechanism).

---

## Relationship to Other Work

- **`admin-auth-hardening` (completed 2026-08-17).** This mission depends on F1–F5 being shipped; role-based authorization builds on top of the `admin: true` authentication gate that mission closed. The `door-staff`/`manager`/`owner` tiers are Brad's own three-tier model from that context.
- **`sandbox-ticket-proof` (paused).** Its F3 (a human sandbox purchase) and F5 (door admission) were blocked on auth. Once M3 here is complete, that mission's purchase proof is superseded — F12 (human proof) and F13/F14 (staff onboarding and buyer recovery) are the proof this mission delivers instead.

---

## Notes

- Dev server: `pnpm dev:secure` runs on port 3333, reachable at `https://dev.saoc.co.za`.
- **Security-critical:** test behaviour against the **deployed host** as well as locally — the two have diverged before, expensively (noted in `admin-auth-hardening`'s context).
- Brad's 2027 show venue is **The Hangar, Stellenbosch Flying Club** (an aerodrome) — connectivity is unconfirmed. F12's venue connectivity observation (§7.4, §11 of the spec) is an explicit, recorded deliverable, not an afterthought.
- Resend account configuration: Brad holds the decision and the credentials. Early communication is key — F11 is blocked until it exists, but M1 is not.
