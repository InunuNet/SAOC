---
schema: athanor.mission/v1
slug: ticketing-foundation
goal: 'Build the scalable ticketing foundation from docs/ticketing-system-foundation-spec.md:
  show-scoped ticket types, an orders/positions data model, a capability-based staff
  role system, a public buyer-account and lost-ticket-recovery layer that grants zero
  admin capability, and an end-to-end human-proven purchase-to-door-scan flow'
created_at: '2026-08-17T14:39:52.125721+00:00'
started_at: '2026-08-17T16:35:26.642255+00:00'
last_active_at: '2026-08-17T21:52:34.547085+00:00'
status: in_progress
cost_estimate:
  features: 14
  milestones: 3
  total_calls: 0
last_checkpoint:
  milestone: M3
  feature: F14
  ts: '2026-08-17T21:52:34.547085+00:00'
features:
- id: F1
  title: 'Resolve `show` document collision: extend archive type for sales fields,
    proving backward compatibility'
  inline_brief: null
  status: done
  milestone: M1
  started_at: '2026-08-17T16:35:26.642072+00:00'
  completed_at: '2026-08-17T17:02:22.088622+00:00'
  spec: docs/ticketing-system-foundation-spec.md
  contract: contracts/contract-ticketing-f1-show-collision.yaml
- id: F2
  title: Orders collection, position-level `orderId`, `TicketStatus` gains `refunded`,
    gateway-neutral payment fields
  inline_brief: null
  status: done
  milestone: M1
  started_at: '2026-08-17T17:02:22.088849+00:00'
  completed_at: '2026-08-17T17:35:54.000000+00:00'
  spec: docs/ticketing-system-foundation-spec.md
  contract: contracts/contract-ticketing-f2-orders-model.yaml
- id: F3
  title: Fixed capability set and `lib/admin-roles.ts` role→capability mapping with
    behavioural contract assertions
  inline_brief: null
  status: done
  milestone: M1
  started_at: '2026-08-17T18:02:58.094169+00:00'
  completed_at: '2026-08-17T18:22:39.892165+00:00'
  spec: docs/ticketing-system-foundation-spec.md
  contract: contracts/contract-ticketing-f3-admin-roles.yaml
- id: F4
  title: '`roles` custom claim (per-show map), AND-only composition, revoke-on-mutate
    tooling, batch-grant tooling, date-window lapse, one-time admin migration'
  inline_brief: null
  status: done
  milestone: M1
  started_at: '2026-08-17T18:22:39.892348+00:00'
  completed_at: '2026-08-17T19:03:32+00:00'
  spec: docs/ticketing-system-foundation-spec.md
  contract: contracts/contract-ticketing-f4-roles-claim.yaml
- id: F5
  title: '`buyers/{uid}` collection with consent record, hard security boundary proven
    by HTTP assertion'
  inline_brief: null
  status: done
  milestone: M1
  completed_at: '2026-08-17T20:12:20.534271+00:00'
  spec: docs/ticketing-system-foundation-spec.md
  contract: contracts/contract-ticketing-f5-buyers.yaml
- id: F6
  title: Signed order-access recovery token on orders, rate-limited resend-my-tickets
    endpoint
  inline_brief: null
  status: done
  milestone: M1
  completed_at: '2026-08-17T20:12:20.744706+00:00'
  spec: docs/ticketing-system-foundation-spec.md
  contract: contracts/contract-ticketing-f6-recovery-token.yaml
- id: F7
  title: Check-in audit trail — `checkinAttempts` collection capturing every scan
    outcome
  inline_brief: null
  status: done
  milestone: M1
  completed_at: '2026-08-17T20:54:01.877976+00:00'
  spec: docs/ticketing-system-foundation-spec.md
  contract: contracts/contract-ticketing-f7-checkin-audit.yaml
- id: F8
  title: 'Comp-ticket route bypassing PayFast, writing order/position pair with `gateway:
    ''comp''`'
  inline_brief: null
  status: done
  milestone: M1
  completed_at: '2026-08-17T20:54:02.097684+00:00'
  spec: docs/ticketing-system-foundation-spec.md
  contract: contracts/contract-ticketing-f8-comp-tickets.yaml
- id: F9
  title: Demo ticket type (single general show admission) scoped to active show, marker-tagged
  inline_brief: null
  status: done
  milestone: M2
  completed_at: '2026-08-17T20:54:02.311314+00:00'
  spec: docs/ticketing-system-foundation-spec.md
  contract: contracts/contract-ticketing-f9-demo-ticket.yaml
- id: F10
  title: 'Folded ITN re-pin ceremony: signature fix, `break` fix, order/position two-write,
    email hookup'
  inline_brief: null
  status: done
  milestone: M2
  completed_at: '2026-08-17T20:54:02.515611+00:00'
  spec: docs/ticketing-system-foundation-spec.md
  contract: contracts/contract-ticketing-f10-itn-repin.yaml
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
  status: done
  milestone: M2
  completed_at: '2026-08-17T21:26:07.206476+00:00'
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
  status: blocked
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
  status: blocked
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
  status: blocked
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
  status: done
  gate_ran_at: '2026-08-17T21:06:52.876095+00:00'
  gate_result: pass
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
