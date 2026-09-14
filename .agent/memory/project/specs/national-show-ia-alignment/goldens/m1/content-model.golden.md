# Golden — National Show content model (M1)

Authoritative shape for the Sanity types M1 introduces. @dev implements against this
file, not against prose in the contract. Any deviation needs this golden changed first.

## Decision: ONE `showPage` document type, not 18 singletons

The spec's Section 1B names 18 National Show pages (spec content.md:14-33). Three models
were weighed.

| model | verdict |
|---|---|
| 18 per-page singleton document types (the existing `aboutPage` / `contactPage` pattern) | **rejected** |
| One `showPage` document type keyed by an immutable `pageKey`, carrying an ordered `sections[]` array | **chosen** |
| Page shell plus a library of free-form reusable block objects (full page-builder) | **rejected for M1** |

**Why not 18 singletons.** The existing singleton pattern (`sanity/structure.ts:13-27`)
costs one schema file, one entry in `schemaTypes`, one entry in `PINNED_SINGLETON_TYPES`
and one entry in `SINGLETON_TITLES` per page — four developer edits for every page added.
Spec 2.8 (content.md:77-79) requires content that changes as the event approaches to be
editable "without developer assistance"; 18 types make a 19th page a developer ticket.
Worse for this mission specifically: the provenance gate (see `provenance-gate.golden.md`)
would then live in 18 separate schema files, i.e. 18 places to forget it. One type means
one place, which is what makes the gate provable at all.

**Why not a full page-builder.** Free-form blocks put layout decisions in the dataset. We
build these page templates ourselves (scope reversal, 2026-09-09), and a page-builder would
hand structural decisions to Sanity editors instead — producing a dataset no template can
make design promises about, and re-opening the visual decisions that belong to the NOS
design system, not to a content editor.

**Why `sections[]` and not one flat `body`.** Pages 3, 9, 16 and 17 mix council-supplied
facts with material nobody has supplied yet (research scratch section 1, rows 3, 9, 16, 17).
A page-level flag would force one dishonest answer for the whole page. Section-level
provenance lets page 3's real marketing prose read as real while its missing operational
facts (hours, parking, photography policy — spec 4.3) read as placeholder, and lets
Lee-Ann clear one block at a time.

## Entity-collection pages are NOT prose pages

Spec pages 4, 5, 8, 11, 12 and 15 are databases, not articles — spec 2.6
(content.md:66-68) and Section 7 (content.md:600-613) require an exhibitor, guest,
speaker, sponsor, judge, society or workshop to be "created once in a structured database
and referenced wherever it is needed, rather than re-entered."

M1 does **not** build those entity types. M1 makes sure the page model does not block
them: `showPageSection.kind` is an enumerated string with `prose` as the only value M1
implements, plus reserved values `entityList` and `programme` that M1 declares in the
options list and renders as nothing. M2 adds the entity types and the reference fields,
without reshaping any M1 document.

Reserved `kind` values and their intended M2 owners:

| kind | M2 entity type | spec pages |
|---|---|---|
| `prose` | none (implemented in M1) | all |
| `entityList` | `showExhibitorProfile`, `showGuestProfile`, existing `sponsor`, existing `judge` | 4, 5, 8, 10, 15 |
| `programme` | `showSession` plus a speaker reference | 6, 7, 11, 12 |

`sponsor` and `judge` already exist as document types (`sanity/schemas/index.ts:14,17`) —
M2 extends them, it does not replace them. `society` already exists and spec entry 14 needs
no entity work at all (see below).

## Spec entry 1 is a landing page, and there is no NOS home page

`.agent/memory/project/rules.md` — "Site hierarchy — NOS is a SUBSECTION of saoc.co.za.
Never re-litigate this." saoc.co.za is the only home page on this site. The National Orchid
Show is a promotional event subsection, branded as if it were a different company, but that
branding is presentation only and never earns it a home page.

Lee-Ann's spec entry "1. Home" therefore means the **`/national-show` landing page, which
already exists**. Its document is keyed `01-national-show-landing`, never `01-home`, and the
word "home" appears nowhere in this model — a key is read by every future developer, and
`01-home` would reintroduce the exact misreading the rule was written to stop.

It still gets a document, because spec 4.1 puts editable content on that page (hero title,
subtitle, supporting text, news) and 2.1 and 2.8 require a non-technical SAOC user to edit
it without a developer. A landing page whose copy is hardcoded in `page.tsx` fails both. The
document makes the copy editable; it does not make the subsection a site.

## Spec entry 14 is a link, not a page

Lee-Ann's own reply on spec 4.14: *"Not sure why we will have this page – it should
remain at the SAOC section. As much as it is important information, it is not relevant to
the actual reason for the show."* — and the sitemap footnote (content.md:29): *"It will
just be a small icon possibly or a button that directs them to the society pages."*

So spec entry 14 gets **no `showPage` document at all**. It is a link to `/societies` in
the navigation and on the landing page's quick links, and nothing else. Modelling it as a
page would be modelling something Lee-Ann asked us not to build.

That is why there are **17 documents for 18 sitemap entries** — specNumbers 1-13 and 15-18.
`route-map.golden.md` shows the full arithmetic.

## `showPage` — document

```
showPage
  pageKey        string   required, unique, immutable after seed.
                          Format: /^[0-9]{2}-[a-z0-9-]+$/  e.g. "04-south-african-exhibitors"
                          The two-digit prefix is the spec's own Section 4 page number, so
                          the Studio list sorts into sitemap order with no ordering field.
  specNumber     number   required, integer 1..18, excluding 14. Redundant with pageKey's
                          prefix on purpose: it is the machine-readable join back to spec
                          Section 4 and is what the seed-source cross-check asserts against.
  title          string   required. The page's own H1 text, editable by the council.
  summary        text     optional. One or two sentences; used for cards and meta
                          description. NOT a section — it has no independent provenance and
                          therefore must never carry a factual claim. See the gate golden.
  sections       array of showPageSection, required, minimum length 1.
  seoTitle       string   optional
  seoDescription text     optional
  seoImage       image    optional
```

The three `seo*` fields exist because spec 2.4 (content.md:58-60) requires every page to
have an editable SEO title, meta description and social-sharing image, managed per page.

Document `_id` is deterministic: `showPage.` followed by the pageKey — e.g.
`showPage.04-south-african-exhibitors`. Deterministic ids are what make the seed script
idempotent (see `seeding-reconciliation.golden.md`), and they make a duplicate page
detectable by id rather than by fuzzy title match.

`pageKey` uniqueness is enforced twice, because Sanity has no native unique constraint:

1. `validation: (Rule) =` an arrow returning `Rule.required().regex(...)`, plus an async
   custom rule that queries for another document of the same type with the same `pageKey`
   and a different `_id`.
2. The GROQ read is `*[_type == "showPage" && pageKey == $pageKey]` — the loader takes the
   whole array and **throws when it holds more than one document**, rather than silently
   taking `[0]`. The existing "unordered result, silent `[0]`" hazard is documented at
   `sanity/structure.ts:5-9`; this model cannot use the singleton pin that fixed it there,
   so it fails loud instead.

## `showPageSection` — object

```
showPageSection
  sectionKey   string   required. Stable, lowercase-kebab, unique within the page.
                        Seed reconciliation keys off it — see the seeding golden.
  heading      string   optional. Absent means the section renders without its own heading.
  kind         string   required, list: prose | entityList | programme. initialValue 'prose'.
                        A default is safe HERE and only here: `kind` is a rendering
                        selector, not a truth claim. Contrast `provenance` below.
  body         portableText   required when kind == 'prose'.
  provenance   string   required. NO initialValue. list:
                          council-supplied | research | placeholder-ai
                        See provenance-gate.golden.md — this field is the mission.
  sourcePath   string   conditionally required: required when provenance is
                        'council-supplied'. A repo-relative path under
                        content/drive-source/ or content/drive-recovered/ naming the
                        council document the copy came from. Asserted to exist on disk
                        by the seed-source check.
  seedHash     string   hidden, readOnly. Written by the seed script only. Holds a hash of
                        the body the script last wrote, so a re-run can tell "we wrote this
                        and nobody has touched it" from "a human edited this". Never read
                        by the site.
```

Every array member's `_key` is **derived**, never random: the pageKey, two hyphens, then
the sectionKey. `scripts/seed-show-visitor-info.ts:20-21` records why — "a random key
changes the document on every run and defeats idempotence."

## `showPageSettings` — pinned singleton

The notice wording is content, not code, so the council can reword it without a developer
(spec 2.1, content.md:43). Follows the existing `pendingLabel` / `researchLabel` precedent
at `sanity/schemas/documents/showVisitorInfo.ts:26-46`.

```
showPageSettings                    _id === "showPageSettings", pinned in structure.ts
  placeholderLabel   string  required  short badge text for provenance 'placeholder-ai'
  placeholderNotice  text    required  the full sentence shown above the copy
  researchLabel      string  required  short badge text for provenance 'research'
  researchNotice     text    required  the full sentence shown above the copy
```

All four are `Rule.required()`. If the singleton is missing, or a field is blank, the
loader does **not** fall back to silence — it falls back to a hardcoded constant in
`lib/data/show-pages.ts` and still renders the notice. A missing settings document must
never be able to suppress a notice; see the gate golden's fail-loud table.

## Registration

- `sanity/schemas/index.ts`: `showPage` and `showPageSettings` added to `schemaTypes`;
  `showPageSection` added to the objects block.
- `sanity/structure.ts`: `showPageSettings` appended to `PINNED_SINGLETON_TYPES` with a
  title in `SINGLETON_TITLES`; `showPage` appended to `COLLECTION_TYPES` so the council
  gets an ordinary browsable list in sitemap order.

## What this model deliberately does not do

- It does not model tickets. `ticketType` (`sanity/schemas/documents/ticketType.ts`)
  already carries the five admission products and is untouched by this mission.
- It does not model the visitor-info copy that `showVisitorInfo` already owns for
  /plan-your-visit, /what-to-expect and /faq. Those three pages map to spec pages 16, 3
  and 17, so their `showPage` documents exist, but M1 seeds them with a pointer section
  only. Whether to migrate `showVisitorInfo` into `showPage` or leave the two split is an
  M4 question, taken when those pages are reconciled, and is explicitly deferred here.
- It does not touch the vendor subsystem (`vendorApplications`, `vendorSubmissions`,
  `vendorStandOrders`) in any way.

## Binding on M2: entity types carry the same provenance field

When M2 adds `showExhibitorProfile`, `showGuestProfile` and `showSession`, each must carry
the identical required `provenance` enum with no `initialValue`, resolved through the same
`resolveNotice`. This is not a stylistic preference.

An invented prose paragraph reads as marketing. An invented **exhibitor** is a named
business that a visitor may plan a trip around, and an invented **speaker** is a named
person attributed a talk they never agreed to give. Spec 4.4 and 4.5 both require a
Confirmed / Coming Soon / Awaiting Confirmation status on exhibitors and guests already —
that is the council's own confirmation workflow and it answers a different question
("has this exhibitor committed?"). `provenance` answers ours ("did anybody tell us this,
or did we generate it?"). Both fields exist; neither substitutes for the other.

M1's job here is only to leave the door open. It does that by putting the gate in
`resolveNotice` and `ShowPageProse` — functions of a provenance value, not of a `showPage`
document — so M2's entity types reuse them unchanged.
