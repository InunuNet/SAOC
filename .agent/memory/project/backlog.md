# SAOC Backlog

Organised by **priority and subject**, not by session. Rebuilt 2026-08-19 from a 2,677-line
session diary (pre-cleanup copy: `archive/backlog-2026-08-19-pre-cleanup.md`).

**Rules for this file.** One line of stale information here misleads every agent, every session.
Completed items are deleted, not ticked — git history is the record. Plan steps live in
`Plans/` and mission files, not here. `[verify]` marks an item whose status is genuinely unknown.

**Governing context.** The ticketing system is being rebuilt to the council's brief
(`Ticketing system overview - with details.docx`, Drive `1fegrT9UKObJ71tUjUme_kFtqieSOsYca`).
The approved plan is `Plans/valiant-squishing-thimble.md`. It supersedes older project
assumptions about ticketing: single-line checkout, terminal once-per-lifetime check-in, the
`attendeeName`/`attendeeEmail` pair, and single-ticket-type assumptions are all being replaced.
Do not scope work from an entry that contradicts it.

---

## Standing rules

- **Leave `branding/`, `design spec/`, `design/Claude Design HTML/` alone** (Brad, 2026-08-12).
  He is reorganising them by hand. Do not read, move, edit or "tidy" anything inside them.
- **`design/design_handoff_saoc/src/data.js:444` and `src/pages-show-events-contact.jsx:24`
  still carry the stale 18–21 September show dates** (found during `show-dates-purge-16-19-sept-2027`,
  2026-08-22) — deliberately left untouched, same reason as above (Brad's active design-prototype
  workstream, not this project's own missions to edit). Flag for him to sync once he's done with
  that workstream; not an action item for any SAOC mission.
- **No invented brand assets** — colours, logos, type, semantic feedback colours. Ask Brad.
- **Scope = SAOC only.** Not WOSA (separate developer), not Athanor R&D. Dogfood the harness and
  file every harness bug upstream at `InunuNet/Athanor` rather than working around it silently.
- **Never drive a PayFast test from the local server.** `SITE_URL` is unset locally and falls back
  to `https://saoc.co.za` (the old Joomla site), so the ITN is delivered there and the ticket sits
  `reserved` forever. Use the deployed host for payment testing.
- **Local dev:** `pnpm dev:secure`, not `pnpm dev`. Chrome auto-upgrades `.co.za` to HTTPS.

---

## Next up (queued, not yet a mission — dispatch as soon as current mission closes)

(none currently queued)

---

- [ ] **[P3] Leftover "previous venue's values" comment at `scripts/seed-show-visitor-info.ts`
  ~line 105 (in `patchNationalShow()`), plus the still-open `nationalShowVenuePatch.venue.
  directionsNote` field** — flagged by @qa during `venue-never-changed-copy-fix` (2026-08-24) as
  real but out of that mission's scope. Not the same line as the protected line-163 comment
  (that one is deliberately preserved as historical record under `contract-venue-prose-residue.yaml`
  A10 — dev-only, never rendered). Route to whoever owns `venue-prose-residue` follow-up work;
  not urgent.

---

## Blocked on the council / Lee-Ann

- [ ] **[P1] Ticket prices and capacities — estimate now, correct later (Brad's standing
  instruction, already the pattern used for the ticketing admission products in
  `lib/provisional-figures.ts`/F4).** Do not leave figures blank waiting on the council; put in
  our best estimate, flagged provisional, same discipline as F4. Conference tickets (SAOC
  Symposium/WOSA/joint, 6 entries) fully shipped as of 2026-08-21 — data model (F1), purchase
  pages (F3), nav (F4), and checkout (F5) all done; `ticketing-conferences-and-events` (Mission
  Two) is now complete end to end. Workshops/Field Trips/Cocktails category likewise fully
  shipped as of 2026-08-21 (F2 estimation, F5 checkout closes the pooled-capacity fix F2
  deferred) — 4 real priceable products (Sunset Cocktails single/couple, Field Trip
  single/all-outings) now enforce their REAL physical ceilings (200/200/60/60) via
  `planPooledCapacity()`'s pool-key/headcount-weighted math, not the F2 interim's conservative
  resized constants (100/50/30/30). A non-sellable `WORKSHOP_PRICING_STRUCTURE` placeholder
  remains since individual workshop sessions genuinely cannot be priced without a
  council-confirmed session list — do not invent specific workshops. Still outstanding: vendor
  fees (exhibit/food), venue/workshop capacity figures generally, and the real workshop session
  list itself. Her form answers (pricing artifact) are still empty as of 2026-08-21 — do not
  wait for them to start estimating the remaining categories.
- [ ] **[P1] Refund and cancellation terms — draft real content ourselves for her to review/adjust
  (Brad's direction, 2026-08-21), do not wait for her answer first.** `/refunds` exists
  (`app/(marketing)/refunds/page.tsx`, 109 lines) but is deliberately figure-free — no cancellation
  windows, refund conditions, or cooling-off period. Draft reasonable estimated terms, flag them
  clearly as pending her confirmation. When real/adjusted figures land, POLICY-10 (the digit+unit
  ban) must be revisited — it currently bans the very figures being added.
- [ ] **[P1] POPIA Information Officer — placeholder decision made 2026-08-21, needs implementing
  and formal confirmation.** Brad's call: name **Lee-Ann McCleland** (Fynbos Pottery Studio) as
  Information Officer on `/privacy` for now — she can correct it later if the council wants someone
  else. Not yet applied to `app/(marketing)/privacy/page.tsx` (still names `secretary@saoc.co.za`
  by project convention). Still outstanding regardless of who: under POPIA the officer must be
  formally registered with the Information Regulator; naming her on the page is not that
  registration, just interim contact-page accuracy. Confirm her contact details (email/role) before
  publishing — the screenshot this decision came from only confirms the name, not an email address.
- [ ] **[P1] All three policy pages carry an "AI-generated draft, not legal advice" notice** and
  need professional legal review before the council relies on them.
- [ ] **[P1, commercial — Brad's call] Spec V3 scopes TWO websites**, not one: a permanent SAOC
  org site (6 pages) and a dedicated 2027 Show site (18 pages). V3 §6 also marks as "Confirmed by
  INUNU" several items never priced in the accepted 28-May proposal — unified multi-category
  checkout, filterable exhibitor/guest databases, the relational awards archive, the Members
  Portal. **Do not restructure routes; this needs a scope+price conversation first.**
- [ ] **[P1] Spec V3 §8 is a 13-question list for INUNU** (CMS, filtering, bookings,
  notifications, archiving). Several already have answers in our codebase. Worth a written reply.
- [ ] **[P1] Stellenbosch visitor travel content.** Every CTICC-anchored travel section was
  *cleared* rather than rewritten (correct — inventing airfield transport detail is the banned
  failure mode). `airportRoutes`/`accommodation`/`attractions` are empty; `publicTransport`,
  `parking`, `accessibility` and two intros are neutralised to "not confirmed". Owed: real
  Stellenbosch-area content. There is no scheduled public transport to the airfield, so arrival
  is drive/e-hail only, which changes the shape of the advice. Pre-change values backed up at
  `.agent/memory/scratch/venue-change-2026-08-12/before.json`.
- [ ] **[P2] Vendor Terms & Conditions document does not exist.**
  `VendorPaymentFieldset.tsx:49` makes vendors agree to a document with no page, route or text
  behind it — an agreement checkbox binding to nothing. Content is Lee-Ann's to write; do not
  draft placeholder legal text. Once supplied, the page + linked label is ordinary work.
- [ ] **[P2] National Show brand model.** Brad's unconfirmed hypothesis: a stable master brand
  across editions plus a rotating per-edition host sub-brand, instead of a full redesign each
  cycle. If the committee agrees, `branding/national-show-2027/` may need restructuring into a
  stable parent with per-edition subfolders. **Do not restructure anything now.**
- [ ] **[P2] Secure organisation-owned document custody.** Institutional records sit in
  individuals' Drives, thumb drives and personal email. Critical sub-point: accounts must be
  registered to SAOC as an organisation, not to whoever created them — especially the payment
  merchant account, the domain, and any Google/Microsoft tenant. Section E of the call-prep doc.
- [ ] **[P2] Real Show copy has arrived and is not yet loaded.** `About - 2027 National Show.docx`,
  `What to Expect.docx`, `South African Exhibitors.docx` — first client-approved copy, replaces
  our labelled placeholders. Confirms the theme: "From Wild Origins to Cultivated Excellence."
- [ ] **[P2, security] Spec V3 circulates SAOC mailbox passwords in plaintext** in a shared Drive
  doc. Values are already stale (the VPS migration replaced all five). Tell Lee-Ann the doc should
  not carry credentials at all.
- [ ] **[P3] `show@saoc.co.za` has been unused since 2020**; Lee-Ann suggests archiving. V3 also
  asks for per-area show addresses (symposium, WOSA, bookings) so committee members get their own
  area's registration notifications.
- [ ] **[P3] Hero lede copy authority unresolved.** The design reference and
  `components/home/Hero.tsx:84-86` differ. May be an intentional later revision, not drift — do
  not change without confirming which is authoritative.

---

## Blocked on Brad (human action, not dispatchable)

- [ ] **[P1] Ozow — mission `ozow-payment-provider` DONE (F1-F4, all gated, M4 gate passed
  2026-08-23); one external item remains for Brad.** Ozow is now a fully working second
  `PaymentProvider` alongside PayFast — adapter, checkout wiring/provider registry, and a real
  `confirmNotification()` fix (F4: `GetTransactionByReference` needs an explicit `IsTest=true`
  query param for sandbox transactions, which the code never sent — see `learned.md` "Ozow F4").
  The originally-logged "unprovisioned merchant account" blocker was WRONG (see `learned.md`) —
  real causes were a SiteCode misconfiguration (fixed) and this F4 bug (fixed). **Still open,
  external and genuinely Brad's to resolve:** a real Ozow-side R0.01 transaction cap on the
  sandbox account — support ticket needed with Ozow to raise/remove it before a full-value live
  purchase can be proven end to end (Ozow support email still unsent). PayFast's own live-purchase
  path remains regression-proved unaffected. **Demo-readiness gap now closed** — mission
  `ozow-sandbox-toggle` (F1, gated 2026-08-24, 12/12 PASS) shipped an admin-toggleable
  `ozowSandboxTestMode` flag (`/admin/settings`) that forces only the amount sent to Ozow's
  `initiate()` to R0.01 while leaving cart/display/order/PayFast untouched, with a visible TEST
  MODE banner; this replaces the manual, revert-dependent live-Sanity-price-edit workaround as
  the documented demo method (`docs/payment-seam.md`). The R0.01 sandbox cap above is a separate,
  still-open, vendor-side issue — do not conflate the two. See
  [`contracts/golden/ozow-m1-f3/README-addendum-blocked.md`](../contracts/golden/ozow-m1-f3/README-addendum-blocked.md)
  and `contracts/golden/ozow-m1-f4/README.md` for the full investigation. Outstanding follow-ups
  from `docs/payment-gateway-research-2026-08.md` §10 still apply once live: PayFast Clause 9.8
  fund-hold commitment in writing before sales open; PCI-DSS/ISO 27001 certificates verified via
  IAF CertSearch; POPIA operator agreement; attorney review of the refund policy; disclosure to
  the council of our conflict of interest (we built the custom system) and the thin-evidence
  spots. Card payments must be explicitly activated on whichever provider's merchant account — not
  always on by default — or international attendees cannot pay at all (confirmed again in the
  pricing artifact's payment note to Lee-Ann).
- [ ] **[P1] Go-live: live payment credentials.** In order: obtain live Merchant ID/Key/Passphrase;
  store in Secret Manager with `printf '%s' | --data-file=-` (**never `echo`** — see the secret
  corruption class); flip `lib/payfast.ts` off the sandbox constants; point `SITE_URL` at the real
  domain (**gated behind DNS cutover** — live ITNs will not land otherwise); re-verify the ITN
  signature path against a live transaction via the documented re-pin ceremony.
  **Do not go live before council-confirmed prices are in.**
- [ ] **[P1] DNS cutover.** Nameservers still point at the old cPanel host. Sequence:
  re-pull mail from the legacy host one final time immediately before cutover (the 2026-07-20
  restore is a snapshot) → switch nameservers → only THEN add any further Resend DNS records.
  Adding them before the switch loses them silently with no code change to blame.
- [ ] **[P1] Run `scripts/install-dev-domain.sh` once from Terminal.app**
  (`cd ~/ai/SAOC && sudo bash scripts/install-dev-domain.sh`) — sudo cannot prompt in an agent
  shell. Until then the working URL is `https://dev.saoc.co.za:3333`.
- [ ] **[P1] A 53 MB zip sits in git history** from commit `5b67fdf`
  (`branding/National Show 2027/Old NOS 2027 Assets.zip`). Repo is 171 MB. Removal needs a history
  rewrite + force-push, so it needs Brad's explicit permission and a quiet moment.
- [ ] **[P1] Live `roles`-claim migration has never been run.** `scripts/admin-migrate-roles.ts`
  is dry-run by default; no account holds a `roles` claim, including `brad@inunu.net`. Running
  `--apply` is human-gated. `app/api/admin/checkin/route.ts`'s capability check stays deliberately
  deferred until it has.
- [ ] **[P1] Firestore test-data cleanup — deletion is Brad's call, not an agent's.** Live
  collections carry test residue: ~15 `@harden-check.invalid` fixture docs in `tickets`, two
  `contactSubmissions` diagnostic records, and the sandbox order/ticket documents from proving
  purchase end to end. Blocks A5/A34 in `contract-payfast-m1-lock-cleanup-fix.yaml` and
  `contract-door-test-qr-seeder.yaml` (both go green once cleared). Note the leak count has gone
  both up and down across sessions (5 → 12 → 17 → 15) — record the number, do not narrate a trend
  from it; measure under controlled conditions before drawing a conclusion.
- [ ] **[P1, security] Rotate `FIREBASE_ADMIN_PRIVATE_KEY`** (leaked into a session transcript via
  a redaction pattern that only matched single-line pairs, missing the multi-line key body)
  **and `SANITY_REVALIDATE_SECRET`** (visible in verification screenshots) before launch.
- [ ] **[P2] Admin "mark paid" route — Brad wants it, wants to discuss before it is built.**
  Use case: a buyer pays by EFT, no ITN arrives, the order sits reserved forever. This is also the
  only sound resolution for a paid-but-ITN-failed order — nothing Firestore records can
  distinguish that from an abandoned cart (see
  `specs/ticketing-capacity-reconciliation-hold/WITHDRAWN.md`), so a human deciding is the answer.
  Questions to settle: who may do it (its own capability, not general admin); what evidence is
  recorded (bank reference, acting uid, timestamp, immutable); does it send the confirmation email
  and QR; does it decrement capacity (it must, or manual sales oversell); can it be reversed.
  **Do not build unattended.**
- [ ] **[P2] Semantic feedback colours do not exist in the brand.** `app/globals.css` has
  primary / accent / parchment / ivory / bone / ink / muted / rule only — no success green, no
  error red, nothing that reads as bright at a door in daylight. Brad's door check-in spec
  requires "bright green" and "bright red", which the current palette cannot satisfy. Either he
  adds two semantic tokens, or he decides explicitly to use primary/accent (muted, arguably fails
  the requirement). Do not invent colours. **Update 2026-08-24:** the door check-in
  success/failure banner shipped anyway (`door-checkin-success-feedback` mission) by reusing
  existing tokens (bg-primary/text-ivory success, bg-bone/border-primary-800/text-primary-800
  failure) rather than waiting — so this no longer *blocks* that feature, but the underlying gap
  (no bright semantic green/red) is still open and Brad's original "bright" requirement is still
  arguably unmet.
- [ ] **[P2] Design template for ticket branding** — needed before the three ticket surfaces can be
  unified (see Ticketing below).
- [ ] **[P2] Design bundle for mission `national-show-design-alignment`** (4 features, validated,
  blocked). Cannot start until the assets arrive.
- [ ] **[P2] Microsoft and Apple sign-in providers are DEFERRED (2026-08-17).** Code shipped in F5;
  neither provider is enabled for `saoc-webapp`. Microsoft needs an Entra app registration (needs
  a directory), Apple needs a Services ID + signing key. A green gate proves the code path, not
  that the provider is on.
- [ ] **[P2] Domain owner contact details.** Apply Lee-Ann's correct registrant details at
  domains.co.za — "Update Pending" may be gating registry changes.
- [ ] **[P3] Manual Sanity dashboard usage check** — manage.sanity.io → Settings → Usage. Confirm
  CDN/API/bandwidth totals and that role display doesn't conflict with Free's 2-role cap. Not
  retrievable via the token API. 5-minute task.
- [ ] **[P3] Decide whether the legacy `public_html_1` / `public_html_2` copies are worth keeping.**

---

## Ticketing — open work (read `Plans/valiant-squishing-thimble.md` first)

**Category structure, per Lee-Ann's spec (Drive `1fegrT9UKObJ71tUjUme_kFtqieSOsYca`):
"Orchid Exhibition" (with Visitor and Exhibitor/Vendor ticket types), Conferences, and
Workshops/Field Trips/Cocktails are three distinct top-level categories, not variants of one
flow.** Status as of 2026-08-21: **Orchid Exhibition — Visitor is SHIPPED** — multi-line-item
cart, the five real admission products (Early-Bird/Day Visitor/Early-Bird Weekend/Weekend/VIP),
day selection, named attendees, checkout, PayFast payment, confirmation — proven with a real
end-to-end purchase against the deployed site 2026-08-21 (both positions correctly `paid`,
`chosenDay` correctly persisted). **Exhibitor/Vendor ticketing, Conferences, and
Workshops/Field Trips/Cocktails are NOT built** — vendor registration (a separate, already-
built flow for booth applications) is not the same as an Exhibitor ticket/pass. **Nav restructure
DONE 2026-08-21** (`ticketing-nav-restructure` M1, gate 8/8) — "National Show" is now the single
top-level nav item with a mega-menu whose Tickets column routes to a chooser page
(`/national-show/tickets`) plus direct Visitor/Exhibitor/Vendor sub-links; the ticketed-"Events"
vs. societies-calendar-"Events" naming collision is resolved by construction. Scoped to Exhibition
only — Conferences and Workshops/Field-Trips/Cocktails now have their own nav sub-links too (see
F4 below). **`ticketing-conferences-and-events` (Mission Two) is DONE IN FULL as of 2026-08-21** —
`.agent/memory/project/missions/2026-08-21-ticketing-conferences-and-events.md` has the closeout
for every feature; mission `status` is `done`. M1 (F1 Conferences + F2 Workshops/Field-
Trips/Cocktails estimation/structure) and M2 (F3 purchase pages, F4 nav wiring, F5 checkout) are
all complete, 5/5 features. F2's known future item — a structurally-safe interim fix (resized
capacity constants) for a real oversell defect Codex GPT-5.5 caught (multi-head products and
shared capacity pools not modelled by the checkout's per-slug-only capacity enforcement) — is now
CLOSED: F5 shipped the real fix (multi-head- and shared-pool-aware capacity enforcement via
`planPooledCapacity()` in `lib/checkout-reservation.ts`) and restored the real physical ceilings
(200/200/60/60) that F2's interim numbers (100/50/30/30) had conservatively capped below.
Workshops themselves (the per-session structure) remain unpriced/unbuilt pending a real
council-confirmed session list — deliberately out of scope for this mission, not a gap in it.

**F3 (Build category-aware Conferences and Workshops & Field Trips purchase pages) is DONE as of
2026-08-21** — Conferences and Workshops & Field Trips now have real purchase pages/routes,
reachable from the nav chooser (`/national-show/tickets`) and directly
(`/national-show/conferences`, `/national-show/workshops`). Needed three defect-repair cycles
(a real production-data hazard, a seed-script gap, and an import-safety hazard — see the mission
file's Closeout — F3 note for detail) before shipping. **F4 (extend the mega-menu's Tickets
column with Conferences and Workshops & Field Trips) is DONE as of 2026-08-21** — gate 8/8,
@qa PASS, Codex GPT-5.5 PASS, `components/chrome/nav-config.ts` extended by append only, no
structural changes to Header/MegaMenu/MobileMenu. **F5 (checkout support for Conference and
Workshop/Field-Trip/Cocktail ticket types, plus the real pooled-capacity fix deferred from F2) is
DONE as of 2026-08-21** — contract gate 17/17 green, needed FIVE independent real defect-repair
cycles (cross-slug pool oversell; an inactive-sibling pool leak plus a UI sold-out display gap;
a coverage gap in the architect's own proof artifact found by @qa-apex; a shared-validator
integer/fractional bug on `capacity`; a cross-show pool-name-collision gap in
`ticketTypesByPoolQuery`) — see the mission file's Closeout — F5 for the full account and
`learned.md` for the reusable lessons. **This closes out Mission Two — no items remain in M2.**
**`national-show-menu-restructure` M1 (F1+F2) is DONE as of 2026-08-21** — contract gate 21/21
green, @qa PASS, Codex GPT-5.5 PASS. Fixed Brad's live-tested complaint: the National Show
mega-menu's Tickets column now sits alongside a new "About the Show" column (What to Expect,
Plan Your Visit, FAQ, Archive — previously confirmed-live but unreachable from any menu), and
`/national-show/exhibitors` plus the exhibitor chooser card on `/national-show/tickets` now
carry honest "not yet open" static messaging instead of reading as a silent purchase dead end.
See `docs/f1-national-show-menu-restructure.md` and `learned.md` for the reusable two-column-
flat-over-nested-submenu pattern.
- [ ] **[P2] `scripts/migrate-ticket-type-category.ts` has only ever run `--dry-run`.** The 5 live
  admission `ticketType` docs in production Sanity still have `category: null`. A server warning logs
  for each during Admission ticket page renders (spotted during `ticketing-flow-redesign` F2 QA,
  2026-08-24). This is protected by F3's admission-only null-category read-time fallback in the GROQ
  query, so it is not urgent, but the docs should be backfilled with a real category for real
  eventually rather than relying on the fallback indefinitely. Recommend: `scripts/migrate-ticket-type-category.ts --apply`
  to clear the warning.
- [ ] **[P2] Day Visitor's chosen day is not shown on the ticket confirmation page.** Verified
  2026-08-21: `chosenDay` is correctly captured and persisted (`"2027-09-18"` confirmed in
  Firestore against a real purchase), but `/tickets/confirmation` only shows
  "day-visitor · R150.00" — no date. A buyer has no way to see which day they're confirmed for
  after checkout. Minor completeness gap in F5 (ticketing-f5-day-attendees), not a data-loss bug.
- [ ] **[P1] Verify the reserved-seat release path actually fires.** `buildReservationDocs` now
  writes `expiresAt` onto the position document as well as the order (`lib/checkout-reservation.ts`
  lines 56 and 81), which was the missing field that made lazy expiry-release unreachable — every
  reserved position hit the "no `expiresAt` → fail closed" branch unconditionally, so
  `RESERVATION_TTL_MINUTES = 30` was inert and abandoned carts held capacity forever. **The write
  is fixed; the release path itself has still never been observed running.** Verify it, do not
  assume. Note the interaction: once seats DO release, a paid-but-stranded order's seat becomes
  resellable. Also note what this episode showed — the no-oversell WRITE path is genuinely well
  proven (5 concurrent requests at the last seat, real server, real Firestore) while nothing
  verified the RELEASE path, which is where the defect sat.
- [ ] **[P1] QR code image does not render in the confirmation email.** Gmail shows the
  broken-image placeholder with its alt text. Generation is fine — it renders on the confirmation
  page and in the downloaded file. Likely cause: the email references the QR by URL or data: URI;
  Gmail proxies remote images and strips data: URIs. Robust fix is a CID-attached inline image
  (Resend supports attachments with a content id). **"It renders in my browser preview" is not
  proof of a fix** — this defect only exists in the real client, so any assertion must check what
  the delivered email contains, and the fix needs a real send to a real Gmail inbox.
- [ ] **[P1] Door check-in: the successful scan produces no visible feedback.** Brad's live mobile
  test — the scan WORKED (ticket reached `checked-in`, duplicates correctly refused) and the UI
  showed him nothing. Leading hypothesis, unverified: the result panel renders below the fold, same
  as the "Check In" button, so on the first successful scan the confirmation rendered off-screen.
  If so, "no feedback" and "below the fold" are ONE defect. **Rule out in this order before
  designing:** (1) does the admitted state render at all, or only the failure/duplicate branches;
  (2) if it renders, does it persist or is it cleared when the scanner loop resumes; (3) where does
  it land relative to the viewport at 375px and 320px immediately after a scan.
  **Brad's required behaviour, explicit:** SUCCESS is visually assertive and unmistakable at a
  glance, then the page RESETS clearing the previous ref so the next person can be scanned.
  FAILURE HOLDS the entered reference for inspection, with a bright red "Check-in not accepted"
  AND the specific reason — already checked in / unpaid / wrong show / unknown reference — because
  the reason determines the steward's next action. Blocked on the semantic-colour decision above.
  Accessibility: colour alone must not carry the verdict; pair with icon and text, meet contrast on
  parchment, assume a colour-blind steward in bright sunlight.
  Verify on a real phone with a real unscanned ticket — a DOM assertion cannot see this, and the
  existing suite never asserted that a successful scan shows the operator anything.
  `[verify against new brief]` — the verdict taxonomy changes when check-in becomes per-day.
- [ ] **[P2] Manual entry should take only the unique suffix.** Staff should never type
  `SAOC-2027-`; show it as a fixed affix. Must still accept a full pasted reference and normalise
  it (a scanner app, an email copy-paste and a typing steward must all work) — Brad's input had a
  stray space and still resolved, so some normalisation exists; find it before adding a competing
  second one. Uppercase-normalise too; phone keyboards autocapitalise inconsistently.
- [ ] **[P2] Downloaded ticket must be a PDF, not a PNG.** Currently
  `saoc-ticket-<ref>.png` (`components/tickets/DownloadTicketButton.tsx`). A PDF carries page size
  and vector text. **Watch:** the QR must stay crisp and scannable at print size — a downscaled or
  JPEG-compressed QR fails at the door, which is the one thing the artifact exists to do. Any
  contract needs a real scan test of the generated PDF, not "a PDF was produced".
- [ ] **[P2] Uniform branding across the three ticket surfaces** — confirmation page, downloaded
  artifact, confirmation email. All three are currently plain/unstyled with no SAOC identity.
  BLOCKED on Brad's template. Email has a hard constraint the others don't: clients strip `<style>`
  blocks, ignore most modern CSS, and Gmail clips over ~102KB — so table layout, inline styles, and
  a logo delivered as a CID attachment the same way the QR fix will be.
- [ ] **[P1] Refunds cannot be represented end to end.** `TicketStatus` has a `refunded` value but
  nothing sets it, `components/admin/StatusPill.tsx` has no style for it (renders through the
  neutral fallback, indistinguishable from an unrecognised status), and no gateway refund call
  exists. A refund today means refunding in the gateway dashboard and hand-editing Firestore with
  nothing linking the two. PayFast exposes a Refunds API (same MD5+passphrase auth as the ITN), so
  this is buildable. Needed before high refund volume.
- [ ] **[P2] `createOrderWithPosition()` uses idempotent `transaction.set()`, not `.create()`** —
  a colliding `bookingRef` silently overwrites instead of failing. **Verified 2026-08-21: the main
  checkout path no longer uses this** — `buildMultiReservationDocs()`/`writeMultiReservationPair()`
  (multi-line-item-cart mission) use `transaction.create()` (fail-loud on collision), confirmed by
  reading the code. `createOrderWithPosition()` is now ONLY used by the admin comp-ticket route
  (`app/api/admin/tickets/comp/route.ts`) — narrower blast radius than originally scoped, still a
  real gap there, lower urgency (comp tickets are a low-volume admin action, not public checkout).
- [ ] **[P2] `amount`/`purchasedAt`/`m_payment_id`/`pf_payment_id` are duplicated on both `Order`
  and `Ticket`**, deliberately, and nothing detects divergence between the copies. **Confirmed still
  true 2026-08-21** against a real live purchase (both fields present and populated on the order
  doc and on each of its two position docs). The position copies were meant to be removed with a
  backfill once checkout/ITN stop writing them.
- [x] ~~Recovery-token wiring has no owner~~ **RESOLVED, verified 2026-08-21.** `mintRecoveryToken()`
  is called in checkout (`app/api/tickets/checkout/route.ts:739`) and `recoveryToken`/
  `recoveryTokenExpiresAt` are confirmed present on a real order doc. Still genuinely open: the
  guest-order-claiming backfill (a guest's existing orders' `buyerUid` backfilled when they later
  register) — not re-verified, may still be owned by nobody.
- [ ] **[P3] `RECOVERY_TOKEN_DEFAULT_TTL_MS` is a 180-day working placeholder**, not a
  council-approved value. Real security/usability tradeoff: too short locks buyers out of tickets
  they paid for, too long keeps a leaked link live for months.
- [x] **[P2] Confirm a `checkinAttempts` document is actually written on a real scan.** The path is
  wired (`app/api/admin/checkin/route.ts:60` → `recordCheckinAttempt`), but the paused mission
  `prove-ticket-purchase-works-end-to-end-b` M1 gate observed no document after a live scan.
  Agent-actionable: query Firestore directly, do not queue a human scan. If the write genuinely
  fails, it fails silently — `lib/checkin-audit.ts:143` logs and swallows. Must survive the Stage 5
  per-day check-in rewrite: re-verify after it lands.
  **DONE 2026-08-25** — built read-only `scripts/verify-checkin-audit-write.ts`, cross-referencing
  checked-in tickets against `checkinAttempts` admit records (bookingRef-primary join, orderId
  fallback). Live run against real Firestore (verified twice): 0 orphans — the write path works
  correctly right now. No production code changed; a regression-locked verification tool now
  exists for future checks. Gate 6/6 pass, QA + Codex GPT-5.5 found and fixed 3 real bugs in the
  script's own join logic mid-mission. See `docs/verify-checkin-audit-write.md`.
- [ ] **[P2] `docs/firestore-ticket-schema.md` is stale on `TicketType`** — still documents the
  retired `'general' | 'member' | 'vip'` union and a 6-digit `bookingRef`. Reality: free-form
  string keyed by Sanity slug, 60-bit Crockford base32 refs.

---

## Security & admin auth

- [x] **[P1] F5's debug-log claim is not mechanically enforced.** DONE 2026-08-24 (mission
  `admin-session-refusal-log-enforcement`) — `contracts/checks/admin-session-refusal-log-enforcement-f1/`
  now runs a real refused POST /api/admin/session round trip and asserts the `classifyRefusal`
  reason/email log line actually fires, plus that refusal detail never leaks to the response.
  Gate passed 5/5, Codex GPT-5.5 clean after one fix round.
- [ ] **[P2] Empty-allowlist behaviour is reasoned about, not proven live.** No test restarts the
  server with an empty/unset/whitespace-only/trailing-comma `ADMIN_EMAIL_ALLOWLIST`. Residual risk
  is low (`parseAllowlist()` is a deterministic trimmed split) but this is exactly the
  secret-corruption defect class: an empty allowlist fails closed for everyone and is
  indistinguishable from a working gate from outside. Assert both that everyone is refused and that
  the `parsed length: 0` log line appears.
- [ ] **[P2] No claim-size guard on the grant path.** Firebase caps custom claims at ~1000 bytes;
  ~24 per-show `manager` grants exceed it. The operator gets a raw `auth/claims-too-large` with no
  advance warning.
- [ ] **[P2] `/admin/login` has no path for `auth/admin-restricted-operation`**, which self-signup
  refusal now produces.
- [ ] **[P2] No test admin credentials exist for automated visual QA.** `/admin` and `/admin/door`
  are behind Firebase Auth, so no browser agent can verify them render — only Brad can see these
  pages. Candidates: a narrowly-scoped rotatable test account, or a CI-only gate-bypass token never
  valid for production traffic.
- [ ] **[P3] A throwing `lookupShowWindow` closure propagates out of `hasCapability()`** rather
  than returning false (`lib/admin-auth.ts:170,199` — no try/catch). Not exploitable: the shipped
  `resolveShowWindowLookup` catches internally and can never throw. Any future route that
  hand-rolls a `ShowWindowLookup` must catch internally or wrap at the boundary.
- [ ] **[P3, convention] Every capability-gated route wires `ShowWindowLookup` itself** —
  `hasCapability()`'s default is `() => null`. New routes must call `resolveShowWindowLookup`, pass
  `{ now, lookupShowWindow }`, and land with their own wiring check. Not a task; the convention.
  Separately: `checkin`, `tickets` and `export-csv` admin routes call no capability check at all —
  the checkin one is the documented deferral above; the other two are pre-existing.
- [ ] **[P3] OAuth consent screen shows `saoc-webapp.firebaseapp.com`** instead of the council's
  name. Needs a custom `authDomain`.
- [ ] **[P3, untested] Concurrent grant/revoke race on the same identity** — low likelihood for a
  manual single-operator CLI.

---

## Accessibility & UI defects

- [ ] **[P3] `CartDayPicker`'s bordered-callout error-contrast fix is verified by source-read
  only, not live render.** `form-error-contrast-remaining-components` F1 (2026-08-24/25) applied the
  fix, but its error branch is unreachable today only because no current Sanity conference/workshop
  ticket type has `requiresDaySelection: true` set — a content fact, not a code guard.
  `CategoryTicketsPage` (used by `/national-show/conferences` and `/national-show/workshops`) CAN
  render `CartDayPicker` if an editor sets that flag on a multi-item category product. Recommend
  either a regression test forcing this path, or explicit documentation of the constraint, so it
  doesn't silently break if triggered later. Agent-actionable whenever picked up.
- [ ] **[P2, HELD for Brad's design call] WCAG accent-token contrast audit.** 30-row audit and
  contract identify real accent-contrast failures on live public pages. Remedy fully specified in
  `contracts/golden/wcag-accent-contrast/remedy.md`, deliberately not applied — it is a design-token
  decision. This is a live accessibility failure on public pages and should not sit indefinitely.
- [x] ~~**[P2] Vendor form has no client-side validation gating submission.**~~ RESOLVED
  2026-08-25 — investigation (mission `vendor-form-client-validation-gate`, F1) found the described
  defect did not exist in current committed source: `handleSubmit()` in
  `components/vendors/VendorRegisterForm.tsx` already runs client-side validation before the fetch,
  blocks on any error, and reuses the existing error-display path. No production fix was needed; a
  6-script Playwright regression-lock suite was added instead
  (`contracts/checks/vendor-form-client-validation-gate-f1/`) to prevent the defect from being
  reintroduced. Gate 7/7 PASS, QA PASS, Codex GPT-5.5 clean. Docs:
  `docs/vendor-form-client-validation-gate.md`.
- [x] ~~**[P2] `boothCount` still bypasses the form's own guarded-parse pattern.**~~ RESOLVED
  2026-08-25 — mission `vendor-boothcount-guarded-parse` (F1) routed `boothCount` through
  `toOptionalInt()` in `lib/vendor-register-form-payload.ts:117`, matching every other numeric
  field. A check suite covering all 4 historical Codex findings was added under
  `contracts/checks/vendor-boothcount-guarded-parse-f1/`. Gate 11/11 PASS, QA PASS (independently
  re-verified all 4 findings), Codex GPT-5.5 PASS. Docs: `docs/vendor-boothcount-guarded-parse.md`.
- [ ] **[P2] Vendor registration rate-limits after ~4 attempts for 45 minutes.** A vendor fumbling
  the form while genuinely trying to fix it gets locked out. (The human-readable countdown itself
  was fixed in `f7c5f6f`; the 45-minute lockout on a form this error-prone is the remaining issue.)
  Two BrowserAgent tests were blocked by this and remain unrun: the exact error-banner text repro,
  and one clean valid submission.
- [x] **[P2] `vendorCategory` claims `aria-required="true"` but enforces nothing** — none of its 8
  ~~checkboxes has `required`, and the client wouldn't block on it regardless. A screen-reader user is
  told the group is required; nothing backs that up.~~ Resolved as a side effect of the
  `vendor-form-client-validation-gate` mission (client + server now genuinely enforce
  at-least-one-category). `vendorcategory-aria-required-enforcement` mission (2026-08-25) added a
  regression-lock Playwright check suite (`contracts/checks/vendorcategory-aria-required-enforcement-f1/`)
  to keep it that way — no production source changed by that mission, check suite only.
- [x] **[P2] No visible focus indicator on ~24 of ~40 vendor-form interactive elements.** ~~Every
  text/number/email/tel/url/textarea input relies on a barely-perceptible border-colour shift with
  `outline: none`. Checkboxes, radios, submit and nav links are correct; isolated to text inputs.~~
  Fixed 2026-08-25 via `vendor-form-input-focus-indicators` mission F1 — shared `inputClass` in
  `components/vendors/VendorFormField.tsx` now carries
  `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2
  focus-visible:ring-offset-ivory`. Gate 5/5 pass, QA PASS, Codex GPT-5.5 PASS. See
  `docs/vendor-form-input-focus-indicators.md`.
- [x] ~~**[P2] No `maxlength` on any of the 25 vendor form fields** (5000 chars accepted into
  `businessName` with no truncation or warning) **and no `pattern` on the phone field** —
  `type="tel"` accepts `"not a phone number !!"` verbatim.~~ RESOLVED 2026-08-25 via
  `vendor-form-maxlength-and-phone-pattern` mission F1 — per-field `maxLength` added across all
  25 fields (`VendorFormField.tsx` + the five fieldset components) and a phone format validator
  (`^(?=.*[0-9])[0-9+\-() ]{7,20}$`, requires at least one digit) wired identically into the client
  validator, the server validator, and the HTML `pattern` hint. Gate 8/8 pass, QA PASS, Codex
  GPT-5.5 found and confirmed the fix for a whitespace-only bypass mid-mission, re-ran clean. See
  `docs/vendor-form-maxlength-and-phone-pattern.md`.
- [ ] **[P2] Vendor form all-caps labels are hard to read.** `font-mono text-[11px] uppercase
  tracking-[0.16em]` across five shared components. Contrast passes at 5.24:1 — the problem is
  11px + uppercase + 1.76px letter-spacing combined, not colour. Brad found it genuinely hard to
  read at length, and he is the decision-maker, so this is authorised, not invented brand work.
  First check whether the treatment is scoped to the vendor components or shared site-wide; a fix
  must not silently diverge the vendor form's typography from the rest of the site. Recommendation:
  keep the mono/letter-spacing character, drop `uppercase` for sentence case.
- [x] **[P2] Admission ticket list-mode card `<Link>` lacks custom focus ring.** ~~`TicketTypeCard.tsx`'s
  list-mode wrapper has no `focus-visible:ring-*` class and falls back to the default browser outline.~~
  Fixed 2026-08-25 via `tickettypecard-focus-ring` mission F1 — list-mode `<Link>` now carries the same
  `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2`
  token set as the stepper buttons. Gate 4/4 pass, QA PASS, Codex GPT-5.5 PASS. See
  `docs/tickettypecard-focus-ring.md`.
- [ ] **[P3] TicketTypeCard sold-out cards use `opacity` alone, no `aria-disabled`/state token.**
  Flagged as non-blocking during the F1 focus-ring QA pass, not a real defect — the inert
  `opacity`/`soldOut` styling works but doesn't carry a semantic disabled state. Low-priority
  forward-looking cleanup, not urgent.

---

## Vendor registration

- [ ] **[P2] Permit fields ask for a number but should collect the actual document.** Brad:
  "when we ask for a document it needs to actually upload a document, save it and email it as an
  attachment." Affects `phytosanitaryPermitNumber`, `citesPermitNumber`,
  `foodHandlingCertificateNumber`. F7's proof-of-payment path is the pattern to extend (public
  unauthenticated upload, base64 in / Storage out, MIME allowlist, size cap, extension derived from
  `mimeType` never the caller's filename). `lib/email.ts`'s `sendEmail()` has no attachment support
  — Resend supports `attachments: [{filename, content}]`, so extend rather than replace. Open
  design questions: does upload replace the number field or sit alongside it; who receives the
  attachment; does it apply to all three fields. F9's "collected, not verified" stance should very
  likely carry forward regardless.
- [ ] **[P3] CIPC and VAT numbers accept any data.** Both free-text with zero format validation.
  A real fix validates against SA's actual CIPC format and the 10-digit VAT format (starts with 4)
  — but confirm the CIPC format from an authoritative source; do not guess a registration-number
  regex.
- [ ] **[P3, informational] No CAPTCHA on the vendor form.** Mitigation is a honeypot plus per-IP
  rate limiting. Reasonable for low-volume B2B registration, not CAPTCHA-strength against a
  determined bot. Answered for Brad; no fix implied unless he asks.

---

## CMS / content

- [ ] **[P1, verify — may be resolved] The CMS→site loop may not invalidate at the CDN.** Logged
  2026-07-30: Studio publish wrote to the dataset and `POST /api/revalidate` returned 200, but the
  App Hosting CDN kept serving its cached object (`x-nextjs-cache: STALE` alongside
  `cdn-cache-status: hit`, `s-maxage=31536000`, `age` climbing). Lead, unconfirmed: `x-fah-adapter:
  nextjs-14.0.21` reported against a Next 16 app. **Content edits have since propagated and been
  verified live over HTTP more than once**, so this may be resolved — confirm before scoping work,
  and do not assume the version gap is the cause.
- [ ] **[P1] `/events/[slug]` has an independent propagation gap.** It tags its `sanityFetch` calls
  `['events']` only — no `'sanity'` tag, and `'events'` does not match the real document `_type`
  (`societyEvent`) a webhook payload sends. Event detail pages likely will not revalidate even once
  the CDN question is settled.
- [ ] **[P2] `scripts/seed-page-singletons.ts` still uses destructive `createOrReplace`**
  (7 occurrences). Seeds must be create-if-absent; a re-run today silently overwrites edited
  singletons.
- [ ] **[P2] `scripts/seed-show-visitor-info.ts` still contains the CTICC copy.** Inert today
  (every write is `createIfNotExists`) but it is a stale source of truth if the dataset is ever
  rebuilt from empty.
- [ ] **[P2] Studio has no guard against a second active show.** The `active` checkbox on `show`
  has no fieldset, `hidden` or `readOnly` condition, and `structure.ts` lists `show` as a plain
  type list. If an editor ticks Active on a past archive doc, `resolveActiveShow()` correctly fails
  closed to `null` — and `ticketTypeMatchesActiveShow()` then rejects EVERY ticket type for EVERY
  buyer with a generic 500. A sitewide sales outage from one mis-click, no warning, no alerting.
  Lee-Ann is the person who would hit this. Needs its own behavioural assertions — a Studio-side
  guard, not just the code-side fail-close.
- [ ] **[P2] `show-19-2027`'s edition/dates/venue are a COPY of the `nationalShow` singleton**, not
  a reference. They match exactly today, verified — but a future edit to either silently diverges
  in front of buyers. Needs one document to be authoritative.
- [ ] **[P2] Make show identity edition-scoped so a venue/date change is ONE edit.** Brad: "after
  three years they'll do a new show with a new venue — are we going to recreate all of this every
  time?" The venue fact lives in four dataset places plus four repo files; they agree only because
  they were written by hand in one sitting. What good looks like: one venue object as the single
  source with the edition doc and calendar event referencing it; venue-dependent prose recording
  WHICH venue it was written for so a change auto-flags it stale (this alone would have caught the
  CTICC bug — the current `confirmations.*` flags rely on a human remembering); and a documented
  show-rollover procedure that is a content operation, never a code change. Sequence after the
  design-alignment mission, which may move these surfaces anyway.
- [ ] **[P2] Unread schema fields teach editors that publishing does nothing.** `aboutPage.title`
  (fetched, never rendered), `aboutPage.boardIntroText`, `judgingPage.stats` (hero headings are
  hardcoded JSX), `contactPage.formRecipients` (consumed by nothing), and `show.awards` (lost its
  rendered surface in the archive merge — no live effect today since all values are null). Delete
  or wire; do not leave as-is.
- [ ] **[P2] `membersPage` and `judge` schemas are registered with no consumer.** `membersPage` has
  no query and no `/members` route; `judge` has zero documents. Both need the same scope decision:
  build, or remove so they stop misleading editors. Related: the real Members Portal is a separate
  future build, and the spec leaves open how membership status is verified against SAOC's actual
  records — that needs a client answer first.
- [ ] **[P2] Populate `hostSociety` on the 18 `societyEvent` documents.** 0 of 18 are set, so the
  home page's Upcoming Events strip always renders a blank host-society column. Content-entry task
  needing domain knowledge; the code side is correct.
- [ ] **[P2] `societyEvent` slugs are empty** (confirmed on "Cape Orchid Society Autumn Show"),
  which is the direct cause of `/events/[slug]` being unverifiable in the M2 regression pass.
  Studio has a per-document "Generate" button. Other spot-checked gaps: `society` description/logo/
  website, `boardMember` email/photo, `sponsor` tier/logo/website/description, `show` date.
- [ ] **[P2] `docs/secretary-cms-guide.md` §7 and §12 instruct the secretary to open singleton
  documents that may not exist** ("there is one document — click it to open"). Either the documents
  are seeded or the guide needs a first-time branch. `[verify]` — seeding may have happened since.
- [ ] **[P2] No SAOC-side notification for contact-form enquiries, and no admin UI lists them.**
  Submissions land in `contactSubmissions` and nothing tells anyone; they are visible only in the
  Firebase console. Real gap before launch — worth a small authenticated list view, same pattern as
  the door scanner.
- [ ] **[P2] Secretary CMS controls, phase 1.** Scope-narrowed deliberately: hero headings/lede on
  home/about/national-show, upcoming show details, a news block, contact details. Do NOT attempt
  full-site editability in one mission. Seed must pre-populate every new field from current
  hardcoded values so she starts with real content, not blank forms.
- [ ] **[P3] `ticketType.show` reference picker is unfiltered** — an editor can point a ticket type
  at a 2012 archived show. Checkout fails closed, so this is wasted-editor-effort only. Add an
  `options.filter` scoping to `active == true`.
- [ ] **[P3] Verifying the Sanity webhook end to end is impossible with the dataset-scoped
  `SANITY_API_TOKEN`** — reading webhook config needs `sanity.project.webhooks/read` (401
  confirmed). Contracts assert the direct revalidate call instead, which is a weaker claim.
- [ ] **[P3] `@sanity/image-url` deprecated default export** fires a warning on every home-page
  render in dev. Cosmetic console noise.
- [ ] **[P2] Sanity v6 major upgrade** — `sanity@5.31.1 → 6.3.0`, likely `next-sanity@11 → 13`.
  Requires a research pass first: v6 changelog, next-sanity v13 breaking changes, App Hosting SSR
  compatibility, React 19 peer story, schema/Studio API changes. Do NOT upgrade blind.
- [ ] **[P3] Auto-refresh `llms.txt` / `llms-full.txt`.** `scripts/refresh-llms.ts` is built but
  Alembic blocks `localhost` by design, so it only works against the live external URL — usable
  post-cutover only, and never in CI. `public/llms.txt` stays hand-authored.

---

## Contract & test infrastructure

- [ ] **[P1] Five stale sha256 pins across two files — same defect, two instances.** In both cases
  a pinned file changed for a reviewed, deliberate reason and the pin was never re-cut, so the
  assertion went quietly red. **The current content IS the intended baseline in both cases** — this
  is drift to catch up with, not a regression to revert. Each needs a re-pin ceremony: @architect
  authors the expected value, @dev never computes a pin, and it is never an in-passing edit.
  1. ~~`app/api/tickets/itn/route.ts` — four pins.~~ ✅ **Re-pinned 2026-08-20 by
     `payment-provider-seam` F2.** `discover_route_pins.py` found a FIFTH pin beyond the four
     originally listed here — a DIFF pin (`ticketing-hardening` A33) deriving its own NEW_SHA from
     the same expected file the ceremony itself validates against. All five updated to `09adc6fcab5eb9c0a67e57bb1dc5ae533aeecf815e84353594927baae19964a8`;
     `shasum -c` and `diff` all exit 0. A sixth orphan copy of the expected file survives at
     `golden/ticketing-f10-itn-repin/itn-route.expected.ts.txt` (prose refs only) — consolidation
     still deferred. See `learned.md` "payment provider seam" session entries.
  2. **`lib/orders.ts` — one pin.**
     `contracts/golden/production-blockers-f4-itn-check-repoint/orders-lib.golden.sha256` records
     `47c2e83c…`; the file hashes to `a8c8b416…`. Triaged 2026-08-19 to commit `31ee68c`
     "fix(tickets): write expiresAt onto the position, releasing abandoned seats" — the reviewed
     fix to the live capacity bug. Needs its own catch-up ceremony; explicitly **NOT** folded into
     `payment-provider-seam` F2, which does not touch this file.
- [ ] **[P1] Re-pin discipline has no enforcement at all — five silently-red pins found in one
  evening.** Nothing fails when a pinned file changes legitimately and the pin is not updated: the
  assertion goes quietly red in a place nobody routinely looks, and the contract corpus decays
  while still reporting green overall. All five were found by an architect who happened to be
  reading, which is luck, not a control. @architect is drafting a standing drift-detection check
  across ALL contracts. **This is worth more than any individual re-pin.**
- [ ] **[P1] `contracts/contract-ticketing-checkout-orders.yaml` A4/A5 are stale — checkout no
  longer calls `writeReservationPair()` directly.** Both assert a *structural, source-level* shape
  ("`writeReservationPair()` called exactly once in `app/api/tickets/checkout/route.ts`, inside
  the transaction, after the idempotency guard"; "a `RECOVERY_TOKEN_SECRET` fail-closed guard sits
  textually before that call site"). Commit `6046bc0` (M2-F5, pooled-capacity checkout — predates
  `ozow-payment-provider`, unrelated) replaced the direct call with a `reserveTicket()` wrapper
  that calls it internally; confirmed via `git show 6046bc0:app/api/tickets/checkout/route.ts` —
  the direct call was already gone before Ozow's mission even started. Found 2026-08-22 by Codex
  GPT-5.5's full-mission-diff pass on `ozow-payment-provider` (which also found and fixed a real,
  in-scope regression in the same contract's A3 — a test fixture missing F2's new required
  `gateway` field — now fixed). A4/A5 need re-scoping to assert the same invariants (atomic
  write-inside-transaction, fail-closed missing-secret guard) against `reserveTicket()`'s current
  shape, not the pre-refactor one; not fixed here — out of scope for `ozow-payment-provider`,
  which never touched this call site.
- [ ] **[P2] The `vendor-f3-showcase-page` golden has never been evaluated by any assertion.** It
  is correctly formatted and currently accurate — @architect's initial "drifted" report was its own
  false negative, self-corrected. The defect is that no assertion in any contract runs it: a green
  pin that has never been evaluated. Different problem from a decayed one, and **not fixable by
  drift detection** — the hash matches; nothing ever checks it.
- [ ] **[P1] PR the `contract.py` timeout-enforcement fix upstream BEFORE the next
  `make update-template`.** The fix for dropped `timeout_seconds` copying is shipped locally
  (8/8 green) but `make update-template` will silently revert it and reopen the fixture-leak
  vulnerability with no warning. Coordinates: `InunuNet/Athanor` → `execution/contract.py`, 4 edits
  (26 ins / 5 del). Detail: `docs/contract-timeout-enforcement-harness.md`.
- [ ] **[P1] Audit remaining contracts for the weak-assertion defect class** — an assertion
  satisfiable by something that is not the real property. The 2026-08-16 audit cleared four
  contracts and found no live vulnerability; the sweep is not exhaustive.
- [x] ~~**[P1] `contract-payfast-m1` A18 asserts a security property the system deliberately no
  longer has.**~~ ✅ **Retired 2026-08-20 by `payment-provider-seam` F2** — removed from
  `check-itn-behaviour-unchanged.sh` (suite hard-counted `EXPECTED_SUITE_SIZE=3` so a silent
  re-add goes red). Note: the original "proven pre-existing via differential" method was itself
  found unsound mid-mission (the check is nondeterministic on BOTH pre- and post-rewire code — a
  differential across a flaky check proves nothing whichever way it lands); the retirement instead
  rests on the deterministic probe (pre-rewire route + bogus IP + settle time → `status='paid'`
  anyway) and on `8476c56` predating the check's last touch. Four downstream contracts still
  reference the removed file's prose — repointed, not orphaned. See `learned.md`.
- [ ] **[P1] `payfast-m1` A1 and A6 cannot pass as written.** A1 forbids `stripePaymentIntentId`
  anywhere under `docs/` and trips on the sentence explaining the field was removed (red since
  `e7de1e0`). A6 expects `m_payment_id` literally inside a route that now correctly delegates to
  `lib/checkin.ts`. Retire-or-rewrite with the `exit 77` / `SUPERSEDED:` pattern used on D5/D6.
- [ ] **[P2] Two known weak assertions, unfixed.** `contract-ticketing-m1-m2.yaml` A20 (price-source
  assertion satisfiable without the real property) and `contract-ticketing-hardening.yaml` A16
  (secret-leak regex evaded by indirection or multiline formatting).
- [ ] **[P2] `A-STRUCT-01`'s self-signup structural check is satisfied by a comment.** It greps for
  the literal `functions.auth.user().onCreate(` on one physical line; the real chain is split across
  lines, so only the JSDoc comment matches. QA proved it by swapping the whole trigger for a no-op
  HTTP handler — all four structural checks still passed. Not exploitable today (the behavioural
  checks genuinely exercise the emulator) but a future regression changing the trigger type with the
  comment intact passes silently. Strip comments before matching, or match the real multi-line shape.
- [ ] **[P2] `A-STRUCT-01`'s Apple `addScope('email')` check is grep-based and provably defeatable**
  — it passes against a commented-out call and against an `addScope` on a dead branch. If Apple
  sign-in ever stops receiving emails, suspect this check first. A real fix needs AST parsing.
- [ ] **[P2] F8 check A4 is blind to null.** It greps for `undefined` only, missing both
  bare-JSX interpolation of undefined (renders blank) and template-literal coercion of null
  (renders "null" — that exact regression shipped in `bcbbc03`, fixed in `cd0308d`). Widen to
  `null` plus a bare-`{boothNumber}`-as-JSX-child guard.
- [ ] **[P2] `A-GRANT-03`'s stdout-grep assertion proves nothing** — rewrite to observe the Admin
  SDK call rather than grep stdout for "reset link".
- [ ] **[P2] Retrofit JSX-interpolation rigour onto pre-existing contracts.** Assertions that check
  "this Sanity field is rendered" via a plain substring grep are false greens — they pass a field
  that appears only in a fetch, destructure or type annotation. That is precisely the
  `aboutPage.title` bug. The correct check requires the field inside a real JSX interpolation,
  excluding `{/* comment */}`. Also assert no reversed fallback precedence
  (`'literal' ?? data.field`), which lets a hardcoded string mask a published edit. Reference:
  A48/A49/A50/A50a in `contract-ticketing-m1-m2.yaml`.
- [ ] **[P2] The shared contract test-server has no lock or refcount.**
  `contracts/checks/admin-auth-hardening/server-ctl.sh` claims lock/refcount handling in its
  comments and implements none — one fixed PIDFILE on port 3400, so one contract's `stop()` tears
  down a server another contract is still using. Causes intermittent failures specifically in busy
  multi-agent sessions.
- [ ] **[P2, process trap] Running the door-test-qr-seeder gate DESTROYS live human test
  fixtures.** A4 deletes the three seeded `DOOR-QR-*` docs to prove teardown is scoped, and never
  re-seeds — on 2026-08-17 that cost a live testing session and read as a scanner failure. A4 should
  re-seed after asserting, or the gate should print a loud warning. A check's side effects on shared
  live state are part of its contract.
- [ ] **[P2] Contract checks structurally cannot detect missing DEPLOYED configuration.** The gate
  runs against a local server reading `.env.local`, so it cannot catch a secret declared locally and
  missing from `apphosting.yaml`/Secret Manager (the `ADMIN_EMAIL_ALLOWLIST` incident). Wants a
  post-deploy smoke assertion probing the live URL for the specific failure mode.
- [ ] **[P2, candidate contract] Secret verification guard.** After any
  `firebase apphosting:secrets:set`, read the secret back and assert SHA-256 digest match, exact
  byte length, and no leading/trailing whitespace. Four payload-corruption incidents in 16 weeks
  reached production undetected because no post-write verification ran. `gcloud` is NOT needed —
  the Firebase CLI's cached OAuth token has `cloud-platform` scope. Detail:
  `docs/secret-corruption-incidents.md`.
- [ ] **[P2] Two live contract locations cause duplicate work.** Contracts live both in `contracts/`
  (git-tracked, legacy) and `.agent/memory/project/specs/<slug>/` (recent missions). An untracked
  contract for the boothCount bug was independently redesigned from scratch by a later architect —
  two designs, same destination, divergent APIs — and nothing caught it: the gate only runs the
  contract it is pointed at, and @qa reviews within scope. Codex found it only because it reviews a
  diff. Decide on ONE canonical location, or document which is for what and have @architect check
  both. At minimum, contracts must be committed when written — an untracked contract is invisible to
  every tool and unrecoverable if deleted.
- [ ] **[P2] `contract.py` timeout validation has three unguarded ceilings** (all pre-existing):
  `validate_cmd()` is never called from `check_cmd()`/`gate_cmd()` so rejected values still reach
  the runner; no upper bound (`999999999999` causes an unhandled OverflowError); the `is not None`
  edit is correct but uncovered by any assertion. Do not claim complete validation until fixed.
- [ ] **[P2] Contract assertions read `$MISSION_F2_BOOKING_REF`, which nothing sets** —
  `mission.py cmd_gate` and `contract.py` both pass a plain env copy, so the gate runs with an empty
  ref and fails for the wrong reason. Persist it or inline it into the assertion command.
- [ ] **[P2] `specs/prove-ticket-purchase-works-end-to-end-b/contract-f1.yaml` is one omnibus file**
  holding all 10 assertions for F1–F4, and no feature declares a `contract:` field — so gating M1
  evaluates F3/F4 assertions outside that milestone and skips F2 entirely. Split per feature.
- [ ] **[P2] No branch protection on `main`** (`gh api` → 404). Every CI check, including
  `dataset-residue-guard`, is advisory only; a broken push still merges. Remedy command recorded in
  `docs/dataset-residue-guard.md`.
- [ ] **[P2, CI] Wire the two credential-free structural ITN checks into CI with a path trigger.**
  `check-paid-write-inside-transaction-scope.mjs` and
  `check-server-confirm-fetch-outside-transaction-scope.mjs` need no secrets and cost nothing, but
  run only inside the credential-gated `contract-payfast-m1.yaml` suite, which rarely runs. A job
  triggered on diffs to `app/api/tickets/itn/route.ts` or `lib/orders.ts` would have caught F4's
  entire staleness the day F10 merged instead of months later via audit.
- [ ] **[P2] `cms-loop-f3-national-show.yaml` A5 is superseded and wants a scope review, not a
  patch.** It asserts the `nationalShow` schema declares exactly its original six fields, so it is
  already red for a sanctioned reason — the visitor stream legitimately added `showEndDate`,
  `edition`, `hostRegion`, `venue`. While in there, decide whether to delete the now-unreferenced
  `check-exhibitor-stages-round-trip.mjs`.
- [ ] **[P2] `contracts/golden/f4-seed-page-singletons/nationalShow.golden.json` still pins CTICC.**
  The seed script's venue was corrected; the golden was not. Owned by
  `cms-loop-f3-national-show.yaml`; A19 in `contract-venue-prose-residue.yaml` deliberately leaves
  it alone as proof that fix stayed scoped. Self-detecting on the F4 contract's next run.
- [ ] **[P2] Second pair of eyes on the venue-prose-residue checkers' scope exclusions.** One bad
  attribution was found and corrected (golden identity fields claimed as owned by a contract that
  never protected them); the audit was not exhaustive. This is the exact defect class — imprecise
  ownership claims narrowing a checker's scope — that let stale CTICC prose survive two green gates.
- [ ] **[P3] `check-new-document-filter.mjs:17` hardcodes `MUST_SURVIVE = ['society', 'event']`**
  but `'event'` is not a real schema type — it is `societyEvent`. No false pass today, but A2 never
  exercises the real name, so a regression filtering `societyEvent` out of the create-new menu would
  go uncaught.
- [ ] **[P3] `lib/qr.ts`'s whitespace-only `bookingRef` case is unexercised.** The empty-string
  branch is actually proven by the `qrcode` library throwing on `''`, not by the guard's own
  `.trim()` — a mutant that removed the guard still failed A3 for the wrong reason. A whitespace-only
  ref would encode silently. Add a dedicated whitespace-only case only the guard rejects.
- [ ] **[P3] Complete or remove the orphan F6 rendered-check harness.**
  `contracts/checks/f6-home-fidelity/` has Playwright checks with no assertions invoking them
  (@architect died mid-session). Either wire them or remove the files and the unused `playwright`
  devDependency.
- [ ] **[P3] `fleet_loop.sh` commits feature work under "chore: comms reply" labels** — twice,
  including an entire feature implementation. History truthful in content, lying in labels, and it
  races the orchestrator's staging. Gated off (`chmod -x`) 2026-08-18; needs a contract before
  re-enabling: label accuracy plus never staging outside `.agent/memory/`.
- [ ] **[P3] `firebase apphosting:rollouts:create` reports success while creating nothing** —
  appears to dedupe on git SHA. Workaround is POSTing directly to the App Hosting REST builds
  endpoint.

---

- [ ] **[P1] `contract-payfast-m1` A30/A31 (`check-itn-atomic-idempotent-write`) has a dead
  scenario-1 comparison.** It checks `position.pf_payment_id` on both sides — F10 moved payment
  identity to `order.gatewayPaymentId`, nothing writes the position field, and
  `buildReservationDocs` initialises it to `null`. Both sides are null every run regardless of
  what the transaction does; unfalsifiable. Found during `payment-provider-seam` F2's suite sweep
  (same shape as the retired A18 above) but explicitly left for `contract-payfast-m1`'s own pass —
  its two sibling assertions in the same block still bind, so this is a single-scenario repair,
  not a block-wide one.
- [ ] **[P2] Docs still name the pre-`payment-provider-seam` `AMOUNT_MATCH_TOLERANCE`** —
  `docs/payment-seam.md`, `docs/payfast-integration.md`, `contracts/golden/payment-seam-f1/*`.
  The real guard is now integer-cents (`AMOUNT_MATCH_TOLERANCE_CENTS`,
  `app/api/tickets/itn/route.ts:34`, `lib/payments/payfast.ts` for the adapter-side
  `grossAmountCents` parse) — the float-tolerance version it replaces accepted a genuine 1-cent
  underpayment. Docs task, not code.
- [ ] **[P2] `check-idempotency-bound-to-payload.mjs` A26/A27 has a latent fixture-selection
  bug.** `otherActiveTicketTypeSlug` can pick a ticket type that requires `chosenDay`, which the
  check never supplies — pre-existing, confirmed to fail identically before and after
  `verify-reservation-release-path`'s changes (2026-08-24), so out of scope there. Needs the
  fixture selection to filter out `requiresDaySelection: true` types, or supply `chosenDay`.
- [ ] **[P3] `check-missing-capacity-fails-closed.mjs` A29 hangs on Sanity CDN propagation in
  this environment.** Documented as already-known-red by `verify-reservation-release-path`
  (2026-08-24); not a regression from that mission's changes.
- [ ] **[P1] `contracts/checks/ticketing-hardening/` (~18 files) is orphaned from every active
  `contract.yaml`'s `assertions`.** Nothing currently wires the suite into `mission.py gate`, so
  a break in it raises no alert — `verify-reservation-release-path` (2026-08-24) only caught the
  `_shared.mjs` postCheckout-payload staleness because its own F1 happened to depend on that one
  file. Needs a future mission to either wire the suite into an active contract or formally
  retire it; leaving it silently unreachable is worse than either.

## Code quality & housekeeping

- [ ] **[P2] Prettier fails repo-wide** — 28 files across `app/`, and a wider ~160-file drift noted
  earlier. Deliberately not fixed piecemeal inside feature contracts (fixing 4 of 28 leaves the rest
  inconsistent). Decide whether to run `pnpm format` repo-wide in one pass and gate it in CI.
- [ ] **[P3] No request body-size cap on any App Router API route.** Every route calls
  `request.json()` uncapped; App Router has no default limit. Project-wide; wants one shared guard.
- [ ] **[P3] `app/(marketing)/events/submit/page.tsx` calls `initAdmin()` at page scope without
  `force-dynamic`** — same cloud-prerender trap class as `/admin/vendors` (fixed). Has built OK so
  far; verify before it bites.
- [ ] **[P3] `functions/src/index.ts` uses plain `console.*` instead of `firebase-functions`'
  `logger.*`**, losing structured Cloud Logging fields on a security-relevant deletion audit trail.
  The v1 import never pulls in the `console.*`-patching shim, so `{uid, email, reason}` flattens
  into the text payload. Against this project's own structured-logging rule.
- [ ] **[P3] Pre-existing American spellings** at `docs/ticketing.md:424, 484, 488, 820`. The
  Microsoft/Entra proper nouns in `docs/admin-access.md` are correct and must NOT be "fixed".
- [ ] **[P3] Stale header comments in `lib/confirmation-email.ts`** still describe an earlier
  "minimal stub, doesn't call Resend" state. The code genuinely calls Resend and generates real QR
  images; the comments actively mislead a reader.
- [ ] **[P2] Favicon: revisit when the SAOC org logo lands.** The interim mark is a detailed
  full-colour illustration that loses definition at 16px, while the site chrome uses a monochrome
  line-drawing disa — the tab icon and the header mark are not yet the same identity.

---

## Harness — upstream to InunuNet/Athanor

- [ ] **TEMPLATE BUG: `execution/gh_closure_scan.py` fails but exits 0.** It prints
  `ERROR: …/OVERNIGHT-PLAN-2026-07-30.md has no YAML frontmatter`, scans nothing, and returns 0 —
  so any caller gating on the exit code reads a hard failure as success, and closure scanning has
  been silently non-functional here for an unknown period. Two defects: **the exit code is the one
  that matters** (an ERROR path returning 0 is the same "reports green while measuring nothing"
  class this project keeps hitting), and separately the scanner should skip non-mission files rather
  than aborting the whole directory. Fixing only the input hides the exit-code bug again. A second
  symptom seen 2026-08-17 (`ERROR: could not resolve --repo:`) appears transient/environmental.
- [ ] **[athanor-upstream] sync-autonomy v2** — `set-autonomy LEVEL=high` should propagate to
  `.claude/settings.json` `permissionMode`. Filed 2026-06-16.
- [ ] **[athanor-upstream] `mission.py` slug fix** — cross-date slug scan fix needs upstreaming via
  `make update-template`. Filed 2026-06-16.
- [ ] **[P3] `SecurityValidator.hook.ts` false-positives on `rm -rf` with multiple absolute paths**
  (reads a plain `/Users/...` as recursive delete from filesystem root). Worked around with one
  relative path per command. Worth tightening if it recurs.

---

## Hosting — decision pending Brad

Research: `documents/hosting-research-2026-06-20.md`. Vercel has Cape Town compute but SA SSR needs
Pro ($20/mo); Fly.io `jnb` is best-value SA SSR at $8–15/mo but requires a Dockerfile migration;
"Coolify on Hetzner JNB" was a misconception (Hetzner has no SA DC). **Recommendation: stay on
Firebase until latency is a measured problem.** Brad to confirm whether SA compute is a hard
requirement, the budget ceiling, and that no migration happens before DNS cutover.

---

## Phase 2 — out of scope (do not work on until Phase 1 ships)

- Society individual pages, society admin logins, federated ticketing
- Paid SAOC membership (recurring billing) + members-only area
- Digital archive of *Orchids South Africa* yearbooks
- Donation system, sponsorship management, Google Ad Grant
- Learning library, judges training portal, articles/video
- Society-published `.ics` calendar feeds aggregated into the national calendar. Not scraping —
  `.ics` is published natively by Google Calendar, Outlook and Facebook Events, and the codebase
  already emits it. Needs a moderation step and a manual-entry fallback. Validate cheaply first:
  ask how many of the 21 societies actually keep one.
- Conference registration, workshops, field trips, the cocktail event, time-conflict detection and
  the admin reporting layer from the council's ticketing brief — later slices, deliberately not in
  the current plan.

---

## Closure Candidates (needs sign-off)

_None currently. `execution/gh_closure_scan.py` does not run to completion (see harness section);
`InunuNet/SAOC` last showed zero open GitHub issues._

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=none

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-21-scoped-staging-commits.md

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-21-compaction-nudge-template-propagation.md

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-21-gate-contract-mismatch-guard.md

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-21-pulse-quota-resume-hardening.md

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-21-contract-gate-integrity-fixes.md

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-21-token-accounting-hardening.md

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-21-quota-mirror-partial-write.md

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-21-codex-qa-timeout.md

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-21-gemini-agent-model-drift.md

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-21-idempotency-check-repo-mutation.md

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-21-mission-abandon-clear-active-fix.md

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-21-pulse-launchctl-rc-113.md

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-21-contract-py-hygiene-fixes.md

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-21-mission-contract-lookup-cwd-anchor.md

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-21-full-boot-redaction-regex.md

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-23-contract-gate-cache-staleness.md

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-24-template-mirror-sync-f7.md

- [ ] SAOC (Misc): [quota-monitor] Athanor: no active mission

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-24-template-mirror-missing-files.md

- [ ] SAOC (Feature, P2): early-bird / regular ticket display gating (Brad, 2026-08-24, tested
  at /tickets). `earlyBirdCutoff` exists per ticket type today but is ONLY enforced server-side
  at checkout (409 if you try to buy after cutoff) — see docs/f4-admission-products.md line 88.
  Nothing hides cards on the /tickets page: Early-Bird Exhibition Ticket and Day Visitor Ticket
  (its regular-price equivalent) both show simultaneously right now, regardless of date. Two
  gaps:
  1. Once `earlyBirdCutoff` passes, the early-bird card should disappear (currently stays
     listed and only fails at checkout — bad UX, buyer gets to fill in details before erroring).
  2. While still inside the early-bird window, the paired regular-price ticket should be
     hidden/disabled too — right now a buyer could choose the pricier regular ticket during the
     early-bird window when only the cheaper early-bird option should be available. No pairing
     field exists between an early-bird product and its regular equivalent (matched only by
     category/description today) — needs either a schema addition or an agreed naming
     convention before this can be built correctly.
  Brad's proposed rule: early-bird tickets sold up to ~9 months before the show; after that,
  only normal tickets show. Recommendation (Claude, 2026-08-24): make this presentational,
  driven off the existing `earlyBirdCutoff` field, not just the checkout-time 409. Needs
  architect spec work on the pairing mechanism before @dev.

  REFINED 2026-08-24 (Brad, second pass): NOT a hide/show toggle after all —
  1. `earlyBirdCutoff` is already Sanity-editable per ticket type
     (sanity/schemas/documents/ticketType.ts:78, via /studio) — no new admin surface needed,
     Brad just didn't know it was already there. Confirmed, no action needed on this point.
  2. Display behaviour: once early-bird has closed, don't hide the early-bird card — GREY IT
     OUT instead, so visitors can still see what they would have saved by buying early (social
     proof / FOMO for the next show's early-bird window). Same idea likely applies to the
     regular-price card during the early-bird window (grey out + show early-bird savings),
     though Brad specifically called out the "closed early-bird, show what you missed" case.
  Still needs the pairing mechanism (early-bird ↔ regular ticket) resolved before @dev — no
  schema field links the two today, only category/description similarity.

- [x] SAOC (Feature, P1): remove buyer-facing "Pay with: Ozow / PayFast" gateway picker from
  public checkout — DONE 2026-08-24, mission `gateway-picker-admin-only`, gate 13/13 + QA PASS +
  Codex PASS. `ProviderChoice.tsx` removed; admin-only `activePaymentGateway` Firestore setting
  added at `/admin/settings` (same `manage-payment-settings` capability gate as the Ozow sandbox
  toggle); checkout route resolves the gateway server-side only and fails closed (500) if
  unset/invalid — no client-supplied `providerId` is trusted for gateway selection anymore.

- [x] SAOC (Feature, P2): ticketing flow redesign — DONE 2026-08-24, mission
  `ticketing-flow-redesign` (F1-F3, both milestones gate-green: M1/F1 10/10, M2/F2 10/10,
  M2/F3 10/10), commit `6ae483b`. Delivered: (1) vertical ticket-type cards with real orchid
  photos (`public/images/orchid-{pink,purple,yellow,violet,dark}.jpg`), replacing the abstract
  geometric icons; (2) one dedicated buy screen per Admission ticket type
  (`/tickets/[slug]`) instead of a shared cart+buy button; (3) early-bird and regular merged
  into ONE ticket per type via a new `regularPrice` field + `resolveEffectivePrice()` — price
  changes at `earlyBirdCutoff` instead of two separate products, which supersedes and closes the
  "early-bird / regular ticket display gating" item above (that item's pairing-mechanism problem
  no longer exists — there is only one ticket per type now); (4) VIP price fixed R300 → R480 so
  it stays the top tier above Weekend Pass's R400; (5) Day Visitor per-day quantity picker
  (`DayQuantityPicker.tsx`) for buyers wanting tickets across multiple show days. QA found and
  fixed 3 real bugs across 3 QA rounds + 1 browser-verification round on F3 alone (shared-identity
  attendee data loss, interleaved-edit day-misassignment, stale validation message) — see
  learned.md "Cart/checkout UI needs multiple QA rounds, not one" for the detail. Live-dataset
  price migration script is written but dry-run only, not yet applied to production Sanity data.

- [ ] SAOC (Chore, P3): early-bird / regular ticket display gating item above (line 896) is now
  OBSOLETE — F1 of `ticketing-flow-redesign` merged early-bird/regular into a single ticket per
  type via `regularPrice` + `resolveEffectivePrice()`, so the pairing-mechanism problem that item
  was blocked on no longer applies. Leaving the original entry in place with this note rather than
  deleting, per this project's backlog-hygiene convention of not silently removing history — but
  no further action needed on it.

- [ ] SAOC (Chore, P3): `ticketing-flow-redesign` non-blocking follow-ups flagged by @docs during
  F2/F3, not yet actioned:
  1. Focus-ring styling gap on the ticket-type card in list-mode (visible keyboard-focus outline
     missing/incomplete) — accessibility polish, not a functional bug.
  2. A migration script exists for the F1 `regularPrice` schema field's live-dataset rollout, but
     it's dry-run only — needs to actually be run against the live Sanity dataset once Brad signs
     off (see project_sanity_dataset_not_live memory: site is pre-production, safe to edit, but
     keep the careful method).
  3. Day-of-week/date labels in the Day Visitor per-day quantity picker are currently raw values,
     not friendly-formatted (e.g. "Thu 17 Sep" instead of an ISO date or raw day index) — cosmetic,
     not functional.

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-24-close-bash-file-write-bypass-of-require-.md

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-24-make-backlog-hygiene-self-enforcing-acro.md

- [ ] SAOC (Misc): [quota-monitor] Athanor: active=2026-08-25-update-template-write-safety-hardening.md
