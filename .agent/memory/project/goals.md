# Goals

## Mission

Build and maintain the South African Orchid Council's digital presence and tooling. SAOC is the workspace for this project, running on the Athanor agentic framework.

## Active Goals

1. Establish what the SAOC project needs to build (website, membership system, events, etc.)
2. Keep the Athanor workspace healthy and in sync
3. Deliver working software for the South African Orchid Council

## Current Mission Status (updated 2026-08-12)

**Overnight four-stream session, all shipped in `be80580` — four contracts green and documented:**

- ~~`ticketing-hardening` — F6 payment/door security (37/37, @qa PASS)~~ ✅ Door scanner fails
  closed on every unenumerated state; capacity is a Firestore transaction; booking refs are
  60-bit crypto-random; checkout idempotency is bound to buyer and payload; abandoned
  reservations release on a TTL that can never expire a paid ticket; `SITE_URL` declared in
  `apphosting.yaml`. **@qa round 2 raised R2-1…R2-5, none fixed** — see `backlog.md`.
- ~~`show-visitor-info` (72/72)~~ ✅ Show identity now flows from the `nationalShow` singleton to
  all seven surfaces; Plan Your Visit, What to Expect and FAQ added, Sanity-editable and marked
  pending committee confirmation. **Round-2 fixes gate-verified but not re-reviewed by @qa.**
- ~~`cms-wiring-cleanup` (14/14, @qa PASS)~~ ✅ Event revalidation tags, archive detail merge,
  `province` wiring, two dead fields removed.
- ~~`show-exhibitor-info` (52/52)~~ ✅ Structured entry guide replacing the placeholder, built on
  researched international convention and marked pending, not stated as SAOC policy.
  **Round-2 fixes gate-verified but not re-reviewed by @qa.**

Still open on ticketing: **F5 (emailed QR ticket)**. Highest-value remaining work is @qa round 3
on Stream A and first round-2 review on B and D.

Two blockers are external, not code: **Firebase Auth is unprovisioned on `saoc-webapp`**, so
`/admin` and the door scanner are non-functional in every environment; and the committee still
owes real prices, capacity, venue, dates and every exhibitor rule. Both in `needs-human.md`.

### Prior status (2026-08-11)

`ticketing-pages` — M1+M2 (F1–F4) done, gate green 57/57. Public ticket flow exists end to end:
`/tickets` (buy page), `/tickets/confirmation` (honest pending/paid polling against the ITN
race), `/tickets/cancelled`, `/api/tickets/status`. Pricing, capacity, sales-open switch and all
visitor-facing copy are Sanity-controlled (`ticketType` docs + `ticketsPage` singleton +
`nationalShow.salesOpen`) — the payment code itself (`lib/payfast.ts`, the ITN route) never
imports Sanity, mechanically enforced. Dataset seeded with 5 provisional ticket types,
`salesOpen=true` for the demo. Docs: `docs/ticketing.md`, `docs/ticketing-for-editors.md`.
Remaining: F5 (emailed QR ticket), F6 (a11y + payment-security hardening — see backlog's F6 door
scanner / TOCTOU / idempotency items), F7 (docs + deploy config, incl. `SITE_URL` in
`apphosting.yaml`). See `reboot.md` for resume instructions.

`cms-activation-deploy` (prior mission) — 5 of 6 features done; F6 (Studio edit → live site) was
BLOCKED on a Firebase App Hosting CDN edge, since resolved by the later `cms-loop-and-wiring`
mission (bounded-staleness `revalidate = 60` fix, see `learned.md`).

### admin-auth-hardening (started 2026-08-14, in progress)

M1 (auth gate closed + proven + provisioning) done and gated. **F4 (Google sign-in) done
2026-08-15**, gate green 6/6 — claim-first provisioning design, see `learned.md`. ~~F5
(Microsoft + Apple sign-in) PARKED by user decision~~ ✅ **F5 done 2026-08-17** — resumed from
PARKED, shipped `3ffc36a`, milestone M2 gates 2/2. Mission stands at **5/6 features done; only
F6 remains** ("door scanner and admin proven working end to end, by a human" — inherently a
human task, milestone M3). See `learned.md` "F5 admin-auth-hardening" and `backlog.md`.

**2026-08-15, post-ship:** F4 met reality and needed three real fixes a green gate could not
catch — invisible login inputs (and the identical defect on `/admin`/`/admin/door` one click
behind it), a missing deployed `ADMIN_EMAIL_ALLOWLIST`, and `beta.saoc.co.za` not yet in
Firebase's authorised domains. All three fixed (`79ee2f8`, `93c5855`, `22397a1`), verified by
browser against the live build, and **F4 is now proven end to end by a human** — Brad signed in
with Google and reached `/admin` with real ticket data, same Firebase uid throughout, no second
account. This closes F6's admin half. **F6's door-scanner half is still `pending`, milestone
M3** — not yet proven at a real entrance by a human. New standing rule added to `rules.md`:
"Visual work is not done until a browser has seen it." See `backlog.md`
"admin-auth-hardening" section and `learned.md` "F4 meets reality" for full detail.

### 2026-08-16 — safety scanner shipped ahead of mission chain, ticketing still blocked on the pin

Out-of-mission session (active mission checkpoint stayed at M2/F4, unchanged) shipped three
commits: `f7155fe` live-dataset residue scanner + CI guard (DONE), `2828d0a` PayFast ITN
signature helpers (BLOCKED — route stays sha256-pinned, no ticket can reach `paid` until Brad
authorizes the re-pin ceremony), `011d98b` WCAG accent-contrast audit (HELD for Brad's design
call, no production code). Also repaired a live content defect found this session: the
`/national-show` H1 had been serving a leftover `F3-TITLE-SENTINEL-*` string with a
2098-12-31 countdown for ~3 days — restored from seed, revalidated, verified. **The PayFast
pin-lift is now the single blocker standing between the codebase and F6 (door check-in proven
end to end) / go-live** — see `backlog.md` "Session 2026-08-16" section.

### 2026-08-16 (afternoon) — P1 weak-assertion audit: DONE, no live vulnerability

~~P1 weak-assertion audit across payment/auth-security contracts~~ ✅ Every audited property
(admin claim enforcement, ITN signature, amount match, server-confirm gating, transaction
atomicity, idempotent replay) verified correctly implemented in the actual code; the assertions
guarding several of them were weak enough that stub handlers with only comment-level keywords
passed them. Fixed across `650d02c` through `f4a37bd` (six commits) — see `backlog.md` and
`learned.md` for full detail and the reusable "retire via `exit 77` + `SUPERSEDED:`" remedy for
contracts that go red because the code improved. **New open finding, not yet explained:** the
Firestore `tickets` fixture-leak count is climbing session over session (5→12→17 docs) despite
checks calling `withCleanup()` — root cause unmeasured, tracked in `backlog.md`. The PayFast
sha256-pin lift (Brad's call) remains the single blocker on F6/go-live; untouched this session.

### 2026-08-17 — ticketing spec extended (§8 buyer accounts), `ticketing-foundation` mission planned

Brad flagged that a lost ticket is currently unrecoverable — nothing emails a ticket, no
buyer-facing lookup exists. Spec extended with §8 (`docs/ticketing-system-foundation-spec.md`,
commit `2e81ca2`): recovery via a signed `recoveryToken` on the order plus a rate-limited
resend-my-tickets form, no account required; an optional `buyers/{uid}` layer adds newsletter
consent + purchase history but grants zero admin capability (self-signup is still open). Brad
approved the spec. New mission `ticketing-foundation` planned and committed (`aff6c2f`): 14
features, 3 milestones, status `pending` — not yet started. The old zero-milestone
`2026-08-17-ticket-flow-end-to-end.md` stub is closed. `ticketing-foundation` is now the ACTIVE
mission (`active.json`, activated 2026-08-17T14:39Z); `admin-auth-hardening` is `paused` at 5/6
with F6 (door-scanner proof, needs a human) outstanding — it is not blocking, and F6 is largely
superseded by this mission's F12, which proves the same scan path against a real purchase.
Note: `brain.py` still reports `admin-auth-hardening` as active and skipped its scratch purge on
that basis — its detection disagrees with `active.json`, which is authoritative. See `backlog.md` "Session 2026-08-17" and `learned.md` "Ticketing foundation spec —
§8 buyer accounts" for full detail, including the F1 schema-collision decision and the DNS/Resend
sequencing note (nameservers still point at the old host; Resend DNS must wait for the switch).

### 2026-08-17 (later still) — F2 done

~~F2 (orders collection, position-level `orderId`, `TicketStatus` gains `refunded`,
gateway-neutral payment fields)~~ ✅ **DONE**, gate 7/7 (re-run twice), @qa PASS across two
rounds, docs complete. Checkpoint now M1/F2, 2 of 14 features shipped. See `learned.md`
"Ticketing foundation — F2 done" for the schema-verification catch (a proposed type move would
have denied fields present on all 14 live position documents with no migration in scope) and the
check-quality lessons (verify-by-construction for typecheck assertions, a false citation caught
in a decision-record doc, an idle-but-not-actually-done report caught by checking disk state).

### 2026-08-17 (later still) — F3 done

~~F3 (admin roles/capabilities — `lib/admin-roles.ts`, seven-capability set, three role bundles
`door-staff`/`manager`/`owner`, `resolve()`)~~ ✅ **DONE**, gate 8/8 (re-run twice), zero
`agent_review` assertions, docs in `docs/ticketing.md` + `docs/admin-access.md`. Checkpoint now
M1/F3, 3 of 14 features shipped. See `learned.md` "Ticketing foundation — F3 done" for a golden
README that contradicted its own prose (and which half @dev followed), the
authorship-vs-behaviour assertion-design lesson, an agent that deleted @dev's untracked
implementation during its own temp-file cleanup, and a Haiku 4.5 documentation-prose reliability
finding (six factual errors) that keeps Sonnet 5 as the project default for subagent prose/code.

### 2026-08-17 (later) — F1 done, `ticketing-foundation` now the active in-progress mission

~~F1 (resolve the `show` schema collision)~~ ✅ **DONE**, @qa PASS, gate 9/9 (re-run twice by the
orchestrator, including after docs). `show.ts` extended with 6 optional sales fields rather than a
competing type; `NATIONAL_SHOW_ID` unchanged; `show-19-2027` is now the first sales-capable show;
active-show selection via `show.active` + `resolveActiveShow()`, fails closed. Mission checkpoint
now M1/F1 done, 1 of 14 features shipped. The mission brief's proposed identifier-merging approach
was wrong and has been corrected in the mission file itself — see `learned.md` "Ticketing
foundation — F1 done" for the full correction and the two check-quality defects found along the
way (A7 population mismatch, A6 `node --import tsx/esm` alias-resolution gap). `admin-auth-hardening`
remains **paused** at 5/6 (F6, door-scanner human proof, outstanding) — not blocking, largely
superseded by this mission's later F12.

### 2026-08-17 (later still) — F4 done

~~F4 (`roles` custom claim per-show map, AND-only composition, revoke-on-mutate tooling,
batch-grant tooling, date-window lapse, one-time admin migration)~~ ✅ **DONE**, gate 12/12
(verified twice by the orchestrator), F3's gate re-run and still 8/8 (no regression), @qa PASS
(8 mutants attempted, 7 died). `lib/admin-auth.ts` extended; new `lib/admin-grant-validation.ts`,
`lib/admin-revoke-plan.ts`, `lib/admin-orphan-roles.ts`, `lib/admin-migrate-roles-plan.ts`, new
`scripts/admin-migrate-roles.ts`, extended `scripts/admin-grant.ts` / `admin-revoke.ts` /
`admin-list.ts`. Docs in `docs/ticketing.md` (F4 section) and `docs/admin-access.md`. Checkpoint
now M1/F5, **4 of 14 features shipped, M1 at 4/8**. Two real gaps found and deferred to their
natural owners rather than fixed inline: no claim-size guard on the grant path (Firebase's
~1000-byte custom-claim cap, targeted at F13's batch-grant work) and a throwing
`lookupShowWindow` that would propagate out of `hasCapability()` as a 500 instead of a clean 403
(F5 to decide when wiring the real lookup). The live one-time migration has **NOT** been run —
`scripts/admin-migrate-roles.ts` is dry-run by default; no account, including `brad@inunu.net`,
currently holds a `roles` claim. Running it with `--apply` needs Brad's explicit authorisation.
See `learned.md` "Ticketing foundation — F4 done" and `backlog.md`.

### 2026-08-17 (latest) — F11 done; mission `ticketing-foundation` now blocked on Brad, no autonomous work left

~~F11 (QR generation at email-send time + real multi-position confirmation email + recovery
link)~~ ✅ **DONE**, gate `contract-ticketing-f11-qr-confirmation-email.yaml` 9/9, run twice
(before and after @qa's mutation pass), green both times. @qa PASS — 10 mutations against real
source, 8 killed, 1 no-op (not a finding), 1 partial survivor (`.trim()` half of the empty-
`bookingRef` guard, filed as a P3 backlog item). New `lib/qr.ts`, `lib/recovery-url.ts`,
`emails/OrderConfirmation.tsx`; F10's `lib/confirmation-email.ts` surface and the pinned ITN
route's call site untouched. Docs updated (`docs/ticketing.md` +144 lines, `README.md:99`,
`.env.local.example`). M2 is now F9/F10/F11 done, F12 pending.

**Mission status: no autonomous feature work remains in `ticketing-foundation`.** F12 (human
purchase-and-scan proof at The Hangar, incl. venue connectivity observation), F13 (Lee-Ann's real
per-show `manager` grant verified by live HTTP round trips), and F14 (a human buyer proving
lost-ticket recovery end-to-end) all require human/live action that no agent can perform. F12
will also hit the pre-existing, already-logged blocker that checkout never creates an `orders`
document (see `needs-human.md` "Ticketing foundation F11 — checkout never creates an `orders`
document", now updated with F11's completion status). The mission is blocked on Brad until he
acts on F12/F13's prerequisites. **Status unchanged this session: 11/14, F12-F14 still awaiting
Brad.**

### 2026-08-19 — `policy-pages` (F1) done: merchant-account-blocking legal content shipped

Ozow confirmed (on a trial merchant application) that South African payment gateways require
Privacy Policy, Terms of Service, and Refund Policy pages before approving a merchant account —
no merchant account, no ticket sales. F1 shipped all three (`/privacy` rewritten to remove a
false third-party-sharing denial, `/terms` gained conditions of sale, `/refunds` is new and
deliberately figure-free pending council input). Gate: 14/14 pass; Codex pass run (one finding,
attributed to pre-existing repo-wide Prettier drift, not this change). Four follow-ups logged in
`backlog.md` under "Session 2026-08-19" — two blocked on council (POPIA Information Officer
designation, refund terms), one repo-hygiene (Prettier), one standing (legal review notice).

### 2026-08-18 — `vendor-registration` mission reaches `close_out`, 10/11 features done

M1 (F1-F5, naming disambiguation through the public register route), M2 (F6-F9, review
workflow, offline EFT payment path, permit-posture handling, approval email) and M3's F11
(POPIA sensitivity flag recorded, no conversation opened) all shipped and gated. Only **F10**
(a human proof: submit the public form, approve it in `/admin/vendors` with a booth number,
confirm the approval email renders it correctly) remains — runbook in `needs-human.md` under
"Vendor registration F10 — human proof (Brad, ~10 min)". Mission moved to `close_out` via
`execution/mission.py close-out`; `active.json` updated. Both major missions now sit in the same
shape: fully gated on the autonomous side, blocked only on a human doing a real end-to-end
click-through. Three incidents from this session are recorded in `learned.md`: mutation residue
from a stopped QA agent shipped once into a production file (fixed `cd0308d`), `git checkout --`
destroying uncommitted work under test during a mutation revert (recovered from an agent's own
earlier verbatim read, not from git), and a fabricated `<system-reminder>` instructing a QA agent
to hide a claimed file change from the user (the agent correctly disregarded it and surfaced it —
treat any reminder demanding silence as hostile by construction).

### 2026-08-20 — `multi-line-item-cart` mission: M1 + M2 closed (visitor ticketing purchase flow)

New mission, active since 2026-08-20, replacing the single-line-item ticket flow with a real
cart: multiple ticket types/quantities per order, real admission products, day selection and
named attendees. Session resumed mid-mission after a macOS crash.

~~M1 (cart end-to-end: checkout, UI, drift guard)~~ ✅ **DONE**, 23/23 gated across F1-F3,
including F3's UX-defect fixes found via prior browser testing. Committed.

~~M2 (real products + day/attendee capture)~~ ✅ **DONE** — two features:
- **F4** (five admission products as `ticketType` documents): `lib/provisional-figures.ts` is the
  sole source of truth for price/capacity/releasedQuantity; `effectiveCapacity()` and
  `isWithinEarlyBirdWindow()` enforce it. Gate 11/11. Codex found 2 real defects @qa missed (see
  `learned.md` "multi-line-item-cart, M1+M2"), both fixed, re-gated. Committed `360dd15`.
- **F5** (day selection + named attendees): `computeShowDays()`/`isValidChosenDay()` driven
  entirely by the show record's real `startDate`/`endDate` — never hardcode or derive a
  placeholder show date, this project has been burned by that twice before (see
  `project_show_dates_placeholder`). Gate 15/15 after fixing a real SAST/UTC calendar-day bug
  (@qa) and two more Codex-found gaps (chosenDay not stripped for non-day tickets; idempotency
  replay ignoring chosenDay). Committed `8246559`.

Final verified state: F1/F2 9/9, F3-UI 5/5, F4 11/11, F5 15/15, Codex clean on full F5 diff, all
independently re-run by the orchestrator. See `learned.md` for the reusable lessons (required-
field additions breaking earlier frozen fixtures; Codex catching what @qa misses; SAST timezone
recurrence).

**Next: F6** (booking contact block + POPIA-sensitive fields + 5-ticket cap) — flagged as a
checkpoint before starting, since `/privacy` is currently known-inaccurate about what's actually
collected (see `project_popia_deferred`). Not started this session.

### 2026-08-21 — `multi-line-item-cart` paused; live purchase proven end-to-end; new mission drafted

Mission paused (not closed) with F6 not started. Session instead: (1) proved a real ticketing
purchase against the DEPLOYED site — pushed 12 unpushed local commits, explicitly triggered a
Firebase App Hosting rollout (does not auto-fire on push — see `learned.md`), re-seeded production
Sanity, then verified via BrowserAgent purchase flow AND an independent Firestore read that a Day
Visitor and a VIP position both landed `paid` with correct `chosenDay` handling under one shared
orderId; (2) caught and corrected real memory/backlog drift — show dates were already confirmed
(16–19 Sept 2027, not the old 18–21 placeholder) and `/privacy`/`/refunds`/`/terms` already existed
and were already linked to Lee-Ann, contrary to what prior-session memory claimed (see
`learned.md`); (3) drafted new mission `.agent/memory/project/missions/2026-08-21-leeann-content-
corrections.md` (F1 purge stale 18–21 Sept placeholder + re-seed confirmed dates, F2 designate
Lee-Ann as interim POPIA Information Officer, F3 draft real estimated refund content, F4 estimate
remaining unpriced ticket/vendor/conference categories) — **this is now the active mission**
(`active.json`), not yet started; (4) Ozow gateway elevated to HIGH PRIORITY backlog — confirmed
client preference, and ticketing is the single biggest Phase 1 workstream. Two non-blocking
findings added to backlog: `chosenDay` not shown on confirmation page, separate booking ref per
position is intentional. A "fix NAV" mission (routing visitors between Orchid Exhibition Visitor/
Exhibitor/Vendor vs Conferences vs Events) is next up after `leeann-content-corrections`, before
scoping the unbuilt ticket categories. QR codes still not rendering in confirmation emails —
pre-existing P1, untouched this session.
