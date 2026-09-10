# ticketing-complete M1/F1 — design record

Pure taxonomy + computed early-bird pricing module. This is the ONLY feature gated by
`contract-f1.yaml`; F2-F8 are designed here only where F1's shape constrains them, and are
NOT gated by this contract.

## 1. Two new files, both pure (no Firestore, no network, no implicit clock)

- `lib/ticket-taxonomy.ts` — `TicketCategory` (7 values, see `fixtures/f1-taxonomy.json`),
  `TICKET_CATEGORIES`, `TICKET_CATEGORY_LABELS`, `TICKET_CATEGORY_PURCHASE_SURFACE`.
- `lib/admission-early-bird-pricing.ts` — `ADMISSION_EARLY_BIRD_DISCOUNT_PERCENT = 20`,
  `ADMISSION_EARLY_BIRD_CUTOFF_DAYS_BEFORE_SHOW = 90`, `deriveAdmissionEarlyBirdCutoffIso(showStartDate: Date): string`,
  `resolveComputedEarlyBirdPrice(input: { basePrice: number; purchaseDate: Date; showStartDate: Date }): { amount: number; tier: 'earlyBird' | 'regular' }`.

Both files import ONLY types/pure functions — `isWithinEarlyBirdWindow` is imported by
**value** from `./checkout-reservation` (relative, not `@/`-aliased, exactly like
`lib/vendor-stand-pricing.ts` does today, for the same reason: `.mjs` check scripts run under
`node --import tsx/esm`, outside Next.js's own module resolution, where the `@/*` path alias
is not honoured). `checkout-reservation.ts`'s only import is `import type { Timestamp } from
'firebase-admin/firestore'` — type-only, erased at compile time, so this reuse does not pull
Firestore into the runtime graph. Do not duplicate `isWithinEarlyBirdWindow`'s boundary
comparator — reuse it, per the existing `vendor-stand-pricing.ts` precedent.

## 2. Pricing model — one basePrice, mechanically-derived discount (not two independent figures)

`resolveComputedEarlyBirdPrice` takes exactly the three inputs the mission brief specifies
verbatim ("a pure function of (basePrice, purchaseDate, showStart)") and returns
`amount = Math.round(basePrice * 0.8)` when within the window, `basePrice` otherwise. This
mirrors `lib/vendor-stand-pricing.ts`'s per-stand-rate pattern: ONE confirmed number
(`basePrice`) plus ONE confirmed percentage (Brad's stated 20%), never two independently
hand-maintained prices that can drift apart. `ADMISSION_EARLY_BIRD_CUTOFF_DAYS_BEFORE_SHOW`
is its own constant — deliberately NOT imported from or shared with
`VENDOR_STAND_EARLY_BIRD_CUTOFF_DAYS_BEFORE_SHOW` (vendor stands) or
`PROVISIONAL_REFUND_POLICY`'s day thresholds (refunds), even though all three currently read
"90" or similar — three unrelated rules that happen to share a number today. See
`fixtures/f1-pricing-boundary-cases.json` for the exact truth table (91/90/89 days, cutoff
day's first and last instant, a fractional-rand rounding case, and the SAST-vs-UTC
disagreement case) and `fixtures/f1-broken-naive-utc-fixture.json` for the negative-control
companion.

## 3. Timezone ruling — SAST (+02:00), evaluated exactly like the vendor-stand precedent

`deriveAdmissionEarlyBirdCutoffIso(showStartDate)` must produce an ISO string with an
**explicit `+02:00` offset**, never bare UTC/`Z` — same rationale as
`deriveVendorStandEarlyBirdCutoffIso()`: a Firebase App Hosting container runs UTC, and
Firestore/Cloud Logging timestamps are UTC, so a bare-UTC cutoff boundary would silently land
2 hours off from the SAST calendar day Brad actually means. 90 days before the show's
confirmed start (`2027-09-16`, per the live `show-19-2027` Sanity document's `startDate:
2027-09-16T09:00:00+02:00`) is `2027-06-18` — matching the mission text's own stated cutoff
verbatim, confirming the arithmetic. The boundary is evaluated in SAST, not UTC and not
server-local time (the dev machine is SAST, which is a coincidence, not the reason — the
reason is the show's own calendar day, and that calendar day is defined in SAST because
that's the venue's timezone).

## 4. Taxonomy — 7 categories, exhibitor entry deliberately unresolved

`TicketCategory` = the exact 7 names in the mission goal string. `TICKET_CATEGORY_PURCHASE_SURFACE`
maps each to the *existing* Sanity `ticketType.category` enum (`admission` / `conference` /
`workshop-field-trip`) that already gates which public page a ticketType document appears on
— this is a new, finer classification layer sitting above that enum, not a replacement of it.

**Exhibitor entry: deliberately unresolved.** Exhibitor Entry's real purchase surface is
`/national-show/exhibitors`, inside `app/(marketing)/national-show/**` — a tree this mission
is barred from touching (F5's negotiated boundary with session `saocnosdesign-ea`). Which of
the 3 schema `category` values (if any) an exhibitor `ticketType` document should carry is
genuinely undecided pending F5's component-API handoff. `TICKET_CATEGORY_PURCHASE_SURFACE.exhibitor`
is the **explicit** literal `'unresolved-nos-boundary'`, never silently defaulted to
`'admission'` or any other schema value — a silent default here would be exactly the kind of
invented eligibility relationship the mission's anti-fabrication constraint targets (Brad:
"no invented ... eligibility relationship"). A9/A-negative-default assertion enforces this.

## 5. What this contract does NOT decide (Brad's / a later feature's call)

- **VIP price ladder** (VIP R300 vs Weekend Pass R400/R380, described as including the full
  weekend plus a reception). Live-dataset audit (2026-09-08) confirms VIP is genuinely R300
  live today — `scripts/fix-vip-and-weekend-pass-pricing.ts`'s R480 patch was written but
  **never run** against the live Sanity dataset. F1 changes nothing about any specific
  product's price — it only ships the generic `basePrice → discounted-or-full` function.
  Brad/Lee-Ann's call, per the mission's own "Known-open questions."
- **Which SKU's price becomes the `basePrice` anchor** for `early-bird` (currently R130, no
  regular-price sibling) and for `weekend-pass` (live: TWO active SKUs today,
  `weekend-pass` R400 flat and `early-bird-weekend-pass` R380, cutoff `2027-07-31` — note that
  cutoff is NOT the mission's 90-day `2027-06-18` figure, a second live inconsistency the
  merge must resolve, not just the R380-vs-R400 one). This is an F2 (seed/schema) decision,
  not F1's.

  **HARD RULE (team lead, 2026-09-08, supersedes the "seed script must be idempotent" framing
  in the mission brief): there is only ONE Sanity dataset (`production`) — confirmed via the
  project's dataset-list API. Local `next dev` and the deployed beta site read the SAME data.
  Any seed/migration/patch this mission RUNS is therefore a deploy by side-effect, which
  contradicts Brad's explicit "local only, not deployed" instruction (he is asleep and cannot
  approve it). F2's migration must be CODE + a script only — written and unit-tested, but its
  real execution against the live dataset is explicitly OUT OF THIS MISSION'S SCOPE, deferred
  to a step Brad approves himself in the morning (F8).** Concretely, F2's contract must
  require:
  - The script defaults to a dry-run / `--verify`-style read-only mode; it refuses to mutate
    anything without an explicit flag (e.g. `--apply`) that this mission never passes.
  - No mutating Sanity client (`.commit(`, `.patch(`, `createOrReplace`, `createIfNotExists`)
    is constructed on any code path reachable without that flag.
  - Verification of live state is by QUERY ONLY, never by "write a value then read it back" —
    matching this mission's own read-only audit method (the 2026-09-08 live-dataset audit
    that produced every fact below queried Sanity/Firestore directly and wrote nothing).
  - **Migration hazard, quantified from Firestore (real constraint, not hypothetical)**: 39
    ticket positions exist; retired slugs (`adult` 14, `exhibitor` 7, `pensioner` 1) already
    have real positions against them and are already handled correctly by "retire, don't
    delete" — working precedent. **`early-bird-weekend-pass` has 1 REAL ticket position** —
    the migration script must NEVER delete or rename that slug, only ever flip
    `active: false`; `weekend-pass` has 0 positions, so reshaping it is comparatively low-risk.
    F2's contract should assert this as code, not prose: fail if the migration script's source
    contains a delete call or a slug-rename for any SKU known to carry existing positions.
  - The 5 admission SKUs all carry live `category: null`, working today only because
    `activeTicketTypesByCategoryQuery` has a null-means-admission fallback (load-bearing and
    fragile). Setting these explicitly is in scope for the migration's dry-run design, but
    still gated by the same apply-flag rule above — no exception for "just a category field."
  - Show start for the 90-day math is Sanity's own `show-19-2027.startDate =
    2027-09-16T09:00:00+02:00` (already carries an explicit SAST offset) — use that stored
    value as the authoritative source, don't invent a second timezone convention.
- **Sunset Cocktails / Field Trip real-figure adoption.** Lee-Ann's doc gives real prices
  (Cocktails Single R800/Couple R1500, Field Trips flat R200) that differ sharply from the
  currently-seeded "our estimate, no client source" figures (R250/R450, R300/R750 split).
  Recommend F2 seed the doc's real, cited figures rather than keep the known-fabricated
  estimate, but list it explicitly in F8's review as a changed figure — never apply silently.
- **council@ vs info@ enquiry address.** Untouched by F1.
- **Refund-policy conflict**: `/refunds` promises a tiered 90/50/0% schedule on admission;
  Lee-Ann's doc says admission is flatly non-refundable and workshops/conferences get a
  binary 60-day cutoff. Pre-existing conflict, not created by this mission, not F1's to fix.
- **Max 5 tickets per booking contact** and **workshop/field-trip time-overlap prevention**
  (both real requirements in Lee-Ann's doc, absent from the mission's F1-F8 list) — genuine
  scope gaps. Recommend folding both into F4 (checkout/capacity wiring) rather than a later
  mission, since both are checkout-time validation rules with no UI or schema dependency;
  they do not touch F1's pure module and are out of this contract's assertions.
- **F7 test-framework choice** (recorded here since F1 sets the precedent F7 must follow):
  continue the established `contracts/checks/<slug>/*.mjs` + `node --import tsx/esm`
  convention for pure-function unit coverage (15+ existing precedent directories, zero new
  dependency, already proven on `vendor-stand-pricing.ts`'s equivalent boundary tests) AND
  stand up a real `playwright.config.ts` for the browser/nav coverage Brad explicitly asked
  for (`playwright` is already a devDependency with no config using it today) — a second unit
  -test framework (vitest) would be redundant given the `.mjs` convention already works well
  for pure functions; Playwright has no existing substitute and was explicitly requested.

## 6. Real-vs-provisional citation distinguishability (for F2 onward)

Every `ProvisionalAdmissionProduct`-shaped record going forward must be traceable to exactly
one of: (a) a cited figure from a named SAOC/Lee-Ann source document, or (b) an explicit
web-team estimate with no client source. F1 itself introduces no priced product, so it adds
no such record — this is a requirement for F2's seed module to satisfy, recorded here so F2
doesn't have to rediscover it: add an optional `sourceCitation: string | null` field to
`ProvisionalAdmissionProduct` (`lib/provisional-figures.ts`) — `null` only for a genuine
web-team estimate, otherwise a short citation string (e.g. `"Lee-Ann's Ticketing system
details.docx, line 305"`). This makes "cited fact" vs "our guess" mechanically checkable
(grep for `sourceCitation: null` vs a non-null string) rather than something a future reader
has to remember from a code comment.

## 7. Security note (out of scope, flagged for maintainer/Brad, not acted on)

The 2026-09-08 live-dataset audit reported an unexpected line printed by the `dotenv` package
at import time referencing an external domain (`www.vestauth.com`) not expected from a
standard `dotenv.config()` call. Not investigated further, not acted on, no data sent
anywhere — flagging here only so it reaches this contract's readers; recommend a maintainer
check `node_modules/dotenv`'s installed version and integrity against `pnpm-lock.yaml`,
independent of this mission's ticketing work.
