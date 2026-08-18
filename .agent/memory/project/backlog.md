# Athanor Issue Backlog

## Session 2026-08-17 (latest) — F11 (QR generation + confirmation email) DONE; mission now blocked on Brad

- [x] **F11 — QR generation at email-send time + real multi-position confirmation email with
  recovery link, DONE.** New `lib/qr.ts`, `lib/recovery-url.ts`, `emails/OrderConfirmation.tsx`;
  extended `lib/confirmation-email.ts` (F10's `ConfirmationEmailPosition` /
  `SendConfirmationEmailInput` / `deliverConfirmationEmailAfterCommit` untouched, pinned ITN
  route's single-arg call site still matches). Gate
  `contracts/contract-ticketing-f11-qr-confirmation-email.yaml` A1-A9, 9/9, run twice (before and
  after @qa's mutation pass), green both times. @qa verdict PASS — 10 mutations against real
  source, 8 killed cleanly, 1 no-op (not a weak-check finding, see `learned.md`), 1 partial
  survivor (the `.trim()` half of the empty-`bookingRef` guard, see `learned.md` and the P3 item
  below). All four files restored byte-identical, sha256-verified by @qa and independently by the
  orchestrator. Docs: `docs/ticketing.md` (+144 lines, F11 section + flow diagram + Known Gaps),
  `README.md:99`, `.env.local.example` `SITE_URL` comment.
- [ ] **[P3, NEW 2026-08-17, from F11 mutation review] `lib/qr.ts`'s whitespace-only
  `bookingRef` case is unexercised.** The empty-string branch of the guard is actually proven by
  the underlying `qrcode` library throwing on `''`, not by the guard's own `.trim()` check — a
  mutant that removed the guard still failed A3 for the wrong reason. A whitespace-only
  `bookingRef` (e.g. `'   '`) would encode silently today. Add a dedicated test case using a
  whitespace-only string, which only the guard (not the library) rejects. Full detail in
  `learned.md` "F11 mutation review — a negative control can pass for the wrong reason".
- [x] **[STATUS] Mission `ticketing-foundation` M1 and M2's F9-F11 are DONE. No autonomous
  feature work remains — F12, F13, F14 all require human action** (deployed-host
  purchase-and-scan proof at The Hangar with venue connectivity observation; Lee-Ann's real
  per-show `manager` grant verified by live HTTP round trips; a human buyer proving lost-ticket
  recovery end-to-end). The mission is now blocked on Brad, not on any agent. F11 also surfaced
  (not fixed, out of its own scope) that checkout never creates an `orders` document, so F12 will
  hit that blocker first when attempted — see `needs-human.md` "Ticketing foundation F11 —
  checkout never creates an `orders` document" for the standing detail and its 2026-08-17 status
  update.

## Session 2026-08-17 (later still still still) — vendor-registration mission drafted, queued

- [ ] **[NEW 2026-08-17] Mission `vendor-registration` drafted and filed, status `queued` (not
  started) — `.agent/memory/project/missions/2026-08-17-vendor-registration.md`.** Built from
  Lee-Ann's "South African Exhibitors" Drive doc (11 features, 3 milestones). Queued to start
  **after** `ticketing-foundation` completes — it reuses that mission's `lib/admin-roles.ts` /
  `lib/admin-auth.ts` capability system and orders/positions conventions directly. Naming
  collision resolved in F1: this stream is internally called "vendor" (schema/collection/route),
  not "exhibitor" — the codebase already has an unrelated shipped feature named "exhibitor"
  (`showExhibitorInfo`/`showExhibitorStep`, the judged-entry guide behind
  `/national-show/exhibitors`). CMS/Firestore split made explicitly: the public nursery showcase
  is Sanity (new `vendorNursery` type, F2), the 31-field registration form is a Firestore
  submission pipeline (new `vendorSubmissions` collection, F4–F5), linked but not merged — an
  admin approval step (F6) decides what, if anything, becomes public. Four open questions
  recorded with recommended defaults (payment path — recommend offline EFT, not PayFast;
  approval-before-public — recommend yes; booth allocation — recommend manual, tool just records
  it; public route name). POPIA flag recorded (F11) — this form collects CIPC/VAT numbers, cell
  numbers, physical addresses, vehicle registrations, and permit numbers, materially more
  sensitive than ticket-buyer data; POPIA work stays deferred per existing project decision, no
  conversation opened with Lee-Ann or Brad. CITES/phytosanitary/food-handling permit fields (F9)
  are collected but explicitly not validated — verification obligation is a show-committee
  question, not assumed either way. No code, contract, Sanity document, or Firestore document was
  created — planning and filing only, per instruction.

## Closure Candidates (needs sign-off)
_(2026-08-17, F1 wrap-up) `execution/gh_closure_scan.py --format lines` failed again, but back to
the ORIGINAL known error (`ERROR: .agent/memory/project/missions/OVERNIGHT-PLAN-2026-07-30.md has
no YAML frontmatter`), not the `--repo` error seen earlier the same day. The two different
failure modes on the same day suggest the `--repo` error was transient/environmental, not a
regression — the frontmatter bug is the persistent, already-filed one (see TEMPLATE BUG item
below). No candidates surfaced this session (script still does not run to completion)._

## Session 2026-08-17 (later still still still) — F6 contract written, two more scope gaps surfaced

- [ ] **[P2, open ownership question, NEW 2026-08-17] Minting the recovery token at order-creation
  time is unowned.** F6 ships only the pure primitives: `lib/recovery-token.ts`'s
  `mintRecoveryToken()`/`verifyRecoveryToken()`, the rate-limit decision function, and the
  enumeration-safe response (`contracts/contract-ticketing-f6-recovery-token.yaml`,
  `contracts/golden/ticketing-f6-recovery-token/README.md`). Something still has to CALL
  `mintRecoveryToken()` when an order is created and persist the resulting token (or its
  signature) onto the order document — otherwise there is nothing for a recovery link to verify
  against, and F14 (lost-ticket recovery proven end-to-end) cannot work. No F-item currently owns
  that wiring. F10 (ITN re-pin ceremony) and F11 (QR generation + confirmation email) are the
  plausible homes since both already touch order creation and the confirmation email, but neither
  names it. Same shape as the F5 guest-order-backfill gap above: real work sitting in the seam
  between two features, invisible because each one's own scope is complete. Needs Brad to place
  it against an existing F-item or add a new one — do not self-assign or invent an F-number.
  Worth settling before milestone M1 closes.
- [ ] **[P3, placeholder value, NEW 2026-08-17] `RECOVERY_TOKEN_DEFAULT_TTL_MS` is set to 180
  days as a working placeholder, not a Council-approved value.** It determines how long a
  lost-ticket recovery link stays valid — a real security/usability tradeoff, not an engineering
  default: too short and buyers lock themselves out of tickets they paid for; too long and a
  leaked link stays live for months. Built against a reasonable working number in the meantime,
  clearly flagged as a placeholder, same treatment as the 2027 Show ticket pricing placeholder
  (see `needs-human.md` "Real 2027 Show ticket pricing"). Also logged in `needs-human.md`
  ("Recovery-link expiry (`RECOVERY_TOKEN_DEFAULT_TTL_MS`)") since it needs an actual SAOC/Brad
  decision, not just an agent's tracking note.

## Session 2026-08-17 (later still still) — F5 contract written, two ownership gaps surfaced

- [ ] **[P1, open ownership question, NEW 2026-08-17] Buyer-account live security proof (spec
  §8.4) has no owning F-item.** The F5 contract (`buyers/{uid}` collection + hard buyer→admin
  refusal boundary) proves the boundary offline via real `hasCapability()` calls and via a real
  HTTP round trip with NO credentials (401 on missing and on garbage session cookies). It cannot
  prove offline the actual spec §8.4 scenario: a real Firebase-Auth-minted **buyer** session
  cookie `POST`ing to `/api/admin/checkin` and being refused, paired with a real **admin**-session
  positive control that succeeds. That needs live credentials, so @architect wrote it as a
  five-step human-run manual procedure in `contracts/golden/ticketing-f5-buyers/README.md` rather
  than a contract assertion — logged in `needs-human.md` ("Ticketing foundation F5 — buyer-account
  live security proof"). **F13 (Lee-Ann's `manager` grant, M3) covers the staff/admin side of live
  HTTP verification, not the buyer side — do not assume it covers this without a deliberate call.**
  This is the load-bearing security property of F5 and currently has no live-proof owner; needs
  Brad (or whoever plans the mission next) to place it against an existing F-item or add a new
  one. Not to be self-assigned to F13/F14 or given a new F-number without that decision.
- [ ] **[P2, open ownership question, NEW 2026-08-17] Guest-order-claiming backfill (spec §8.3)
  has no owning F-item.** When a guest buyer later registers an account, their existing orders'
  `buyerUid` should be backfilled to the new account. F5 deliberately adds only the field's
  existence and type (`buyers/{uid}` collection, optional `buyerUid` on orders) — the backfill
  itself is explicitly out of F5's scope. No other feature in mission `ticketing-foundation` owns
  it either. Worth placing before milestone M1 closes (M1 = F1–F8, the data-model/security
  foundation milestone) rather than letting it fall through to M2/M3 unowned.

## Session 2026-08-17 — ticketing spec extended with buyer accounts (§8), foundation mission planned

- [x] **Ticketing spec §8 (public buyer accounts + lost-ticket recovery) — DONE, commit
  `2e81ca2`.** Added in response to Brad noticing the spec had no answer for a lost ticket. Key
  decision: recovery uses a signed `recoveryToken` on the order (not the booking ref, which is
  spoken aloud/printed) plus a rate-limited no-enumeration resend form; the optional
  `buyers/{uid}` layer is additive only and grants zero admin capability (self-signup is still
  open — see `learned.md` "Ticketing foundation spec — §8 buyer accounts"). Old §8–§10 renumbered
  to §9–§11. Brad approved without a thorough read, standing condition: "we're dealing with
  people's data here, so security is top priority all the time."
- [x] **Mission `ticketing-foundation` planned and committed — `aff6c2f`.** 14 features, 3
  milestones, `.agent/memory/project/missions/2026-08-17-ticketing-foundation.md`, status
  `pending` (not started). Old zero-milestone stub `2026-08-17-ticket-flow-end-to-end.md` closed.
  Six decisions recorded in the mission body: door-staff gets `lookup-booking-ref` but not
  `search-buyers`/`export-buyer-data`; comps bypass PayFast entirely; Resend is an external
  blocker off the critical path; demo prices are marker-tagged placeholders; the `show` schema
  collision (F1) is resolved by extending the archive type rather than adding a second name; one
  ticket type for the first run.
- [ ] **[F1 prerequisite] Size the `show` archive-document impact before extending the schema.**
  @architect must count published `show` documents in Sanity and confirm no existing query/Studio
  view breaks when sales fields (`edition`, `startDate`, `endDate`, `venue`, `salesOpen`,
  `active`) are added to the archive type. Flagged explicitly in the mission F1 brief.
- [ ] **[F10 flag] `DEFAULT_SITE_URL = 'https://saoc.co.za'` in the checkout route will become
  stale-in-a-new-direction once the nameserver switch happens.** Its comment currently says that
  host resolves to the old Joomla site — true today, false after cutover. Handle inside the
  single authorised ITN re-pin ceremony (see the go-live PayFast item below), not as a second
  reopening of that route.
- [ ] **[F11 note] Resend email work does not need to wait on DNS.** `lib/email.ts` is already
  complete (client, `sendEmail({to, subject, react})`, from-address via `RESEND_FROM_ADDRESS`) —
  no API key, no ticket caller yet. Resend's `delivered@resend.dev` / `bounced@resend.dev` test
  recipients let F11 be built and proven, including hard-bounce handling, with no verified domain.
- [ ] **[domain/DNS sequencing, NEW 2026-08-17] saoc.co.za has transferred to SAOC control;
  nameservers deliberately still point at the OLD cPanel host** (mailboxes get pulled first, then
  nameservers switch). **Resend DNS records must be added only AFTER the nameserver switch** — add
  them now and they are lost silently with no code change to blame when email stops sending.
  Recommended: verify the subdomain `tickets.saoc.co.za` (not the root, so records can't disturb
  `@saoc.co.za` mail routing mid-migration), European region.

## Session 2026-08-17 (later still) — F4 (roles custom claim + tooling) DONE, four follow-ups scoped

- [x] **F4 — `roles` custom claim (per-show map), AND-only composition, revoke-on-mutate tooling,
  batch-grant tooling, date-window lapse, one-time admin migration — gate 12/12 (verified twice),
  F3 re-gate still 8/8, @qa PASS (8 mutants, 7 died).** Full detail in `learned.md` "Ticketing
  foundation — F4 done". `lib/admin-auth.ts` extended; new `lib/admin-grant-validation.ts`,
  `lib/admin-revoke-plan.ts`, `lib/admin-orphan-roles.ts`, `lib/admin-migrate-roles-plan.ts`, new
  `scripts/admin-migrate-roles.ts`, extended `scripts/admin-grant.ts` / `admin-revoke.ts` /
  `admin-list.ts`. Docs in `docs/ticketing.md` (F4 section) and `docs/admin-access.md`.
- [ ] **[P2, NEW] No claim-size guard on the grant path.** Firebase caps custom claims at ~1000
  bytes; roughly 24 per-show `manager` grants (or ~36 single-role grants) exceed it. Nothing
  checks size before `setCustomUserClaims`; the operator gets a raw `auth/claims-too-large` error
  with no advance warning. Target F13's batch-grant work. Measured by @qa.
- [ ] **[P2, NEW] A throwing `lookupShowWindow` propagates out of `hasCapability()`** rather than
  returning false. Fail-loud not fail-open, so not a security defect, but it 500s a request
  instead of cleanly 403ing. F5 must decide whether to wrap it when wiring the default lookup.
- [ ] **[P1, ESCALATED from P3 2026-08-17, BLOCKS F13] No live Sanity-backed `ShowWindowLookup`
  implementation exists anywhere — per-show role grants are ALWAYS refused in production, even
  inside their date window.** Verified this session: `lib/admin-auth.ts:199` defaults
  `lookupShowWindow` to `() => null` whenever a caller passes no opts; no production
  implementation of a `ShowWindowLookup` exists in `app/`, `lib/`, `sanity/`, or `scripts/` —
  every reference lives inside `lib/admin-auth.ts`'s own type/function definitions; the new comp
  route (`app/api/admin/tickets/comp/route.ts:76`) calls `hasCapability()` with no opts, and every
  future route that follows this pattern will too. Net effect: any per-show grant (e.g. `manager`
  scoped to one show) is refused in every real request, squarely inside its date window — only an
  org-wide `'*': ['owner']` grant works, because that path skips the window check entirely. F4's
  contract doesn't catch this because it injects its own lookup, proving the FUNCTION honours a
  window when given one, while no route ever gives it one. **Fails closed, so this is not a
  security hole — it's a functionality hole**, but it directly **blocks F13** ("Lee-Ann granted a
  real per-show `manager` role, verified by HTTP round trips including negative control") — as
  wired, that verification cannot pass, and Lee-Ann would appear to hold a role that silently does
  nothing, with no error explaining why. Implementing this is a real correctness question, not
  just plumbing: which Sanity date fields actually define the window (`show.startDate`/`endDate`?
  `salesOpen`?), and how timezone is handled — SAOC operates SAST (+2) while Firestore/Cloud
  Logging timestamps are UTC, and this project has already shipped one false published correction
  from exactly that confusion (see `learned.md` "Firestore `createTime` and Cloud Logging
  timestamps are UTC; SAOC operates SAST (+2)"). Whoever builds the real `ShowWindowLookup` should
  treat the timezone handling as a decision, not a detail.
- [ ] **[P3, NEW] Pre-existing American spellings** at `docs/ticketing.md:424, 484, 488, 820`
  (from the F2 docs pass). Deliberately left alone to keep the F4 commit scoped. The
  Microsoft/Entra proper nouns in `docs/admin-access.md` are correct as-is and must NOT be
  "fixed".
- [ ] **[STANDING, carried forward] The live `roles`-claim migration has NOT been run.**
  `scripts/admin-migrate-roles.ts` exists, is dry-run by default, and has never executed against
  the live project. No account currently holds a `roles` claim, including `brad@inunu.net` (the
  sole admin). Running it with `--apply` is a human-gated step Brad must authorise.

## Session 2026-08-17 (later) — F1 (show schema collision) DONE, three follow-ups scoped ahead of F9

- [x] **F1 — `show` schema collision resolved, gate 9/9, @qa PASS.** Full detail in `learned.md`
  "Ticketing foundation — F1 done". `sanity/schemas/documents/{show,ticketType}.ts`,
  `lib/show-resolution.ts` (new), `scripts/migrate-show-sales-fields.ts` (new),
  `sanity/queries.ts`, `app/api/tickets/checkout/route.ts`, contract + 6 checks + goldens under
  `contracts/`, docs in `docs/ticketing.md` + `docs/ticketing-for-editors.md`.
- [ ] **[P2, NEW] Studio guard against a second active show.** @qa finding, MEDIUM severity. The
  `active` checkbox on the `show` schema sits alongside the archive fields with no fieldset,
  `hidden`, or `readOnly` condition, and `sanity/structure.ts` lists `show` as a plain document
  type list — nothing in Studio warns an editor before they tick it. If an editor ticks "Active"
  on a past archive doc (so two docs are both `active: true`), `resolveActiveShow()` correctly
  fails closed to `null` — but `ticketTypeMatchesActiveShow()` then rejects EVERY ticket type for
  EVERY buyer with a generic 500. A sitewide sales outage from one mis-click, with no Studio
  warning and no alerting. Lee-Ann is the person who would hit this. Scope as its own feature with
  its own behavioural assertions (a Studio-side guard/validation, not just a code-side fail-close)
  — do not fold into another feature without dedicated tests. Slot ahead of F9 (demo ticket type).
- [ ] **[P3, NEW] `ticketType.show` reference picker is unfiltered.** `to: [{type:'show'}]` with
  no `options.filter`, so an editor can point a ticket type at e.g. a 2012 archived show.
  Checkout fails closed (the mismatch is caught server-side), so this is wasted-editor-effort
  cosmetic risk only, not a security or sales-outage issue. Add an `options.filter` scoping the
  reference to `active == true` shows.
- [ ] **[P2, NEW] `show-19-2027` edition/dates/venue are a COPY of the `nationalShow` singleton,
  not a live reference.** @dev sourced the real values rather than inventing a placeholder
  (correct — there is prior form on this project of an invented CTICC venue leaking into six-plus
  fields), and the two documents match exactly today, verified. But because it's a copy, a future
  edit to either document will silently make them diverge in front of buyers. Documented as a
  known limitation in both `docs/ticketing.md` and `docs/ticketing-for-editors.md`; needs a real
  resolution (e.g. one document is authoritative and the other reads from it) before shipping
  further ticketing-facing UI that displays both.
- [ ] **[P2, unresolved, re-measured] Firestore fixture-leak count: 15 docs today (14
  `nationalShow` + 1 `door-qr-check-wrong-show`), NOT a clean monotonic climb.** Earlier sessions
  recorded 5 → 12 → 17 → (now) 15. The trend line going down as well as up means the prior
  "ongoing leak" narrative may be wrong, or measurement conditions differ session to session (see
  `learned.md` "unchanged detector reading" for the general caution against inferring a story from
  an unverified count). Record the number, don't re-narrate a trend from it — next session should
  measure under controlled conditions (immediately before/after a known check run) before drawing
  any conclusion. Deletion of leaked docs remains Brad's call, not an agent's.

## Session 2026-08-16 (afternoon) — P1 weak-assertion audit complete, no live vulnerability

- [x] **P1 weak-assertion audit — DONE, no live vulnerability found anywhere.** Full narrative in
  `learned.md` "P1 weak-assertion audit". Retired/rewrote weak assertions across four contracts:
  `650d02c`/`8e3e98b` (entry-point guard on scan-dataset-residue.ts + false-claim correction),
  `808ca7b` (D5-04/16/23 retired as auth-greps-a-comment-satisfies; D3-16/19 corrected off a
  deleted Stripe field), `382e157` (D6 door check-in auth proven by real HTTP round trip),
  `f87bcb3` (payfast-m1 ITN validation proven behaviourally + by AST), `0b5f0ea` (D6's four
  remaining stale greps retired), `f4a37bd` (scanner now detects D6 + known-residue fixtures; A34
  leak-regression guard added). Sprint doc corrections in `7222e12`/`4c8a1a0`/`2deda6c`.
- [ ] **[P1, unexplained] Firestore fixture leak is ONGOING.** `tickets` collection went 5 → 12 →
  17 documents today; scanner went 12 hits/13 docs → 29 hits/18 docs. Checks DO call
  `withCleanup()` — the open question is why it isn't reclaiming these documents. A34 (new,
  `f4a37bd`) now measures the delta directly instead of trusting an unchanged scanner count (see
  `learned.md` "unchanged detector reading" lesson). **Do not guess the cause — measure it next
  session.** 12+ detect-only documents remain live in Firestore; deletion is Brad's call, not an
  agent's.
- [ ] **[P1, pre-existing, cannot pass as written] payfast-m1 A1 and A6 — same stale/self-defeating
  grep family as the retired D5/D6 assertions, NOT yet fixed.** A1 forbids the string
  `stripePaymentIntentId` anywhere under `docs/` and trips on the sentence in `docs/` explaining
  the field was removed (red since commit `e7de1e0`). A6 expects `m_payment_id` literally inside
  a route file that now correctly delegates that logic to `lib/checkin.ts`. Retire-or-rewrite
  using the same `exit 77` / `SUPERSEDED:` pattern applied to D5/D6 this session.
- [ ] **[P2] Shared contract test-server has no lock/refcount — one check can kill another's
  server mid-run.** `contracts/checks/admin-auth-hardening/server-ctl.sh` claims lock/refcount
  handling in its comments but implements none: a single fixed PIDFILE on port 3400, so one
  contract's `stop()` can tear down a server a different contract is still using. Causes
  intermittent failures specifically in busy multi-agent sessions. Shared infra — deliberately
  left untouched this session, flagging for whoever owns contract tooling next.
- [ ] **[P2, lower severity, unfixed] Two more weak assertions found but not fixed this session.**
  `contract-ticketing-m1-m2.yaml` A20 (price source assertion is easily satisfied without the
  real property holding) and `contract-ticketing-hardening.yaml` A16 (secret-leak regex evaded by
  indirection or multiline formatting).

## Session 2026-08-16 (morning) — safety scanner shipped, PayFast pin-lift still blocking, WCAG held

- [x] **Live-dataset residue scanner + CI guard — DONE, commit `f7155fe`.**
  `scripts/scan-dataset-residue.ts` + `dataset-residue-guard` job in `.github/workflows/ci.yml`
  (push/PR/daily cron), contract 14/14, `docs/dataset-residue-guard.md`. Built directly in
  response to the `/national-show` sentinel-in-production incident this session (see content
  repair item below). See `learned.md` "Dataset Residue Guard" for the two rounds of adversarial
  QA findings folded into the final version.
- [x] **National Show live-content repair — DONE, no commit (Sanity dataset, not code).**
  `/national-show` had been serving `F3-TITLE-SENTINEL-1786560879358` as its H1 with the
  countdown target set to 2098-12-31 for ~3 days. Restored `title`/`location`/`countdownDate`
  on the `nationalShow` singleton from `scripts/seed-page-singletons.ts` (~lines 211-216),
  revalidated, verified live, and scanned all 133 dataset docs clean.
- [ ] **[P1, BLOCKER] PayFast ITN signature helpers shipped but route stays pinned — commit
  `2828d0a`, QA PASS, contract 6/8, marked BLOCKED.** `lib/payfast.ts` now has the inbound ITN
  signature helper functions, but `app/api/tickets/itn/route.ts` is sha256-pinned
  (`itn-route.expected.ts.txt` / `itn-route.golden.sha256`) and the two call sites (lines 89, 193)
  plus the import were never wired in — needs Brad to authorize the documented re-pin ceremony.
  Until the pin lifts, assertions A5/A6 stay red and **no ticket can reach `paid`**, which blocks
  mission feature F6 (door check-in proven end to end) and go-live. Fold in the second item below
  when doing the re-pin — don't do it twice.
- [ ] **[P1] `parseOrderedFields` uses `continue` where the ITN spec implies `break` at the
  signature key — latent divergence inside the same pinned route, found this session, NOT fixed
  by the pin-lift above on its own.** Needs its own line item in the same re-pin ceremony so it
  isn't silently reintroduced.
- [ ] **[P2] No branch protection on `main`** (`gh api` → 404 confirmed this session) — the new
  `dataset-residue-guard` CI job (and every other CI check) is advisory only; a broken push still
  merges. Remedy URL + exact `gh` command are recorded in the residue-guard golden README and
  `docs/dataset-residue-guard.md`.
- [ ] **[P2, HELD for Brad's design call] WCAG accent-token contrast audit — commit `011d98b`,
  docs only, no production code changed.** 30-row audit + contract identify real accent-contrast
  failures on live public pages. Remedy is fully specified in
  `contracts/golden/wcag-accent-contrast/remedy.md`, but is deliberately not applied — it's a
  design-token decision, not an engineering call. This is a live accessibility failure on public
  pages; should not sit indefinitely once Brad greenlights the token change.

## SAOC Project — Active (Phase 1 scope only)

_Last compacted: 2026-07-10 by session (machine-reboot wrap-up). Full history: git log on this file._

- [x] **[P1] Response to Lee-Ann McCleland (SAOC Secretary) — SENT** — Response to her 11 proposal-evaluation questions (`documents/Inunu - Additional info request.docx`) drafted, fact-checked (PayFast recommended over waitlisted Yoco, Quicket cost comparison sourced, security claims verified against the actual codebase), and sent from brad@inunu.net 2026-07-01. Covered: security, payment security, refunds, ticketing costs vs Quicket, membership scope, journal archive, judges platform, CMS ease of use, Next.js scalability, ownership transfer, support model, non-renewal consequences. **Now WAITING on the Council's decision — no action pending on our side.**

- [x] **DONE (compacted 2026-07-10) — Phase 1 platform build + polish + AI/CI.** Full detail in git log. Covers:
  - **Phase A Foundation** (Next.js + TS strict + Tailwind v4 + Sanity CMS + Firebase App Hosting + lint/format + CI); **Phase B** 8 CMS-driven static pages; **Phase C** events calendar (month-grouped, ICS export — note member-only event submission form built as C5 is Phase 2 scope, shipped but not linked); **Phase D partial** 2027 ticketing D1/D3/D5/D6 (Resend email, Firestore ticket model, admin dashboard, door check-in); **Phase E** SEO + Secretary training + launch checklist (E4 22/22, E5 19/19, E6 14/14).
  - **Chrome wiring** (real UtilityBar/Header/Footer in layout); **Design-verify pass** (full globals.css token set, radius-0, editorial polish); **AI/LLM optimization** (llms.txt + llms-full.txt + robots.ts AI allowlist + NGO JSON-LD); **llms-full.txt nightly GROQ cron** (`.github/workflows/refresh-llms.yml`, needs GitHub secrets `NEXT_PUBLIC_SANITY_PROJECT_ID` + `SANITY_API_TOKEN` before cron fires); **Inner-pages design polish** (mission 2026-06-30, done 2026-07-01, commit 0488cc8).
  - **PayFast ticketing M1** (F1 schema rework, F2 checkout initiation route, F3 ITN webhook handler; 3 rounds adversarial QA fixed 2 real payment-security bugs — spoofable X-Forwarded-For IP trust + non-atomic idempotency race; docs/payfast-integration.md; gate 33/33; **left UNCOMMITTED intentionally**).
  - **CI fix 2026-07-10**: removed pnpm version pin conflict in `.github/workflows/ci.yml` that failed every CI run since 2026-06-30 (commit 5c75473, pushed to main).

- [ ] **[P1] Scope reconciliation: Spec V2 vs Phase 1 — DECISION MADE 2026-07-20, provenance VERIFIED 2026-07-23, awaiting Brad to send.** Full decision in `needs-human.md`. Brad decided: keep Phase 1 tight to ~original scope (absorb small Spec V2 polish free), defer/reprice the four "root cause" items as a separately-scoped Phase 2 — (1) shared relational content DB / Section 7 schemas, (2) unified multi-category booking + waitlists, (3) Members Portal + journal + awards archive, (4) Symposium/WOSA Conference/Workshops event layer. Delivery sequence: (a) design sign-off → (b) core SAOC site + Show "marker" landing page live → (c) ticketing live off that same page → (d) the four big items as Phase 2. Driver: sponsor-presentable site ASAP + Show tickets on sale early enough to sell out by early 2027.
  - **(2026-07-23) Proposal provenance now CONFIRMED, not assumed.** The proposal Lee-Ann actually received was `SAOC_Website_Proposal_28-05-2026.pdf`, emailed 28 May 2026 to `saoctreasurer@gmail.com` (a DIFFERENT address than the `2027national@gmail.com` she uses now). Brad's sent PDF was downloaded from Gmail and diffed word-for-word against `documents/SAOC_Website_Proposal_28-05-2026.docx` on disk — content identical, only PDF letterhead/pagination differs. The docx on disk is now the CONFIRMED source of truth.
  - **(2026-07-23) New phase-map artifact** (page-by-page scope comparison, all 24 Spec V2 pages mapped individually to Phase 1 / Phase 2 / needs-decision, each with reasoning, cross-referenced against the verified proposal): https://claude.ai/code/artifact/eb888f16-a4e8-42c7-9a1e-0c595fc85326 . Flags one overstatement in Lee-Ann's own Spec V2: it claims the full unified multi-category booking (General Admission + Symposium + WOSA + Workshops in one checkout) was "confirmed by INUNU" — only General Admission for Phase 1 is actually confirmed.
  - **Draft email ("SAOC website — how I'd sequence the build," to Lee-Ann <2027national@gmail.com>) sits UNSENT in Brad's Gmail drafts (id `r7069159880970212600`) and is now STALE** relative to the corrected call-prep doc — it has NOT been rewritten to reflect the verified/corrected facts. Brad has not decided whether to rewrite it or work live from the phase-map artifact on the call. No agent action — Brad edits+sends, rewrites, or replies personally. Scope-freeze on Section 7 schemas / un-built National Show pages remains in force until this is sent and confirmed.
- [x] **[P1] Pull National Show 2027 brand assets from Gmail into the repo — DONE 2026-07-20.** Collected under `branding/national-show-2027/`: `logo/` (5 files — full-res PNG, JPEG, small web PNG, alt dark colourway, print PDF), `reference-photos/` (13 of Scott Ormerod's watermarked studio orchid photos), `palette-and-type/` (colour hex `A7A841`/`7F7D33`/`211A57`/`F3F2D6` + font recs Montserrat + Hey August/James Stroker/Fake Serif), and a `README.md` manifest with full provenance per asset. **Show-specific branding only.** Two follow-ups remain (see needs-human.md): (a) folder is **untracked — Brad hasn't decided whether to commit**; (b) ~~photo usage rights unconfirmed~~ **RESOLVED 2026-07-28 (Brad):** Scott only sends photos SAOC holds full copyright over — the 13 photos in the repo are cleared for use. Do NOT use the placeholder `design/design_handoff_saoc/` "Sage & Paper" system as the real brand; the SAOC-org brand is still outstanding.

- [ ] **[branding, PENDING COMMITTEE] National Show brand model — may affect asset folder structure** — Brad's working hypothesis (unconfirmed, needs a committee conversation — see `needs-human.md`): the National Show may want a **stable master brand** persisting across editions + a **rotating per-edition "host sub-brand"** layer, instead of the current full-from-scratch redesign each host cycle (the 2027 identity is explicitly "WESTERN CAPE 2027", host-region-tied). **IF the committee agrees to that model**, it changes how future Show branding assets should be structured/named: e.g. `branding/national-show/` as a stable parent with per-edition subfolders like `branding/national-show/2027-western-cape/`. Consequence: the current `branding/national-show-2027/` folder naming may need revisiting once the model is decided. **Do NOT restructure anything now** — this is contingent on the committee decision, which is Brad's to have with Lee-Ann + the National Show committee. Blocked until then.

- [ ] **D2/D4: PayFast ticketing — M1 DONE, M2 BLOCKED.** Mission `2026-07-01-payfast-ticketing.md` ACTIVE, paused at the M1/M2 boundary (checkpoint M1/F3). Gateway = PayFast (Yoco waitlisted with no ETA; PayFast recommended + committed, verified against PayFast dev docs — Subscriptions API, Refunds API, hosted redirect + Onsite Beta, PCI DSS Level 1).
  - **M1 DONE (uncommitted):** F1 Firestore schema reworked off the old Stripe-shaped field to PayFast's model; F2 checkout initiation route; F3 ITN webhook handler. Documented in `docs/payfast-integration.md`. Gate green 33/33.
  - **M2 BLOCKED:** F4 buy-flow UI, F5 confirmation page + email (Resend), F6 sandbox verification. Blocked on TWO external inputs, both logged in `needs-human.md`: (1) **PayFast Sandbox credentials** (free signup at sandbox.payfast.co.za, no FICA — Merchant ID/Key/Passphrase into .env.local) — **(2026-07-28) Brad is waiting on the society to supply PayFast credentials; external wait, no agent action**; (2) **real 2027 Show ticket pricing** (adult/pensioner/child/member/exhibitor tiers + capacity). Resume: `python3 execution/mission.py resume` → `/spec` for F4.
  - **Live merchant account — FICA COMPLETE (Brad, 2026-08-12).** The non-profit FICA verification is
    done, which was the last gate on a live PayFast merchant account. **This no longer blocks going
    live; the remaining live-payment work is now ours, not paperwork.** See the new "Go-live: PayFast
    live credentials" entry below for exactly what is left.
- [ ] **Configure SPF/DKIM/DMARC on saoc.co.za** — required before launch. Setup guide: docs/email-dns-setup.md. Brad to add DNS records once Resend domain verified.
- [ ] **Domain transfer** — saoc.co.za to Inunu Net registrar. Brad to initiate. R172.50 once-off.
- [ ] **DNS cutover** — point saoc.co.za to Firebase App Hosting. Requires domain transfer complete + SPF/DKIM/DMARC in place.

### Legacy site migration → Inunu VPS (2026-07-20) — RESTORE DONE, cutover pending
Old saoc.co.za (legacy cPanel at i-svr.net; access held by "Nico"; committee/Lee-Ann no longer directly manage it) is being migrated to Inunu's own **multi-tenant** VPS `wh3.inunu.co.za` (cPanel user `ahsaoc`, domain `saoc.co.za`, account IP `164.160.89.117`; root via `ssh wh3`, key-based). ALL work scoped strictly to `/home/ahsaoc` via `su -s /bin/bash - ahsaoc` + `user=ahsaoc`-scoped cPanel API — other tenants on the box (eastrandorchids/allwastesolutions/acruxaccounting) untouched. This is a **local-preview restore only**; the legacy public site is untouched and still live. All credentials (temp mailbox pwds, new DB pw, and the OLD plaintext DB cred `saoccoza_NicoG` found in the legacy `configuration.php`) live ONLY in gitignored `/Users/vetus/ai/SAOC/ops-secrets.local.md` — never reference their contents in any committed file.
- [x] Full JetBackup5 account backup pulled from legacy host (native cPanel "Backup" was disabled — JetBackup was the only path). Saved locally at `/Users/vetus/ai/SAOC/Old SAOC Website Backup/` (`download_saoccoza_1784561106_17043.tar.gz`, 989MB, + extracted copy) — NOT in git (large binary, out of repo scope).
- [x] Website files restored — live Joomla `public_html/` (435MB, 13,860 files). Stale duplicates `public_html_1`/`public_html_2` (old installs; `_2` has an untouched `installation/`) deliberately NOT restored.
- [x] Database restored — new DB `ahsaoc_saoc` + user `ahsaoc_saocweb` (fresh generated pw, NOT the old exposed one); old `saoccoza_SAOC` dump imported cleanly (78 tables verified); `public_html/configuration.php` repointed to new creds.
- [x] Email restored — all 5 mailboxes (info@ ngos@ president@ show@ treasurer-secretary@) recreated with TEMP pwds; old Maildir content (192MB across all 5, sizes verified vs source) restored on top so historical mail is intact.
- [x] Local preview working — cPanel subdomain `new.saoc.co.za` created (same `public_html`, not empty) + `rebuildhttpdconf` + graceful httpd restart; Brad's `/etc/hosts` maps `164.160.89.117 new.saoc.co.za` (corrected once from a stale `.116`). Serves restored Joomla site, verified end-to-end via HTTP + browser.
- [x] ~~Swap 5 temp mailbox pwds → real originals~~ **RESOLVED 2026-07-20: NOT swapping.** Lee-Ann's supplied originals were weak / reused (treasurer's ≈ legacy cPanel login pw). Brad decided to KEEP the generated random passwords on all 5 mailboxes for security; users re-enter the new pw once at cutover. Committee follow-up on password hygiene is Brad's. Detail in needs-human.md.
- [ ] Re-pull mail from legacy host ONE more time immediately before DNS cutover — today's restore is a snapshot; catches mail received 2026-07-20 → cutover day.
- [ ] Real DNS/domain cutover saoc.co.za → new VPS (NOT done; legacy i-svr.net site still live/public).
- [ ] Decide whether stale `public_html_1`/`public_html_2` are worth preserving.
- [ ] **[P2, candidate contract, NEW 2026-08-12] Secret verification guard** — after any
  `firebase apphosting:secrets:set`, read the secret back and assert: (a) SHA-256 digest matches the
  intended value, (b) byte length matches exactly, (c) no leading/trailing whitespace. Three separate
  incidents of secret-payload corruption in 16 weeks (dotenv banner, trailing tab, stray character)
  went undetected until they reached production because no post-write verification ran. **Note:** `gcloud`
  is NOT installed in the typical project environment and is NOT needed — the Firebase CLI's cached
  OAuth token in `~/.config/configstore/firebase-tools.json` has `cloud-platform` scope and works
  against Secret Manager, IAM, Firestore, Service Usage, and Cloud Logging REST APIs. Use the Firebase
  CLI or REST directly. Details: `docs/secret-corruption-incidents.md`.

- [ ] **[P3, cleanup, NEW 2026-08-12] Remove four test documents from Firestore** — added during
  PayFast diagnostic probes today: two `tickets` collection documents (booking refs
  `SAOC-2027-JG6Q598FG0QD` and `SAOC-2027-C584G82Z7F6D`), and two `contactSubmissions` diagnostic
  records. These are test data only; remove before any UAT involving real reservations or contact forms.

- [ ] **[P1, NEW 2026-08-12] Go-live: switch PayFast from sandbox to live credentials.** Unblocked by
  FICA completion. The code is ready — the checkout, ITN webhook, capacity transaction, idempotency,
  reservation TTL and 60-bit booking refs are all gate-green (`contracts/contract-ticketing-hardening.yaml`
  37/37). What remains, in order:
  1. Obtain live Merchant ID / Merchant Key / Passphrase from the verified PayFast account.
  2. Store them in Secret Manager, NOT `.env.local` — `firebase apphosting:secrets:set` for each,
     then reference them in `apphosting.yaml`. **Set them with `printf '%s' | --data-file=-`, never
     `echo`** — the F2 incident was caused by a trailing newline and non-ASCII prose corrupting a
     secret payload, and exact string comparison then never matched (see the F2 section above).
  3. Flip `lib/payfast.ts` off the sandbox constants and confirm the live process URL is used.
  4. `SITE_URL` in `apphosting.yaml` currently points at the App Hosting URL. It must become the real
     domain before live ITNs will land correctly — **so this is gated behind the DNS cutover**, not
     independent of it.
  5. Re-verify the ITN signature path against a live transaction. `app/api/tickets/itn/route.ts` is
     sha256-pinned (A15); changing it requires the documented re-pin ceremony in
     `contracts/golden/ticketing-hardening/itn-write-guard.golden.md`.
  **Do not go live before real council-confirmed prices are in** — every price in the dataset today is
  an invented placeholder rendered with a "provisional" label, and a live gateway taking real money
  against invented prices is the worst possible ordering.

- [ ] **Live PayFast test transactions + cross-browser dry-run** — Phase 1 launch gate. Run after D2/D4 (PayFast M2) complete and live FICA-verified credentials are in place.

- [ ] **[P1, NEW 2026-08-14] Payment gateway decision — execute findings from research paper.** Recommendation: stay on PayFast for 2027 Show, add Ozow as secondary option (subject to vendor Q&A). Follow-ups: (1) email vendor questions in section 10 of `docs/payment-gateway-research-2026-08.md` (PayFast: Clause 9.8 commitment + refund API; Ozow: credential-free banks, settlement timing, fund-float, NPO onboarding); (2) PayFast Clause 9.8 fund-hold commitment must be in writing before sales open; (3) build SAOC refund-state tracking before high refund volume (currently system has no "refunded" ticket state); (4) request PCI-DSS/ISO 27001 certificates + verify via IAF CertSearch before signing; (5) negotiate POPIA operator agreement; (6) attorney review of refund policy (section 8 contains our legal reading, not binding advice); (7) disclose to Council our conflict of interest (we built custom system) and thin-evidence spots (Peach/Paystack recurring unconfirmed, Yoco API not fully reviewed). All findings dated 2026-08-14, no new research needed. Role: procurement/leadership.

- [ ] **Auto-refresh llms.txt + llms-full.txt via Alembic** — Alembic-based script BUILT (`scripts/refresh-llms.ts`, `pnpm refresh-llms`): crawls 7 routes through Alembic → regenerates `public/llms-full.txt`. ⚠️ Alembic blocks `localhost` hostnames by design, so the script only works against the live external URL (`https://saoc.co.za/<page>`) — usable only POST DNS-cutover, and NOT usable in CI (GitHub Actions can't reach local Alembic). `public/llms.txt` (index + descriptions) stays hand-authored. Production automation moved to the GROQ item below. Depends on live domain. Docs: `docs/llm-optimization.md`.
- [x] **Home page UI drift audit — DONE 2026-07-28 (F5, `hardening-ui-fidelity` mission).** Full re-audit against `design/Claude Design HTML/SAOC Website (standalone).html`, superseding the stale 2026-06-30 notes below. Findings: `.agent/memory/scratch/home-audit-20260728/audit.md`. 9 deviations (D1–D9) found; code fixes for D2/D3/D5/D7/D8/D9 + D1's code half contracted as F6 (`contracts/f6-home-fidelity.yaml`). Two items split out as their own backlog entries below: D1 content population, D6 hero copy authority.
- [x] **F6 home-page fidelity code fixes — DONE 2026-07-29.** Gate `contracts/f6-home-fidelity.yaml` PASS (26/26 shell assertions, verified by orchestrator). Changed `components/home/{PartnersSection,YearbookStrip,MissionBlock,NavCards}.tsx`, `components/chrome/{UtilityBar,Footer}.tsx`, `components/ui/EventRow.tsx`, `eslint.config.mjs`; `playwright` added as devDependency. Docs: `docs/home-page-fidelity.md`, `docs/m3-home.md`. See [[learned.md]] "F6 Home-Page Fidelity (2026-07-29)" for the caught defect (stale `.next` cache hid a rendering bug behind a passing grep-only assertion).
- [ ] **[content] Populate `hostSociety` on Sanity `societyEvent` documents** — confirmed via direct Sanity query 2026-07-28: **0 of 18** `societyEvent` docs have a populated `hostSociety` reference, so the home page's Upcoming Events strip always renders a blank host-society column (design reference shows e.g. "CAPE ORCHID SOCIETY" there). This is a Sanity Studio content-entry task, not a code bug — `EventRow.tsx`'s code-side fix (hide the blank span when `event.host` is falsy) is in F6. Someone with Studio access needs to set `hostSociety` on each event document once Studio editing is unblocked (see the Sanity Studio P0 item above).
- [ ] **[copy, needs decision] Hero lede copy — reference vs. local differ, authority unresolved** — Reference: "Twenty-one affiliated societies. A nationally standardised judging system. A flagship show every three years. This is where cultivated orchids are grown, studied, exhibited and celebrated." Local (`components/home/Hero.tsx:84-86`): "Uniting twenty-one affiliated societies in the cultivation, exhibition, and appreciation of orchids across South Africa since 1968." Found during the 2026-07-28 F5 audit — flagged as a content/copy deviation, not a layout bug. Do NOT change without confirming which copy is authoritative (may be an intentional later revision, not drift) — client/design-owner call.
- [ ] **[P3] Fix 375px horizontal overflow in `ShowBand.tsx:35`** — `aspect-[4/3]` causes horizontal overflow at 375px viewport width. Pre-existing, found during F6 QA (2026-07-29), NOT caused by the F6 change set.
- [ ] **Complete or remove orphan F6 rendered-check harness** — `contracts/checks/f6-home-fidelity/` has `_shared.mjs` + `utilitybar-tagline-desktop.mjs` (Playwright-based rendered checks) but `contracts/f6-home-fidelity.yaml` has no A27+ assertions invoking them — @architect died mid-session before finishing this. Either complete the harness (checks: utilitybar hidden at 375px, "EST. 1968" badge overlay renders, PartnersSection shows 6-col single row) and wire the assertions, or remove the orphan files and the now-unused `playwright` devDependency.
- [ ] **Fix `$ANTHROPIC_DEFAULT_HAIKU_MODEL` agent-model config — REPRODUCED AGAIN 2026-07-29, previous fix attempt DISPROVEN.** The `docs` agent failed to spawn again with `There's an issue with the selected model ($ANTHROPIC_DEFAULT_HAIKU_MODEL)`. A prior session had removed the env entry from `.claude/settings.json` as a candidate fix — that did NOT fix it. Root cause is the `docs` agent's own frontmatter declaring `model: haiku`; that alias fails to resolve regardless of the settings.json env var. Workaround remains an explicit model override at spawn time. Underlying config issue still open; do not re-attempt the settings.json-removal fix, it's confirmed not to work.

- [ ] **Sanity v6 major upgrade** — `sanity@5.31.1 → 6.3.0` (and likely `next-sanity@11 → 13`). Pre-mission research required: review v6 changelog + migration guide, check next-sanity v13 breaking changes, verify Firebase App Hosting SSR compatibility, confirm React 19 peer dep story, identify any schema or Studio API changes. Do NOT upgrade without a research pass — this is a major version with likely breaking changes across both packages.

- [ ] **Secretary CMS controls (phase 1)** — Scope-narrowed: start with only what the secretary actively needs to edit, build up slowly to avoid risk. Phase 1 target fields: hero headings/lede on key pages (home, about, national-show), upcoming show details (date, venue, ticketing link), news/announcements block, contact details. Do NOT attempt full-site editability in one mission. Each phase ships, verifies, and stabilises before the next. Seed must pre-populate all new fields from current hardcoded values so the secretary starts with real content rather than blank forms.

- [x] **Assess Sanity Free-plan downgrade impact — DONE 2026-07-28.** Full assessment: `docs/sanity-free-plan-assessment.md`. Verdict: OK — nothing measured is within 2x of any Free-plan cap, nothing breached.

- [ ] **[P3] Manual Sanity dashboard usage check** — manage.sanity.io → Settings → Usage: confirm CDN/API/bandwidth/asset totals + that administrator/editor/viewer role display doesn't conflict with Free's 2-role cap. Not retrievable via token API (verified 2026-07-28). 5-min human task.

- [ ] **[P3] Fix `@sanity/image-url` deprecated default export** — `sanity/lib/image.ts` fires a deprecation warning on every home-page render in dev (found during the 2026-07-28 home-page drift audit, `.agent/memory/scratch/home-audit-20260728/audit.md`). Low priority, cosmetic dev-console noise only, no functional impact observed.

- [x] **[P1, security] `dotenv@17.4.2` promotional banner — DONE 2026-07-28. VERDICT: BENIGN.** Installed tarball hash matches npm registry `dist.integrity` exactly, no install scripts, zero advisories for `dotenv` itself; banner is upstream maintainer self-promotion via `dotenv`'s rotating TIPS feature (no network call, no data collection). Fix applied: `scripts/seed-sanity.ts` now loads `dotenv` with `config({ quiet: true })`. Full detail: `docs/dotenv-supply-chain-f1.md`.

- [x] **[hygiene] React peer-dependency range tightened for Sanity Studio — DONE 2026-07-24 (uncommitted).** `package.json` `react`/`react-dom` bumped `^19.0.0` → `^19.2.2` to match `sanity@5.31.1`'s and `@sanity/vision`'s actual peer floor (Structure Tool calls `React.useEffectEvent`, a React ≥19.2.2-only API). Gate green 8/9 static assertions (`contracts/contract-sanity-react-peer-fix.yaml`, RF-01–RF-10; RF-11 is human-only, see P0 item below). **Real hygiene, but NOT confirmed root cause** — `pnpm-lock.yaml` resolved React `19.2.7` throughout the entire incident history (before the bug, after a prior failed fix `397de87`, and now), so the runtime version was never actually the problem. Full writeup: `docs/sanity-studio-p0-investigation.md`.
- [x] **[bugfix] `/studio` hard-crashed under `pnpm dev` — DONE 2026-07-24 (uncommitted).** `sanity.config.ts` was `require()`-ing the ESM-only `@sanity/vision` package inside a dev-only conditional — ESM-only packages have no CJS entry to `require()`, so this hard-500'd the ENTIRE `/studio` route locally (production builds were unaffected; webpack prunes the dead branch). Fixed via static `import { visionTool } from '@sanity/vision'` + moved the dev-only gate to the plugins array instead of the import mechanism. Independently reproduced broken-then-fixed; gate green 7/7 (`contracts/contract-sanity-vision-esm-fix.yaml`, VF-01–VF-07 — two bugs in the gate script itself, a curl exit-code concatenation bug and a dev-server process-leak-on-cleanup bug, were also found and fixed as part of this contract). This fix is a genuine standalone bug fix AND the prerequisite that unblocks local `pnpm dev` access to `/studio` for the P0 investigation below.
- [ ] **[P0, ENGINEERING — TOP PRIORITY per Brad 2026-07-28] Sanity Studio: not usable for editing AT ALL — TWO BUGS FIXED 2026-07-28, CORS/membership still open, human verification pending.** **(2026-07-28) Brad reports the symptom is broader than previously logged: he has never successfully opened Sanity Studio to edit ANY page, in any environment — "Sanity is not working at all". Back-end editing via Sanity is a core deliverable; Brad asked to prioritize research into what's wrong. Note the environment Brad tested (hosted vs localhost) is unconfirmed — prior "document list loads, edit pane blank" observation may have been a different environment/stage of the same failure.** Studio is substantially built (`app/studio/[[...tool]]/`, full schema set in `sanity/schemas/documents/*`, `sanity/lib/` client+fetch, seed at `scripts/seed-sanity.ts`). Symptom: document list loads fine, but clicking into a document to edit shows no edit form. Investigated 2026-07-24: (1) React `useEffectEvent` peer-version mismatch — ruled out, see hygiene item above; (2) Sanity Free-plan permission downgrade (project auto-downgraded 2026-07-14) — ruled out via live API check: direct read query AND a real mutate transaction against the `production` dataset both returned HTTP 200 with the project's actual `SANITY_API_TOKEN`, confirming full read/write access on Free plan. Along the way, found and fixed the separate `/studio` dev-crash above, which now unblocks local reproduction. **Next step, tracked as `RF-11` (`agent_review`, SKIP verdict, cannot be machine-checked) in `contracts/contract-sanity-react-peer-fix.yaml`, detail in `needs-human.md`:** run `pnpm dev`, open `http://localhost:3002/studio` with real credentials, click into an existing document (e.g. a society or event), and record exactly what happens — does the edit pane render fields, stay blank, spin, or error — plus any browser console errors (note in particular whether a `useEffectEvent` error appears, corroborating evidence either way). Full investigation writeup: `docs/sanity-studio-p0-investigation.md`.
  - **(2026-07-28) @analyst diagnostic pass — TWO distinct confirmed bugs + one human question. Evidence: `.agent/memory/scratch/sanity-p0-20260728/` (screenshots + dev.log).** (1) **CONFIRMED, local:** `pnpm dev` → `/studio` hard-crashes server-side on EVERY request (`TypeError: Cannot read properties of null (reading 'useSyncExternalStore')` / invalid hook call) — HTTP 200 but infinite spinner, Studio never renders. Likely cause: `next.config.ts:5` `serverExternalPackages: ['sanity','next-sanity','@sanity/vision']` (documented failure class — next-sanity#707, sanity#2819, next.js#70487); present since first Sanity commit. NOTE: prior session's RF-11 was never actually performed — it stopped at HTTP 200 without checking the dev-server console. (2) **CONFIRMED, all envs:** `app/layout.tsx:83-88` renders UtilityBar/Header/Footer unconditionally, so marketing chrome wraps `/studio` too (`app/(marketing)/layout.tsx` is a passthrough — route group isolates nothing). (3) **Deployed** (`saoc-prod--saoc-webapp.europe-west4.hosted.app/studio`) renders the Sanity LOGIN screen fine — but Sanity project `26yfbug4` has exactly ONE human member (created 2026-06-11, email not exposed at editor-token grant); if that's not Brad's account, login is a dead end = his "not working at all". (4) CORS origins UNVERIFIABLE with current editor-role token (401 on cors/read) — needs manage.sanity.io admin. **Fix path:** contract asserting (a) serverExternalPackages fix → dev `/studio` renders doc fields zero console errors (closes RF-11), (b) chrome moved to `(marketing)` layout; human-queue: confirm Brad's Sanity login email is the project member + check CORS origins. **(2026-07-28) Brad confirms he signs in as `brad@inunu.net` and will do all testing under his own account before inviting anyone. Whether `brad@inunu.net` IS the project's single human member (created 2026-06-11) remains UNVERIFIED — local Sanity CLI is not logged in (`sanity debug`: "Not logged in"), so `sanity users list` fails; Brad to run `pnpm exec sanity login` (interactive) or check manage.sanity.io/projects/26yfbug4 → Members + API → CORS origins.**
  - **(2026-07-28) Chain complete: @analyst → @architect → @dev → @qa → @docs, gate 6/6 PASS.** Both confirmed bugs FIXED (uncommitted, commit follows this wrap-up): (a) `serverExternalPackages: ['sanity','next-sanity','@sanity/vision']` removed from `next.config.ts` (cargo-culted at initial install, caused the dev-only SSR hard-crash on every `/studio` request); (b) marketing chrome moved from `app/layout.tsx` to `app/(marketing)/layout.tsx` so `/studio` and `/admin` no longer inherit UtilityBar/Header/Footer. **Still open, human-only:** (1) confirm `brad@inunu.net` is the Sanity project's single human member (created 2026-06-11) — local Studio now mounts and lands on "Connect this studio to your project," the classic missing-CORS symptom; (2) add local dev origin to CORS at manage.sanity.io/projects/26yfbug4 → API → CORS. Full writeup: `docs/sanity-studio-p0-investigation.md`.

- [ ] **[docs-accuracy] Correct `CLAUDE.md` tech-stack table — it omits Sanity (stale).** The tech-stack table in `CLAUDE.md` lists only Firestore and makes no mention of Sanity, but **Sanity Studio was part of the stack from the start** and is substantially built (schemas, `/studio` route, client libs, seed script, `@sanity/*`/`sanity`/`next-sanity` in `package.json`). This stale table already caused a wrong "Sanity = unagreed scope creep" flag in the call-prep doc that Brad had to correct. Update the table to include Sanity CMS. Low effort. _(Do not fix as part of memory-logging — tracked here for a normal doc pass.)_

- [ ] **[reference, living doc] Call-prep doc for Lee-Ann call — `documents/SAOC-LeeAnn-Call-Prep-2026-07-20.md`.** Built by diffing Lee-Ann's Spec V1/V2 against the 28-May proposal. Contains: the decided Phase 1/2 sequencing (restated from the unsent Gmail draft), open questions (payment-gateway paperwork mismatch, Sanity Studio status, ticket pricing/capacity — still blocks PayFast M2, content-gathering ownership/timeline, one-codebase-vs-two-sites, POPIA ownership), branding questions, the committee's own Spec-V2 Section-8 questions, and a running "Log — new items" section Brad keeps appending to.
  - **(2026-07-23) Corrected this session** after Brad caught earlier work asserting from memory instead of source: (a) **sources section** rewritten with the verified proposal provenance (28-May PDF → `saoctreasurer@gmail.com`, diffed against the on-disk docx); (b) **B1 (Yoco) corrected** — Yoco→PayFast is NOT an open question: Brad's SENT reply of 3 Jul 2026 (thread `19f177b373bd9f35`, to `2027national@gmail.com`) already told Lee-Ann Yoco is waitlisted with no ETA, recommended PayFast with exact fees (3.2% + R2/card txn, 2.0% Instant EFT) and listed the FICA docs; Lee-Ann acknowledged same day and said the committee would revert (no reply since). Now framed only as a "did the committee land anywhere?" follow-up, not a fresh question; (c) **phase-map artifact linked** (see scope-reconciliation item above); (d) **new C3 sub-item added** — Brad's view that the current National Show branding (Scott Ormerod's logo/colours/fonts) is somewhat lacking for a national-event brand; wants to directly ask Lee-Ann/the committee whether it's locked or open to a proper redesign via Claude Design, framed as a process offer, not a critique of Scott's volunteer work.
  - **Brad is still adding to it — no agent action; reference only.**

- [x] **[hardening] gitignore the legacy backup dir `Old SAOC Website Backup/` — DONE 2026-07-23.** Was UNTRACKED but NOT gitignored, so a stray `git add -A` would have staged it — including `homedir/public_html/configuration.php` and `database_user/` files carrying the OLD plaintext legacy DB credential. Added both `Old SAOC Website Backup/` and `ops-secrets.local.md` to `.gitignore` (lines 40–41); verified with `git check-ignore` (IGNORED-OK) and `git ls-files` (dir not tracked). Purely closed the accidental-commit window on the legacy cred; no live-site change. Re-verified 2026-07-23: no session mailbox password value appears in any tracked file (only the DB *username* label `saoccoza_NicoG*` is referenced in memory notes, never the secret value — actual values stay in gitignored `ops-secrets.local.md`).

## Autonomous routines — RETIRED (2026-07-28, Brad)
_The cloud RemoteTrigger routines were a once-off autonomy experiment that didn't work out — there is NO permanent nightly autonomous routine. Findings were passed upstream to the Athanor template maintainer, who will iterate on autonomy; improving that is NOT this project's job. Historical trigger IDs (for reference only, do not recreate): `trig_01Ry4fkFgbZCoW9CgUtqfh8D` (nightly sync + mission progress, had a 2026-07-15 scope-freeze), `trig_01PNsrRuno8EzxpaZP8dArv1` (harness watch 6-hourly), `trig_01Ue5oZh2nhRoKDXdURaFWu1` (disabled 2026-07-15)._

## Standing rule (2026-08-12, Brad): leave `branding/`, `design spec/`, `design/Claude Design HTML/` alone
Brad is actively reorganising these three untracked directories by hand. No agent should read,
move, edit, or clean up anything inside them until he says otherwise — not even as a "hygiene"
pass or gitignore fix. If a task seems to require touching one, stop and ask first.

## Standing rule (2026-07-28, Brad): scope = SAOC only; dogfood the harness, report upstream
- This workspace's job is the SAOC deliverables, nothing else (not WOSA, not Athanor autonomy R&D).
- Use the Athanor harness AS DESIGNED (mission → contract+goldens → @dev → @qa → @docs → gate → @maintainer) while building SAOC, and file every harness bug, friction point, or improvement idea upstream as a GitHub issue (`gh`) on the Athanor repo (`InunuNet/Athanor`) rather than working around it silently.

## F2 — Deploy: secrets do not resolve at runtime — PARTIALLY DONE, mission NOT closed (cms-activation-deploy, 2026-07-29/30)

Deploy shipped (commit `84dbf58`, backend `saoc-prod`) and the P0 (Studio editing) is genuinely
fixed for real users — `/studio/structure/{homePage,aboutPage,nationalShow,judgingPage}` all open
real document editors and all 12 marketing routes return 200, contract gate 6/6 against
production. BUT draft-mode preview and webhook revalidation are dead in production.

- [ ] **[P0, blocker] `SANITY_REVALIDATE_SECRET` / `SANITY_API_TOKEN` do not resolve at runtime.** **ROOT CAUSE REDIAGNOSED 2026-07-30 — the analysis below is SUPERSEDED and wrong.** The real cause is Secret Manager **payload corruption**, not IAM, not a stale build, not a failed rollout: both secrets were written by the same broken invocation, which stored `<~80-95 bytes of non-ASCII prose>` + `\n` + `<the real token>`. Secret Manager stores payloads verbatim with no trimming, so runtime resolves the whole contaminated blob and exact string equality against the clean value can never match — which is precisely why correct/wrong/absent all returned an identical 401. Proven structurally without printing either value: the payload's post-newline tail sha256 matches `.env.local` exactly (43 of 123 bytes for REVALIDATE; 180 of 276 for API_TOKEN). Both routes were exonerated — `app/api/revalidate/route.ts:5` and `app/api/draft/route.ts:7` read the env var INSIDE the handler, not at module scope. **`SANITY_API_TOKEN` was corrupted identically and would have failed the event-submission form the moment anything exercised it — a second latent production defect found by this diagnosis.** Fix: re-set both via `printf '%s' | --data-file=-` (never `echo`, which appends a newline; never dotenv, whose banner pollutes stdout), then force a rollout, since secret values resolve at Cloud Run revision creation. Guarded permanently by assertion A9. *Superseded original analysis, retained only as a record of the false trail:* The `grantaccess` re-run since verified via Secret Manager `getIamPolicy` REST that both secrets ARE bound to the backend's real service account — so the blocker now is getting a NEW build to actually run: `firebase apphosting:rollouts:create --git-branch main [--force]` reports success but creates nothing (likely dedupes on commit SHA against the already-failed build for `84dbf58`). A REST workaround was identified and started but not confirmed: `POST .../backends/saoc-prod/builds?buildId=<unique-id>` with `{"source":{"codebase":{"branch":"main"}}}` returned a real build operation (`build-manual-1785355696`) still in progress at session end. **Resume here:** poll that build (or a fresh one) to READY, confirm its `config.effectiveEnv` resolves both secrets, then re-probe `/api/revalidate` (correct secret → 200, wrong/none → still 401) and `/api/draft`. Full trace (auth method, exact API calls, evidence) recorded in `learned.md` under "F2 Deploy — Secrets Runtime Resolution Failure" since the original scratch investigation file is gone (`brain.py wrap-up` purges scratch).
- [x] ~~**App Hosting continuous deployment appears unarmed.**~~ **DISPROVEN 2026-07-30 by contract assertion A10.** Push-to-`main` autodeploy IS armed: the build serving 100% of production traffic (`build-2026-07-30-001`, commit `01dd63f`) was created automatically at 05:13Z with committer `github-actions[bot]`, with no manual rollout. The earlier conclusion came from the rollout-creation dedupe bug (below) masking the automatic path. Unattended/overnight deploys are NOT blocked — a commit on `main` ships on its own.
- [ ] Verify whether `SANITY_API_TOKEN` resolves at runtime once a good build is live (needs a Firebase ID token or a temporary diagnostic route) — same fix as the revalidate secret should cover it, but confirm separately since it's a different code path (`app/api/events/submit/route.ts`'s write client).
- [ ] **[security] Rotate `FIREBASE_ADMIN_PRIVATE_KEY`** (leaked into a session transcript via a non-allowlist `sed` redaction of `.env.local` — the pattern only matched single-line pairs, missing the multi-line key body) **and `SANITY_REVALIDATE_SECRET`** (became visible in screenshots during verification) before launch.
- [ ] **No admin UI lists `contactSubmissions`** — enquiries submitted via the contact form are visible only in the Firebase console, not anywhere in `/admin`. Real gap before launch; worth scoping as a small follow-up feature (a simple authenticated list/table view, same pattern as the door check-in scanner).

## Blocked (awaiting Brad)
- **RESEND_API_KEY not set anywhere (no Resend account signed up yet)** — found during F2 (`cms-activation-deploy`) apphosting.yaml env-var gap audit, 2026-07-29. `lib/email.ts` reads `process.env.RESEND_API_KEY`; `app/api/contact/route.ts` calls it inside its own try/catch and swallows the error, so this is NOT a contact-form outage — the Firestore write and HTTP 201 still succeed. Effect is silent degradation: submitters get a success response but never receive the confirmation email, in prod today and after F2's deploy. Fix: Brad signs up at resend.com, verifies the saoc.co.za sending domain, runs `firebase apphosting:secrets:set RESEND_API_KEY --project saoc-webapp`, then apphosting.yaml gets a `RESEND_API_KEY` (secret) + `RESEND_FROM_ADDRESS` (plain value) entry in a follow-up feature. Deliberately dropped from F2's contract (A5/A6 removed 2026-07-29 per team-lead) rather than declaring a `secret:` ref to a Secret Manager entry that doesn't exist, which would fail the whole App Hosting rollout.
- ~~**PayFast live merchant account (FICA verification)**~~ **DONE 2026-08-12 (Brad).** FICA is complete and the live merchant account is available. No longer awaiting Brad. The remaining go-live work is engineering, tracked as "Go-live: PayFast live credentials" above — and it is gated behind the DNS cutover, because `SITE_URL` must be the real domain before live ITNs land correctly.
- **DNS records**: SPF/DKIM/DMARC + Firebase hosting A-record. Brad to add after Resend domain verified.
- **Domain transfer**: saoc.co.za from current registrar to Inunu Net.

## Phase 2 — Out of scope (do not work on until Phase 1 ships)
- Society individual pages + admin logins + federated ticketing
- Paid SAOC membership (Yoco recurring billing) + members-only area
- Digital archive of Orchids South Africa yearbooks
- Donation system, sponsorship management, Google Ad Grant
- Learning library, judges training portal, articles/video

## Hosting — Decision Pending Brad (researched 2026-06-20)
Research complete: `documents/hosting-research-2026-06-20.md`. Key findings: (1) Vercel has Cape Town `cpt1` compute but SA SSR requires Pro plan ($20/month); free plan only caches in SA. (2) Fly.io `jnb` Johannesburg is best-value SA SSR at $8–15/month, requires Dockerfile migration. (3) "Coolify on Hetzner JNB" was a misconception — Hetzner Cloud has no SA DC; Hetzner SA is now Xneelo (separate company, suitable but maintenance-heavy). **Recommendation: stay on Firebase until latency is a measured problem; if SA compute is a hard requirement, Fly.io `jnb` is best value.** Brad to confirm: (a) hard requirement vs. preference, (b) budget ceiling, (c) no migration before DNS cutover.

## Harness Upstream (Athanor → InunuNet/Athanor)
- [x] **[athanor-upstream] Triage 2 pre-existing harness test failures — DONE 2026-07-28, clean-template triage. VERDICT: SPLIT.**
  - `test_mission.py` (17/19) — **UPSTREAM BUG.** Test 8 asserts old `resume` exit-0 semantics; current `mission.py` exits 2 "MAINTAINER WRAP-UP REQUIRED" for all-done fixtures. Reproduces identically on clean Athanor main. Filed: https://github.com/InunuNet/Athanor/issues/1318
  - `test_contract_fix.py` (10/15) — **ORPHANED LOCAL TEST.** Authored locally in `e863d887` alongside a 15-line single-phase `gate_cmd` fix to `contract.py`; a later `make update-template` silently overwrote `contract.py` with upstream (fix lost; `contract.py` now byte-identical to upstream), leaving the test permanently red. Test deleted locally 2026-07-28 (recoverable at `e863d887`). Fix + clobber-friction filed upstream: https://github.com/InunuNet/Athanor/issues/1319
- [ ] **[athanor-upstream] sync-autonomy v2** — `set-autonomy LEVEL=high` should propagate to `.claude/settings.json` permissionMode. Filed 2026-06-16.
- [ ] **[athanor-upstream] mission.py slug fix** — cross-date slug scan fix needs upstreaming via `make update-template`. Filed 2026-06-16.
- [ ] TEMPLATE BUG: `execution/gh_closure_scan.py` throws `ERROR: <file> has no YAML frontmatter` and returns zero candidates (silently, exit 0) if ANY file under `.agent/memory/project/missions/` lacks frontmatter — e.g. a plain planning note like `OVERNIGHT-PLAN-2026-07-30.md`. It should skip/warn on the one bad file and keep scanning the rest of the directory, not abort the whole scan. Found 2026-07-30 during mission close on `cms-activation-deploy`; user should run /report-bug.
- [ ] TEMPLATE BUG (NEW 2026-08-17, different symptom than above): `execution/gh_closure_scan.py --format lines` now fails immediately with `ERROR: could not resolve --repo:` (empty value) — no missing-frontmatter message this time, script appears to not even reach the mission-scan step. Not yet triaged (repo-detection / `gh` config vs. a regression in the script itself); user should run /report-bug.

## Deferred (auto-tracked)
- [ ] [dev 2026-06-18] Factory loop script needs error handling — Out of scope for this task _(priority: low, handoff: 20260618T075409-dev.json)_

_Last compacted: 2026-07-10 by session. Dismissed: check_own_comms + quota-monitor + qa-guard informational pulse noise — all informational, no action required. Full history: git log on this file._

## WOSA website rebuild — REMOVED FROM THIS PROJECT'S QUEUE (2026-07-28, Brad)
- [x] **~~[P1] Rebuild wildorchids.co.za (WOSA)~~ — NOT OURS. A separate developer and session are handling the WOSA rebuild.** Standing rule from Brad 2026-07-28: WOSA is an affiliate of SAOC — the SAOC site will carry plenty of info ABOUT them (and link to wildorchids.co.za), but we do NOT build or interfere with anything on their dedicated website. No agent, mission, or autonomous routine in this workspace should pick this up. Original requirements kept below for historical context only:
  - Visit the LIVE site at wildorchids.co.za and extract every design item (layout, colours, typography, spacing, imagery treatment, components) — copy faithfully, do not reinterpret or invent.
  - Target stack: Next.js, React, TypeScript, Firebase — same as SAOC — but content must be Sanity.io-editable on the backend (matches the CMS pattern already proven on this SAOC project).
  - Build LOCALLY first — no deploy yet. This phase is a placeholder/shell only.
  - Explicitly OUT of scope for this phase: full orchid genera/species taxonomy, full province listings, and other large structured content sets — those are data-migration work for a later phase.
  - Sequence: (1) design fidelity + shell first, get that nailed down, (2) THEN plan data migration separately.
  - Token-conscious: Brad flagged limited budget for this — plan carefully before executing, avoid wasted exploration.
  - NOTE: per CLAUDE.md scope boundary, WOSA is wild-orchid conservation, a separate org from SAOC — this is almost certainly a new/separate project directory, not inside this SAOC repo. Confirm target repo location before starting.
  - Status: NOT STARTED. Queued for a fresh session with full context budget (this session was near its context limit when the request came in — starting fresh avoids burning tokens on session recap instead of the actual design audit).

## P1 — Home page hydration mismatch in ShowBand / useCountdown — FIXED 2026-07-29 (F1, `cms-activation-deploy`)

**CLOSED.** `lib/hooks/useCountdown.ts` now uses `useSyncExternalStore` with a frozen
all-zeros `getServerSnapshot`, matching the pattern proven for `components/show/ShowCountdown.tsx`
in M2. Gate `contracts/f1-countdown-hydration.yaml` PASS (3/3), including a behavioural Playwright
check negative-controlled twice (pre-fix by @architect, post-fix stash-and-restore by @qa) and
live confirmation of real ticking (415 days, seconds 01→59) and clean interval teardown on
unmount. Full writeup: `docs/f1-countdown-hydration.md`.

Original finding (2026-07-29, kept for history): `useState<CountdownParts>(() => compute(targetDate))`
— a `Date.now()`-derived lazy initializer, rendered by `components/home/ShowBand.tsx` on the
home page — computed the countdown once on the server and again independently at hydration, so
any page load slower than ~1s produced a hydration mismatch and a visible flash. Reproduced by
@qa with Playwright (3s `_next/**` throttle): 2 `pageerror`s on `/`, numerals `31` vs `32` and
`30` vs `31`. Pre-existing since 2026-06-01/06-12, not caused by the Next 16 upgrade — deliberately
left out of scope for M2.

## Low priority — `useMemo` vs `useState` trade-off in `useCountdown.ts` (F1, 2026-07-29)

@qa flagged a non-blocking, unproven concern during F1 review: `useCountdown.ts` builds its
external store with `useMemo(() => createCountdownStore(targetMs), [targetMs])`, which carries a
React spec-level allowance to be discarded and recreated (unlike `ShowCountdown.tsx`'s
`useState(createCountdownStore)`, which never discards). @qa could not get React to actually
discard the memo, and reasoned that even if it did, the `setInterval` is created inside
`subscribe()` at commit time (not inside the memo callback), so a discarded memo would be inert
rather than leaking. Counter-argument: `useState`'s lazy initializer only runs once ever, so it
would NOT rebuild the store when `targetMs` changes on a later render — since `useCountdown` is a
shared hook that must support a caller changing its target (unlike `ShowCountdown`'s hardcoded
constant), `useMemo` is the form that actually supports the hook's contract. Open trade-off, not
a defect — no action needed unless a future session observes an actual discard-related bug.

## F6 — Page singletons: assessment findings (studio-next16-upgrade, 2026-07-29)

Full assessment: `docs/f6-page-singletons.md`. Assessment only — no documents created, no
code changed, per scope freeze.

- [ ] `membersPage` schema is orphaned — registered in Sanity Studio but no query in
  `sanity/queries.ts` and no `app/(marketing)/members/` route consume it. Needs a scope
  decision from Brad: build the page (new-page work, out of scope for F6) or remove the
  schema so it stops misleading editors.
- [x] Dead editable fields: `homePage.countdownDate` and `contactPage.formRecipients` are
  editable in Studio but nothing reads them. Either wire them in or remove them.
  **DONE 2026-08-12 (Stream C, `be80580`)** — both removed from the schemas after live
  `defined()` counts confirmed zero documents used them. `nationalShow.location` and
  `ticketType.price` (superseded duplicates) went the same way.
- [ ] No custom desk structure in `sanity.config.ts` (stock `structureTool()`) — the six
  page singletons are not pinned to a single document. An editor can create duplicate
  `homePage` (etc.) docs and the site will silently render an arbitrary one (`[0]` of an
  unordered GROQ result), with no error surfaced anywhere. ~1-2 hrs to fix with a standard
  Sanity desk-structure singleton pattern.
- [ ] Seed one document per singleton from the existing hardcoded copy (~2-3 hrs,
  mechanical migration) — makes `docs/secretary-cms-guide.md`'s promises true without
  changing anything visible on the live site.
- [ ] Populate `hostSociety` on the 18 `societyEvent` docs (~15-20 min, needs domain
  knowledge — someone who knows which society hosts which event; code side is already
  correct, see `docs/f6-page-singletons.md` §4).
- [ ] `docs/secretary-cms-guide.md` §7 and §12 currently instruct the secretary to open
  singleton documents that do not exist yet ("there is one document — click it to open").
  Guide is wrong until either the documents are seeded or the guide gets a "first time
  only, click New document" branch added (~15 min doc fix, can happen independent of
  seeding).
- [ ] Deployed Studio at `saoc-prod--saoc-webapp.europe-west4.hosted.app` still runs the
  old Next 15 build and remains broken (the `useEffectEvent` crash) until the next deploy
  ships the Next 16 upgrade from this mission.
- [ ] Pre-existing prettier drift across ~160 files (`pnpm format:check` fails) — unrelated
  to this mission, noted during the M2 regression pass.

## Content gaps observed in Studio walkthrough (Brad, 2026-07-29)

Direct visual evidence from a live authenticated Studio session on port 3333. These are
content-entry gaps, not code defects — every field below renders correctly and is editable.

**A 7th empty document type, not caught by the F6 assessment:**
- `Judge` — "No documents of this type". The schema is registered and reachable in the
  Studio sidebar, but zero documents exist. F6 enumerated the six page singletons and the
  `hostSociety` gap; it did not flag `Judge`. Needs the same scope decision as
  `membersPage`: is a judges directory planned, or should the schema be removed?

**Empty fields on existing documents (spot-checked, likely not exhaustive):**
- `societyEvent` — **Slug is empty** (confirmed on "Cape Orchid Society Autumn Show").
  This is the direct cause of `/events/[slug]` being unverifiable in the M2 regression pass
  (3 of 62 routes were compiled-and-present only, never live-rendered). Populating slugs
  would close that gap. Note the Studio has a "Generate" button per document.
- `society` — Description, Logo, Website all empty on "Cape Orchid Society" (Member Count
  is populated at 220, so the docs are partially filled).
- `boardMember` — Email and Photo empty on "David Naidoo" (Name and Role populated).
- `sponsor` — Tier, Logo, Website, Description all empty on "Royal Horticultural Society"
  (Name only).
- `show` — Date empty on "National Show 14 (2012)" (Title, Slug, Year populated).

**Populated and healthy:** 21 societies, 18 events, 6 board members, 6 shows
(National Show 14–19, incl. 19 (2027)), 10 show classes, 6 awards, 6 sponsors, 9 provinces.

Note: "Wild Orchids of Southern Africa" exists as a `sponsor` document — worth confirming
that matches the intended WOSA relationship (SAOC links to WOSA as a partner organisation;
see CLAUDE.md scope boundary).

## F3 — Pin singletons: follow-ups (cms-activation-deploy, 2026-07-29)

Full detail: `docs/f3-pin-singletons.md`. F3 shipped and @qa passed all five assertions;
these are the residual items, not defects in what shipped.

- [ ] **[Low] Check gap:** `contracts/checks/f3-pin-singletons/check-new-document-filter.mjs:17`
  hardcodes `MUST_SURVIVE = ['society', 'event']`, but `'event'` is not a real schema
  type name — the actual type is `societyEvent` (`sanity/schemas/index.ts` imports a
  binding named `event` from `documents/event.ts`, whose `defineType` declares
  `name: 'societyEvent'`). Causes no false pass today (A2 only tests set membership,
  and `'event'` never collides with the pinned-type list either way), but it means A2
  never actually exercises the real `societyEvent` name — a future regression that
  accidentally filtered `societyEvent` out of the create-new menu would go uncaught.
  Needs an @architect follow-up to fix the constant to `'societyEvent'`.
- [ ] **[Informational]** F3 protects the Studio UI only, not the write API — @qa
  confirmed `client.create({ _type: 'homePage', ... })` with a write-token client
  succeeds against the live dataset with zero resistance (test doc deleted, counts
  verified back to 0 immediately after). No write-token integration exists in this
  codebase today that would exploit this, so no action needed now — revisit if one is
  ever added (a script, migration, or third-party integration holding a Sanity write
  token could still create a duplicate of a pinned singleton type and reopen the
  `[0]`-query fragility F3 exists to close).
- [ ] **[Needs client answer]** Per the project spec
  (`documents/Website Development SpecificationV1.docx` §3.5, cross-referenced to
  §8), the real Members Portal is planned as an authenticated, member-only area with
  a Digital Journal library — separate future build, not the `membersPage` singleton
  F3 pinned as an empty placeholder. The spec leaves open how membership status will
  be verified and kept in sync with SAOC's actual membership records. This needs a
  client answer before the Members Portal itself can be built (not blocking on F3,
  which only pins the placeholder).

### [P0 BLOCKER] The CMS→site loop does not work in production — found 2026-07-30 by F6

- [ ] **A published Studio edit never reaches the public site. The App Hosting CDN edge never
  invalidates.** This is the mission's central claim failing, and it is NOT a check-script bug —
  reproduced three times, and independently re-verified by the orchestrator.
  **What works:** Studio publish writes to the dataset (confirmed by authoritative Content Lake read);
  `POST /api/revalidate` with the correct secret returns 200 `{"ok":true,"revalidated":true}` (F2's fix
  is real); `revalidateTag()` correctly marks Next's own cache stale.
  **What fails:** the CDN in front keeps serving its own cached object. Live headers on `/about`:
  `x-nextjs-cache: STALE` (Next knows) alongside `cdn-cache-status: hit`, `cache-control:
  s-maxage=31536000` (one year), and `age` climbing monotonically across a 120s poll. Next marks it
  stale; the edge serves the stale copy anyway.
  **Lead, unconfirmed:** App Hosting is presumably meant to translate `revalidateTag()` into a CDN
  purge — there are `cache-tag` response headers that look built for exactly that. Note
  `x-fah-adapter: nextjs-14.0.21` is reported against a Next **16.2.12** app; that version gap is the
  first thing for someone with App Hosting context to examine. Do not assume it is the cause.
  **Consequence for the client:** the secretary can edit, publish, and see nothing change on any
  already-cached page — the exact failure this mission exists to prevent. Everything else about the
  CMS is now correct, so this single gap gates the whole deliverable.
- [ ] **[P1] `/events/[slug]` has a second, independent propagation gap.**
  `app/(marketing)/events/[slug]/page.tsx` tags its `sanityFetch` calls `['events']` only — no
  `'sanity'` tag, and `'events'` does not match the real document `_type` (`societyEvent`) that a
  webhook payload would send. So even once the CDN issue is fixed, event detail pages likely still
  will not revalidate. Found while designing F6; deliberately NOT used as the test target so it could
  not be confounded with the CDN finding.
- [ ] Verifying the actual Sanity webhook fires end-to-end is currently impossible with the
  dataset-scoped `SANITY_API_TOKEN` — reading webhook config needs the `sanity.project.webhooks/read`
  grant (confirmed live: 401). F6 asserts the direct revalidate call instead, which is a weaker claim,
  stated as such rather than overclaimed.

### CMS wiring gaps — site-wide route audit, 2026-07-30

Source-first audit of all 18 `app/(marketing)/` routes: grepped every page for `sanityFetch`/query
imports and read what each does with the result. Method note: seeded copy was migrated FROM the
component fallbacks, so the two are byte-identical and text matching proves nothing — discriminate
via Sanity CDN asset URLs, PortableText `_key` UUIDs in the RSC payload, or source reading.

- [x] **[P2] `/national-show/archive/[year]` has no page for any show added in the Studio.**
  **FIXED 2026-08-12 (Stream C, `be80580`)** — `archive/[year]` now merges Sanity with the static
  array, so a Studio-added show has a detail page. Leftover from that merge: `show.awards` lost its
  rendered surface (no live effect — all values are null; booked in the new section below).
  Original text: The archive
  LIST (`archive/page.tsx:42`) is Sanity-backed via `pastShowsQuery`, so a `show` document created in
  the Studio does appear there. The DETAIL page (`archive/[year]/page.tsx:6,49`) reads only the static
  `lib/data/shows` array and calls `notFound()` otherwise — so a Studio-added show has a list entry but
  no detail page behind it.
  **CORRECTION (same day):** an earlier revision of this entry claimed the list "publishes a broken
  public link" and ranked it P1. That was wrong — verified `archive/page.tsx` links only to
  `/national-show` and `/contact`; the list cards are plain divs, not links, and the only
  `archive/${year}` hrefs are the prev/next buttons inside the detail page, themselves generated from
  the static array. So no dead link is created today. The real exposure is narrower: a visitor who
  reaches that URL directly — a shared link, or once someone wires up card links — gets a 404.
  Downgraded to P2 accordingly. Note the latent trap: whoever later makes the list cards clickable
  turns this into the visible-broken-link problem it was mistakenly described as.
- [x] **[P2] Orphaned document types — editable in the Studio, read by nothing.**
  **PART STALE, PART DONE — corrected 2026-08-12 (Stream C, `be80580`).** ⚠️ The `award` half of
  this entry was **wrong**: `award` is not orphaned. It has 6 documents, `awardsQuery` exists
  (`sanity/queries.ts:196`) and `/judging` already fetches it
  (`app/(marketing)/judging/page.tsx:9,40`). No work was needed; do not act on the claim below.
  `province` was **wired, not removed** — 9 live docs — and the `/societies` chips were verified by
  Playwright to actually filter. `membersPage` remains a deliberate placeholder (still open above).
  Original text: `award`
  (`AwardsGrid.tsx` reads the static `lib/data/awards` instead) and `province` (`society.province` is
  free-text, not a reference to it). Either wire them or remove them from the Studio; leaving them
  editable teaches the client that publishing does nothing. `membersPage` is also unread but is a
  deliberate placeholder with no `/members` route yet. NOT orphaned despite absence from a naive
  `_type ==` grep: `judge`, dereferenced via `judgingPageQuery`'s `judges[]->` (`queries.ts:142`).
- [ ] **[P2] Unread schema fields:** `aboutPage.title`, `aboutPage.boardIntroText`, `judgingPage.stats`
  (hero headings are hardcoded JSX). Same class as the already-recorded `homePage.countdownDate`.

**Verified Sanity-backed** (safe to tell the client she can edit): `/` (hero images, mission text,
countdown via `nationalShow.countdownDate`, events strip, partners), `/about` (pillars, timeline,
board), `/judging` (all copy + judge directory), `/contact` (code path correct; unverifiable from HTML
until F6), `/events` + `/events/[slug]`, `/sponsors`, `/societies` + `/societies/[slug]`,
`/national-show/archive` (list only).

**Verified NOT editable:** `nationalShow` title/venue/host/hero/exhibitor stages; the `/national-show`
page's own countdown (`ShowCountdown.tsx:5` hardcodes the target — note this differs from the home-page
countdown, which IS live); `archive/[year]`; `/media-kit`, `/constitution`, `/privacy`, `/terms`,
`/national-show/exhibitors` (no CMS pretense — expected, not broken).

### Seeded-but-inert content — found 2026-07-30 by post-F4 render audit

- [x] **[P1] `/national-show` never reads the `nationalShow` singleton.** **FIXED 2026-08-12
  (Stream B, `be80580`)** — show identity (title, venue, dates, edition, countdown) now flows from
  Sanity to all seven surfaces, proven by a runtime swap sweep (A61) rather than a source grep.
  Before the fix, swapping the venue rendered two different venues in one viewport.
  Original text: F4 seeded the document and its
  gate passed 4/4 — but the gate asserts against the **Sanity API**, not the rendered page.
  `app/(marketing)/national-show/page.tsx:7-8,89-90` calls `sanityFetch` for `showClassesQuery` and
  `pastShowsQuery` only. There is no `nationalShowQuery`. Title, venue (`'CTICC, Cape Town'`, line 151),
  hero image, exhibitor stages and the countdown target (hardcoded in `components/show/ShowCountdown.tsx`)
  are all literal JSX/constants. So the secretary can edit the National Show page in the Studio, publish,
  and **nothing will change on the site** — the exact failure this mission exists to prevent. Not a
  query/field-name mismatch (that would be a one-line fix); the page needs wiring to fetch the singleton,
  which is a code change against heavily hardcoded JSX, so it was deliberately NOT done as part of F4's
  content migration. Note this compounds the already-recorded `homePage.countdownDate` dead-field problem:
  `nationalShow.countdownDate` was documented to the secretary as the field that *does* drive the
  countdown, and it does not either — the countdown is a constant in the component.
- [ ] **[P2] `/contact` cannot be discriminated without a round-trip edit.** `contactPage`'s seeded values
  and the component fallback are byte-identical, and `contactPageQuery` (`sanity/queries.ts:149`) projects
  no `_key` for array items, so no structural marker reaches the rendered HTML. Unknown whether the page
  fetches successfully or silently falls back. F6's round-trip proof should settle it.
- [x] Confirmed genuinely fetching Sanity on the deployed site: `/` (hero images resolve to
  `cdn.sanity.io`, not `/images/*`), `/about` and `/judging` (PortableText branch taken, Sanity `_key`
  UUIDs present in the RSC payload). Discriminators recorded here because seeded copy was migrated FROM
  the component fallbacks — the two are identical strings, so text matching proves nothing.

### F2 — contradiction RESOLVED 2026-07-30

- [x] ~~**Which build is actually live on `saoc-prod`?**~~ **SETTLED.** Neither prior position was right about the
  present state — the build-resource inspection was accurate when taken (2026-07-29) but went stale overnight.
  A CI-triggered build shipped F1+F3+F2 at 05:13Z on 2026-07-30 and now serves 100% of traffic:
  `build-2026-07-30-001`, commit `01dd63f`, confirmed by two independent control planes (App Hosting traffic
  split + Cloud Run `latestReadyRevision`) and by `git merge-base --is-ancestor` against all three of `604ba3a`,
  `ffb4225`, `84dbf58`. The behavioural evidence (pinned singleton editor rendering) was therefore correct.
  Now permanently guarded by assertion A10 (`contracts/checks/f2-deploy-next16/build-identity-deployed.mjs`).
  **Lesson:** ETag is NOT a build discriminator — ISR regeneration changes it — and a single build-resource read
  in isolation is not either. Cross-check two control planes plus git ancestry.
- [ ] `firebase apphosting:rollouts:create` reports "Successfully created a new rollout!" while creating **no** new
  rollout or build resource (verified by REST GET; next sequential ids 404). Appears to dedupe on git SHA. @dev
  worked around it by POSTing directly to the App Hosting REST builds endpoint (`build-manual-1785355696`) — status
  unknown, never polled to completion.
- [ ] IAM is confirmed fixed and durable: `firebase-app-hosting-compute@saoc-webapp.iam.gserviceaccount.com` holds
  `secretAccessor` + `viewer` on both `SANITY_REVALIDATE_SECRET` and `SANITY_API_TOKEN`, verified via Secret Manager
  IAM policy REST calls. The remaining failure is getting a build that references the secrets to actually roll out.
- [ ] Production ETag is NOT a build discriminator — it changed again (`a8e4pxlfw41lfq` → `1337qsztbrz1lfq`) without a
  confirmed new rollout, because ISR prerender regeneration also changes it. A8 is weaker evidence than it looks.

## Client / governance — raised 2026-08-11

- [ ] **Secure organisation-owned document custody for SAOC** (council discussion point, not a
  build task yet). Institutional records currently sit in individuals' Google Drives, thumb
  drives and personal email. Need a role-based, SAOC-owned home for constitution, minutes,
  judging standards, show archives, brand assets, sponsor agreements, NPO/PBO and financial
  documents, photography rights, and site credentials. Critical sub-point: accounts must be
  registered to SAOC as an organisation, not to whoever creates them — applies especially to
  the PayFast merchant account, the domain, and any Google/Microsoft tenant. GitHub stays the
  home for source code only; it is the wrong tool for committee documents. Written up as
  section E in `documents/SAOC-LeeAnn-Call-Prep-2026-07-20.md`.
- [ ] **Society-published calendar feeds aggregated into the national events calendar** (Phase 2,
  back burner). Each of the 21 societies maintains its own iCalendar (`.ics`) feed; the site
  subscribes and aggregates, so maintenance stays with the societies rather than loading SAOC
  staff. NOT web scraping — `.ics` is a stable standard published natively by Google Calendar,
  Outlook and Facebook Events. The codebase already emits `.ics` (`app/api/events.ics`,
  per-event exports), so this is the mirror image of existing work. Needs a moderation step
  before public display, and a manual-entry fallback for societies with no digital calendar.
  Validate cheaply first: ask how many of the 21 societies actually keep one. Written up as
  section F in the call-prep doc.
- [ ] **Retrofit JSX-interpolation rigour onto pre-existing contracts** (raised by TKT-architect
  2026-08-11, deferred — not what the demo needed). Assertions that check "this Sanity field is
  rendered" via a plain substring grep for the field name are FALSE GREENS: they pass a field
  that appears only in a fetch, destructure or type annotation and is never rendered. That is
  precisely the live `aboutPage.title` bug (fetched at `about/page.tsx:19-20`, never rendered).
  The correct check requires the field inside an actual JSX curly-brace interpolation, excluding
  `{/* comment */}` matches. Also worth adding everywhere: assert no reversed fallback precedence
  (`'literal' ?? data.field`), which lets a hardcoded string silently mask a published Studio
  edit — same symptom as an unrendered field, different cause. Reference implementation:
  A48/A49/A50/A50a in `contracts/contract-ticketing-m1-m2.yaml`.
- [ ] **Two known silent no-op CMS fields — fix before Lee-Ann's Studio walkthrough.**
  `contactPage.formRecipients` (in the schema, editable in Studio, consumed by nothing) and
  `aboutPage.title` (fetched, never rendered). An editor changes either, publishes, sees no
  effect, and concludes the CMS is broken. Delete or wire — do not leave as-is.
- [ ] **Agent naming convention for parallel missions:** prefix subagent names with the mission
  slug, not the feature ID. Running `saoc-pages-editable` and `ticketing-pages` concurrently
  produced `F1-dev` and a `TKT-dev` whose contract also had an F1 — the second agent stopped and
  asked whether it was duplicating work. Correct behaviour on its part, avoidable collision on ours.
- [x] **F6 — Door scanner admits unpaid tickets (HIGHEST ticketing priority).**
  **FIXED 2026-08-12 (Stream A, `be80580`)** — admission logic extracted to `lib/checkin.ts`;
  the route delegates and holds none. Every unenumerated state now fails closed (cancelled,
  refunded, case/whitespace variants, absent status). Note the auth layer above it is still
  non-functional — Firebase Auth is unprovisioned, see `needs-human.md`.
  `app/api/admin/checkin/route.ts` looks a ticket up by `bookingRef` alone and only refuses one
  that is ALREADY checked in. It never checks `status === 'paid'` and never checks `showId`. A
  merely `reserved` (unpaid) ticket, including one created under a spoofed `showId`, is as
  admissible at the door as a legitimate paid one. Pre-existing, outside the M1/M2 contract,
  found by @qa 2026-08-11 while probing the capacity gate. Fix before any real door use.
- [x] **F6 — TOCTOU race on ticket capacity.** **FIXED 2026-08-12 (Stream A, `be80580`)** —
  now a Firestore transaction; @qa measures exactly 1×201/19×409 at 20-way concurrency on the
  boundary. The fix introduced its own regression (seats never released on abandonment), since
  closed by a TTL that can never expire a paid ticket. Original text: The capacity check in
  `app/api/tickets/checkout/route.ts` is an unguarded read-then-write: it counts sold tickets,
  then writes the reservation, with no transaction. @qa reproduced it live — a type at 49/50 hit
  with 5 concurrent POSTs returned 201 five times, ending at 54/50 (4 oversold). Needs Firestore
  `runTransaction` around count-then-write, not sequential awaits. Matters most exactly when a
  popular type is selling out, which is when concurrent buyers are likeliest.
- [x] **F6 — Checkout idempotency + booking-ref enumeration.**
  **FIXED 2026-08-12 (Stream A, `be80580`)** — booking refs are now 60-bit crypto-random, and
  checkout is idempotent with the key bound to buyer and payload. Previously a replayed key
  returned another buyer's booking reference, which is the door code. Original text: No protection against rapid
  duplicate POSTs from one client beyond the UI disabling its own submit button. Booking refs are
  a fixed prefix plus a 6-digit number (`SAOC-2027-000000`–`999999`), i.e. guessable; the status
  endpoint's minimal `{status}` response limits but does not eliminate the value of enumeration.
- [x] **F7 — `SITE_URL` is absent from `apphosting.yaml`.** **FIXED 2026-08-12 (Stream A,
  `be80580`)** — declared in `apphosting.yaml`; deployed ITNs would otherwise have reached the old
  Joomla site. Original text: Set locally and read at request time,
  so PayFast sandbox works from this machine. On a deploy the checkout route falls back to
  `https://saoc.co.za` — the OLD Joomla site — so the ITN callback would be delivered there and
  never reach the app. Every deployed payment would sit permanently `reserved`. Blocks any real
  deployed ticket sale.
- [ ] **Council decision blocking ticketing: real prices and venue capacity.** Everything now in
  the Sanity dataset is INVENTED by us and labelled "Provisional price — pending council
  confirmation.": Adult R150/300, Pensioner R100/100, SAOC Member R100/150, Child R50/100,
  Exhibitor free/50. The single most revenue-blocking open item.
- [x] **Proper favicon for the site — SHIPPED 2026-08-12 (interim).** `app/favicon.ico` now serves
  Brad's yellow-orchid mark from `/Users/vetus/ai/SAOC Branding/favicon.ico` (outside the repo).
  Rebuilt from 6 layers to 4 (16/32/48/64), dropping the 128 and 256 layers: 93,316 -> 12,272
  bytes, an 87% cut, since 256px was 62KB of the file and never renders in a tab. Served copy
  verified byte-identical and all four PNG payloads valid. **Revisit when the SAOC org logo
  lands** — the mark is a detailed full-colour illustration that loses definition at 16px, and the
  site chrome uses a monochrome line-drawing disa, so the tab icon and the header mark are not yet
  the same identity. Original text below.
- [ ] **Proper favicon for the site.** We are currently serving a default — likely the Next.js,
  Sanity Studio or Firebase placeholder rather than anything SAOC. Needs a real SAOC icon
  (and check `/studio` separately, which may carry its own). Blocked on the SAOC org logo Brad
  is designing; do the favicon pass once that lands so the mark is consistent. Raised by Brad
  2026-08-11.

## Open after the overnight four-stream session (2026-08-12, commit `be80580`)

All four streams are contract-green and documented (A 37/37, B 72/72, C 14/14, D 52/52). These
are what they left behind.

- [ ] **@qa round-2 findings R2-1 … R2-5 on ticketing — none fixed, all non-blocking.** Full text
  in `.agent/memory/scratch/harden-qa.md`, round-2 section. Summary:
  - **R2-1** — a new failure mode introduced by design and invisible to the operator.
  - **R2-2** — a correct 409 the client cannot recover from.
  - **R2-3** — pre-existing, but round 2 made it *look* handled, which is worse than leaving it
    visibly broken.
  - **R2-4** — the uncovered half of S5.
  - **R2-5** — wrong copy on one refusal path.
- [ ] **Streams B and D: round-2 fixes were verified by the gate but never re-reviewed by @qa.**
  Round 1's equivalent on Stream A found five real defects *past* a green gate, including a
  regression the fix itself introduced. Treat gate-green-but-unreviewed as unfinished.
- [x] **`nationalShow.exhibitorStages` retirement — DONE 2026-08-12, by team-lead ruling.** The
  deadlock turned out to have three sides, not two. Stream B's A5 was amended to drop the field
  (it guards against *collateral* deletion during F1, which a deliberate retirement is not, and a
  grep cannot tell them apart), and B gained **A77**, which asserts the retirement is COMPLETE
  across schema, GROQ projection and the landing page's read path — so a half-done removal now
  fails rather than passing quietly. The third side was
  `cms-loop-f3-national-show.yaml` **A3**, whose whole subject was the field; retired in the same
  change with the reasoning recorded inline. Dataset verified empty first
  (`count(*[defined(exhibitorStages)]) == 0`), so no editorial content was destroyed.
- [x] **Stream B's A41/A56/A24 rotating red by gate ordering — DONE 2026-08-12.** Fixed in the
  shared helper as this entry asked, not per assertion: `settlePage()` polls until the page agrees
  with the dataset, and **A76** now fails any dataset-sourced rendered check that calls
  `fetchOkPage()` directly, so the defect cannot be reintroduced. Two causes hid behind the one
  symptom — the page lagging the dataset (fixed by polling) and the dataset being *deliberately
  invalid* mid-sweep, which polling cannot fix and which is why the read-only checks now take the
  dataset lock too. Root cause of the dataset corruption underneath it all was missing
  `timeout_seconds`: every mutating check inherited the 60s default and was SIGKILLed mid-mutation.

- [ ] **`cms-loop-f3-national-show.yaml` A5 is superseded — needs a scope review, not a patch.**
  It asserts the `nationalShow` schema still declares exactly its original six fields, so it is
  **already red for a sanctioned reason**: the visitor stream legitimately added `showEndDate`,
  `edition`, `hostRegion` and `venue`. That is a contract that has been overtaken by later work,
  not a defect, and it wants a considered pass by someone with the context rather than a one-line
  fix. While in there, decide whether to delete the now-unreferenced
  `contracts/checks/cms-loop-f3-national-show/check-exhibitor-stages-round-trip.mjs` (retired A3,
  kept only as the worked example of the round-trip pattern).
- [ ] **`show.awards` lost its rendered surface in the archive merge** (Stream C). No live effect
  today — every value is null — but the field is now editable with nothing reading it, which is the
  exact pattern that teaches editors publishing does nothing.
- [ ] **No SAOC-side notification exists for contact-form enquiries.** Submissions land in
  Firestore and nothing tells anyone. Staff would have to go looking. Confirmed during Stream C.
- [ ] **`scripts/seed-page-singletons.ts` still uses destructive `createOrReplace`** (7 occurrences,
  verified 2026-08-12). Untouched by this session. Seeds must be create-if-absent; a re-run today
  silently overwrites edited singletons.
- [ ] **TEMPLATE BUG: `execution/gh_closure_scan.py` aborts on any non-mission file in
  `.agent/memory/project/missions/`.** It exits with
  `ERROR: .agent/memory/project/missions/OVERNIGHT-PLAN-2026-07-30.md has no YAML frontmatter`
  and scans nothing, so closure scanning has been silently non-functional here. It should skip
  files without frontmatter rather than abort. Not fixed (Athanor file, out of this project's
  scope) — user may run `/report-bug`. Workaround: `InunuNet/SAOC` currently has **zero open
  GitHub issues**, so nothing was missed this session.

### Filed upstream this session (InunuNet/Athanor)

- https://github.com/InunuNet/Athanor/issues/1337 — `contract.py` drops the CLI `--timeout-seconds`
  override for sub-phases under `--phase all`. Verified in source: the per-sub-phase
  `argparse.Namespace` omits `timeout_seconds`, so the consumer's `getattr(args, ..., 60)` falls
  back to 60. **Per-assertion `timeout_seconds` DO survive** (`contract.py:137-138`) — an earlier
  agent report claiming declared timeouts were dropped was wrong, and the issue says so. The
  issue also asks for SAOC's local `normalize_contract` patch to be upstreamed.
- https://github.com/InunuNet/Athanor/issues/1338 — `handoff_check.py`'s GATE BLOCKED file omits
  the failure reason, artefact path, trend and mission id, so the human it escalates to gets no
  diagnostic. Instance: `.agent/memory/scratch/gate-blocked-20260812T031704Z.md` (the pulse
  `qa -> docs` handoff froze itself after three failures). It blocked nothing this session only
  because agents were dispatched directly rather than through the pulse.

## Content intake from Lee-Ann's Drive folder — 2026-08-12

Folder "Docs for Brad": https://drive.google.com/drive/folders/1rZJVrYwrWM92vqmPw2c9E_HABQKEQoGa
Access VERIFIED 2026-08-12 via the `gws` CLI (authenticated as Brad; plain curl/Alembic only see
the HTML shell). All five files downloaded and read. Mirrored to `documents/from-leeann-drive/`,
which is **gitignored** — Spec V3's final "Email Collection Checklist" carries plaintext mailbox
passwords. Brad met Lee-Ann on Teams the same morning; no status email is owed to her.

- [ ] **[P1, COMMERCIAL — Brad's call] `Website Development SpecificationV3.docx` scopes TWO
  separate websites**, not one: a permanent SAOC organisational site (6 pages) and a dedicated
  2027 National Show event site (18 pages). We built one site with the Show as a section under
  `/national-show`. V3's Section 6 also marks as "Confirmed by INUNU" several items never priced
  in the accepted 28-May proposal — unified multi-category checkout (Admission + Symposium +
  WOSA + Workshops in one transaction), filterable exhibitor/guest databases, the relational
  awards archive, and the Members Portal with journal library. This supersedes the V1/V2 phase-map
  work. **Do not restructure routes; this needs a scope+price conversation first.**
- [ ] **[P1] Spec V3 Section 8 is a direct question list for INUNU** (13 questions across CMS,
  filtering, bookings, notifications and archiving). Several already have answers in our codebase.
  Worth a written reply so the register's "Pending confirmation" rows can be closed.
- [ ] **[P2] Real Show copy has arrived — three approved pages, ready to load into Sanity.**
  `About - 2027 National Show.docx`, `What to Expect.docx`, `South African Exhibitors.docx`.
  This is the first client-approved copy we have; it replaces our labelled placeholders on
  `/national-show` and `/national-show/what-to-expect`. Confirms the show theme: **"From Wild
  Origins to Cultivated Excellence: The Future of Orchids."** Small, well-scoped content mission.
- [ ] **[P2] `2027_SAOC_National_Show_Vendor_Registration_Form.docx` is a 21k-char paper form**
  covering vendor/business details, booth requirements, power, products, insurance and payment.
  Natural candidate for a structured online vendor application (Firestore + confirmation email,
  same pattern as event submissions) rather than a PDF download. Scope question, not yet a task.
- [ ] **[security, low urgency] Spec V3 circulates SAOC mailbox passwords in plaintext** in a
  shared Drive doc. The values are already stale — the 2026-07-20 VPS migration replaced all five
  with generated passwords and deliberately did not restore the originals. Worth telling Lee-Ann
  the doc should not carry credentials at all.
- [ ] **[content] The `show@saoc.co.za` mailbox has been unused since 2020**; Lee-Ann suggests
  archiving it. Also flagged in V3: Brad to create per-area show email addresses (symposium, WOSA,
  bookings) so committee members get registration notifications for their own area.

- [ ] **[P3] `components/chrome/Footer.tsx:117` links the dead `wosa.org.za`.** Site-wide footer,
  every page. The live WOSA site is `https://wildorchids.co.za`. Found 2026-08-12 by
  PARTNERS-architect while scoping the home-page partners redesign; deliberately left out of that
  contract's scope (which fixes the same dead URL in `PartnersSection.tsx` only). One-line fix.
- [ ] **[P3, a11y] Partners card link accessible name concatenates.** In
  `components/home/PartnersSection.tsx` the name and description `<span>`s are JSX-adjacent with
  no whitespace text node, so the anchor's accessible name reads
  "Wild Orchids of Southern AfricaPartner organisation hosting…". Renders fine visually and most
  screen readers pause at the block boundary, but it is not guaranteed across all AT. Found by
  PARTNERS-qa in both review rounds 2026-08-12; deliberately not fixed in that feature. Fix with
  an explicit `aria-label` on the link or a whitespace/`{' '}` separator.

- [ ] **[P1, sequencing decision — Brad 2026-08-12] Ticketing: single tier first, multi-tier
  PAUSED.** Prove the existing General Admission flow end to end against the PayFast sandbox
  before building anything else. Only then expand to multi-tier (General Admission / Symposium /
  WOSA Conference / Workshops / Exhibitor), and pause again for council feedback before
  committing to that shape. Rationale: de-risk the payment path once, cheaply, rather than
  discovering a gateway problem inside a five-product checkout — and the multi-tier structure
  can't be finalised without real council prices, capacities, and Lee-Ann's per-event write-ups
  anyway. Note the two-level shape when it does come: General Admission has CATEGORIES under it
  (adult/pensioner/child/member) while Symposium/WOSA/Workshops are separate PRODUCTS with their
  own capacity and waiting lists; the current flat `ticketType` schema will not stretch to that.
  Also outstanding from Lee-Ann: a cocktail event with option dropdowns (her spreadsheet, tab 2)
  that is not in the five tiers.

## Missions scoped and written to disk — 2026-08-12

- [ ] **MISSION `sandbox-ticket-proof`** (`.agent/memory/project/missions/2026-08-12-sandbox-ticket-proof.md`)
  — 5 features, 3 milestones, validated, **now the active mission**. Prove the existing
  single-tier ticket flow end to end against the PayFast sandbox on a DEPLOYED environment, then
  pause. F1 is deploying current `main` — the deployed site is still on `01dd63f` (2026-07-30) and
  `/tickets` 404s there, so nothing is testable until it lands. F5 (door admission) is blocked on
  Firebase Auth. Sandbox only; no live credentials, no price changes, no ITN route edits.
- [ ] **MISSION `national-show-design-alignment`** (`.agent/memory/project/missions/2026-08-12-national-show-design-alignment.md`)
  — 4 features, 3 milestones, validated, **BLOCKED pending Brad delivering the Claude Design
  bundle**. Ingest the design system, add tokens to `globals.css` without breaking the placeholder
  "Sage & Paper" set used site-wide, rebuild the Show section against the design without
  restructuring routes or re-hardcoding anything currently wired to the `nationalShow` singleton,
  then apply the 2027 Show brand layer below the header. Cannot start until the assets arrive —
  no agent invents brand assets.

- [ ] **[P2, mobile] `/contact` is unreachable from the header on mobile.** Verified live at 375px
  with Playwright 2026-08-12: the header's Contact button is `hidden sm:inline-block`
  (`components/chrome/Header.tsx:150`) so it does not render, and `MobileMenu.tsx` renders only the
  NAV array plus a `mailto:council@saoc.co.za` link — it never includes `/contact`. Count of
  visible `a[href="/contact"]` in the header at 375px: **0 before opening the menu, 0 after**.
  So a phone visitor has no route to the contact form from the header at all; the footer is the
  only remaining path. Found by PARTNERS-docs while documenting ticket reachability (it chose
  NAV-array placement for Tickets precisely because the Contact button pattern is mobile-invisible).
  Same defect class as the ticket-reachability fix — a real entry point that exists but cannot be
  clicked. Fix by adding `/contact` to the MobileMenu, not by unhiding the button (which would
  crowd the mobile header).

- [ ] **[P1, content] Rebuild visitor travel content for the Stellenbosch venue.** Brad corrected
  the National Show venue on 2026-08-12: it is **The Hangar, Stellenbosch Flying Club** (Stellenbosch
  Airfield, R44, Stellenbosch 7600; approx. -33.9794, 18.8196), NOT the CTICC placeholder. The
  `nationalShow.venue` object, `show-19-2027.location`, the national-show societyEvent, and two
  `showFaq-getting-there-*` answers were all corrected in Sanity, and every CTICC-anchored travel
  section was **cleared rather than rewritten**, because inventing airfield transport detail is
  exactly the failure mode the project bans. Emptied: `airportRoutes`, `accommodation`, `attractions`
  (all list components return null when empty, so pages degrade cleanly — verified over HTTP).
  Neutralised to "not confirmed" prose: `publicTransport`, `parking`, `accessibility`,
  `gettingThereIntro`, `accommodationIntro`. Confirmations for those six set to `pending`.
  **What is owed:** real Stellenbosch-area travel, parking, accommodation and attractions content —
  needs committee input (there is no scheduled public transport to the airfield, so arrival is
  effectively drive/e-hail only, which changes the shape of the advice). Pre-change values are
  backed up at `.agent/memory/scratch/venue-change-2026-08-12/before.json`.
- [ ] **[P2] `scripts/seed-show-visitor-info.ts` still contains the CTICC copy.** Inert today —
  every write is `createIfNotExists`, so it cannot clobber the corrected dataset — but it is now a
  stale source of truth if the dataset is ever rebuilt from empty. Update the seed constants to
  match the corrected Sanity content. Code change, so it goes through the chain.
- [x] **[RESOLVED 2026-08-12] Stellenbosch venue is confirmed.** Lee-Ann confirmed it to Brad by
  WhatsApp; `showVisitorInfo.confirmations.venue` set to `confirmed`, so the "to be confirmed by
  the show committee" badge no longer renders under the venue. Remaining pending badges (parking,
  accessibility, public transport, accommodation, attractions) are correct — those are still open.

- [x] **[SUPERSEDED] Is the Stellenbosch venue committee-confirmed?** `confirmations.venue`
  was left at `pending`, so the site still shows a "to be confirmed by the show committee" badge
  under the venue. The venue name itself is now stated plainly (no "working venue" hedging). If the
  committee has signed it off, flip that one field to `confirmed` and the badge disappears.

- [ ] **[P1, architecture] Make show identity edition-scoped so a venue/date change is ONE edit.**
  Brad, 2026-08-12: "after three years they're going to do a new show and that'll have a new venue
  — are we going to have to recreate all of this every time?" Correct concern. Verified today: the
  venue fact is stored in **four** places — `nationalShow.venue.name`, `nationalShow.location`,
  `show-19-2027.location`, and the national-show `societyEvent.venue` — plus four repo files. They
  agree right now only because they were all written by hand in one sitting. That is the definition
  of drift waiting to happen.
  **What good looks like** (see `.claude/rules/content-modeling.md`):
  1. One venue object as the single source; the edition doc and calendar event reference the show
     rather than restating its location as free strings. Contract-assert the copies agree.
  2. Venue-dependent prose (`showVisitorInfo`: travel, parking, accommodation, attractions) records
     WHICH venue it was written for, so a venue change auto-flags it stale instead of silently
     serving directions to the wrong side of the province. This is the fix that would have caught
     the CTICC bug by itself — the current `confirmations.*` flags rely on a human remembering.
  3. A documented, repeatable **show rollover** procedure: current edition → archive entry, new
     edition → current. Must be a content operation, never a code change.
  Blocked on nothing technically, but sequence it AFTER `contract-venue-seed-truth` lands (that one
  removes the immediate from-empty-rebuild regression) and after the design-alignment mission, since
  a Show redesign may move these surfaces anyway. Scope as its own mission via /mission new.

- [ ] **[venue-prose-residue, KNOWN-OPEN] `contracts/golden/f4-seed-page-singletons/nationalShow.golden.json` still pins CTICC.** The seed script changed (venue corrected to Hangar by `venue-seed-truth`) but this golden didn't — it still expects CTICC as output from `seedNationalShow()`. Owned by `contracts/cms-loop-f3-national-show.yaml`, not `venue-prose-residue.yaml`. A19 in `contract-venue-prose-residue.yaml` deliberately leaves it alone (asserting it still holds CTICC as proof the fix stayed scoped). Self-detecting failure on the F4 contract's next run; stale until then. See `contracts/golden/venue-prose-residue/README.md` for why this is out of scope.

- [ ] **[venue-prose-residue, KNOWN-OPEN] Historical golden files from old CTICC research phase.** `contracts/golden/show-visitor-info/{cticc-research.golden.md, venue-single-source.golden.md, show-identity-wiring.golden.md, assertion-discrimination.golden.md}` are preserved as dated research records of what was researched and when for the old venue. Deliberate preservation under content-modeling rule 6 (don't corrupt real history with careless global replace). Worth a human decision: mark with a "superseded" banner to clarify they are historical, or archive them entirely? Not a defect; clearing decision is optional.

- [ ] **[venue-prose-residue, needs second pair of eyes] Review remaining scope exclusions in the venue-prose-residue checkers.** @architect audited the checkers' scope exclusions during this contract and found one bad attribution: the golden's identity fields (e.g. `showFaq-getting-there-3`'s copy) were claimed as "owned by `contract-venue-seed-truth`," but that was never true — only this contract's own A13 actually protects them. That one was caught and corrected; the audit was not exhaustive. Worth a second reviewer walking `contracts/golden/venue-prose-residue/README.md` and the checker scripts' exclusion lists end to end, given this is the exact defect class (imprecise ownership claims narrowing a checker's scope) that let stale CTICC prose survive two earlier green gates.

## Local dev URL — https://dev.saoc.co.za (added 2026-08-13)

`scripts/install-dev-domain.sh` gives the local dev server a permanent hostname.
**Brad must run it once from Terminal.app** (`cd ~/ai/SAOC && sudo bash scripts/install-dev-domain.sh`)
— sudo cannot prompt for a password in the agent shell, so no agent can complete this step.
Until it is run, the working URL is `https://dev.saoc.co.za:3333` (hosts entry + cert are
already in place); after it is run, the bare `https://dev.saoc.co.za` works and persists
across reboots. Reverse with `--uninstall`.

Start the server with `pnpm dev:secure` (NOT `pnpm dev`, which is HTTP on :3002 and will
fail in Chrome — Chrome auto-upgrades .co.za to https and an HTTP server returns
ERR_SSL_PROTOCOL_ERROR).

**Never drive a PayFast test from the local server.** `SITE_URL` is unset locally and falls
back to `https://saoc.co.za`, the old Joomla site, so the ITN would be delivered there and
the ticket would sit `reserved` forever. Use the deployed host for payment testing.

- [ ] **[P1, SECURITY, NEW 2026-08-14 — SEVERITY CORRECTED same day] Open self-signup, an ungated
  session route, and an ungated `/admin/door`. Admin DATA was never reachable.**
  **The original P0 entry claimed a self-registered account could reach the buyer list, CSV
  export and door scanner, and called it a POPIA notifiable-breach shape. That was an inference
  from a successful `accounts:signUp`, never tested end to end. Re-tested against the deployed
  host on 2026-08-14 and it is WRONG.** Measured, with a freshly self-registered account:
  `POST /api/admin/session` → **200, session cookie issued** (real defect, no claim check);
  `/api/admin/tickets` → 403; `/api/admin/export-csv` → 403; `/admin` → 307 to `/admin/login`;
  `/admin/door` → **200, scanner UI renders** (client component, no server gate, no middleware —
  UI exposure only, since check-in POSTs are 403). Five of six surfaces already check
  `decodedToken.admin === true || role === 'admin'` (`app/admin/page.tsx:24`,
  `app/api/admin/tickets/route.ts:25`, `checkin/route.ts:27`, `export-csv/route.ts:32`).
  Both probe accounts deleted and verified gone; project now has 0 accounts.
  GENUINE WORK: (a) `/api/admin/session` must refuse to mint a session for a non-allowlisted
  identity; (b) `/admin/door` needs a server-side gate; (c) no allowlist governs who may hold
  the `admin` claim — grant/revoke is undefined; (d) close open self-signup as defence in depth.
  ALSO: **the project has ZERO auth accounts and ZERO admin claims**, so `/admin` is currently
  inaccessible to everyone including Brad — that, not a breach, is why the door scanner has been
  untestable in every environment. Provisioning is the unblocker.
  ALSO: `contracts/contract-d5-admin-dashboard.yaml` assertion D5-04 is a false-green shape —
  it greps for `admin` plus `claim|role|verifySessionCookie` in the same file, which cannot
  distinguish a real authorisation check from an incidental mention. Replace with a live check.
  Lesson recorded: a successful first step is not proof of the last step.

- [ ] **[P2, NEW 2026-08-14] Empty-allowlist scenario is reasoned about, not proven live.** QA's adversarial
  pass on F1 confirmed every other fail-closed state with real HTTP, but did NOT restart the harness
  server with an empty/unset/whitespace-only/trailing-comma `ADMIN_EMAIL_ALLOWLIST` — that needed a
  server restart outside its remit. `parseAllowlist()` is a deterministic trimmed/lowercased split
  over `[].includes()`, so residual risk is low, but this is EXACTLY the secret-corruption defect
  class: an empty allowlist fails closed for everyone and is indistinguishable from a working gate
  from outside. The `[admin-auth] ADMIN_EMAIL_ALLOWLIST parsed length: 0` log line is the only
  external signal. Add a real assertion that boots the server with each malformed value and proves
  (a) everyone is refused and (b) the length-0 log line appears. Fold into F3 if F3 touches this path.

- [ ] **[P1, NEW 2026-08-14] Ticket delivery does not exist — buyers receive nothing.**
  `lib/email.ts` contains no ticket/booking logic and is never called from
  `app/api/tickets/checkout/route.ts` or `app/api/tickets/itn/route.ts`. Nothing generates a
  QR code, yet `app/admin/door/page.tsx` scans QR codes (html5-qrcode) — so the scanner has
  nothing to scan and every attendee would be checked in by typing a 12-character reference
  by hand at the gate. Buyer currently gets a booking reference rendered on a web page and no
  email at all. Needed before ticket sales open, independent of gateway choice.
  Note: no Resend account exists yet, so delivery also needs an email provider decision.

- [ ] **[P1, NEW 2026-08-14] Refunds cannot be represented in the data model.**
  'refund' appears nowhere in app/, lib/ or types/. `TicketStatus` (types/index.ts:128) is
  'reserved' | 'paid' | 'cancelled' | 'checked-in' — no 'refunded'. A refund today means
  refunding in the PayFast dashboard and hand-editing Firestore, with nothing linking the two
  and no way to distinguish a refunded ticket from one cancelled before payment. PayFast DOES
  expose a Refunds API (GET/POST /refunds/:pf_payment_id, same MD5+passphrase auth as the ITN),
  so this is buildable — see docs/payment-gateway-research-2026-08.md.

## admin-auth-hardening — M1 done, F4 proven end-to-end, F5 shipped, only F6 remains (2026-08-17)

F1 (authorisation gate), F2 (adversarial refusal proof), F3 (account provisioning) all `done`,
milestone M1 gated (F1/F2 contract 12/12, F3's own contract 11/11). New scripts:
`scripts/admin-grant.ts` (grants `admin:true`, `--existing` flag required to touch a
pre-existing account — see [[learned.md]] "admin-auth-hardening F3"), `admin-revoke.ts`,
`admin-list.ts`. `docs/admin-access.md` extended.

**F4 (Google sign-in) done 2026-08-15**, gate green 6/6, 100% machine-verifiable, zero
`agent_review`. Shipped: `GoogleAuthProvider` + `signInWithPopup` on `/admin/login`,
`app/admin/login/GoogleSignInButton.tsx`, a squatter-shape warning in `admin-grant.ts`,
`docs/admin-access.md` extended with "Google sign-in" + "Claim before allowlist". Design is
**claim-first provisioning**: an email must go through `admin-grant.ts` BEFORE it is added to
`ADMIN_EMAIL_ALLOWLIST`, because Firebase enforces email uniqueness unconditionally once
claimed — this closes the squatting race at the platform level rather than by operator
discipline alone. `lib/admin-auth.ts` and the session route were NOT touched by F4. This
closes the "federated sign-in auto-verifies email" item below (now resolved by the claim-first
design, not a raw guard).

`brad@inunu.net` is now the only admin — Firebase uid `NhSVXoMlT2bl6h4gDoyr5NZ1VW52`,
`admin` claim, `emailVerified: true`, account created by us (so no pre-existing squatter risk
on this address). Local `.env.local` allowlist updated.

**Post-ship hardening, 2026-08-15 (`79ee2f8`, `93c5855`, `22397a1`) — see [[learned.md]] "F4
meets reality".** A green gate did not mean a working product: `/admin/login` shipped with
invisible input fields (inline styles), and `/admin`/`/admin/door` one click behind it had the
identical unstyled defect. `ADMIN_EMAIL_ALLOWLIST` was missing from `apphosting.yaml`/Secret
Manager entirely, so the deployed server refused every identity including valid Google
sign-ins — fixed via Secret Manager, value verified byte-exact. Fixed: login restyled on real
site tokens with site chrome added (`app/admin/login/layout.tsx`); `/admin` dashboard styled
with a real table (`components/admin/TicketsTable.tsx`, `StatusPill.tsx`); `/admin/door` styled
for one-handed show-entrance use, deliberately no marketing chrome (`DoorResultBanner.tsx`);
Google button rebuilt to Google's published branding guidelines (official four-colour G inlined
as SVG, `#747775` stroke, height-matched); autocomplete attributes added for password managers;
client-side auth errors now log real Firebase codes. **F4 is now proven end to end by a human**
— Brad signed in with Google and reached `/admin` with real ticket data, same Firebase uid
throughout (`NhSVXoMlT2bl6h4gDoyr5NZ1VW52`), admin claim intact, no second account — this
closes F6's admin half; the door-scanner half of F6 is still open.

**F5 (Microsoft + Apple sign-in) DONE 2026-08-17** — resumed from the 2026-08-15 PARKED state
(the two open questions logged below were resolved by Brad before this chain ran), shipped
`3ffc36a`. Chain: @architect (unparked contract) -> @dev -> @qa (FAIL) -> @dev (fixes) -> @qa
(PASS) -> contract gate 4/4 -> @docs -> commit. Milestone M2 now gates 2/2. Mission file
`missions/2026-08-14-admin-auth-hardening.md` shows F5 `status: done`, mission `status: paused`
(F6 still open). Shipped: three provider handlers on `/admin/login` collapsed into one
`handleFederatedSignIn()`, all funnelling through the existing `mintSession()` ->
`POST /api/admin/session` call; new Microsoft/Apple button components; Apple requests the
`email` scope explicitly; Apple's SVG mark replaced (the original path's geometry ran outside
its declared `viewBox`, rendering as a malformed blob — caught only by the real-browser check,
see `learned.md`). Also fixed a pre-existing documentation defect: `docs/admin-access.md` told
operators they could recover a refused sign-in's email from a `getAdminSession()` server log
that did not exist; `classifyRefusal()` now actually logs (reason + attempted email,
server-side only) so the claim is true. **F6 (door scanner/admin proven working end to end, by
a human) is now the ONLY feature remaining on this mission**, `status: pending`, milestone M3 —
inherently a human task, not dispatchable to an agent chain.

- [ ] **[P1, residual risk, NEW 2026-08-17] F5's new debug-log claim is not mechanically
  enforced.** `app/api/admin/session/route.ts:29` calls `classifyRefusal()` purely for its
  logging side effect and discards the return value — nothing asserts the call site still exists
  or that the log actually fires on a refusal. A future refactor could silently delete it without
  any check catching the loss, reintroducing the exact "documented but non-functional debugging
  path" defect this feature just fixed. See `learned.md` "F5 admin-auth-hardening — Residual
  Risks" for the recommended fix (a contract assertion that exercises a real refusal round trip
  and validates the log line, not a grep for the function name).
- [ ] **[P2, residual risk, NEW 2026-08-17] `A-STRUCT-01`'s Apple `addScope('email')` check is
  grep/line-window based and provably defeatable** — @qa showed it still passes against a
  commented-out call and against an `addScope` on a dead branch. Not a blocker (the real code
  path is correct and manually console-verified), but if Apple sign-in ever stops receiving
  emails from real users, treat this check itself as a suspect before anything else. See
  `learned.md` for full detail; a real fix needs AST parsing, not a bigger grep.
- [ ] **[P0, human, required for F5 to function in any deployed environment] Enable Microsoft
  and Apple sign-in providers.** Mirrors the still-open Google item below, done separately per
  provider: Microsoft needs an Azure/Entra app registration (tenant, client id, secret) enabled
  in Firebase Auth; Apple needs the Services ID + signing key (Brad confirmed he holds a paid
  Apple Developer Program membership) configured in Firebase Auth. A green gate proves the code
  path, not that either provider is actually turned on for `saoc-webapp`.

- [ ] **[P0, human, required for F4 to function] Enable Google sign-in in Firebase Auth.**
  A green gate does NOT prove this was done — go to
  `https://console.firebase.google.com/project/saoc-webapp/authentication/providers`, enable
  Google, set a support email.
- [ ] **[P0, human] Add `brad@inunu.net` to the DEPLOYED `ADMIN_EMAIL_ALLOWLIST`** in Secret
  Manager — only `.env.local` (local) has been updated. The two `saoc.co.za` entries in
  `.env.local` are contract fixtures and must NOT go into Secret Manager.
- [ ] **[P1, human action, highest value] Disable self-signup on `saoc-webapp`.** Verified still
  live 2026-08-15 (`accounts:signUp` returns `WEAK_PASSWORD`, not
  `auth/admin-restricted-operation`). This is the actual fix for the account pre-hijacking risk
  `--existing` only guards against —
  `console.cloud.google.com/customer-identity/settings?project=saoc-webapp` → "Disable user
  actions". **Closing this requires the irreversible Identity Platform upgrade (no downgrade
  path per Google support) — deliberately deferred, do not enable Identity Platform without a
  explicit go-ahead.** Confirm via `auth/admin-restricted-operation` on a subsequent
  `accounts:signUp` probe once done.
- [x] ~~**[P2, design input for F4/F5] Federated sign-in auto-verifies email.**~~ **RESOLVED by
  F4's claim-first design (see above)** — the squatting race is closed by Firebase's
  unconditional email-uniqueness enforcement, not by the `--existing` guard alone. @qa traced
  the residual gap (a verified password-only account pre-existing at an address) and confirmed
  it is NOT exploitable: verifying a Firebase email requires mailbox access, and there is no
  in-app signup/verification UI, so anyone in that state already owns the address.
- [ ] **[P2] `/admin/login` should handle `auth/admin-restricted-operation` gracefully** once
  self-signup is disabled above — today the UI has no path for that error code.
- [ ] **[P2] A-GRANT-03's stdout-grep assertion doesn't prove anything** (see
  [[learned.md]] item 4) — rewrite to observe the Admin SDK call rather than grep stdout for
  "reset link".
- [ ] **[P3, untested] Concurrent grant/revoke race on the same identity** — low likelihood for a
  manual single-operator CLI, not exercised this session.
- [ ] **[P3, style] `app/admin/login/page.tsx` uses inline styles throughout**, against
  `.claude/rules/coding.md` (wants tokens/utility classes). Pre-dates F4; deliberately not fixed
  inside an auth change — own task, own review.
- [ ] **[P3] No tooling here can drive a real Google OAuth consent flow** — the sign-in button is
  structurally verified but never exercised end to end. Belongs to F6's human proof.
- [ ] **[P1, audit] Audit remaining contracts for the weak-assertion defect class** (see
  [[learned.md]] "Weak-assertion defect class — 4th confirmed instance"), starting with the
  already-recorded D5-04 false-green in `contract-d5-admin-dashboard.yaml`.

- [x] ~~**[P2, NEW 2026-08-14, F5 scope — PARKED, see above] Additional sign-in providers.**~~
  **DONE 2026-08-17 — see "admin-auth-hardening" section above.** Brad wants Google (done, F4),
  Microsoft and Apple (done, F5). Code is shipped for all three; enabling each provider in the
  Firebase console for the deployed environment is a separate open human task, tracked above.

- [ ] **[P2, accessibility, NEW 2026-08-15] `ContactForm` and `TicketPurchaseForm` render error
  text as `text-accent`** — 2.94:1 contrast on ivory, fails WCAG AA. Public-facing, affects
  visitors, not just admins. Found while restyling the admin pages, which now use a bordered
  callout at 13.6:1 instead — apply the same pattern to the two public forms.
- [ ] **[P3, NEW 2026-08-15] OAuth consent screen shows `saoc-webapp.firebaseapp.com`** instead
  of the Council's name during Google sign-in. Needs a custom `authDomain` configured in
  Firebase Auth settings.
- [ ] **[P1, cleanup, NEW 2026-08-15] A 53 MB zip is in git history from commit `5b67fdf`**
  (`branding/National Show 2027/Old NOS 2027 Assets.zip`) — `branding/` is Brad's own active
  workstream (see the standing rule above: leave it alone) and a binary that size does not
  belong in git regardless. Repo is now 171 MB. Removal needs a history rewrite + force-push, so
  it needs Brad's explicit permission and a quiet moment when nobody else is pushing.
- [ ] **[P2, NEW 2026-08-15] No test admin credentials exist for automated visual QA** — `/admin`
  and `/admin/door` are behind the Firebase Auth gate, so a browser agent cannot sign in and
  verify them; only a human (Brad) can currently see these pages render. Worth solving —
  candidates: a dedicated test admin account with narrowly scoped, rotatable credentials, or a
  gate-bypass token for CI/QA use only, never for production traffic.
- [ ] **[P2, harness, NEW 2026-08-15] Contract checks cannot detect missing DEPLOYED
  configuration** — this project's contract gate runs against a local server reading
  `.env.local`, so it structurally cannot catch a secret/env var that's declared locally but
  missing from `apphosting.yaml`/Secret Manager (see the F4 `ADMIN_EMAIL_ALLOWLIST` incident
  above). Consider a post-deploy smoke-assertion step that probes the live URL for the specific
  failure mode (e.g. a known-good credential should reach 200, not 401/403) rather than relying
  on local-only checks for anything that depends on deployed secrets.
- [ ] **[P4, informational, NEW 2026-08-15] Google Sans is not loaded** — the Google sign-in
  button uses the site's own sans stack instead of Google's specified typeface, a known and
  accepted deviation from the letter of Google's branding spec. Not worth loading a webfont for
  one button; no action expected unless this becomes a wider pattern.
- [ ] **[P1, NEW 2026-08-15] Door scanner (F6's second half) still unproven at a real entrance.**
  F4 proved the admin dashboard end to end with a human login; the door check-in scanner has not
  had the same human proof yet. Milestone M3 remains `pending` until this happens.

## Ticket status stuck at `reserved` — found 2026-08-15 during F6 door testing

All four tickets in the live Firestore `tickets` collection show status **`reserved`**, none
`paid`, and `purchasedAt` is empty (`—`) on every row. Confirmed visually on the styled
`/admin` dashboard.

**Why it matters:** the door scanner correctly refuses a `reserved` ticket with "This ticket
has not been paid for" — verified on a real Samsung S23 FE with booking ref
`SAOC-2027-5H63FBAE8AHP`. So the check-in gate works, but **no ticket can ever be admitted
until something sets status to `paid`.** At a real door, every attendee would be refused.

**Suspected cause:** the PayFast ITN webhook (`app/api/tickets/itn/route.ts`, sha256-pinned)
is not flipping `reserved` → `paid`. Either it never fires in sandbox, fails verification
silently, or was never exercised. Brad's understanding was that these tickets ARE paid, which
suggests payments completed on PayFast's side while our record never updated — the worst shape
of failure, because it is invisible until the door.

**Next steps:** trace one sandbox payment end to end; confirm whether the ITN endpoint is
reachable from PayFast and whether it writes. Relates to the `sandbox-ticket-proof` mission.
Do NOT modify `app/api/tickets/itn/route.ts` without checking its sha256 pin first.

**Blocks:** a successful door check-in cannot be demonstrated (F6) until at least one ticket
reaches `paid`.

## Session 2026-08-17 — Three contracts shipped (fixture-leak fix, door-test-qr, timeout-enforcement)

### New backlog items (all pre-existing ceiling limits, not new defects)

- [ ] **[P1, cleanup, NEW 2026-08-17] Fixture residue — 15 @harden-check.invalid docs in live Firestore tickets collection** — Added during prior diagnostics and test runs; blocking A5 and A34 environmental requirements in both `contract-payfast-m1-lock-cleanup-fix.yaml` and `contract-door-test-qr-seeder.yaml`. Deletion is Brad's call. Once deleted, both A5 and A34 will pass (green-checked). See `docs/fixture-leak-hardening.md` "Known Limitations" and `docs/door-test-qr-seeder.md` "A5 — Environmental RED".

- [ ] **[P1, harness, NEW 2026-08-17] PR contract.py timeout enforcement to InunuNet/Athanor BEFORE next make update-template** — CRITICAL. `execution/contract.py` fix for dropped `timeout_seconds` copy is shipped locally (commit `contract-check-timeout-enforcement.yaml` 8/8 green), but it MUST be PR'd upstream or the next `make update-template` will silently revert it and reopen the fixture-leak vulnerability with no warning. Details: `docs/contract-timeout-enforcement-harness.md`. Coordinates: InunuNet/Athanor → execution/contract.py → 4 edits (26 ins / 5 del).

- [ ] **[P2, harness validation, NEW 2026-08-17] contract.py timeout validation has three unguarded ceilings** — All pre-existing, not introduced by the fix. (1) `validate_cmd()` is never called from `check_cmd()`/`gate_cmd()`, so rejected timeout values still reach the runner (`true` → timeout=1, string → raw TypeError). (2) No upper bound — `timeout_seconds: 999999999999` would parse and cause unhandled OverflowError. (3) The `is not None` edit is structurally correct but not covered by any assertion. Documented as "Known Limitations" in `docs/contract-timeout-enforcement-harness.md` — do not claim complete validation unless these are fixed. Harness-level issue; file upstream if needed.

- [ ] **[P3, harness detection, NEW 2026-08-17] Lock-timeout invariant walk skips bare/aliased specifiers to _shared.mjs** — The import-graph walk added to defeat barrel imports has an acceptable but documented boundary: bare or aliased specifiers that secretly resolve to `_shared.mjs` are skipped as external (ESM-only codebase, `require()` unmatched). This is a design choice, not a defect, but future refactoring that moves `_shared.mjs` or changes its import pattern should revisit this assumption. Documented in `docs/fixture-leak-hardening.md` "Secondary Hardening: Lock-Timeout Invariant" under "Remaining ceiling".

- [ ] **[P1, UI, observed on a real device] `/admin/door` "Check In" button is clipped off the
  bottom of the viewport on mobile.** Observed 2026-08-17 on Android Chrome at
  `beta.saoc.co.za/admin/door` (screenshot from Brad): the camera viewport + manual-entry field
  push the primary action below the fold, leaving only the top ~8px of the button visible above
  the system nav bar. The button is reachable by scrolling, but the door scanner is a
  one-handed, at-speed surface at a show entrance — the primary action must be visible without
  scrolling. Likely fixes: constrain the camera viewport height (e.g. `max-height` in `dvh`, not
  `vh` — mobile browser chrome makes `vh` wrong), and/or pin the manual-entry row to the bottom.
  Must be verified on a REAL device at 320/375px, not just a desktop resize — this is exactly
  the class of defect the "visual work is not done until a browser has seen it" rule exists for.
  Note `dvh`/`svh` handle the collapsing-URL-bar case that `vh` does not.

- [ ] **[P1] Door check-in refusals are never logged server-side.**
  `app/api/admin/checkin/route.ts` logs only on a malformed body (`console.error`) or an
  unhandled exception. Every admission verdict — `not-found`, `unpaid`, `wrong-show`,
  `already-checked-in`, and successful admits — returns to the client and leaves no server
  record. At a show entrance this makes "the scanner didn't work for someone at 10am"
  unfalsifiable. Observed live 2026-08-17: Brad scanned four codes at `beta.saoc.co.za`, all
  returned `Ticket not found`, and there was no server-side evidence of any of it. Want:
  structured log per attempt (bookingRef, verdict, httpStatus, timestamp) per
  `.claude/rules/coding.md` logging standards — and consider a Firestore audit collection, not
  just stdout, since door staff run on phones and nobody reads Cloud Logging at a gate.

- [ ] **[P2, process trap] Running the door-test-qr-seeder gate DESTROYS live human test
  fixtures.** A4 (`check-teardown-scoped.mjs`) deletes the three seeded `DOOR-QR-*` docs to prove
  teardown is exactly scoped, and never re-seeds. On 2026-08-17 the orchestrator ran the full
  gate ~10 min before Brad scanned; every code correctly returned `not-found` because the tickets
  were genuinely gone, costing a live testing session and reading as a scanner failure. Fix:
  A4 should re-seed after asserting teardown, or the gate should print a loud "fixtures torn
  down — run `pnpm door:seed` before human testing" notice. Same class as the fixture-leak
  lesson: a check's side effects on shared live state are part of its contract.

- [ ] **[P2, doc drift, NEW 2026-08-17] `docs/firestore-ticket-schema.md` is stale on `TicketType`.**
  It still documents the retired hardcoded union (`'general' | 'member' | 'vip'`) and a 6-digit
  `bookingRef` example. `types/index.ts` moved `TicketType` to a free-form `string` (ticket
  categories now live as `ticketType` Sanity documents, keyed by slug) and `lib/booking-ref.ts`
  moved to 60-bit Crockford base32 references, both already covered correctly in
  `docs/ticketing.md` and `docs/ticketing-hardening.md`. Flagged while writing
  `docs/ticketing-system-foundation-spec.md` — fix the doc in place (not in scope of that spec).

- [P3] `refunded` TicketStatus has no `StatusPill` style — renders its literal text through the
  neutral fallback, visually indistinguishable from an unrecognised status and from nothing in
  particular. Found by @qa during F2 (2026-08-17), non-blocking. Natural home is F8 (comp/refund
  route) or a dashboard-polish pass. `components/admin/StatusPill.tsx` `STATUS_STYLES`.
- [P2] `createOrderWithPosition()` in `lib/orders.ts` uses idempotent `transaction.set()`, not
  `.create()` — a colliding `bookingRef` silently overwrites instead of failing. Inert today (no
  live caller; ~60 bits of CSPRNG entropy per ref) but F8/F10 must confirm collision-detection is
  not load-bearing in their flows before reusing this primitive.
- [P2] `amount`/`purchasedAt`/`m_payment_id`/`pf_payment_id` are duplicated on both `Order` and
  `Ticket` after F2, deliberately. F10 must remove the position copies together with a backfill
  when checkout/ITN stop writing them. Until then nothing detects divergence between the copies.

## Ticketing foundation — F3 done: admin roles/capabilities (2026-08-17)

F3 shipped — `lib/admin-roles.ts`, contract `contracts/contract-ticketing-f3-admin-roles.yaml`
(8/8, zero `agent_review`), docs in `docs/ticketing.md` + `docs/admin-access.md`. See
`learned.md` "Ticketing foundation — F3 done" for the golden-doc self-contradiction, the
authorship-vs-behaviour assertion lesson, and the temp-file-deletion incident.

- [P3] A3's own description says it catches a "dead capability" (one no role grants), but in
  @qa's mutation test it actually fired via its `CAPABILITIES.size !== 7` branch. Cosmetic
  wording mismatch — the check itself is correct, just mis-described.
- [P3] The golden README claims `fixtures/capability-typecheck.ts` is the *only* independent
  check against a whole-set capability rename. That's now stale — @qa proved the source-level
  check (`check-manager-hand-listed-source.mjs`) also catches it, since it carries its own
  hard-coded capability array. Update the README's claim so it doesn't overstate the fixture's
  uniqueness.
- [P2] `resolve()` returning an array instead of a `Set` is caught by A1 (type error), but a
  `const result: any = []` bypass slips A1 and is only caught by A7 (lint's `no-explicit-any`).
  Two-layer catch — keep A7 in the gate; don't drop it as cosmetic.
- [P2, carry forward to F13, not F4] Admin self-signup is still open at the Identity Toolkit
  level (`client.permissions` empty, verified live 2026-08-17). It does not grant admin —
  `admin: true` is only ever set by `scripts/admin-grant.ts`, which already refuses
  pre-existing accounts without `--existing` and warns on the squatter shape. Residual risk:
  email pre-registration ahead of Lee-Ann's onboarding in F13.

- **P1 — checkout never creates an `orders` document.** `app/api/tickets/checkout/route.ts`
  writes only to `TICKETS_COLLECTION` (`transaction.create(tickets.doc(bookingRef), …)`,
  line 247); it contains no reference to `createOrderWithPosition`, `ORDERS_COLLECTION`,
  `'orders'` or `orderId`. Verified directly 2026-08-17. Consequences: F10's
  `markOrderAndPositionPaidByPaymentId()` always resolves `order-not-found` for a real
  purchase, so a real ITN never commits paid state; F11's confirmation email never fires;
  every real order's `recoveryToken` stays null, so F6 recovery and F14 cannot work. The
  spec claims checkout is order-aware (§ around lines 177/251) — the code does not match.
  Contract in progress: `contracts/contract-ticketing-checkout-orders.yaml`.

- **P3 — `components/tickets/TicketPurchaseForm.tsx` is 155 lines, over the project's own
  150-line component limit.** Fails `ticketing-m1-m2` A35. Pre-existing since 2026-08-12,
  untouched by the ticketing-foundation work. Needs a sub-component extraction, and because
  it changes rendering it needs BrowserAgent verification at 1440/375/320px before it can be
  called done — not a blind refactor.

- [ ] F11 hardening (QA finding, 2026-08-17): `check-qr-roundtrip.mjs` (A3) negative control relies on the `qrcode` library's own empty-string rejection. Dropping only the `.trim()` from `lib/qr.ts`'s guard lets a whitespace-only bookingRef encode silently and A3 still passes. Add an explicit whitespace-only case to the A3 negative control. Not a live defect — guard is present and correct in shipped code.



- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-17-agent-tier-split.md

- [ ] SAOC (Misc): New Event: scheduled_resume-20260817234735.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260817235248.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818000320.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818000836.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818001851.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818002403.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818003547.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818004059.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818004233.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818004745.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818004915.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818005441.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818005516.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818010028.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818010126.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818010639.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818010827.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818011349.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818011520.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818012030.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818012054.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818012605.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818012632.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818013142.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818013205.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818013715.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818013739.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818014249.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818014314.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818014824.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818014850.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818015359.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818015419.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818015928.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818015951.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818020459.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818020518.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818021026.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818021045.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818021553.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818021613.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818022121.txt

- [ ] SAOC (Misc): [scheduled-resume] Reached 2026-08-18 02:22:00 — handing off to pulse_mission_loop.sh (one shot).

- [ ] SAOC (Misc): New Event: check_own_comms-20260818023639.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818024648.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818025155.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818025341.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818030633.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818032509.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818033046.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818034920.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818040334.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818042210.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818042747.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818044613.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818045150.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818051024.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818051601.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818053430.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818054007.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818055839.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818060416.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818062248.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818062825.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818063702.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818064210.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818064324.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818064832.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818065001.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818065513.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818065623.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818070132.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818070358.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818070921.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818071934.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818072446.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818073458.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818074011.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818075035.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818075546.txt

- **P3 — no request body-size cap on any App Router API route.** All app/api/ routes call
  request.json() uncapped (App Router has no default body-parser limit). Found by @qa during
  vendor F5; pre-existing and project-wide, not F5-specific. Needs one shared guard.

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818080012.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818080522.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818080647.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818081157.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818081346.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818081856.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818082022.txt

- **P2 — fleet_loop.sh commits feature work under "chore: comms reply + fleet-loop session
  wrap" labels.** Twice now (F3's page, F6's entire implementation, commits 7a01367/8db73e1).
  History is truthful in content but lying in labels, and it races the orchestrator's own
  staging. Gated off (chmod -x) 2026-08-18; needs a contract before re-enabling: label
  accuracy + never staging files outside .agent/memory/.

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818082533.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818082533.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818083043.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818083042.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818083551.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818083551.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818084059.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818084100.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818084608.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818084608.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818085116.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818085116.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818085626.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818085626.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818090135.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818090134.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818090643.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818090643.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260818091153.txt

- [ ] SAOC (Misc): New Event: scheduled_resume-20260818091156.txt

- [P2] F8 check A4 blind to both bare-JSX interpolation of undefined (renders blank) AND template-literal coercion of null (renders "null" — this exact regression shipped in bcbbc03, fixed in cd0308d). Architect: widen A4 to grep "null" as well as "undefined", plus a bare-`{boothNumber}`-as-JSX-child guard. (2026-08-18)
