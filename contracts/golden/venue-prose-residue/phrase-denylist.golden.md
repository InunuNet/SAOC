# Venue-shape descriptive phrase denylist — scoped, not global

## v3 (2026-08-12) — live document vs golden copy are different claims

A third adversarial QA pass found that the architect's own v2 briefing said
"`showFaq-getting-there-3` is the untouched tone model" and let that stand for
BOTH the live Sanity document AND this golden JSON's separate copy of the same
entry. Only the live-document half of that claim was true. `TARGET_FAQ_IDS` in
`check_json_denylist.py` never included `showFaq.getting-there.3`, so the golden's
copy kept the pre-fix "not formally confirmed... planning around the Cape Town
International Convention Centre" text — exactly the `convention centre` phrase
already on this denylist — while the live document and the corrected seed script
had both already moved on to the honest tone-model text. Fixed by adding
`showFaq.getting-there.3` to `TARGET_FAQ_IDS` and `REQUIRED_FAQ_IDS`, correcting
the golden JSON's copy to match the seed script/live text verbatim, and extending
`selftest.py` with a dedicated fixture proving a stale getting-there.3-shaped entry
is caught. See README "Finding 3".

The rule this generalises: **"the live document is untouched" is a claim about the
live document. It is never automatically true of a golden file's copy of the same
content**, even when both are meant to describe the same fact. Say which artifact
was checked.

## v2 (2026-08-12)

A second adversarial QA pass found v1 of this document listed four phrases while
`check_json_denylist.py` implemented only two, and named two of the three
defective FAQ ids while the checker's `TARGET_FAQ_IDS` covered only two — a
different two. The gate went green on a checker that structurally could not
detect most of what this document claimed it detected. `check_denylist_conformance.py`
now proves this document and the checker agree; see its assertion (A22) in
`contract-venue-prose-residue.yaml`. This version expands both the documented
phrase list and the checker together, phrase by phrase.

## The phrases

| Phrase (case-insensitive) | Why it's wrong for the Hangar |
|---|---|
| `convention centre` | The Hangar is an airfield hangar, not a convention centre |
| `parking garage` | No parking garage exists at Stellenbosch Airfield |
| `Foreshore` | CTICC-specific Cape Town CBD locality; irrelevant to an airfield near Stellenbosch |
| `half an hour from Cape Town International` | Unresearched drive-time claim carried over from CTICC and re-pointed at the new name |
| `roughly 25 to 40 minutes` | Same drive-time claim family, worded differently in the golden JSON's `showFaq.getting-there.1` entry |
| `MyCiTi` | Cape Town's scheduled bus brand — does not serve Stellenbosch Airfield |
| `Civic Centre station` | The MyCiTi stop nearest CTICC — exact phrase, not the bare words "Civic Centre", which are also two real SAOC society venue names (see "Why the scoping matters" below) |
| `V&A Waterfront` | Cape Town CBD-adjacent attraction, sold in the golden JSON as "near the working venue" — the venue is now 45 km away in Stellenbosch |
| `Table Mountain` | Same — Cape Town city-bowl attraction, no longer near the venue |
| `Bo-Kaap` | Same |
| `Company's Garden` | Same |
| `Robben Island` | Same, mentioned inside the V&A Waterfront accommodation note |
| `Kirstenbosch` | Same, as a National-Show "nearby attraction" claim — a DIFFERENT, legitimate Kirstenbosch reference exists elsewhere in the repo (`lib/data/events.ts`, `lib/data/partners.ts`); see scoping note |

## Why the scoping matters — two real name collisions, verified

This denylist is venue-**characteristic**-shaped, not venue-**identity**-shaped, so
several of its phrases recur legitimately elsewhere in the repo:

- `sanity/schemas/objects/showVenue.ts:17` legitimately says "...e.g. the
  convention centre's official name" — a generic FIELD DESCRIPTION, not prose
  about this show's venue.
- `lib/data/societies.ts` and `lib/data/events.ts` contain two REAL society venues
  named "Witbank Civic Centre" and "Bloemfontein Civic Centre" (live Sanity docs
  `society-highveld-orchid-society` and `societyEvent-3-saoc-council-agm-2026`).
  The denylist phrase is the exact string `Civic Centre station` (the MyCiTi stop),
  not the bare words "Civic Centre" — this is deliberate and is what keeps those
  two venues from false-positiving. A bare "Civic Centre" phrase would have caught
  both.
- `lib/data/events.ts` (`Kirstenbosch Hall, Cape Town`, three entries) and
  `lib/data/partners.ts` (`Kirstenbosch NBG`) contain REAL, unrelated references to
  Kirstenbosch as an event venue and a partner organisation. `Kirstenbosch` as a
  bare word WOULD match these if the checker ever scanned those files — it does
  not, and never will under this design: `check_json_denylist.py` only ever opens
  one file (`seed-show-visitor-info.golden.json`) and never `lib/data/**`. The
  protection here is file-scoping, not phrase precision, exactly as it already was
  for `convention centre` against `showVenue.ts` in v1. See A1 for a proof that the
  regex itself would match `Kirstenbosch` bare, so the false-positive risk is
  demonstrated, not asserted away.

So every check in `contract-venue-prose-residue.yaml` that uses this denylist names
its target file, live document ID, or JSON field explicitly — never `grep -r`.

## In scope (checked)

- Live Sanity: `showFaq-accessibility-1`, `showFaq-getting-there-2`,
  `showFaq-getting-there-1` (drive-time claim, checked with the status invariant in
  A4, not a flat ban — see below)
- `scripts/seed-show-visitor-info.ts` — the `FAQS` array entries for
  `showFaq-accessibility-1`, `showFaq-getting-there-2`, `showFaq-getting-there-1`,
  and the `showVisitorInfoDocument`-equivalent `accessibility`/`parking`/
  `publicTransport`/`gettingThereIntro`/`accommodationIntro` prose fields in the
  same file (all already correctly cleared as of 2026-08-12 — negative controls
  A10/A11 prove this fix does not disturb them)
- `contracts/golden/show-visitor-info/seed-show-visitor-info.golden.json` — the copy
  source for the above, checked by `check_json_denylist.py` against:
  - `showVisitorInfoDocument.{parking, accessibility, publicTransport,
    gettingThereIntro, accommodationIntro}` (denylist phrases)
  - `showVisitorInfoDocument.{airportRoutes, accommodation, attractions}` (must be
    `[]`, matching the corrected seed script's cleared arrays — these fields carry
    structured Cape Town data, not just denylistable prose, so an equality check is
    the correct tool, not a regex)
  - `showFaqDocuments[_id in {showFaq.accessibility.1, showFaq.getting-there.1,
    showFaq.getting-there.2, showFaq.getting-there.3}].answer` — v3 (2026-08-12) added
    `showFaq.getting-there.3`. Its LIVE Sanity document is the untouched tone model
    (`correct-tone-model.golden.md`) and stays that way — that fact is about the
    live document only. This golden JSON's separate copy of the same entry had
    silently kept the pre-fix "not formally confirmed... planning around the CTICC"
    text because `TARGET_FAQ_IDS` never covered it in v1 or v2. See README
    "Finding 3".
  - `nationalShowVenuePatch.venue.directionsNote` — see "Current-state vs
    historical-record ruling" in README.md for why this one field of that object is
    in scope while its siblings are not
- `docs/show-visitor-info-for-editors.md` — the "Working assumption right now" line
  told to Lee-Ann (the client's editor)
- `docs/show-visitor-info.md` — the equivalent dev-facing "Seeded working-venue
  assumption" line, and the status-model table's CTICC example

## Out of scope (must NOT be touched by this fix — see README)

- `sanity/schemas/objects/showVenue.ts:17` (field description, negative control A17)
- `lib/data/shows.ts` `Durban ICC` entry (real venue, different city, already
  correctly named, negative control A18)
- `lib/data/events.ts` `Kirstenbosch Hall, Cape Town` entries and
  `lib/data/partners.ts` `Kirstenbosch NBG` (real, unrelated Kirstenbosch
  references, negative control A28)
- `society-highveld-orchid-society` / `societyEvent-3-saoc-council-agm-2026` (live
  Sanity docs, real "Civic Centre" venues, negative controls A29/A30)
- `nationalShowVenuePatch.venue.{name, addressLines, city, province, postalCode,
  latitude, longitude, mapsUrl, phone}` in the golden JSON (venue-IDENTITY fields).
  v3 correction: these are NOT "owned by `contract-venue-seed-truth.yaml`" — that
  contract's assertions never touch this golden JSON or these fields (verified by
  grep; see README "Finding 3" audit). This contract's own A13 is the only thing
  keeping them as a dated historical record, the same standing as
  `cticc-research.golden.md` — see README ruling.
- `contracts/golden/show-visitor-info/cticc-research.golden.md`,
  `venue-single-source.golden.md`, `show-identity-wiring.golden.md`,
  `assertion-discrimination.golden.md`, `README.md` (`show-visitor-info` contract's
  own historical record of the CTICC research phase — dated, attributed, accurate
  as a record of what was researched and when; rewriting history here would violate
  the same rule this contract exists to uphold, applied to golden files themselves,
  negative control A20). AMENDED 2026-08-12: the first four now carry a prepended
  "superseded" banner (docs/venue-prose-residue.md) pointing readers at the current
  venue; A20 checks their BODIES survive intact, not byte-identity with the banner
  included. A20 previously only actually checked cticc-research.golden.md despite
  this table always claiming all five — extended to genuinely cover all five.
- `contracts/golden/f4-seed-page-singletons/nationalShow.golden.json:17-18` (owned by
  `contracts/cms-loop-f3-national-show.yaml` — this contract must never touch or depend
  on that file; see README, negative control A19. AMENDED 2026-08-12: v1 of A19 asserted
  the file still PINNED the stale CTICC string, which meant it broke the moment the
  owning contract legitimately fixed its own golden — a negative control that fails on
  correct behaviour is worse than none. Rewritten to a structural proof that does not
  depend on the sibling contract's fix state: no assertion in this contract's own yaml
  may reference that file path (this contract's commands are all read-only checks, so
  "never referenced" is equivalent to "never touched").)
- `.agent/memory/project/**` (session/mission logs — historical record, not
  user-or-editor-facing content)

## The drive-time claim is a status defect, not a text defect

Unlike most phrases on this list, "half an hour from Cape Town International" /
"roughly 25 to 40 minutes" is not necessarily false — it might even be roughly
correct — but nobody has verified it against the real route to Stellenbosch
Airfield, and the live document is marked `status: research`, which this dataset's
confirmation-status model defines as "real, verified by the web team"
(`docs/show-visitor-info.md` confirmation-status table). An unverified claim
wearing a `research` badge is worse than the claim alone — it tells the visitor
page to render it with more authority than it has earned. The correct fix is
either (a) drop the specific drive-time claim and keep the answer honest like
`showFaq-getting-there-3`, downgrading `status` to `pending`, or (b) actually
research the real drive time and keep `research` — either satisfies A4's
invariant: *if the drive-time phrase is still present, status must not be
`research`.* In the golden JSON, this same claim is checked as a flat denylist
hit (A12), not a status invariant, because the JSON's copy of the doc is not
itself a live status-bearing record — see README.

## Finding 2 — the unsourced public-transport claim is a separate defect class

`half an hour from Cape Town International` and its siblings above are all
**stale** claims (true of the old venue, unverified for the new one). The public
transport claim fixed under Finding 2 ("There is no scheduled public transport to
the airfield" / "outside the Cape Town scheduled bus network") is a DIFFERENT
defect: it was never true of any venue — it is a NEW, invented claim written while
fixing this same contract's first pass, with nothing in the repo sourcing it. It
is checked separately, by `check_no_confident_transport_claim.py`, not by this
denylist, because banning specific invented text does not stop the next dev from
inventing different specific text that says the same false thing a different way.
The transport checker instead bans the *shape* of the claim (a confident assertion
either way) rather than its exact wording. See README "Finding 2".
