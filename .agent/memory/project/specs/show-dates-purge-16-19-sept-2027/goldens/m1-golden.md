# Golden: show-dates-purge-16-19-sept-2027, M1

Confirmed real dates: **Thursday 16 - Sunday 19 September 2027** (Lee-Ann-confirmed, per
project memory `project_show_dates_placeholder`; not re-litigated by this mission).
Stale placeholder being purged: **18-21 September 2027** / `2027-09-18` / `2027-09-21`.

## F1 -- source-of-truth code literals

| File | Field | Old value | New value |
|---|---|---|---|
| `scripts/seed-page-singletons.ts:216` | `countdownDate` | `'2027-09-18T09:00:00+02:00'` | `'2027-09-16T09:00:00+02:00'` |
| `scripts/seed-show-visitor-info.ts:128` | `SHOW_IDENTITY.showDate` | `'2027-09-18T09:00:00+02:00'` | `'2027-09-16T09:00:00+02:00'` |
| `scripts/seed-show-visitor-info.ts:129` | `SHOW_IDENTITY.showEndDate` | `'2027-09-21T17:00:00+02:00'` | `'2027-09-19T17:00:00+02:00'` |
| `lib/data/events.ts:171` | event id 15 `date` | `'2027-09-18'` | `'2027-09-16'` |
| `lib/data/events.ts:172` | event id 15 `endDate` | `'2027-09-21'` | `'2027-09-19'` |

The comment directly above `SHOW_IDENTITY` in `scripts/seed-show-visitor-info.ts` ("The dates
mirror the countdownDate already in the dataset...") must no longer claim a mirroring
relationship as its sole justification, since F2 patches the live `nationalShow` document
independently of this file. Update or remove it -- do not leave a stale claim.

`lib/show-identity.ts:19`'s `/** \`18-21 September 2027\`, ... */` JSDoc example is
**illustrative of `formatShowDateRange`'s output shape only** -- confirmed by reading the
function body: it formats whatever `start`/`end` arguments it is given, using no hardcoded
show data. It is explicitly OUT OF SCOPE and must not be edited by this mission.

## F2 -- live Sanity documents (production dataset, project `26yfbug4`)

Three documents, confirmed stale by direct query 2026-08-22:

| `_id` | `_type` | Field(s) | Old | New |
|---|---|---|---|---|
| `nationalShow` | `nationalShow` | `showDate` | `2027-09-18T09:00:00+02:00` | `2027-09-16T09:00:00+02:00` |
| `nationalShow` | `nationalShow` | `showEndDate` | `2027-09-21T17:00:00+02:00` | `2027-09-19T17:00:00+02:00` |
| `nationalShow` | `nationalShow` | `countdownDate` | `2027-09-18T09:00:00+02:00` | `2027-09-16T09:00:00+02:00` |
| `show-19-2027` | `show` | `startDate` | `2027-09-18T09:00:00+02:00` | `2027-09-16T09:00:00+02:00` |
| `show-19-2027` | `show` | `endDate` | `2027-09-21T17:00:00+02:00` | `2027-09-19T17:00:00+02:00` |
| `societyEvent-15-19th-south-african-national-orchid-show` | `societyEvent` | `date` | `2027-09-18` | `2027-09-16` |
| `societyEvent-15-19th-south-african-national-orchid-show` | `societyEvent` | `endDate` | `2027-09-21` | `2027-09-19` |

`show-19-2027` is the `active: true` show document that ticketing's day-selection window reads
(`docs/f5-day-selection-attendees.md`: "All dates flow from Sanity's `show.startDate` and
`show.endDate`"). It was last touched by `scripts/migrate-show-sales-fields.ts` using
`setIfMissing`, so its `startDate`/`endDate` are already SET to the stale values --
the new patch script MUST use `.set()` for these two fields on this document, not
`.setIfMissing()`, or the patch will silently no-op.

### Patch script requirements

One new script, e.g. `scripts/fix-show-dates-2027.ts`, following the pattern already
established by `scripts/migrate-show-sales-fields.ts`:

- Reads `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `SANITY_API_TOKEN`
  directly from `.env.local` (same `readEnvLocal()` helper shape).
- `createClient({ ..., useCdn: false })`.
- Supports `--dry-run`, printing what would be patched without writing.
- Patches all three documents above with `.set()` for the exact fields listed (never
  `createOrReplace` -- these documents carry other editor-set fields that must survive
  untouched).
- Idempotent: a second run against already-corrected documents patches the same values
  again -- harmless, no error, no drift.
- `Run with: node --import tsx/esm scripts/fix-show-dates-2027.ts [--dry-run]` documented
  in the file header, matching every other script in `scripts/`.

### Live verification (gate assertion, not agent_review)

A second script (or the same script's default/`--verify` behavior) queries all three documents
live via `client.fetch` and asserts every field above holds the exact new value, printing a
clear per-field pass/fail and exiting non-zero on any mismatch. This is the mechanism the
contract's F2 shell assertion invokes directly -- per this project's coding.md verification
hierarchy, a real query-based shell check is preferred over `agent_review` and this mission has
no technical reason it can't write one (Sanity's API is directly queryable, unlike a rendered
page).

## F3 -- docs sweep

Fix (present-tense factual claims about currently-seeded/confirmed data):

- `docs/show-visitor-info.md:189` -- `18-21 September 2027` to `16-19 September 2027`.
- `docs/show-visitor-info-for-editors.md:56` -- `18-21 September` (line wraps to `2027` on the
  next line) to `16-19 September 2027`.

Leave unchanged (historical/illustrative references to the old placeholder's existence, not
current-fact claims):

- `docs/payment-seam.md:495-496`
- `docs/f1-ticketing-conferences.md:52`
- `docs/f4-admission-products.md:47`
- `docs/f5-day-selection-attendees.md:86` (a prohibitive example, not a date claim)
- Anything under `.agent/memory/project/` (missions, learned.md, backlog.md,
  provisional-figures.md, goals.md), `Plans/`, or `contracts/golden/` -- these are audit-trail
  / historical records of the defect and its correction, not live documentation, and this
  mission does not rewrite project history.

## Definition of done

- Zero occurrences of `2027-09-18` or `2027-09-21` anywhere under `scripts/`, `lib/`, and the
  two named docs.
- `2027-09-16` / `2027-09-19` (or the full ISO timestamps) present at every location listed
  above.
- Live Sanity verification script exits 0 against production.
- `pnpm exec tsc --noEmit` clean.
- Home-page countdown and `/national-show` pages browser-verified to show the corrected dates.
