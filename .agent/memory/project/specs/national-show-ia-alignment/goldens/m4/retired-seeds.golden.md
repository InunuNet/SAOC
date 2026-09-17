# Golden — retiring four seed files explicitly, and the two mislabelled sections

Brad's approved tree removes four pages. Their seed files become orphans. An orphan seed is
not harmless: it stays in the corpus the linkage and provenance checks scan, it stays a
plausible `pageKey` for a future route, and nobody can tell whether it was retired on purpose
or forgotten.

**Rule: retire explicitly, and never delete Lee-Ann-sourced content without recording where
it went.**

---

## 1. The four retired seeds

| pageKey | spec | why | council content in it? |
|---|---|---|---|
| `08-judging-and-awards` | 8 | no NOS-level judging page; site-level `/judging` exists and a duplicate splits the record | **none** — all three sections are `placeholder-ai` |
| `09-plant-exhibition-and-sales` | 9 | no plant-exhibition page; the competitive display is What to Expect plus `/judging` | **none** — all three sections are `placeholder-ai` |
| `10-plant-sales` | 10 | no plant-sales page; the sales area is described inside the SA Exhibitors document | **none** — all three sections are `placeholder-ai` |
| `18-contact-us` | 18 | no NOS contact page; a second inbox is an unwatched inbox. Site-level `/contact` is the `saoc-eb` lane's | **yes** — `overview` is `council-supplied` against a real Drive source |

Verified by reading each file's `provenance` values before writing this golden — 08, 09 and 10
carry `placeholder-ai` on every section, so retiring them loses nothing of hers. 18 does not,
and is handled separately in §3.

## 2. The mechanism

**Move, do not delete.** Each file moves to `content/show-pages/retired/<file>.json`, and
`content/show-pages/_retired.json` records the decision.

```json
{
  "schema": "saoc.retired-seeds/v1",
  "retired": [
    {
      "pageKey": "18-contact-us",
      "specNumber": 18,
      "file": "content/show-pages/retired/18-contact-us.json",
      "retiredOn": "2026-09-10",
      "ruling": "Brad, 2026-09-10 — no NOS-level contact page. A second inbox is an unwatched inbox; site-level /contact is owned by the saoc-eb lane.",
      "sourceProvenance": "council-supplied — content/drive-source/National Show/18. Contact/2027 Show Contact information/v1.0/content.md",
      "contentDisposition": "The Drive source document is retained unmodified at that path and is the canonical record. This lane publishes none of it. Routing enquiries to the site-level /contact page belongs to the saoc-eb lane; no NOS page consumes this seed."
    }
  ]
}
```

Every entry carries all seven keys, each non-empty. `contentDisposition` answers **where the
words went** — for 08, 09 and 10 the honest answer is "nothing of the council's was in this
file", and that is a valid disposition precisely because it was checked rather than assumed.

## 3. Retirement must not launder a defect

`lib/data/show-pages.ts`'s content-linkage check currently **correctly fails** two sections
whose body is our own prose but is labelled `council-supplied`. One of them is in a file being
retired. Moving it would make the failure disappear without fixing anything — the exact
pattern this project has audited before as "an assertion satisfiable by something that is not
the real property".

So the corpus splits in two, deliberately:

| check | corpus |
|---|---|
| **route / seed resolution** (`RM1`, `R1`) | `content/show-pages/*.json` top level only — `retired/` is invisible |
| **content linkage and provenance** (`CL4`) | `content/show-pages/**/*.json` — `retired/` **included** |

A retired file with a mislabelled section fails the gate exactly as it did before it moved.

## 4. The two mislabelled sections — the M1 defect this closes

### `content/show-pages/13-booking-tickets.json` § `categories`

Named source: `content/drive-recovered/13-booking-tickets/ticketing/content.md` — a real file.
Read in full while writing this golden: it is a **developer specification addressed to Brad**
("VERY IMPORTANT: DON'T PUT THE PRICES INTO THE FORM CODE", "I recommend collecting…"), not
visitor-facing copy the council authored for publication. Our section paraphrases it.

**Ruling: reclassify to `placeholder-ai`.** Not `research`, and not a verbatim excerpt.

- A verbatim excerpt is wrong on the merits — quoting a developer spec on a public ticketing
  page publishes internal instructions.
- `research` means researched-but-unconfirmed *fact*; this is our prose summarising her
  instructions, which is what `placeholder-ai` means.

The section then carries the placeholder notice, which is the truthful signal: these words are
ours and the council has not approved them. `sourcePath` is kept as provenance of what the
summary was drawn from, and the linkage check does not run on `placeholder-ai`.

`/national-show/tickets` is the `saoc-eb` lane's route. Editing this seed's `provenance` field
edits a JSON file M1/M3 wrote in **this** lane; it does not touch their route.

### `content/show-pages/18-contact-us.json` § `overview`

Same failure, same fix — reclassify to `placeholder-ai` **before** the file moves to
`retired/`, so the correction is in the retired copy and the words are preserved.

## 5. Never loosen the threshold

`MIN_LINKAGE_SENTENCE_CHARS = 25` in `lib/data/show-pages.ts` **stays exactly 25**. The check
is correct; the content was wrong. Its own comment already reasons the value out (a 4-word
fragment matches nearly anything; a real sentence fragment does not).

Assertions pin this three ways, because "do not loosen it" is easy to satisfy in letter and
break in spirit:

- `CL3a` — the literal `MIN_LINKAGE_SENTENCE_CHARS = 25` is present.
- `CL3b` — the comparison is still exact containment on normalized text: no `fuzzy`,
  `similarity`, `levenshtein`, `startsWith`, `some(` or `distance` appears in the linkage
  region of `lib/data/show-pages.ts`. Raising the bar to 25 and then matching *loosely* would
  pass `CL3a` and defeat the check entirely.
- `CL3c` — `linkage` is still applied to `council-supplied` **and** `council-draft`, i.e. the
  set of provenances it guards was not narrowed instead of the threshold being lowered.

## Assertions

| id | check |
|---|---|
| `RS1` | `content/show-pages/_retired.json` validates: exactly the four pageKeys, all seven keys present and non-empty on each |
| `RS2` | no retired pageKey appears in `content/national-show-routes.json`, in the top-level seed corpus, or as a route on disk |
| `RS3` | every retired file exists at its recorded path, and its section **body text** is byte-identical to the pre-M4 version — only `provenance` may differ. Proves "moved and relabelled", never "quietly edited or dropped" |
| `RS4` | the four never-create slugs 404 locally (also `L6`) |
| `CL1` | `13-booking-tickets` § `categories` passes linkage — reclassified, or every meaningful sentence occurs verbatim in the named source |
| `CL2` | `retired/18-contact-us` § `overview` likewise |
| `CL3a/b/c` | the threshold, the exactness, and the guarded provenance set are all unchanged |
| `CL4` | whole-corpus linkage passes with **zero** failures, `retired/` included |
| `CL5` | **no `council-supplied` seed section omits source content the live route already renders** — see below |

## 6. `CL5` — the direction the linkage check never covered

Found at revision 3, re-reading the merged tree. The linkage check is **one-directional**: it
proves every sentence in the body occurs in the named source. Nothing proved the converse —
that what is in the source made it into the body.

`content/show-pages/02-about-the-national-show.json` holds **1,372 characters** of a **2,587-character**
source. The deployed `/about` page renders the source in full. Absent from the seed, present in
both source documents and on the live page: the vendors-and-sponsors paragraph and the closing
paragraph.

Had M4 reconciled `/about` onto `loadShowPage` as revision 2 intended, **roughly half of
Lee-Ann's About copy would have vanished from a live page with every check green.**

`CL5`: for every `council-supplied` section whose route already renders content from the same
source, every source sentence the route renders must also be in the seed. **The resolution is
to complete the seed from the source — never to trim the page to match the seed.**

## What this does not settle

- **Whether the site-level `/contact` page should carry the show's contact details.** It is
  the `saoc-eb` lane's page and their call. The Drive source is named in
  `contentDisposition` so they can find it.
- **Whether `13-booking-tickets` should be seeded at all**, given `/national-show/tickets` is
  theirs. Left as-is: deleting a seed another lane may consume is a bigger decision than this
  milestone should make on its own.
