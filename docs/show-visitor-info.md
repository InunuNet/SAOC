# Show Visitor Information — `/national-show/plan-your-visit`, `/what-to-expect`, `/faq`

Technical reference for the National Show visitor-information section. For the plain-language
editor guide, see [`show-visitor-info-for-editors.md`](./show-visitor-info-for-editors.md).

**Status: not deployed.** This lives on the dev site only (`http://localhost:3333` in this
mission's checks). There is no live domain yet, and nothing described here has been shown to the
SAOC committee for confirmation.

Contract: `contracts/contract-show-visitor-info.yaml` — 71/72 assertions passed as of the last
recorded run (2026-08-12); a confirming gate run was in progress at the time this doc was
written and its final result is not independently verified here. Treat "72/72 green" as the
mission's target, not yet a confirmed fact — check the contract's own history for the final
number.

---

## Why this exists

Before this mission, `/national-show` was a single teaser landing page and ticketing (a prior
mission) already sold entry to a show the site barely described. Brad's brief: add the visitor-
preparation basics — getting there, what to expect, FAQs — without building the client spec's
full 18-page National Show section (see **Scope context** below).

## Scope context — the commercial flag

`Website Development SpecificationV1.docx` §4 describes an 18-page National Show section. The
accepted proposal (`SAOC_Website_Proposal_28-05-2026.docx`) priced one line: *"2027 Show hub —
dedicated landing page (venue, dates, programme, FAQs), editable as details are confirmed."* A
single landing page carrying venue/dates/programme/FAQ inline was what was priced; Plan Your
Visit, maps, airport travel and accommodation were specified in the client doc but never priced
in the accepted proposal. This mission deliberately built a middle path — three pages, not
eighteen — to cover the visitor-preparation intent cheaply. Anything beyond it (a filterable
exhibitor database, an interactive society map, a WOSA conference section) is a scope
conversation with the client, not something this mission decided to build.

---

## The central claim: changing the venue is a Studio edit, not a developer task

This is the mission's overriding rule, and the reason most of this section's engineering effort
went into *proving* it rather than just building pages.

**Before this work**, `/national-show`'s venue, dates, edition and countdown target were
hardcoded JSX — `nationalShow` was never read by the page at all.

**What "proving it" turned up.** QA patched the venue in Sanity to a structurally different one
(Tshwane Events Centre, Pretoria) and read every surface. Two new visitor pages and `/contact`
picked it up correctly. `/national-show` itself did not: the hero read a legacy `nationalShow.
location` string while, one screen below, the CTA sentence read the new `venue.city` — the page
showed **two different venues in the same viewport** at once. That defect is now fixed
(`app/(marketing)/national-show/page.tsx:169` prefers `venue.name`, falling back to `location`
only when `venue.name` is absent) and is what assertion **A61** exists to prove.

**A61 is the proof; A54 is only a fast fence.** This distinction matters enough to record
explicitly, because trusting the wrong one is exactly what let the defect through round 1:

- **A54** greps source files for venue literals (`CTICC`, `Cape Town International Convention`,
  etc.). It passed in round 1 *while the page was rendering two venues at once*, because the
  stale value lived in Sanity data, not in code — a grep is structurally blind to that. A54 still
  runs, as a millisecond fast fence that catches an obviously wrong code change before the slow
  check runs, but it never proves the mission rule.
- **A61** (`check-show-identity-sweep.mjs`) swaps the *whole* show identity in the live dataset —
  venue name/city/province/address, both dates, edition, host region — and unsets
  `countdownDate`, then sweeps home, landing, contact, archive and all three visitor pages over
  real HTTP, asserting every surface shows the new values and none shows a token of the old one.
  It deliberately leaves `nationalShow.location` holding the *old* venue, so any surface that
  still prefers `location` over `venue.name` is caught red-handed. It polls each surface until
  the new tokens are actually present (not a fixed sleep) before asserting, restores the dataset
  under a revision guard, and verifies the restore on the rendered page. This is the check that
  can actually fail the mission's central claim, and it does fail on the tree as it stood before
  round 2's fixes.

@dev separately proved the swap by hand, under the same dataset lock, with a guarded restore —
independent confirmation of what A61 asserts mechanically.

### The full show-identity surface inventory

Fourteen places a "show-identity fact" (venue name, city, province, dates, edition, host region,
countdown target) reaches a visitor — the complete table `check-show-identity-sweep.mjs` sweeps:

| # | Surface | Facts | Round-1 state → now |
|---|---|---|---|
| 1 | `/national-show` hero | venue name | stale (`location`) → `venue.name` first |
| 2 | `/national-show` CTA sentence | edition, month/year, venue city | already Sanity |
| 3 | `/national-show` hero meta | dates, host region | already Sanity |
| 4 | `/national-show` exhibitor-stages fallback | four date ranges | fabricated, unmarked → dates removed, rendered behind a pending marker |
| 5 | `/national-show` cycle table | current-row year/edition/host | already Sanity (past/future rows are constitutional record, see below) |
| 6 | `/national-show/plan-your-visit` | full venue object | already Sanity |
| 7 | `/contact` | full venue object (same `VenueCard`) | already Sanity |
| 8 | Home show band | dates, host region, venue name, countdown, edition | hardcoded module constants → props from `nationalShow` |
| 9 | Home hero CTA | edition, year | hardcoded → props |
| 10 | Home nav card | edition, year, month, city | hardcoded → props |
| 11 | Utility bar pill (every page) | edition, month, year | hardcoded → sourced via `app/(marketing)/layout.tsx` |
| 12 | Archive index CTA | edition, month/year, city | hardcoded → fetches `nationalShowQuery` |
| 13 | Archive year page CTA | edition, city, year | hardcoded → fetches `nationalShowQuery` |
| 14 | Countdown component | fallback date, edition in `aria-label` | fabricated fallback → renders absence; edition passed as a prop |

Two surfaces are deliberately out of scope: `app/(marketing)/national-show/exhibitors/**` and
`components/show/Exhibitor*` belong to the exhibitor stream (same defect class, handed off rather
than fixed across a live branch boundary), and `page.tsx`'s `month: 'September'` pin on every
past Sanity-sourced show is low-harm historical record needing a schema change, filed as backlog.

**Two governing rules, applied to every surface above:**

1. **Sanity is always the left-hand side of a fallback.** `sanityShow?.venue?.name ||
   sanityShow?.location || 'Venue to be confirmed'` — never `'literal' || sanityValue`, which
   would mask a published Studio edit behind a hardcoded default. Asserted by A55.
2. **A fabricated fallback is worse than no fallback.** `ShowCountdown`'s old
   `DEFAULT_COUNTDOWN_DATE = '2027-09-18T09:00:00+02:00'` was an invented date presented as a
   live ticking fact, with no pending marker, the moment an editor cleared `countdownDate`. It is
   now deleted; the component renders the absence instead. The one deliberate exception is
   `'Triennial'` on the landing hero — a standing constitutional fact about how the show cycle
   works, not a per-edition value, so it stays in code.

### The legacy `location` field

`nationalShow.location` is a plain string that predates `nationalShow.venue` and is kept, not
deleted, because `contracts/checks/cms-loop-f3-national-show` mutates it in a separate verified
round-trip check. Its status is now **fallback only, never primary**: every surface reads
`venue.name` first, its Studio field description tells editors to keep it consistent with the
venue object, and it sits immediately after `venue` in field order so the two are adjacent in
Studio. Retiring it fully (migrating that other check to a different field, then dropping
`location`) is filed as follow-up work, not done in this mission.

### `nationalShow.title` no longer embeds the edition

The seeded title was originally *"The 19th South African National Orchid Show"* — a second, silent
copy of the edition number, which also lives in its own `edition` field. Changing the edition in
Studio would have left the H1 saying "19th" forever with no code defect to find. By team-lead
ruling on A61, the seeded title is now *"The South African National Orchid Show"*; the page still
renders whatever title the dataset holds (A56), it just no longer duplicates a fact another field
owns.

### The historical carve-out on `/national-show`

The landing page's "Past editions" list names each past show's own venue from separate `show`
documents — a constitutional record no Studio edit should rewrite. One past show (2018) happens to
have been held in the current working venue's city, so A61 cuts that one `<section>` out of the
page text before testing the *city* token only (venue name, year, ordinal and roman numeral are
still swept everywhere, including inside that section). Two guards keep the carve-out from
silently widening: the check fails if the section can't be found, and fails if the excised block
exceeds 40% of the page.

---

## Content model

Three schema pieces, all in `sanity/schemas/`:

- **`documents/nationalShow.ts`** gained a structured `venue` field (type `objects/showVenue.ts`:
  name, address lines, city, province, postal code, latitude/longitude, `mapsUrl`, map image +
  alt, directions note, phone) plus `showEndDate`, `edition` and `hostRegion` — the fields needed
  to stop the remaining hardcoding (a single `showDate` can't express a date range, which is why
  the "Dates" cell used to be a literal).
- **`documents/showVisitorInfo.ts`** — a **pinned singleton** carrying every copy field the three
  new pages render: plan-your-visit copy (intro, airport routes, parking, public transport,
  accommodation, attractions, emergency contacts), what-to-expect copy (opening hours, admission
  note — cross-linked to `/tickets`, never a price — food, photography policy, cloakroom,
  accessibility), FAQ page copy (title, intro, contact note), the two marker label strings
  (`pendingLabel`, `researchLabel`, both `Rule.required()`), and a `confirmations` object with one
  status field per content block.
- **`documents/showFaq.ts`** — a repeatable document type: question, answer, category (one of
  `getting-there`, `tickets`, `accessibility`, `plant-sales`, `general`), order, its own `status`
  field (FAQs are individual documents, so per-document status is the only shape that lets the
  committee confirm answers one at a time), and `active`.
- Supporting object types: `travelRoute`, `accommodationOption` (grouped by `distanceBand`:
  walking/nearby/city/further — deliberately **no price, rating or negotiated-rate field**, since
  SAOC has no arrangement with any property and must not appear to), `attraction`,
  `emergencyContact`, `openingHoursEntry`, `confirmationStatuses`.

All new types are registered in `sanity/schemas/index.ts`; `showVisitorInfo` is pinned in
`sanity/structure.ts`, `showFaq` is a listed collection. GROQ queries: `showVisitorInfoQuery`,
`showFaqsQuery`, `nationalShowVenueQuery` in `sanity/queries.ts`.

### Seeding

`scripts/seed-show-visitor-info.ts` is a **new** script — `scripts/seed-page-singletons.ts` is
known-hazardous (it force-replaces with `createOrReplace`, silently reverting editor changes on
every run) and was deliberately not extended. `showVisitorInfo` and every `showFaq` document use
`createIfNotExists` on a deterministic `_id`; `nationalShow`'s new fields are written with
`setIfMissing`, so a re-run can never overwrite an editor's correction. Portable-text `_key`
values are derived from the document `_id`, not random, so idempotence holds. Verified twice by
QA (`_rev`/`_updatedAt` diffed across two runs — no drift, no duplicates, no empty strings) and
by contract check A24. Runnable as `pnpm seed:visitor` (added this round; previously only
runnable via `npx tsx`).

Seeded venue (client-confirmed 2026-08-12): **The Hangar, Stellenbosch Flying Club**,
Stellenbosch, Western Cape, edition 19, 16–19 September 2027, host region Western Cape. Every one
of these values is a Studio-editable field, not a code literal — see the venue-change guarantee
above. Travel/accommodation prose for this venue is deliberately unresearched (see
`contracts/golden/venue-prose-residue/README.md`) — those blocks stay `pending`, not `research`.

---

## The confirmation-status model

Every unconfirmed value carries a visible marker, same posture as the ticketing mission's
"Provisional price — pending council confirmation." Three statuses, not two, because the visitor
pages need a distinction ticketing didn't:

| Status | Means | Example |
|---|---|---|
| `pending` | Placeholder scaffolding. The committee must supply the real value. | Opening hours, parking specifics, admission conditions, photography policy, cloakroom, most FAQ answers |
| `research` | Real, verified by the web team against a confirmed venue — correct when verified, stale if the venue changes. | (Currently none; see "Seeded venue" above — travel/accommodation prose for Hangar is pending, not research) |
| `confirmed` | The committee has signed this value off. Renders with no marker. | Nothing yet |

Rendered by the shared `components/show/ConfirmationBadge.tsx` server component. Styling reuses
existing Sage & Paper tokens only (`text-muted`, `font-mono`, `border-rule`, `bg-parchment`); no
new CSS or colours. The badge is text, not colour alone — colour-only signalling fails WCAG 1.4.1
and is invisible on a printout a council member reads.

### This round's fix: the marker had an off switch

`showVisitorInfo.pendingLabel` had no schema validation, and the component's old logic was:

```ts
const label = status === 'research' ? researchLabel : pendingLabel;
if (!label) return null;
```

QA cleared `pendingLabel` in Studio — a single string field — and **all 23 pending markers
disappeared** across `/national-show` (1), `plan-your-visit` (2), `what-to-expect` (7) and `faq`
(13), while every `confirmations` value stayed `pending`. The pages then presented unconfirmed
opening hours, admission conditions, accessibility, photography policy and thirteen FAQ answers as
settled fact — in front of the SAOC council. The component's own header comment claimed it "failed
closed", and it failed closed on `status` but open on `label`.

**Fixed, both halves, neither sufficient alone:**

1. **Component fallback** — `ConfirmationBadge` now has exactly one early return
   (`status === 'confirmed'`), and an empty/missing label falls back to a built-in constant
   (`'To be confirmed'` / `'Not yet confirmed'`) — deliberately terse and worded differently from
   the seeded copy, so a page that has fallen back looks visibly degraded rather than silently
   equivalent. This is the load-bearing defence, because Sanity validation is advisory only.
2. **Schema validation** — `Rule.required()` on `pendingLabel` and `researchLabel`, which stops
   the ordinary editing mistake (clearing a field in Studio) with a visible Studio error.

The old assertion that would have forbidden this fix — "no literal fallback label string in
`ConfirmationBadge`" — is gone; it was checking the wrong thing. The real claim (labels come from
Sanity, not frozen copy) is now asserted where it's observable: **A60** counts markers on the
rendered page via a `data-confirmation-badge` attribute — an observable derived from neither the
dataset nor the copy — with `pendingLabel` cleared in the live dataset, and separately asserts
every rendered badge's text equals one of the two *current dataset* labels.

### The FAQ markers were invisible

All 14 FAQ markers rendered inside collapsed `<details>` panels, so anyone scanning the closed
list saw unconfirmed answers presented as plain fact. Fixed by moving the marker into the
`<summary>` element (visible before expansion); `ConfirmationBadge` gained an `as?: 'p' | 'span'`
prop because a `<summary>`'s content model is phrasing content and cannot contain a block-level
`<p>`. **This changes rendered output on the FAQ page** — the marker now sits beside the question
text itself, not below the answer.

---

## The three pages

| Route | File | Covers |
|---|---|---|
| `/national-show/plan-your-visit` | `app/(marketing)/national-show/plan-your-visit/page.tsx` | Getting there (per-airport routes), parking, public transport, accommodation (grouped by distance band), nearby attractions, emergency contacts, venue card (map link/image, no SDK) |
| `/national-show/what-to-expect` | `app/(marketing)/national-show/what-to-expect/page.tsx` | Opening hours, admission (cross-links to `/tickets`, never restates a price), food, photography policy, cloakroom/plant-holding, wheelchair accessibility |
| `/national-show/faq` | `app/(marketing)/national-show/faq/page.tsx` | Categorised, ordered Q&A from `showFaq`, native `<details>`/`<summary>` disclosure |

All three: Server Components (no `'use client'`), `export const revalidate = 60`, each with its
own `loading.tsx`, built from `components/show/{VisitorInfoBlock,VenueCard,TravelRoutes,
AccommodationList,ShowFaqList,ShowSectionNav,ConfirmationBadge}.tsx`, none over the project's
150-line component limit.

**Admission pricing is never duplicated here.** `showVisitorInfo.admissionNote` explains how
admission works (concessions, door vs. advance, re-entry) and links to `/tickets` via
`admissionLinkLabel`; `ticketType` documents remain the single source of truth for actual prices,
and those prices are themselves still provisional pending council confirmation. Verified by A44
and by a rendered-HTML scrape confirming zero currency strings on `/what-to-expect`.

**The FAQ disclosure is native `<details>`/`<summary>`** — no `useState`, no `onClick`, no
`'use client'`. Keyboard-operable (Tab to a summary, Enter/Space toggles), screen-reader
announced, works with JavaScript disabled, and its content stays in the DOM (findable by in-page
search, printable) even while collapsed. Verified with real Playwright keyboard input: 12 tabs to
the first summary, Enter opens/closes it, all 13 questions present in the DOM with JS disabled.

**Maps**: a link and/or static image whose `src` comes from Sanity (`venue.mapsUrl` /
`venue.mapImage`). No maps SDK, no API key, anywhere in the repo's dependencies or new files.

### Reachability

`/national-show/archive` was the site's standing cautionary example: built, 200 response, linked
from nothing. A page that returns 200 is not shipped; a page a visitor can click to is. The three
new pages are now linked from the show landing page (a "Plan your visit" card grid), cross-linked
to each other and to `/contact`/`/tickets` via `ShowSectionNav` on all four show pages, and listed
in site-wide search (`components/chrome/SearchOverlay.tsx`). The primary header nav was
deliberately **not** expanded — a six-item bar stays six items; reachability comes from the
landing cards and section nav instead. `/national-show/upcoming` now issues a permanent (308)
redirect to `/national-show` instead of a temporary one.

---

## Outstanding items

- **`nationalShow.exhibitorStages`** still exists as a second exhibitor-journey surface on the
  landing page. Its retirement is blocked by a cross-contract deadlock: this contract's own A5
  asserts the field must continue to exist (no pre-existing `nationalShow` field may be removed
  while adding `venue`). Deferred deliberately, not an oversight.
- **The show committee still owes**: confirmed venue, exact dates, opening hours, parking
  specifics, accessibility specifics, photography policy, cloakroom arrangements, accommodation
  list, and emergency contacts. Every one of these renders today as a labelled `pending` or
  `research` placeholder, never as settled fact.
- **`useCdn: false` in `sanity/lib/fetch.ts`** was considered as a way to cut the ~60–90s editor-
  visible propagation delay, then correction-ruled out: measurement showed the delay is mostly the
  route's `revalidate = 60` ISR window, not CDN propagation (under 7s on its own), so that change
  would fix only a small fraction of the delay and is filed as a separate, properly-scoped
  follow-up rather than bundled here.
- Retiring `nationalShow.location` fully requires migrating `contracts/checks/cms-loop-f3-
  national-show` to a different field first — filed as follow-up, not done in this mission.
- `page.tsx`'s `month: 'September'` pin on past Sanity-sourced shows — low-harm, needs a schema
  change, backlog.

---

## Operational notes for maintainers

### The round-trip checks mutate the live dataset — keep their timeouts

Four checks in this contract write to the real Sanity dataset during a gate run:
`check-cms-round-trip` (A42), `check-seed-idempotent` (A24), `check-marker-fail-closed` (A60) and
`check-show-identity-sweep` (A61). All four go through a shared guard,
`contracts/checks/show-visitor-info/_mutation-guard.mjs`, which:

- refuses to start if the captured baseline matches the sentinel shape `/SVI-[A-Z0-9-]*-
  SENTINEL-\d+/` — a poisoned baseline is a hard failure, never something to restore;
- takes an exclusive file lock for the whole mutate → verify → restore window (with dead-pid
  reaping so a SIGKILLed check's lock doesn't block every later run for 20 minutes, and
  SIGTERM/SIGINT handlers that release the lock before re-raising the signal). **As of 2026-08-22,
  this lock is now document-scoped and shared:** the lock path is computed via
  `contracts/checks/_shared/doc-lock-path.mjs`'s `docLockPath('nationalShow')` helper, so
  `check-show-identity-sweep.mjs` (which mutates `nationalShow`) now actually serializes against
  `contracts/checks/cms-loop-f3-national-show/check-headline-round-trip.mjs` (A1), which mutates
  the same singleton. Before this date, the two checks used separate lock files and could corrupt
  each other's mutations. See `docs/fix-live-sentinel-residue-cms-loop-f3.md` for the history.
- restores with `ifRevisionID` set, so a concurrent write makes the restore throw instead of
  silently overwriting someone else's change, and emits a `RESIDUE ALERT` (exit code 2) if
  verification fails.

**Why this matters operationally: an incident already happened.** On 2026-08-11 two overlapping
runs of the round-trip check interleaved their captured baselines, and the string
`SVI-PARKING-SENTINEL-1786481132420` was left rendering as the parking information on the live
`/national-show/plan-your-visit` page. The root cause was that these checks declared no
`timeout_seconds`, so `execution/contract.py`'s 60-second default SIGKILLed them mid-mutation on
every gate run — a killed process can't run its own cleanup `finally` block. **Every mutating or
propagation-polling assertion in this contract now declares a `timeout_seconds` with real
headroom** (up to 1200s for A61, which mutates the whole show identity and polls the CDN twice).
Do not remove or shrink these — a check that mutates the dataset must be allowed to finish its own
restore, every time, or the failure mode is a live content incident, not a red gate.

Expect the gate to take **10–15 minutes**, dominated by these four checks running serially by
design (they share one lock). That is the cost of assertions that can actually fail — the round-1
gate ran fast and proved nothing about either of the mission's two overriding rules.

### How to spot and recover a leaked sentinel on a public page

If a string matching `SVI-[A-Z0-9-]*-SENTINEL-<timestamp>` ever appears on a rendered page (most
likely `parking`, `cloakroom` or `pendingLabel` on `showVisitorInfo`, or a `nationalShow` field
during an A61-style sweep):

1. Treat it as a live content incident, not a test artifact — it is visible to anyone browsing the
   dev site right now.
2. In Studio, open the affected document (`showVisitorInfo` or `nationalShow`) and replace the
   sentinel field with its real seeded value — cross-check
   `scripts/seed-show-visitor-info.ts` for the original text.
3. Publish, then confirm the sentinel is gone from the rendered page (allow up to ~90s for the
   ISR window to roll over).
4. Check whether a mutating contract check was killed mid-run around the same timestamp (look for
   a stale lock file in the OS temp dir, or a gate log showing a timeout on A24/A42/A60/A61) — that
   is almost certainly the cause, per the incident above.
