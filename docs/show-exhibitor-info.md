# Show Exhibitor Information — `/national-show/exhibitors`

Technical reference for the exhibitor entry guide. For the plain-language editor guide, see
[`exhibitor-guide-for-editors.md`](./exhibitor-guide-for-editors.md).

**Status: not deployed.** This lives on the dev site only. There is no live domain yet, and
nothing described here has been shown to the SAOC committee for confirmation.

Contract: `contracts/contract-show-exhibitor-info.yaml` — **52/52 assertions pass** (verified by
the orchestrator on a quiet tree, 2026-08-12).

---

## What this section is

`/national-show/exhibitors` replaced a 108-line hardcoded placeholder ("Full details coming
2026") with a Sanity-driven entry guide covering how to enter, deadlines, staging, judging, plant
eligibility, display and sales rules for the National Show.

**The content is not SAOC policy.** SAOC has never run a national exhibitor process online, and
no archived SAOC exhibitor pack was found. Rather than inventing rules or leaving the page empty,
the seeded copy is **researched international orchid-show convention** — surveyed across World
Orchid Conference, AOS-judged shows, RHS, Australian Orchid Council, and Singapore/Taiwan
international shows (full survey: `.agent/memory/project/show-exhibitor-conventions.md`) —
presented as a clearly-marked starting point for the show committee to correct, confirm, or
replace.

This framing is structural, not just a note in the copy. Every content block on the page carries
a visible status, and the default status is the one that hides the least:

| Status | Means | Renders |
|---|---|---|
| `pending` | Placeholder — SAOC needs to supply the real value (deadline, fee, staging time) | "To be confirmed by the show committee" marker |
| `research` | Verified international convention, offered as a starting point | "Researched international show practice — not yet SAOC policy" marker |
| `question` | The research looked and found nothing published (e.g. security, insurance, watering) | "Open question for the show committee" marker |
| `confirmed` | The committee has signed off this value | No marker — reads as plain fact |

Every status field defaults to `pending` in the schema (`initialValue: 'pending'`), and nothing is
seeded as `confirmed`. An unset or garbage status value always falls back to the pending marker —
it can never silently read as confirmed.

---

## Content model

- `sanity/schemas/documents/showExhibitorInfo.ts` — a **pinned singleton** (one document, `_id ===
  'showExhibitorInfo'`) carrying: the three marker label strings, a key-dates table, an entry-form
  slot, nine typed reference sections (`entryProcess`, `fees`, `classes`, `judging`,
  `eligibility`, `display`, `sales`, `practicalities`, `permits`), an open-questions list, and a
  `confirmations` object holding one status per block (10 blocks, including `entryForm`).
- `sanity/schemas/documents/showExhibitorStep.ts` — a repeatable document type for the
  exhibitor-journey steps (decide → enter → prepare → stage → judging → show days → removal). Each
  step carries its own `status` field, independent of the singleton's `confirmations`.
- Supporting object types: `exhibitorSection`, `showExhibitorDate`, `exhibitorQuestion`,
  `exhibitorConfirmationStatuses`.
- **Why `showExhibitorDate.dateNote` is a string, not a datetime**: there is no honestly-empty
  date field. Typing it as `datetime` would force seeding an invented staging deadline, which
  renders as fact regardless of the badge beside it. See
  `contracts/golden/show-exhibitor-info/showExhibitorInfo-schema.golden.json`.
- **Four statuses, not three.** The sibling `show-visitor-info` model uses three
  (`pending`/`research`/`confirmed`). This stream adds `question`, because the research report has
  a distinct fourth category — things it looked for and could not establish (security, watering,
  insurance, display-build rules, domestic plant-movement permits). Filing those as `pending`
  would imply a value simply hasn't been typed in yet; filing them as `research` would present a
  gap as a finding. See `contracts/golden/show-exhibitor-info/exhibitor-confirmation-model.golden.md`.

## Seeding

`scripts/seed-show-exhibitor-info.ts` (run via `pnpm seed:exhibitor`) is a **new, separate**
script — it does not touch or extend `scripts/seed-page-singletons.ts`, which uses
`createOrReplace` and would silently revert any editor change on every run.

- `createIfNotExists` on a deterministic `_id` — a second run never creates a duplicate.
- `setIfMissing` on every field — an editor's correction in Studio always wins over the seed; a
  re-run cannot overwrite it.
- Deterministic portable-text `_key`s (derived from a slug + index, never random) — required for
  idempotence, since Sanity assigns a new `_rev` to any document a transaction touches even when
  nothing changes.
- No field is seeded as an empty string, and nothing is seeded `confirmed`.
- The seed never writes `entryFormFile` or `entryFormUrl` — there is no entry form yet, and
  seeding a placeholder one would be the exact harm this mission exists to prevent.

## How an editor changes it

Everything on the page is editable from Sanity Studio (`/studio`) under **Show Exhibitor
Information** (singleton) and **Show Exhibitor Step** (list). See the editor guide for the
walkthrough; in short: edit a field, change its status if it's now confirmed, click Publish.
Changes appear within about a minute (ISR `revalidate = 60`, plus the Sanity CDN's own staleness
window — see Operational notes below).

---

## Page structure

`app/(marketing)/national-show/exhibitors/page.tsx` — a Server Component (no `'use client'`
anywhere in the exhibitor tree), `revalidate = 60`. Section order follows the exhibitor's own
journey, not the schema's field order: key dates first (someone here is checking a deadline, not
reading an essay), then the entry-form link, then the step-by-step journey, then the nine
reference sections, then open questions, then a contact/cross-link footer.

Components (`components/show/`):

| Component | Role |
|---|---|
| `ExhibitorStatusBadge` | The confirmation marker — see below |
| `ExhibitorKeyDates` | Semantic `<table>` with `<caption>` and scoped headers for the deadline summary |
| `ExhibitorSteps` | The journey as an `<ol>` — order is meaning |
| `ExhibitorSection` | One of the nine reference blocks |
| `ExhibitorQuestions` | The open-questions list |
| `EntryFormLink` | The entry-form download/pending state |

Cross-links: `classes` section links to `/national-show` (show classes render there; never
restated here), `judging` links to `/judging` (SAOC judging standards; never restated here),
`permits` links to `wildorchids.co.za` (WOSA — indigenous/wild-orchid matters are out of SAOC's
scope). No new CSS custom properties or hex literals — Sage & Paper tokens only.

### `ExhibitorStatusBadge` — the honesty mechanism

`components/show/ExhibitorStatusBadge.tsx` fails closed twice over:

1. **Status.** Exactly one branch renders nothing — the explicit `confirmed` branch. A missing,
   empty, or unrecognised status value falls through to the `pending` marker, never to silence.
2. **Label.** All three marker label strings (`pendingLabel`, `researchLabel`, `questionLabel`)
   arrive as props from Sanity and are required fields in the schema (`Rule.required()`). If one
   is ever blank anyway, the component falls back to a single hardcoded floor,
   `FALLBACK_LABEL = 'Not confirmed by SAOC'` — the one hardcoded string permitted in the file,
   deliberately not a fourth Sanity field (that would just move the off switch elsewhere).

This second defence exists because of a defect QA found and @dev fixed in round 2: clearing all
three label fields left 23 bordered boxes on the page containing nothing but an
`aria-hidden` glyph — a sighted reader saw blank rectangles, a screen-reader user got nothing at
all, and the researched convention on the page read as settled SAOC policy. It's now impossible
to reproduce: `Rule.required()` warns in Studio before publish, and the fallback constant is the
floor under that.

The marker is also text, not colour alone (WCAG 1.4.1 — colour-only signals are invisible on a
printout, which is how a council member is likely to actually review this page).

### `EntryFormLink` — never a dead link

There is no online entry submission (out of scope — the council hasn't asked for it, and it would
need its own data-handling decision). The entry form is a committee-supplied PDF (or external
URL) uploaded in Sanity. Until one exists, the component renders the pending note as **plain
text**, with no anchor at all — never an `href="#"` or empty href. An anchor that looks clickable
but goes nowhere reads to an exhibitor as "the site is broken," which is worse than an honest
"not published yet" paragraph.

---

## `nationalShow.exhibitorStages` — retirement status

**Not fully retired. Do not describe it as done.**

- The exhibitor guide itself (`/national-show/exhibitors`) never reads `exhibitorStages` — that
  part is complete and asserted (A12).
- **FU-1 (link the guide from `/national-show`) landed 2026-08-12** — the show landing page now
  links to `/national-show/exhibitors` from its "Exhibitor information" section, below the
  existing inline stages summary. Verified in rendered HTML (A50 passes).
- **FU-2 (delete the `exhibitorStages` field) has not landed and is blocked**, not merely
  pending. The sibling `show-visitor-info` contract's own assertion (`contract-show-visitor-info.yaml:131`,
  its A5) currently asserts the field **must still exist** in
  `sanity/schemas/documents/nationalShow.ts`. Deleting it would turn that contract's gate red.
  Unblocking FU-2 needs both FU-1 (done) and an orchestrator decision to amend the sibling
  contract's A5 — neither stream can do that unilaterally.
- Until FU-2 lands, the landing page shows **two exhibitor-journey surfaces**: the old inline
  portable-text `exhibitorStages` blob (currently empty in the dataset, so nothing renders there
  today) and the new structured guide. This is a known, bounded, and guarded interim state — see
  `check-exhibitor-stages-retired.mjs` (A51), which asserts the field's *content* stays empty
  rather than trying to delete the field, and that the landing page isn't restating the journey
  from a hardcoded fallback constant either. It goes red the moment anyone publishes through
  `exhibitorStages` again.
- Follow-up tracking: `.agent/memory/project/needs-human.md` (search "FU-1" / "FU-2").

---

## Operational notes

### The round-trip check mutates the live dataset — never run it without its timeout

`contracts/checks/show-exhibitor-info/check-cms-round-trip.mjs` (assertion A36) proves that a
Studio edit reaches the rendered page by writing a sentinel value into
`showExhibitorInfo.keyDates` and `showExhibitorInfo.confirmations.sales`, watching for it on the
page, then restoring the original values.

**This happened for real, twice, on 2026-08-11–12.** The assertion originally declared no
`timeout_seconds` and inherited the contract runner's 60-second default. The check itself needs
roughly 140 seconds. So the runner `SIGKILL`ed it on every gate run — reliably *after* the
sentinel was written, and usually *before* the restore. `EXH-DEADLINE-SENTINEL-…` was published as
the live "Entries close" date on `/national-show/exhibitors`; one instance rendered publicly for
about 4.5 hours before QA found and reverted it. The kill also leaked the mutation lock (`SIGKILL`
skips `finally`), which then blocked every subsequent mutating check.

**This is fixed:** A36 now declares `timeout_seconds: 1800`, comfortably above its own ~140s
budget, and `_mutation-guard.mjs` now reaps locks whose recorded pid is dead and releases on
`SIGTERM`/`SIGINT`. But the underlying rule still matters for anyone adding or editing a mutating
check on this contract: **the runner timeout must strictly exceed the check's own internal
deadline.** A missing or too-tight timeout on a mutating check is not a slow gate — it is a
content-incident generator.

### How to spot and fix a leaked sentinel

If `/national-show/exhibitors` ever shows a value starting with `EXH-DEADLINE-SENTINEL-` (or
similar) in the key-dates table or the "Selling Plants" section, that is exactly this failure
mode: a mutating check was killed mid-run before it could restore.

1. Check for a stale lock: `os.tmpdir()/saoc-contract-locks/show-exhibitor-info-dataset.lock`.
   If its recorded pid is dead, it will now self-reap on the next run; you don't need to delete it
   by hand under normal conditions.
2. Restore the affected fields (`showExhibitorInfo.keyDates`, `showExhibitorInfo.confirmations.sales`)
   in Studio to their last known-good values, or re-run `pnpm seed:exhibitor` (safe — it only
   patches genuinely-missing fields, never overwrites existing ones).
3. Re-run A36 standalone with its full timeout to confirm the dataset is clean before trusting the
   gate again.

### Content propagation is not instant

Every measured propagation from a Sanity publish to the rendered page takes **about 60 seconds,
never less** — this is expected, not a bug. It comes from two stacked 60-second windows: the
page's own `revalidate = 60`, and `sanity/lib/client.ts` setting `useCdn: true`, so even a
revalidated Next.js cache re-fetches through a Sanity CDN copy that can itself be up to 60 seconds
stale. `/api/revalidate` does correctly invalidate this route by tag (`showExhibitorInfo`,
`showExhibitorStep` — locked in by A52); the CDN layer is the source of the floor, and it's a
site-wide setting, not specific to this page.

### Never run gates or mutate the dataset casually

A36, A22 (`check-seed-idempotent`), and A47 (`check-marker-fallback`) all mutate the live Sanity
dataset. All three capture a baseline, restore it in a `finally`, and verify the restore before
exiting — but as above, a killed process can still leave residue. Don't run the exhibitor contract
gate while another gate is mutating the same dataset unless you intend to serialise through the
lock.

---

## Outstanding — what the committee still owes

Nothing below is guessed at; each is either a `pending` block waiting for a real value or a
`question` block the research could not answer:

- Entry deadline and fees
- Staging and removal times
- Whether exhibitors may attend judging
- The plant ownership-duration rule (research found a 12-month figure at one UK show; SAOC's own
  figure, if any, is unconfirmed)
- Whether exhibitors may sell plants, and on what terms
- Insurance and overnight security arrangements
- Day-to-day watering/plant-care responsibility during the show run
- Who may build a display stand, and any height/material rules
- The entry form itself (PDF or hosted link)
- Any domestic (non-CITES) provincial plant-movement permit requirement
- Any indigenous-species documentation requirement distinct from CITES (relevant only if
  propagated indigenous species like *Disa* or *Eulophia* are exhibited)

These belong in the call-prep / secretary questions documents, not invented here.
