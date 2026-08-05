# F4: `award` and `province` — orphaned Studio types recon

Read-only investigation, `cms-activation-deploy` mission. No code, config, contracts,
or dataset state was changed. Written 2026-08-05.

## Summary of verdict

| Type | Recommendation |
|---|---|
| `award` | **Wire it.** Real, already-seeded content with a recent secretary-side edit; small, mechanical wiring job. |
| `province` | **Remove the sidebar entry only** (keep the schema type registered so the 9 existing published documents stay valid); do not delete the documents or the schema type as part of this recon. |

Both halves of the team-lead's prior expectation held, but with more nuance and
sharper evidence than "probably" — see below, including one finding (award docs have
already been edited in Studio) and one scope-boundary flag (a *different*, bigger
"awards archive" feature is on Brad's roadmap and must not be confused with this
`award` type).

## Verification of the starting claims

I did not take the task summary on trust. Confirmed independently:

- `sanity/structure.ts:32-41` — `COLLECTION_TYPES` includes both `'award'` and
  `'province'`, rendered via `S.documentTypeListItem(typeName)` (full editor CRUD
  access, no restriction).
- `sanity/schemas/index.ts` registers both `award` and `province` in `schemaTypes`.
- `grep -rn "'award'|_type == .award" sanity/ lib/ app/` — the only hits are the
  schema file itself and the structure.ts sidebar entry. **Zero** GROQ queries in
  `sanity/queries.ts` reference `_type == "award"`.
- `grep -rn "'province'|_type == .province" sanity/ lib/ app/` — same result. Zero
  GROQ queries reference `_type == "province"`.
- `sanity/queries.ts:128` has a field named `awards` — but it belongs to the `show`
  document type, and `sanity/schemas/documents/show.ts:32` defines it as
  `type: 'number'` (an entry *count*), completely unrelated to the `award` document
  type. Confirmed by reading the schema, not assumed from the field name.
- `sanity/queries.ts:17,93` has a field named `province` — but it's the free-text
  `province` field on the `society` document (`sanity/schemas/documents/society.ts:10`,
  `type: 'string'`), not a reference to the `province` document type.
- `components/judging/AwardsGrid.tsx` imports `awards` from `@/lib/data/awards`
  (static TS array), confirmed by reading the component — it never touches Sanity.
- `app/(marketing)/societies/SocietiesClient.tsx` imports `provinces` from
  `@/lib/data/provinces` (static TS array) for both the filter chips and the
  code-matching logic against `society.province` (a plain string) — also never
  touches the `province` document type.

**Everything in the task summary is confirmed as stated.**

## 1. What each schema actually defines, and does the dataset have documents?

I did **not** assume zero documents — queried the Content Lake directly
(`https://26yfbug4.api.sanity.io/v2024-01-01/data/query/production`, read-only GROQ,
using the token already in `.env.local` per the credentials inventory memory).

### `award` (`sanity/schemas/documents/award.ts`)

Fields: `code` (string), `name` (string), `description` (text), `year` (number).

**6 published documents exist**, zero drafts:

| `_id` | `code` | `name` | `year` |
|---|---|---|---|
| `award-am-saoc` | AM/SAOC | Award of Merit | `null` |
| `award-fcc-saoc` | FCC/SAOC | First Class Certificate | `null` |
| `award-hcc-saoc` | HCC/SAOC | Highly Commended Certificate | `null` |
| `award-ccm-saoc` | CCM/SAOC | Certificate of Cultural Merit | `null` |
| `award-cbr-saoc` | CBR/SAOC | Certificate of Botanical Recognition | `null` |
| `award-jc-saoc` | JC/SAOC | Judges' Commendation | `null` |

`description` on every document matches `lib/data/awards.ts` word-for-word. `year` is
`null` on all six — the field is populated nowhere, by the seed script or otherwise
(see §2).

**Notable:** `award-am-saoc._updatedAt` is `2026-07-23T23:11:44Z` — **23 days after**
`_createdAt` (`2026-06-30T18:22:04Z`), while the other five awards' `_updatedAt`
exactly equals `_createdAt`. Something touched this one document in Studio on Jul 23.
I did not chase who/what (out of scope for a read-only recon and not needed to answer
the wire/remove question), but this is worth surfacing to Brad as-is: **someone may
already have edited an award in the CMS and observed it do nothing on the live site**
— which is precisely the "teaches the secretary that publishing does nothing" harm
the task description warned about, and turns it from a hypothetical into something
that may have already happened.

### `province` (`sanity/schemas/documents/province.ts`)

Fields: `name` (string), `code` (string), `slug` (slug, sourced from `name`).

**9 published documents exist**, zero drafts — one per real province (WC, EC, NC, FS,
KZN, GP, MP, LP, NW), matching `lib/data/provinces.ts` exactly minus the `ALL`
pseudo-entry (which is UI-only, correctly not a real province).

`society.province` (free-text string, confirmed via
`array::unique(*[_type=="society"].province)`) already contains exactly these 9
codes — i.e., the free-text values and the `province` documents' `code` field are in
sync today, but only because both were seeded from the same static source, not
because anything enforces or reads the relationship.

## 2. What put the documents there — and why this isn't a deliberate "wire later" decision

`scripts/seed-sanity.ts` explains the origin precisely: it's a single bulk pass
(`main()`, lines ~185-195) that mechanically maps **every** array in `lib/data/` —
`awards`, `boardMembers`, `provinces`, `societies`, `events`, `shows`, `showClasses`,
`partners` — into Sanity documents via one shared `seedBatch()` helper, with no
per-type distinction. `award` and `province` were seeded exactly the same way as
`society`, `boardMember`, `show`, and `event` — the difference is that GROQ queries
were later written for the latter four (all present in `sanity/queries.ts`) and never
written for `award`/`province`. **This reads as an oversight in the query-wiring
pass, not an intentional "seed now, wire later" decision** — there's no comment,
contract note, or commit message anywhere indicating `award`/`province` were meant to
stay static. This matters for the recommendation: it's a gap to close, not a design
someone chose and should be consulted on before touching.

One concrete data-loss point from the mechanical seed: `mapAwards()`
(`scripts/seed-sanity.ts:76-83`) copies `code`, `name`, `description` but **not**
`threshold`, because the `award` schema (§1) has no `threshold` field at all. The
static `Award` type (`types/index.ts:55`) and `lib/data/awards.ts` both carry
`threshold` (e.g. `"80–89 pts"`, `"90+ pts"`), and `AwardsGrid.tsx:17` renders it
conditionally. **This field was silently dropped during seeding and does not exist in
the dataset today.**

## 3. Recommendation: `award` → wire it

Reasoning: real content, already seeded, already matches production wording, and at
least one document already shows a real edit that had no visible effect. Removing the
sidebar entry here would be removing a feature editors already believe they have,
not tidying up an unused one.

**What would have to change (dev work, not part of this recon):**

1. Add a `threshold` string field to `sanity/schemas/documents/award.ts` (the
   `description`-conditional-render pattern in `AwardsGrid.tsx:17` already handles an
   empty/missing value gracefully, so this can ship without a hard migration
   gate).
2. Backfill `threshold` on the 6 existing documents. **This is mechanical, not a
   content-authoring job requiring Brad** — the 6 values already exist verbatim in
   `lib/data/awards.ts` (AM/SAOC "80–89 pts", FCC/SAOC "90+ pts", HCC/SAOC "75–79
   pts", CCM/SAOC "80+ pts", CBR/SAOC "—", JC/SAOC "—") and can be patched via one
   small script using the existing `SANITY_API_TOKEN`, the same pattern
   `scripts/seed-sanity.ts` already uses.
3. Add an `awardsQuery` to `sanity/queries.ts` (`*[_type == "award"]{ _id, code, name,
   description, threshold }`).
4. Wire `app/(marketing)/judging/page.tsx` to fetch it server-side and pass the
   result into `AwardsGrid.tsx` as a prop, replacing the `import { awards } from
   '@/lib/data/awards'` — same pattern already used for `boardMembersQuery` →
   board-members display.
5. Once verified live, retire `lib/data/awards.ts` and the static import to remove
   the dual-source-of-truth risk (don't delete it in the same change as the wiring,
   in case of rollback need).

**Does the static source need migrating first?** No — it's already migrated (seeded
2026-06-30). Only the missing `threshold` field needs adding + a mechanical backfill;
no new domain knowledge or Brad input is required for that specific gap.

**Judgment call worth flagging, not deciding here:** the static array's display order
(AM, FCC, HCC, CCM, CBR, JC) is curated, not alphabetical. A raw `_type == "award"`
GROQ query with no `order()` won't reproduce it. Whoever implements the wiring should
either add an `order` numeric field (same pattern as `boardMember.order`) or confirm
alphabetical/another order is acceptable.

## 4. Recommendation: `province` → remove the sidebar entry only

Reasoning: `society.province` is a working free-text field, already filtered/rendered
correctly today via the static `lib/data/provinces.ts` list (9 fixed South African
provinces — this is not data that changes, unlike awards or events). Converting it to
a reference would require: changing `society.province` from `string` to
`reference`, migrating all existing `society` documents' string values to references,
rewriting `societyListQuery`/`societyBySlugQuery` to dereference (`province->{name,
code}`), and rewriting `SocietiesClient.tsx`'s filter-matching logic (currently a
simple string-equality check) — real engineering effort with **no functional gain**,
since there is no province-specific page, content, or metadata anywhere in the repo,
design spec, or `documents/` correspondence that would need a `province` document to
exist (checked `design/`, `design spec/`, and `documents/*.md` for any mention of a
province landing page or province-specific content — found none).

**Prior expectation tested, not just confirmed:** I looked for evidence the other way
(a reason `province` should be wired) and didn't find one. The one place a
similar-sounding feature is discussed — an "awards archive/gallery" — is unrelated to
provinces (see §6).

**Exactly what to remove:** the `'province'` entry from `COLLECTION_TYPES` in
`sanity/structure.ts:41` only. **Do not** remove `province` from `schemaTypes` in
`sanity/schemas/index.ts`.

**Why not remove the schema type too:** there are 9 published documents. If the
schema type is deregistered while documents of that type still exist in the dataset,
Sanity Studio can no longer render/validate them — they become untyped/orphaned
("Unknown type") entries that still occupy the dataset and are still returned by
`_type == "province"` GROQ queries (so a future accidental query against them
wouldn't error, it would just get untyped data back), but can no longer be edited
normally through Studio and complicate any future decision to actually use the type.
Removing just the sidebar entry hides the type from editors (closing the "looks
editable, does nothing" trap) while leaving the door open to wire it later with zero
data-recovery work, and is trivially reversible (re-add one array entry) if the
recommendation turns out to be wrong.

**Not decided here, flagged for Brad/architect:** whether the 9 `province` documents
should eventually be deleted outright. That's a separate, higher-stakes call (mutates
the dataset) than hiding a sidebar entry, and doesn't need to happen now — an orphaned
schema type with a hidden sidebar entry causes no harm sitting there.

## 5. If `remove` is approved — exact change (for whoever implements it)

Single-line removal in `sanity/structure.ts`:

```diff
 const COLLECTION_TYPES = [
   'society',
   'boardMember',
   'societyEvent',
   'show',
   'showClass',
   'award',
   'sponsor',
   'judge',
-  'province',
 ];
```

No other file needs to change for this — `province` stays in `schemaTypes`
(`sanity/schemas/index.ts`), the 9 documents stay exactly as they are, and nothing
else in the codebase references the type (§ "Verification" above).

## 6. Flag for Brad — don't conflate `award` with the "awards archive" idea

`documents/SAOC-Secretary-Response-Draft-2026-07-01.md:70` and
`documents/SAOC-LeeAnn-Call-Prep-2026-07-20.md:26,86` describe a **different**,
larger feature already on Brad's radar: a searchable public "awards gallery/archive"
of *results* — grand champions, category winners, photographs — per National Show,
described as "a natural extension of data the current site already models (each show
record can store its winners and gallery images)." That is a per-show,
per-exhibitor/plant results archive — a different data shape entirely from the
`award` type recon'd here, which is just the **6 standard award-grade definitions**
(AM/SAOC, FCC/SAOC, etc.) used as a static reference glossary on the `/judging` page.

Wiring the `award` type as recommended in §3 does not build the archive feature and
should not be presented to Brad as progress toward it — it only fixes the immediate
"CMS type does nothing" problem for the existing 6-item glossary. The archive is a
separate, future schema-design conversation (likely a new type, e.g. tied to `show` +
exhibitor + plant + category, per the secretary correspondence) that needs its own
scoping, exactly as the response draft itself says it "would need its own scoping
discussion."

**Also flag:** `award.year` (number field, `null` on all 6 documents, read nowhere in
the codebase) looks vestigial — possibly copy-pasted from a similar field on `show`.
Whether it means something specific (e.g. "year this grade was established/amended")
or should just be dropped during the §3 wiring pass is a judgment call, not something
this recon determined either way.

## Explicitly not done

No code, schema, structure.ts, contracts/, or dataset content was changed. No
documents were created, edited, or deleted in Sanity — every Content Lake call was a
GROQ read against the existing dataset. No secret values were printed, logged, or
echoed (token was piped directly from `.env.local` into `curl` headers). `pnpm build`
was not run; port 3333 was not touched.
