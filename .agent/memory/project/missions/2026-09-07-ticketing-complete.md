---
schema: athanor.mission/v1
slug: ticketing-complete
goal: 'Complete the SAOC 2027 National Show ticketing system: every ticket category
  created (admission, exhibitor, workshops, field trips, SAOC Symposium, WOSA Conference,
  cocktail/reception), a computed early-bird rule (90+ days before the event = 20%
  off, cutoff 2027-06-18) replacing the separate early-bird products, provisional
  capacities for every category, plus a rebuilt site-wide navigation covering all
  sections including the Members Portal placeholder. Self-testable: unit tests for
  pricing/capacity and Playwright coverage for every purchase surface. Built and verified
  locally overnight; NOT deployed. Deliverable ends with a morning review walkthrough
  for Brad.'
created_at: '2026-09-07T21:31:34.807614+00:00'
started_at: '2026-09-07T22:07:41.720010+00:00'
last_active_at: '2026-09-08T12:42:31.069594+00:00'
status: in_progress
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F2
  ts: '2026-09-08T12:42:31.069594+00:00'
features:
- id: F1
  inline_brief: 'Pure, dependency-free pricing + taxonomy module. Define every ticket
    category (admission day/weekend/VIP, exhibitor entry, workshop, field trip, SAOC
    Symposium, WOSA Conference, cocktail/reception) and a computed early-bird rule:
    purchases 90+ days before show start (2027-09-16) get 20% off, cutoff 2027-06-18.
    Replaces the separate early-bird PRODUCTS with one product each carrying a time-based
    discount. Must be a pure function of (basePrice, purchaseDate, showStart) so it
    is trivially unit-testable with no network, no Sanity, no clock dependency injected
    implicitly. Include boundary tests: exactly 90 days, 89, 91, cutoff midnight,
    and timezone (project machine is SAST +2, Firestore/Cloud Logging are UTC).

    '
  name: Ticket taxonomy + computed early-bird pricing engine (pure, unit-tested)
  status: done
  started_at: '2026-09-07T22:07:41.719610+00:00'
  completed_at: '2026-09-08T12:42:31.069376+00:00'
- id: F2
  inline_brief: 'Extend the Sanity ticketType schema and seed so every category from
    F1 exists as a document. Capacities are UNKNOWN for all categories: seed a sensible
    guess and mark it with the existing `provisional` field plus `data-placeholder`
    so real numbers are trivially findable later. Seed script must be idempotent and
    must key _id on stable identity (category/slug), never on a mutable display name
    — a prior defect. Do not reintroduce any fabricated fact.

    '
  name: Sanity ticketType schema + seed for every category, provisional capacities
  status: in_progress
  started_at: '2026-09-08T10:10:14.420127+00:00'
- id: F3
  inline_brief: 'Purchase surfaces for the new categories under /tickets/** ONLY.
    Must not create or edit anything under app/(marketing)/national-show/**. Compose
    from existing components; the main site''s style is frozen. Every surface needs
    loading, error and empty states.

    '
  name: Category purchase surfaces under /tickets (workshops, symposium, WOSA, field
    trips)
  status: pending
- id: F4
  inline_brief: 'Checkout and availability wiring for the new categories: capacity
    checks, sold-out state, and the existing PayFast/order path. Reuse the established
    order/reservation flow rather than inventing a parallel one. Firestore writes
    must never leave undefined own-properties (documented prior defect class).

    '
  name: Checkout + capacity/availability wiring for the new categories
  status: pending
- id: F5
  inline_brief: 'Publish a documented component API + data contract for the NOS session
    (saocnosdesign-ea) to render ticket surfaces inside national-show/** itself. Deliverable
    is the API plus a written note of what changed vs the old shape — specifically
    that ''lowest-ordered admission product'' selection and the static early-bird
    cutoff line become computed state. Do NOT preserve the old field shape for their
    benefit; build the right model and hand over the contract.

    '
  name: Component API handed to the NOS session (no edits inside national-show/**)
  status: pending
- id: F6
  inline_brief: 'Rebuild components/chrome/nav-config.ts and the header/mobile/footer
    nav so every section in Lee-Ann''s structure is reachable and the menu is genuinely
    navigable — Brad''s ''proper beautiful menu system''. This is the ONE sanctioned
    exception to the main-site style freeze. Must include the Members Portal entry
    and remove the invented ''Learn'' item. Coordinate the NOS sub-nav shape with
    saocnosdesign-ea before finalising; that session builds its section routes against
    whatever shape is chosen. Also fix the footer Subscribe horizontal-overflow bug
    at 1024-1050px.

    '
  name: Rebuilt site-wide navigation covering every Lee-Ann section + Members Portal
  status: in_progress
  started_at: '2026-09-08T10:10:16.073114+00:00'
- id: F7
  inline_brief: 'Self-tests, because Brad asked for the work to be self-testable.
    Unit tests for the F1 pricing engine including the boundary cases. Playwright
    coverage over every ticket surface and the new nav at 390/1280, asserting falsifiable
    properties (no horizontal overflow at any tested width, every nav target returns
    200, sold-out and empty states render, no fabricated-content markers). Tests must
    fail loudly when the property breaks — verify each test actually fails against
    a deliberately broken input before trusting it.

    '
  name: Self-tests — unit (pricing/capacity) + Playwright across every surface
  status: done
  started_at: '2026-09-08T10:10:17.608406+00:00'
- id: F8
  inline_brief: 'A morning review walkthrough for Brad: ordered steps through the
    local site, what to look at on each, screenshots at 390 and 1280, the open decisions
    needing his call (VIP price ladder, council@ vs info@, capacities, any placeholder
    he must replace), and what is deliberately unfinished. Published as an artifact
    so he can step through it on any device.

    '
  name: Morning review walkthrough for Brad (ordered steps + screenshots)
  status: in_progress
  started_at: '2026-09-08T10:10:18.000000+00:00'
milestones:
- id: M1
  name: Ticketing foundation — taxonomy, pricing engine, schema, seed
  features:
  - F1
  - F2
  status: pending
- id: M2
  name: Purchase surfaces + checkout for all categories
  features:
  - F3
  - F4
  - F5
  status: pending
- id: M3
  name: Navigation across every section
  features:
  - F6
  status: pending
- id: M4
  name: Self-tests green + morning review ready
  features:
  - F7
  - F8
  status: pending
force_orphaned_at: '2026-09-09T21:20:16.235939+00:00'
---

# Mission: Complete the SAOC 2027 National Show ticketing system: every ticket category created (admission, exhibitor, workshops, field trips, SAOC Symposium, WOSA Conference, cocktail/reception), a computed early-bird rule (90+ days before the event = 20% off, cutoff 2027-06-18) replacing the separate early-bird products, provisional capacities for every category, plus a rebuilt site-wide navigation covering all sections including the Members Portal placeholder. Self-testable: unit tests for pricing/capacity and Playwright coverage for every purchase surface. Built and verified locally overnight; NOT deployed. Deliverable ends with a morning review walkthrough for Brad.

## Context

### Authority
Brad, 2026-09-07: "we have a firmer foundation for how we want the ticketing system to
work... the exhibitor/vendor ticketing system is almost dialed in. We need to complete the
rest of the ticketing flow for all the other tickets, workshops, WOSA conference, all
that. Don't stall on not having information — if you're missing any key information, add a
placeholder... We're going to work on 90 days before the event, we'll still qualify as
early bird and get a 20% discount... I want all the ticketing types at least created. I
want a proper beautiful menu system so it's easy to navigate through all the different
sections... plan the mission so that the code and all the changes you make are
self-testable... do all of this work overnight into the local site, then plan a review for
me to step through in the morning."

### Hard constraints
1. LOCAL ONLY. Do not deploy. Do not push to origin/main without explicit instruction.
   Brad reviews locally in the morning.
2. MAIN SITE STYLE IS FROZEN. Brad: "the style is already dialed in, we shouldn't be
   restyling anything on the main site — the design work is only landing on the national
   orchid shows section." The ONE sanctioned exception is navigation, which he explicitly
   asked to be rebuilt ("a proper beautiful menu system").
3. DO NOT EDIT app/(marketing)/national-show/** AT ALL. Negotiated boundary with session
   saocnosdesign-ea: we deliver the data layer + a component API; that session owns all
   markup inside national-show/**. It also owns app/admin/** and components/admin/*.
4. NO FABRICATED FACTS. Unknown values are placeholders marked `provisional` +
   `data-placeholder`, never invented. No invented dates, fees, names, venues, capacities
   presented as real. `data-placeholder` is load-bearing — integrity checks assert on it.

### Pricing model change (the core of F1)
Early bird = purchased 90+ days before the event = 20% off. Show opens 2027-09-16, so the
cutoff is 2027-06-18. This REPLACES the current model of separate early-bird products
("Early-Bird Exhibition" R130 / "Early-Bird Weekend Pass" R380 sitting alongside "Weekend
Pass" R400). Those collapse into one product each with a computed, time-based discount.

### Known-open questions — escalate, never guess
- VIP is R300 while the plain Weekend Pass is R400, yet VIP is described as including the
  full weekend plus a reception. Incoherent ladder. Brad/Lee-Ann's call.
- Two general-enquiry addresses live simultaneously: council@saoc.co.za and info@saoc.co.za.
- All ticket capacities are unknown. Brad: put in a sensible guess, clearly provisional.

### Known defect to fix in this mission
Footer "Subscribe" button causes horizontal page scroll at 1024-1050px. Reported by
saocnosdesign-ea; SAOC chrome, ours. Mobile-first rule says no horizontal overflow.

### Baseline site structure (Lee-Ann's Drive, read via gws 2026-09-07)
SAOC folder = 6 sections: 1 Home, 2 About, 3 Societies, 4 Calendar of events,
5 Members Portal, 6 Judging. Only Members Portal had no route; being added as a phase-two
placeholder with a suggestions form.
National Show folder = 13 numbered folders (2 About, 5 International Exhibitors, 6 SAOC
Symposium, 7 WOSA Conference, 11 Program of events have no routes) — that section's gaps
belong to saocnosdesign-ea, NOT to this mission. Numbering gaps 8/9/10/14/16 have no
folder yet; spec v3 lines 18-28 fill some.

## Notes


### QUEUED FIX — /members fabricated membership claim (found 2026-09-08 by orchestrator review)

`app/(marketing)/members/page.tsx` currently asserts:

  "SAOC membership is held through an affiliated society. If you belong to one of the 21
   affiliated societies, you are already part of SAOC."

NOTHING SOURCES THIS. It is an invented claim about how membership works, and the spec
suggests it is WRONG:
  - spec v3 line 83: "Join button for prospective members"  -> implies DIRECT membership
  - spec v3 line 132: "Confirm with INUNU how membership status will be verified and kept
    in sync with SAOC's membership records" -> SAOC keeps its OWN membership records
  - spec v3 line 125 (§3.5): "restricted area for paid-up SAOC members"

Fix: remove the claim. Do not replace it with the opposite claim — how one becomes a
paid-up SAOC member is NOT established by any source we hold. Say only what is supported:
the Portal will be a restricted area for paid-up members giving access to digital Journal
issues, it is not yet available, and route the reader to /contact to ask.

ESCALATE TO BRAD: is SAOC membership direct, via an affiliated society, or both? Spec line
132 says this must be confirmed with INUNU. Until answered, the site must not state either.

Blocked at time of discovery by require_contract_for_write.sh (app/ is not a safe zone);
do this as soon as contract-f1.yaml lands and the gate clears.

### CONTENT CONSTRAINT — Symposium date/venue undecided at SOURCE (analyst, 2026-09-08)

Lee-Ann's FAQ doc (recovered from a damaged Drive zip; local file headers intact, md5 matched
Drive's own checksum so the damage is in Drive, not the transfer) contains, verbatim, inside
her own Q1 answer:

  "The symposium will be held on xx, xx September 22027 at the xx"

That is a placeholder INSIDE the source document. The Symposium date and venue are therefore
undecided on Lee-Ann's side — not merely unknown to us. Consequence for F2/F3: the SAOC
Symposium ticket type carries NO date and NO venue, marked absent (`provisional` +
`data-placeholder`). It must NOT inherit the show's own dates (2027-09-16..19) as a stand-in;
that is precisely how the CTICC venue placeholder once propagated across six fields.

Q2 of the same doc confirms the show venue only: "Stellenbosch Flying Club, R44 northbound to
Stellenbosch". Q3 onward is empty rows. Searched full decompressed text for refund/ticket/
cancel: zero matches — the doc does NOT speak to ticket eligibility, inclusions or refunds.

### STILL OPEN — admission refundability (no new evidence either way)

Lee-Ann's ticketing doc says admission is NON-REFUNDABLE. Our live /refunds page publishes a
tiered refund schedule. The FAQ doc does not touch it. Neither claim goes on a ticket surface
until Brad rules. Carry into the F8 decisions list.

### RESOLVED-AS-UNKNOWABLE — SAOC membership model (analyst, 2026-09-08)

No source we hold settles whether SAOC membership is direct, via an affiliated society, or
both. Checked, in order:

1. **Constitution — the authoritative source — is not in our possession.** /constitution's own
   page says the text "has not been supplied for this site... will be updated once it is
   received from the Council." Nothing in content/drive-source/ either.
2. **Lee-Ann's Members Portal Drive folder is completely empty** — no files at all.
   Her "2. About" doc is a founding-history narrative; it repeatedly frames SAOC as acting
   "through its affiliated societies" but never states that society membership confers SAOC
   membership. It does not address individual membership at all.
3. **Spec v3 cuts the other way** from tonight's invented claim: a "Join button for prospective
   members" distinct from the society directory (l.83), "visitors AND members" as two groups
   (l.103), and "SAOC's membership records" needing sync (l.132) — a register that would not
   need to exist if membership were simply inherited from society affiliation. This does not
   prove direct-only membership (hybrid is possible; societies may be institutional members
   while individuals separately join) but it does establish SAOC tracks membership itself.

**Site rule until Brad/Lee-Ann answer: state NEITHER model.** Note the analyst's proposed
phrasing ("...and separately maintains its own individual membership") is itself an inference
from spec v3, NOT an established fact — do not adopt it. The page says what the Portal will be,
that it is not yet available, and routes to /contact. Nothing about how one becomes a member.

FOR THE F8 DECISIONS LIST — ask Brad: is SAOC membership direct, via an affiliated society, or
both? Spec l.132 says this must be confirmed with INUNU. Requesting the constitution text from
the Council would settle it permanently and unblocks /constitution too.

Related, pre-existing, NOT changed tonight: app/(marketing)/about/page.tsx:64 timeline node
("Membership expands steadily across all nine provinces as new societies affiliate") carries
the same conflation. It is already `placeholder: true` and renders a "Detail pending
confirmation" badge, and it predates this mission. Logged, deliberately left alone — /about is
outside this mission's scope and the main site is frozen.

### LIVE HAZARD — six migration scripts MUTATE the shared production dataset by default

Found by @architect while contracting F2 (`scripts/fix-vip-and-weekend-pass-pricing.ts:79`);
orchestrator swept the directory and it is not one script, it is six:

    scripts/fix-venue-never-changed-copy.ts:77
    scripts/migrate-ticket-type-category.ts:102
    scripts/migrate-show-sales-fields.ts:86
    scripts/fix-vip-and-weekend-pass-pricing.ts:79
    scripts/fix-show-dates-2027.ts:80
    scripts/fix-visitor-info-dates-confirmed.ts:76

All use `const DRY_RUN = process.argv.includes('--dry-run')`. The polarity is inverted: the
no-flag invocation WRITES, and you must remember a flag to stay safe. There is only ONE Sanity
dataset (`production`), read by both local dev and the deployed site, so a bare `npx tsx
scripts/<any of these>` changes the live site immediately with no deploy step.

Worse: in `fix-vip-and-weekend-pass-pricing.ts` the mutating `createClient()` is constructed at
module top level (l.70-77) BEFORE the DRY_RUN check (l.79) — so even the "safe" invocation
builds a write-capable client. A crash, a refactor, or an early call site is all that stands
between a dry run and a live patch.

Three scripts already do it correctly (`--apply` to mutate): seed-fictional-test-show.ts,
seed-demo-ticket-type.ts, swap-active-show.ts. So the safe pattern exists in-repo and was
simply not applied consistently.

F2's `scripts/migrate-f2-ticket-taxonomy.ts` is contracted with the correct polarity — default
dry-run, `--apply` the only mutating path, flag checked BEFORE any client construction or env
read (contract-f2 A3 proves it by running with Sanity env vars unset and requiring exit 0).

FOR BRAD'S MORNING LIST — decision, not a silent fix: bring the six inverted scripts to
`--apply` polarity, or delete the ones that have already served their purpose. Deliberately NOT
changed overnight: these are outside this mission's scope and several may have already been run
against live data, so flipping their behaviour unreviewed is its own risk.

### MISSION RE-ORDER (orchestrator, 2026-09-08) — F7 moves ahead of F3/F4

F7 (self-tests) was scheduled last, in M4, AFTER the four new purchase surfaces F3/F4 build.
That is backwards. Tests written after the code they cover get shaped to confirm whatever the
implementation happens to do; Brad asked for work that is "self-testable" while being built,
not audited afterwards. F7's contract is now being written ahead of F3.

Consequence: F3 and F4 land verified by a harness that already exists, and the known footer
overflow defect at 1024-1050px becomes a RED test on day one rather than a bug report.

Milestone membership is unchanged on paper (F7 still listed under M4); only the build order
moved. Not rewriting the milestone structure mid-mission — the checkpoint trail matters more
than tidy grouping.

### F1 STATUS (2026-09-08, orchestrator-verified, NOT committed)

12/12 contract assertions pass — re-run individually by the orchestrator, not taken from @dev's
report. `npx tsc --noEmit` exit 0. `bun run build` exit 0 (first attempt collided with a
concurrent build's lock; that was a concurrency artifact, clean on retry). Codex GPT-5.5
returned PASS with no findings on both `lib/admission-early-bird-pricing.ts` and
`lib/ticket-taxonomy.ts`.

Two defects were caught and fixed DURING implementation, both worth remembering:
1. `deriveAdmissionEarlyBirdCutoffIso` did SAST calendar arithmetic on UTC calendar components.
   Correct only because the real show start (09:00 SAST) falls on the same date in both zones;
   a start before 02:00 SAST would have slid the cutoff to 2027-06-17 silently. NOTHING in the
   original fixture set could catch it — every case used a safely mid-morning start. Fixed by
   shifting the instant by the SAST offset before reading Y/M/D. New assertion A12 +
   `check-cutoff-derivation.mjs` now cover it.
2. `ADMISSION_EARLY_BIRD_CUTOFF_DAYS_BEFORE_SHOW` briefly read 89 instead of 90.

Lesson (generalises beyond this mission): a fixture set where every case passes under both the
correct and the naive implementation proves nothing, however many cases it has. The architect's
follow-up sweep graded all 7 pricing cases and found 5 discriminate, 2 are baseline-only — now
labelled as such in the fixture itself rather than silently counted as boundary proofs.

### TESTING HAZARD — POST /api/contact has a live email side effect (found 2026-09-08)

Proving the /members suggestion form end-to-end required a real POST to `/api/contact`. That
route writes to Firestore `contactSubmissions` AND sends a confirmation email via Resend to
whatever address was submitted. The test used `qa-members-portal-test@example.com`, so a
delivery attempt went out to a non-existent address at a reserved domain.

Two consequences:
1. A test document landed in the live `contactSubmissions` queue with `status: "new"`, alongside
   real enquiries from real people. Ordered deleted by exact doc id (itObDm976jh2oaHCF26i) —
   single-document delete only, no query-and-sweep.
2. Bounces accrue against the sending domain's reputation. This project is mid-migration on
   domain + Resend DNS, which makes that worse than it would normally be.

The route catches send failures as non-fatal, so the 201 was genuine and the write path is
sound. The hazard is the side effect, not a defect.

**Bearing on F7:** any Playwright coverage that submits a form on this route sends real email.
F7 needs either a test-mode guard on the route or a mocked mailer BEFORE form coverage is
written, or every CI run mails a stranger. Fold into F7's contract.

### F1 QA VERDICT: PASS — with two assertions broken by mutation testing (2026-09-08)

Code verdict: both lib modules are correct. QA verified empirically, not by inspection —
`Date.UTC` negative-day normalisation across year and leap-February boundaries, the exact
exclusive-end instant, the early-morning SAST start, purity, and no float divergence across the
real R104-R900 price catalogue (tested `basePrice*0.8` and `basePrice*80/100`; identical).
It also independently reproduced the "A5/A6 blind, A12 catches it" pairing BEFORE reading
@dev's report — two independent methods, which is what makes that result trustworthy.

But two assertions were broken by mutation, both this repo's audited class:

1. **A8** — `grep -q "unresolved-nos-boundary" lib/ticket-taxonomy.ts` only requires the string
   to appear somewhere in the file. A mutant setting
   `TICKET_CATEGORY_PURCHASE_SURFACE.exhibitor = 'admission'` (the exact silent default A8
   exists to prevent) while leaving the const declaration at l.51 intact STILL PASSED A8.
2. **A4** — keeping the `isWithinEarlyBirdWindow` import line satisfies both greps even when the
   calculation calls a locally reimplemented comparator. QA's mutant was behaviourally wrong so
   A5 caught it by luck; a behaviourally IDENTICAL copy-paste would pass A4, A5, A6 and A12
   simultaneously, because none of them test provenance — which is A4's whole stated purpose.
3. A1 (minor) — its description says "no more, no fewer" categories; it enforces only "no fewer".

**THE LESSON, and it is the important one from this mission so far:** F1's code was correct,
12/12 assertions were green, and Codex GPT-5.5 passed it clean with no findings. The properties
those assertions guard were true *because the code happened to be written correctly*, not
because anything was enforcing them. Every green signal was accurate and the guard rails still
bore no weight. Only mutation testing could tell the difference.

Generalises: a gate proves a property only if you have watched it fail when that property is
violated. "It passes" and "it enforces" are different claims, and the gap between them is
invisible from every green run. Sandbox mutants left at `.tmp/sandbox/qa-mutation/`; @dev must
prove each tightened assertion goes red against those exact mutants, since they already pass.

### PRE-EXISTING RED GATE — check-workshop-products.mjs was already failing before F2

Codex flagged that `contracts/checks/ticketing-workshops-f2/check-workshop-products.mjs` fails
against F2's changed data. Investigated; the failure splits three ways and only two are ours:

CAUSED BY F2 (legitimate, expected):
  - "expected 4 products, got 3" and the two missing slugs `field-trip-single` /
    `field-trip-all-outings`. F2 deliberately retired those two SKUs — they encoded an INVENTED
    R300/R750 bundle split, replaced by one flat R200 Field Trip product cited to Lee-Ann's doc.
    The check asserts the old, fabricated shape. It must be updated, not the data reverted.

NOT CAUSED BY F2 (pre-existing, and the more interesting finding):
  - "sunset cocktails: worst-case simultaneous sellout ... never exceeds venue head capacity
    (200): expected true, got false".

    The check computes `single.capacity * 1 + couple.capacity * 2`. Verified against
    `git show HEAD:lib/provisional-figures.ts`: at HEAD, SUNSET_COCKTAILS_POOL_CAPACITY = 200
    and BOTH cocktail products carry `capacity: 200` with `capacityPool: 'sunset-cocktails'` and
    `headcountPerUnit` of 1 and 2. So the check computed 200*1 + 200*2 = 600 > 200 and failed
    BEFORE F2 touched anything. F2 did not change either cocktail capacity.

    This is a FALSE POSITIVE, not a real oversell. The data moved to a shared capacity-POOL
    model (both products draw from one 200-head pool, weighted by `headcountPerUnit`); the check
    still assumes two independent caps that sum. The check is stale with respect to the model.

**The real finding: a contract check from a previous mission has been RED in this repo and
nobody noticed.** A gate that fails unobserved is worth less than no gate, because its green
history is cited as evidence. Whatever runs these checks either does not run this one, or its
failure goes somewhere unread. Worth establishing which, before F7 adds nineteen more.

I initially read the head-capacity line as a live venue-oversell risk. It is not — but the
distinction took a `git show` against HEAD to establish, and asserting it either way without
that check would have been guessing.

### ANSWERED — nothing runs the contract checks. Ever. (orchestrator, 2026-09-08)

I asked what runs `contracts/checks/**`. The answer is: **nothing does.**

`.github/workflows/ci.yml` runs exactly four things — `pnpm lint`, `pnpm type-check`,
`pnpm build`, plus two residue guards (`scan-dataset-residue.ts`, `scan-firestore-residue.ts`,
the latter SKIPPED because its Firebase admin secrets were never configured, which the workflow
itself warns about). `package.json` has no `test` script. Nothing in CI, the Makefile, or
`execution/` references `contracts/checks` at all. Grep returns zero.

So every contract assertion in this repo runs at exactly one moment: when an agent manually
invokes `contract.py` during the feature that created it. After that it is never run again.
There is no regression detection. That is why `check-workshop-products.mjs` could go red and
stay red without anyone learning.

Compounding it, ci.yml's own comment states: "main has no branch protection, so a red push/PR
job blocks nothing."

**Consequences worth stating plainly:**
1. A green contract gate is a point-in-time measurement, NOT a standing guarantee. Historical
   "12/12 green" claims in this repo mean "green on the day it was written."
2. F7 will add 19 assertions to a directory nothing executes. Standing up Playwright without
   wiring it into CI produces tests that rot exactly the way these did — and worse, whose
   existence is cited as proof of coverage.
3. This substantially raises F7's value, and changes its shape: F7 must include a runner that
   executes the checks (a `test` script) AND a CI job that invokes it. Otherwise F7 delivers
   the appearance of a safety net.

FOR BRAD'S MORNING LIST: main has no branch protection, so even a wired-up CI failure blocks
nothing. Enabling it is a GitHub setting, not a code change, and it is his call.

### QUEUED CONTRACT REQUIREMENT — F6 must flip F7's A8 (added 2026-09-08 by architect)

`contract-f7.yaml`'s A8 is deliberately INVERTED: it is green exactly when the footer
Subscribe horizontal-overflow test at 1024-1050px is RED (proving the harness actually
detects the known live defect, not a vacuous pass). F6's own brief includes fixing that
exact defect. The moment F6 lands correctly, A8 will fail -- by design, because F6 did
precisely what it was asked to do.

**Whoever writes `contract-f6.yaml` MUST include an assertion in it that flips F7's A8 to
its non-inverted form** (drop the leading `!` in `contract-f7.yaml`'s A8 command, so it
passes only once the footer sub-test is GREEN) as part of F6's own required checks. This is
not optional cleanup — without it, the most likely outcome is someone sees A8 fail after F6
ships, assumes the inversion is stale, and deletes the assertion along with the coverage it
provides. See `contract-f7.yaml`'s A8 description for the full rationale. This note exists so
the requirement survives even if a different architect ends up writing F6's contract.

### REFUND CONFLICT CONFIRMED IN CODE (2026-09-08) — was previously "open, no evidence either way"

Earlier tonight the analyst searched Lee-Ann's FAQ doc for refund/ticket/cancel and found zero
matches, leaving the admission-refundability conflict open with no corroboration either way.
@architect has now confirmed the OUR-SIDE half directly, by reading the code rather than
inferring it:

`lib/provisional-figures.ts` -> `PROVISIONAL_REFUND_POLICY` has `appliesTo` INCLUDING
`'admission'`, with real tiered percentages (90% / 50% / 0%).

So this is a genuine contradiction between two things we actually hold, not a gap in our
knowledge:
  - Lee-Ann's ticketing document: admission is NON-REFUNDABLE.
  - Our own live /refunds page + PROVISIONAL_REFUND_POLICY: admission IS refundable, on a
    tiered schedule.

Both are published positions. One of them is wrong and a customer could rely on either.
This is now a HIGH-priority decision for Brad, not a documentation tidy-up: it is the kind of
discrepancy that surfaces during a dispute, when the refund is already being demanded.

Note the policy is named `PROVISIONAL_...` — so our side may never have been council-approved
in the first place, which would make Lee-Ann's document the authoritative one. Do NOT assume
that; it is exactly the kind of inference that has gone wrong repeatedly this mission. Ask.
