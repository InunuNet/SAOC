# F1 + F2 — vendor naming decision and `vendorNursery` schema: decision record

Mission `vendor-registration` (`.agent/memory/project/missions/2026-08-17-vendor-registration.md`),
features F1 and F2 only. F3-F11 (public page, Firestore submission pipeline, review workflow,
payment path, permits, human proof, POPIA flag) are **not** in this contract's scope and nothing
here builds toward them beyond the naming convention F1 fixes for later features to follow.

**DO NOT IMPLEMENT.** This contract is architecture only. @dev implements against the golden
files and assertions below; nothing under `sanity/`, `lib/`, `app/`, `scripts/` was touched while
writing this contract.

---

## Source document — read directly, not trusted from the mission brief

Lee-Ann's "South African Exhibitors" brief, Google Drive file `1UKUdzZ9NAJHsqWHSV0mN9tnTrp6NE8I4`
(an uploaded `.docx`, owned by `2027national@gmail.com`), fetched 2026-08-17 via
`gws drive files get --params '{"fileId":"1UKUdzZ9NAJHsqWHSV0mN9tnTrp6NE8I4","alt":"media","supportsAllDrives":true}'`
(export fails on it — it is a binary upload, not a native Google Doc) and extracted from
`word/document.xml`. Full extracted text is reproduced in the mission brief's "Source" section
and matches what this contract read independently. **No discrepancy found** between the mission
brief's inline description of F1/F2 and the actual document — both the field list and the
"Available at the Show" tag set match exactly:

> Every nursery has: Nursery logo / Country / Owner / Short history / What they specialise in /
> Plants they will bring / Website / Social media.
>
> You could even include: Available at the Show — Species orchids / Hybrids / Miniatures / South
> American species / Asian species / Growing supplies.

(document lines 8-24, `contracts/checks/vendor-f1f2-naming-and-nursery-schema/fixtures/` records
both lists verbatim for the checks to diff against, rather than re-typing them a second time
somewhere a future edit could silently diverge from this README.)

One field genuinely is **not** itemised in the source list: a nursery *name*. See "Judgement call
1" below.

---

## F1 — naming decision (already made by Brad/team-lead; recorded and gated here)

**Decision, not up for re-litigation in this contract:** internal identifiers use `vendor*`
throughout this mission:

| Concept | Internal name | Built by |
|---|---|---|
| Public showcase document type | `vendorNursery` | **F2, this contract** |
| Registration submission document type (future) | `vendorRegistration` | F4 (not this contract) |
| Firestore submission collection (future) | `vendorSubmissions` | F4/F5 (not this contract) |
| Public showcase route (future) | `/national-show/vendors` | F3 (not this contract) |
| Public submission API route (future) | `/api/vendors/register` | F5 (not this contract) |

**Why:** `sanity/schemas/documents/showExhibitorInfo.ts` and `showExhibitorStep.ts` already ship
an unrelated feature — the judged-competition entry guide behind `/national-show/exhibitors`,
documented in `docs/show-exhibitor-info.md` and `docs/exhibitor-guide-for-editors.md`. Lee-Ann's
document uses "Exhibitors" for something else entirely: commercial nurseries selling from trade
booths. Her own registration form disambiguates for us — it is titled "2027 SAOC NATIONAL SHOW
**VENDOR** REGISTRATION FORM" (document line 26) — so "vendor" is not an invented word, it is
lifted from the source. Two meanings of "exhibitor" in one repo is a standing trap for every
future search, grep, and onboarding read; this decision closes it before any vendor code exists.

**What stays "Exhibitors":** Lee-Ann's public-facing prose — the four intro paragraphs quoted in
the mission brief, including the phrase "South African Exhibitors Pavilion" — is not renamed.
That is F3's concern (rendering her prose verbatim) and out of this contract's scope; this
contract only fixes the *internal* vocabulary.

**Public route name** (mission's "Open Question 4" — who decides `/national-show/vendors` vs.
`/national-show/exhibitors-showcase`): team-lead's dispatch message states this decision is
already made — `/national-show/vendors` — and instructs F1 to record, not re-open, it. That
supersedes the mission brief's framing of it as still-open. Recorded here for F3's benefit; not
gated by any assertion in this contract since no route file exists yet to check.

### What F1 gates, concretely

Nothing under F3-F11 exists yet, so F1's "no collision" claim can only be checked against what
*does* exist today: the new `vendorNursery` type (A1, A3) and the untouched old `exhibitor`
feature (A2). The future `vendorSubmissions`/`vendorRegistration`/route names are recorded above
as a decision, not gated — a check asserting "the string `exhibitorSubmissions` does not appear
anywhere in the repo" would pass today by pure absence and prove nothing (see "Contract scoring
principles" — a check that can only vacuously pass is not a defence). That guard belongs in F4/F5's
own contract, written against the code that will actually exist then.

---

## F2 — `vendorNursery` schema: field-by-field design

Modelled on `sanity/schemas/documents/sponsor.ts` per the dispatch brief — logo + descriptive
fields + external links, editor-authored, no `groups`, no `orderings` needed (sponsor.ts has
neither). One document per nursery, not an array on a singleton, for the same reason
`showExhibitorStep.ts`'s own comment gives (quoted there): the number of nurseries is exactly
what changes most often between now and the 2027 show, and each nursery benefits from its own
Studio URL and edit history — a committee member should be able to hand one nursery's Studio link
to that nursery's contact for review, which an array-on-singleton design cannot offer.

| Field | Type | Required | Source |
|---|---|---|---|
| `name` | `string` | **yes** | not itemised — see Judgement call 1 |
| `logo` | `image` | no | "Nursery logo" |
| `country` | `string` | no | "Country" |
| `owner` | `string` | no | "Owner" |
| `history` | `text` | no | "Short history" |
| `specialisation` | `text` | no | "What they specialise in" |
| `plantsBrought` | `text` | no | "Plants they will bring" |
| `website` | `url` | no | "Website" |
| `socialMedia` | `array` of `{platform, url}` | no | "Social media" — see Judgement call 2 |
| `availableAtShow` | `array` of `string`, fixed `options.list` | no | "Available at the Show" — see Judgement call 3 |

### Judgement call 1 — adding `name`

The source document's "Every nursery has" list never says "name" — it is implicit (a nursery is
referred to by its own name throughout the prose, e.g. "many of South Africa's most respected
orchid nurseries"). Every other document type on this site that represents a named entity has an
explicit `name`/`title` field (`sponsor.name`, `judge.name`, `society.name`) and F2's own Done
criterion in the mission brief says "**preview shows nursery name + country**" — which is
impossible without a field to read the name from. `name` is added, typed `string`, and marked
`Rule.required()` — the only required field in this schema — because an unnamed nursery is
unusable in both the Studio document list and the future showcase grid. Gated by A1 (the field
exists and is required) and A6 (preview actually surfaces it).

### Judgement call 2 — `socialMedia` shape

No existing schema type on this site has a social-media-link pattern to copy (checked: no
`social` identifier anywhere under `sanity/schemas/` before this contract). The dispatch brief
allows either "array of {platform, url} or free-text handles — match sponsor.ts's existing
link-object pattern if one exists." None exists, so this contract specifies an inline array-of-
objects (`platform`: string, `url`: url) rather than free text, because a nursery plausibly runs
more than one social account (Facebook *and* Instagram) and a single free-text field cannot hold
both without delimiter-hacking. Kept as an inline object definition (not a separate registered
Sanity object type in `sanity/schemas/objects/`) — this is the only place this shape is used, so
a new shared type would be premature abstraction for a two-field object. Gated by A5.

### Judgement call 3 — `availableAtShow` as a fixed multi-select, not free text

Not actually a judgement call — the dispatch brief is explicit ("must be a fixed `options.list`
multi-select, not free text, so the showcase can filter and badge consistently") and the source
document's own bullet list (6 items, document lines 19-24) is a closed set. Recorded here only to
name the exact mechanism: `type: 'array', of: [{ type: 'string' }], options: { list: [...] }` —
the standard Sanity checkbox-multi-select pattern (field-level `options.list` on an array field,
distinct from `sponsor.ts`'s `tier` field, which is a *single*-select string with the same
`options.list` mechanism but no `array`/`of` wrapper). Exact 6-value list and order, extracted
directly from the `.docx` and stored once in
`contracts/checks/vendor-f1f2-naming-and-nursery-schema/fixtures/expected-availability-tags.json`
so the check and this README can never silently diverge from each other: `Species orchids,
Hybrids, Miniatures, South American species, Asian species, Growing supplies`. Gated by A5.

### Judgement call 4 — no `active` boolean

`sponsor.ts` has an `active: boolean` field for hiding a sponsor without deleting its edit
history. This contract deliberately does **not** add the equivalent to `vendorNursery` — not
because it is a bad idea, but because it is implementation discretion this contract chooses not
to force: nothing in the source document or the dispatch brief asks for it, and adding
unrequested fields to a contract whose whole purpose is precise field-by-field gating risks
scope creep beyond what was actually specified. @dev MAY add it; no assertion here requires or
forbids it either way.

### Preview

```
preview: {
  select: { title: 'name', subtitle: 'country' },
  prepare: ({ title, subtitle }) => ({ title: title ?? 'Untitled nursery', subtitle }),
}
```

The `?? 'Untitled nursery'` fallback is not itself gated by name/type — A6 only requires
`prepare()` not to throw and not to return `title === undefined` on an empty document; the exact
fallback string is @dev's choice.

---

## Registration

`vendorNursery` is added to `sanity/schemas/index.ts`'s `schemaTypes` array — a new import line
plus a new array entry, following the existing `sponsor`/`judge`/`showFaq` collection-document
grouping (not the "Singletons" block at the top). No structural reorganisation of the file.

---

## `npx tsx` vs `node --import tsx/esm` — checked, does not apply here

Every check in this contract uses `node --import tsx/esm`, not `npx tsx` (contrast
`contracts/golden/ticketing-f10-itn-repin/README.md`'s note on the same question, which this
contract's author re-read before writing any check here). The trap only bites when the imported
file's transitive import graph contains a VALUE import through the `@/*` tsconfig alias — `node
--import tsx/esm` strips TypeScript syntax but does not resolve that alias.

`sanity/schemas/documents/vendorNursery.ts`, following `sponsor.ts`'s own pattern exactly, has
**no imports beyond `sanity` itself** (`defineField`, `defineType`). `sanity/schemas/index.ts`
likewise only imports sibling files under `sanity/schemas/**`, none of which reach into `lib/`,
`app/`, or anywhere else `@/*` is used. **This is a design constraint on F2's implementation, not
just an observation**: if @dev adds any `@/*` value import to either file, every `node --import
tsx/esm` check in this contract (A1, A2, A3, A5, A6) will fail with `Cannot find module '@/...'`
against otherwise-correct code — the same false-negative ticketing-f10 paid for twice. There is no
legitimate reason for a Sanity schema-definition file to import from `lib/` or `app/`, so this
constraint should never bind in practice; it is stated explicitly so a QA/dev reading a red gate
here checks the command before suspecting the code.

---

## Assertion list, each with its named defeating mutation

| ID | Proves | Defeating mutation |
|---|---|---|
| A1 | `vendorNursery.name === 'vendorNursery'`, registered exactly once in `schemaTypes`, no duplicate object under that name | Naming it `exhibitorNursery` or `vendor` (no suffix); registering a second, different object under the same string name |
| A2 | `showExhibitorInfo`/`showExhibitorStep` (name, type, `showExhibitorStep`'s 6 fields) and their route file are byte-identical in effect to before this mission; every identifier from the recorded baseline still registered | "Cleaning up" by renaming the old feature to match the new convention, or dropping a field while refactoring nearby |
| A3 | No field name/title/description on the real `vendorNursery` object contains "exhibitor", scanned recursively over the whole object graph (comments excluded — they aren't part of the runtime object) | Copy-pasting a `defineField()` block from `showExhibitorStep.ts` and forgetting to rename the field or its editor-facing description |
| A4 | `vendorNursery.ts` exists AND the isolated schema-tree type-check passes | Never writing the file at all — `test -f` first because bare `tsc` was confirmed live on 2026-08-17 to silently skip a missing `include` entry rather than error, which would make the type-check assertion vacuously pass forever |
| A5 | Every field's Sanity type is correct; `socialMedia`'s object member has `platform`+`url`; `availableAtShow.options.list` is exactly the 6-tag set in source order | Typing `availableAtShow` as free-text `string` with no `options.list` — passes a "field exists" check but fails this one's `options.list` diff against the fixture |
| A6 | `preview.select` maps to `name`/`country`; `prepare()` run against a fixture document actually returns them; does not throw on an empty document | `select` declared correctly but `prepare()` returns a hardcoded string, or points at a non-existent `title` field (this type has none) |
| A7 | `eslint` passes with zero errors on the two touched files | An unused import, a stray `console.log`, or another lint-error-level regression in either file |

---

## What this contract does NOT prove

- **Nothing about F3-F11.** No public page, no GROQ query, no Firestore collection, no API route,
  no admin review workflow, no email, no payment path, no POPIA note exists or is checked here.
- **No live Sanity round trip.** Every check is a pure in-process import and static inspection —
  no `SANITY_API_TOKEN`, no network call, no document ever created, read, or deleted in the
  actual Content Lake. This is deliberate (design constraint: "No check may create, write or
  delete any Sanity or Firestore document, ever") but it also means Studio's *actual rendering* of
  this schema — does the image picker really work, does the multi-select checkbox UI really
  render six checkboxes, does the preview list really show the right thumbnail — is never
  observed by this contract. That is a real gap between "the schema object is shaped correctly"
  and "an editor can use it correctly in Studio," closed only by opening Studio and looking, which
  no assertion here does.
- **No route-name collision guard for `/national-show/vendors`** against Next.js's actual router,
  since no route file exists yet. F3 must re-verify no existing route already claims that path
  segment (grep of `app/(marketing)/national-show/` at build time is sufficient there).
- **No guard that a future F4/F5 actually uses the names `vendorRegistration`/`vendorSubmissions`**
  — recorded as a decision in this README, not gated, per "What F1 gates, concretely" above.
- **No accessibility, responsive-layout, or visual check** — there is no rendered output yet to
  check; F3 owns that per the project's mobile-first/accessibility coding rules.
- **No proof that `availableAtShow`'s tag set is what the show committee will actually settle on**
  — it is exactly what Lee-Ann's document says today (verified 2026-08-17); if the committee
  changes the list later, this contract's fixture and assertion must be updated together, not
  just one of them.
