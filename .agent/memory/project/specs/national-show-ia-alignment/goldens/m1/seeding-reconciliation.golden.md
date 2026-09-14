# Golden — seeding 18 pages without ever clobbering an edit (M1)

## The decision

A committed seed script, `scripts/seed-show-pages.ts`, reading committed per-page content
files at `content/show-pages/{pageKey}.json`. Not Studio-authored, not a one-off ndjson
import.

**Why not Studio-authored.** 17 documents with 3–6 sections each, each carrying an exact
provenance value and a source path, hand-entered once and unreproducible. A fresh dataset,
a staging environment or a restored backup would need the whole thing typed again, and
nothing would prove the provenance values were entered honestly.

**Why not a raw ndjson import.** `sanity dataset import` has two modes: create-only, which
fails outright on the second run, and `--replace`, which destroys editor changes. Neither
satisfies the constraint below.

**Why content in JSON files rather than literals inside the script.** Three reasons.
M3 authors researched copy for ten pages and gap-fills five more; as inline literals that
is a two-thousand-line
TypeScript file that must be re-reviewed as code every time a sentence changes. Separated,
a copy change is a content diff. And — the reason that actually matters — the JSON files
are a static, machine-checkable corpus: assertion A9 can verify every section claiming
`council-supplied` names a real council document **without a Sanity token and without
network access**, which is what makes it runnable in a gate.

## The constraint that shapes everything

> It must be re-runnable without duplicating documents, and must never clobber an edit
> Lee-Ann has made in Studio.

`scripts/seed-page-singletons.ts` is the project's own cautionary tale. Its header claims
idempotence via `createOrReplace`, and `scripts/seed-show-visitor-info.ts:6-9` records what
that actually cost: *"known-hazardous: it force-replaces documents with hardcoded literals,
so re-running it silently reverts whatever the secretary edited in Studio."*

`seed-show-visitor-info.ts` fixed that with `createIfNotExists` plus `setIfMissing`. That
is safe, but it is too blunt for this mission: M1 seeds honest stub sections and M3
replaces them with researched copy. Under blanket `setIfMissing`, M3's re-run would write
nothing at all, and the stubs would ship.

So M1 uses a third rule, keyed on whether a human has touched the section.

## The reconciliation rule

Every seeded section carries `seedHash` — a SHA-256 of the canonical JSON of the body the
script last wrote, truncated to 16 hex characters. On each run, per section, keyed by
`sectionKey`:

| dataset state | script action | reason |
|---|---|---|
| Page document absent | `createIfNotExists` the whole document with all sections | first run |
| Section absent from an existing page | append it, set `seedHash` | a new section added by a later milestone |
| Section present, stored `seedHash` matches a hash of its **current** body | overwrite body and provenance, update `seedHash` | the script wrote this and nobody has touched it since — safe to update |
| Section present, stored `seedHash` does **not** match its current body | **skip, and report** | a human edited it. Never overwrite. |
| Section present with **no** `seedHash` at all | **skip, and report** | provenance unknown; assume human-authored. Absence must not read as permission. |
| Section present in the dataset but absent from the seed source | **leave it alone, and report** | the council added a section. Deleting it is not the seed's business. |

The last three rows are the constraint. The script's exit contract makes them visible
rather than silent: exit 0 when every section was created or safely updated; exit 3 when
one or more sections were skipped, printing each as
`SKIP {pageKey}/{sectionKey} — edited in Studio, seed not applied`. A skip is a report, not
a failure — but it is never invisible.

**Why hash the current body rather than trust the stored hash alone.** The stored
`seedHash` says what the script wrote. Comparing it against a freshly computed hash of what
is in the dataset *now* is what detects the edit. Trusting the stored value alone would let
any edit through unnoticed.

## Hard prohibitions — provable by grep

`scripts/seed-show-pages.ts` must contain **zero** occurrences of:

- `createOrReplace` — the known-hazardous pattern named above
- `.delete(` — a seed script never deletes council content
- `randomUUID` / `Math.random` — `_key` values are derived, never random
  (`scripts/seed-show-visitor-info.ts:20-21`)

## Determinism

- Document `_id`: `showPage.` + pageKey. Never generated.
- Section `_key`: pageKey + `--` + sectionKey. Never generated.
- `showPageSettings` `_id`: the literal `showPageSettings`, per the pinned-singleton
  convention at `sanity/structure.ts:13-27`, and written with `createIfNotExists` so a
  reworded notice is never reverted.
- Env is read directly from `.env.local`, not via `dotenv` — the project has been bitten
  by dotenv's stdout banner corrupting a captured value
  (`scripts/seed-show-visitor-info.ts:27-29`). Copy that file's `readEnvLocal()` helper.

## Seed source file shape — `content/show-pages/{pageKey}.json`

```
{
  "pageKey": "02-about-the-national-show",
  "specNumber": 2,
  "title": "About the 2027 National Show",
  "summary": "...",
  "sections": [
    {
      "sectionKey": "overview",
      "heading": "About the Show",
      "kind": "prose",
      "provenance": "council-supplied",
      "sourcePath": "content/drive-source/National Show/2. About/2.1 About - 2027 National Show/v1.0/content.md",
      "body": [ ...portable text blocks... ]
    }
  ]
}
```

`sourcePath` is required whenever `provenance` is `council-supplied`, is repo-relative, and
must resolve to a file that exists. Assertion A28 enforces all three across all 17 files
with no network access.

## What M1 seeds, and what it deliberately does not

M1 creates **17 documents** — spec entries 1-13 and 15-18. Entry 14 gets no document: it is
a link to `/societies`, per Lee-Ann's own instruction, and modelling it as a page would model
something she asked us not to build. See `route-map.golden.md` for the arithmetic.

| spec entries | M1 content | provenance |
|---|---|---|
| 2, 4 | the real council copy already in `content/drive-source/` | `council-supplied` with a verified `sourcePath` |
| 6, 13, 17 | the recovered council text from `content/drive-recovered/` | `council-supplied` with a verified `sourcePath` |
| 3, 18 | the thin real copy that exists, and nothing invented to fill the gaps | `council-supplied` for what exists |
| 1, 5, 7, 8, 9, 10, 11, 12, 15, 16 | a **one-paragraph honest stub** naming what the page will cover, drawn from that page's spec Section 4 "Purpose" line | `placeholder-ai` |

Entry 1 is `01-national-show-landing` — the existing `/national-show` landing page,
reconciled, not created. It is not keyed `01-home` and it is not a home page; saoc.co.za is
the only home page on this site (`.agent/memory/project/rules.md`).

**M1 does not write researched placeholder copy.** That is M3's whole job. M1's stubs exist
so that no page renders empty and so that the gate has real placeholder documents to prove
itself against. The `seedHash` rule above is precisely what lets M3 replace those stubs
later without a migration and without touching anything Lee-Ann has since edited.

**Ticket prices are not seeded anywhere.** `.tmp/sandbox/nos-ia/13.1-ticketing.md` lists
R130 / R150 / R380 / R400 / R300 and Lee-Ann's own reply on spec 2.7 says the ticket and
cocktail options *"still need to be fully developed."* The document also contradicts itself
— its first "Recommended booking structure" list has no Early Bird Weekend Pass, while its
own later Developer Specification table adds one at R380. Page 13's seeded section
describes the ticket **categories** and links to the live booking flow; it states no price.
Prices live in `ticketType` documents, which this mission does not touch.

## The reconciliation decision must be a pure, exported function

`scripts/seed-show-pages.ts` exports:

```
export type SectionAction =
  | 'create'              // section absent from the dataset — write it
  | 'update'              // stored seedHash matches the current body — safe to overwrite
  | 'skip-edited'         // stored seedHash does not match — a human edited it
  | 'skip-unknown-origin' // no seedHash at all — assume human-authored
  | 'leave-extra';        // in the dataset, absent from the seed source

export function decideSectionAction(
  seedSection: SeedSection | null,
  existing: { body: unknown; seedHash?: string | null } | null,
): SectionAction;

export function hashBody(body: unknown): string;  // sha256 of canonical JSON, 16 hex chars
```

Pure means: no Sanity client, no filesystem, no clock, no env. This is what lets the M1
verifier drive all six rows of the table above with no dataset and no network, in a gate.
The I/O half of the script calls it; it never re-implements the decision inline.

Decision table as executable cases the verifier drives:

| seedSection | existing | existing.seedHash | hashBody(existing.body) | expected |
|---|---|---|---|---|
| present | null | — | — | `create` |
| present | present | `"abc123"` | `"abc123"` | `update` |
| present | present | `"abc123"` | `"def456"` | `skip-edited` |
| present | present | `null` | any | `skip-unknown-origin` |
| present | present | `""` (empty) | any | `skip-unknown-origin` |
| null | present | any | any | `leave-extra` |

`hashBody` must be stable across runs and across key order — canonicalise the JSON (sorted
object keys) before hashing, or a re-serialised body with reordered keys reads as an edit
and every section falls through to `skip-edited` forever.
