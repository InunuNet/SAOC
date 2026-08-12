# venue-prose-residue — what this contract is and is not

## v3 (2026-08-12) — third adversarial QA pass

A third QA pass found the architect's own v2 briefing conflated two different
claims: "`showFaq-getting-there-3` is the untouched tone model" is TRUE of the
LIVE Sanity document and FALSE of this golden JSON's separate copy of the same
entry. `TARGET_FAQ_IDS` in `check_json_denylist.py` never covered
`showFaq.getting-there.3`, so the golden's copy silently kept the pre-fix "not
formally confirmed... planning around the Cape Town International Convention
Centre" text (containing the `convention centre` denylist phrase that would have
caught it on the first pass, had it been in scope) while the live document and
the corrected seed script had already moved on. See "Finding 3" below. Fixed:
`TARGET_FAQ_IDS`/`REQUIRED_FAQ_IDS` now include `showFaq.getting-there.3`, the
golden JSON's copy is corrected to match the seed script/live text verbatim, and
`selftest.py` gained a dedicated fixture for this exact shape of gap.

The v3 audit (requested alongside the fix) also found the "owned by
`contract-venue-seed-truth.yaml`" attribution for the golden JSON's
venue-IDENTITY fields (Finding 1, below) was itself unverified — see "Finding 3 —
audit of exclusion premises" for what that check found, corrected everywhere it
appeared.

**Separately, and outside this amendment's scope:** re-running `check_json_denylist.py`
against the current committed state of
`contracts/golden/show-visitor-info/seed-show-visitor-info.golden.json` during this
pass found it failing on far more than `showFaq.getting-there.3` — `parking`,
`accessibility`, `publicTransport`, `gettingThereIntro`, `airportRoutes`,
`accommodation`, `attractions`, and `nationalShowVenuePatch.venue.directionsNote`
all still contain denylisted phrases / stale structured data. This directly
contradicts this document's own "Finding 1 — corrected checker scope" section
below and the contract's `goal:` text, both of which state the golden was "now
corrected across airportRoutes/accommodation/attractions/publicTransport/
gettingThereIntro/accommodationIntro/directionsNote" in v2. `git log` for this file
shows no commit since `be80580` (pre-dates the venue change) touched it, and it
was clean (not modified) in the working tree at the start of this v3 session — so
that v2 correction was never actually applied to this file, despite the golden's
own documentation asserting it was. This is a live, RED gate finding, not fixed by
this amendment (out of the scope given for this pass — the getting-there.3 gap
only) — see the gate run at the bottom of this document and the orchestrator's
report for what remains.

## v2 (2026-08-12) — second adversarial QA pass

v1 of this contract gate-passed (all assertions green) while the defect class it
claims to close stayed open. Two blocking findings, both independently confirmed:

1. **The checker was incomplete against its own spec.** `check_json_denylist.py`
   implemented 2 of the 4 phrases `phrase-denylist.golden.md` documented, and its
   `TARGET_FAQ_IDS` covered 2 of the 3 defective FAQ documents. The golden copy-source
   JSON (`contracts/golden/show-visitor-info/seed-show-visitor-info.golden.json`)
   consequently passed A12 while still carrying Cape Town CBD prose in
   `airportRoutes`, `publicTransport`, `accommodation`, `attractions`,
   `gettingThereIntro`, `accommodationIntro`, and `nationalShowVenuePatch.venue.
   directionsNote` — a golden that no longer describes what the corrected script
   (`scripts/seed-show-visitor-info.ts`) actually produces. See "Finding 1" below.
2. **The fix for v1 invented a new unsourced claim.** Both the live
   `showFaq-getting-there-1` document and `scripts/seed-show-visitor-info.ts:328`
   now assert "There is no scheduled public transport to the airfield" as settled
   fact. Nothing in the repo sources this — there is no Stellenbosch equivalent of
   `cticc-research.golden.md`. See "Finding 2" below.

`check_json_denylist.py`, `check_denylist_conformance.py` (new), and
`check_no_confident_transport_claim.py` (new) together close both findings. This
document, `phrase-denylist.golden.md`, and the contract's assertion list were
updated together so the doc, the checker, and the gate cannot drift apart again —
A22 makes that drift a hard failure instead of a silent one.

## The defect class (unchanged from v1)

`venue-seed-truth` (this repo, uncommitted, gate 16/16 green) fixes every place a
venue **name-string** was hardcoded — a find-and-replace on identity fields
(name/address/city/coordinates/phone). It does not, and cannot, fix prose that
describes the venue's **physical characteristics without naming it**:

> "The working venue is a modern convention centre with step-free access..."
> "...has several parking garages..."
> "...a drive of roughly half an hour from Cape Town International..."
> "...MyCiTi bus route A01... Civic Centre station..."
> "...V&A Waterfront... Table Mountain... Kirstenbosch..."

None of these sentences contains "CTICC", "Cape Town International Convention", or
any string on the venue-seed-truth denylist. They survived that sweep intact and are
now **confidently wrong** about an airfield hangar 45 km outside Stellenbosch: the
Hangar has no parking garages, is not a "modern convention centre", is nowhere near
the V&A Waterfront or Kirstenbosch, and the half-hour/25-40-minute drive-time claim
was never researched against the real venue — it was carried over from the CTICC
research and re-pointed at a new name.

This is exactly the failure mode `.claude/rules/content-modeling.md` §3 predicts:
"the failure mode to design against is not 'content is missing' — it is 'content is
confidently wrong'. Missing content is visible. Stale content looks fine." A
name-anchored denylist is structurally blind to it, by construction.

## Finding 1 — current-state vs historical-record ruling (the tension this version resolves)

`contracts/golden/show-visitor-info/seed-show-visitor-info.golden.json` mixes two
kinds of content that must be treated differently, and v1's A13 blurred the line by
protecting the *entire* `nationalShowVenuePatch.venue` object as "historical":

- **Venue-IDENTITY fields** — `name`, `addressLines`, `city`, `province`,
  `postalCode`, `latitude`, `longitude`, `mapsUrl`, `phone` inside
  `nationalShowVenuePatch.venue`. These describe *which* venue the original
  `show-visitor-info` research phase targeted (CTICC, 2026-08-11).
  `contract-venue-seed-truth.yaml` already changed the *actual* `VENUE` constant in
  `scripts/seed-show-visitor-info.ts` to the real venue (`The Hangar, Stellenbosch
  Flying Club`) and deliberately left `directionsNote`/`phone` unset there rather
  than carry over false detail (see the script's own comment above `const VENUE`).
  **v3 correction:** this golden JSON's *copy* of the old identity fields is NOT
  owned or asserted by `contract-venue-seed-truth.yaml` — that contract's
  assertions never open this file (verified by grep across
  `contracts/contract-venue-seed-truth.yaml` and
  `contracts/golden/venue-seed-truth/README.md`; neither references
  `seed-show-visitor-info.golden.json` or `nationalShowVenuePatch`). The earlier
  "owned by venue-seed-truth" language was an assumption inherited from a brief,
  not a checked fact — exactly the pattern this v3 audit was asked to hunt for. The
  correct statement: this golden's copy of the *old* identity fields is a
  correctly-dated historical record of what the original research produced, same
  standing as `cticc-research.golden.md`, and **this contract's own A13 is the only
  thing protecting it.** **Ruling: stays untouched. A13 still protects it** — same
  ruling as before, corrected attribution only.
- **Venue-DESCRIPTIVE prose** — `nationalShowVenuePatch.venue.directionsNote`
  ("The CTICC is on the Foreshore..."), and everything under
  `showVisitorInfoDocument` (`airportRoutes`, `publicTransport`, `accommodation`,
  `attractions`, `gettingThereIntro`, `accommodationIntro`, `parking`,
  `accessibility`). This is exactly this contract's defect class: physical
  characteristics of a venue, stated as if still current, for a venue that changed.
  Unlike the identity fields, this prose is not "what CTICC's own address was" — it
  is "what a visitor should currently believe about getting to the show," and that
  belief is now false. The corrected `scripts/seed-show-visitor-info.ts` already
  reflects the fix (VENUE renamed, `AIRPORT_ROUTES`/`ACCOMMODATION`/`ATTRACTIONS`
  cleared to `[]`, `directionsNote` left unset entirely rather than carried over).
  This JSON is that script's copy-source golden — it specs the CURRENT expected
  output, not a snapshot of what was true in August 2026 for a venue no longer in
  use. **Ruling: in scope. Must match the corrected script.**

The dividing line is not "which object does the field live in" — `directionsNote`
sits inside the same `venue` object as `name`, but it is prose, not identity, so it
is on the in-scope side. `check_json_denylist.py` implements exactly this split:
it checks `directionsNote` but not its siblings.

## Finding 1 — corrected checker scope

See `phrase-denylist.golden.md` "In scope" / "Out of scope" for the complete,
field-by-field list. Summary of what changed from v1:

- `DENYLIST` grew from 2 phrases to 12 (Foreshore, the drive-time phrase family,
  MyCiTi, Civic Centre station, V&A Waterfront, Table Mountain, Bo-Kaap, Company's
  Garden, Robben Island, Kirstenbosch), matching every phrase now documented.
- `TARGET_FAQ_IDS` grew from 2 ids to 3 (`showFaq.getting-there.1` added).
- Two new checks that are structural, not phrase-based, because
  `airportRoutes`/`accommodation`/`attractions` carry stale *structured data*
  (whole entries), not just a stale sentence: they must equal `[]`, matching what
  the corrected seed script now produces.
- A new field check on `nationalShowVenuePatch.venue.directionsNote` per the
  ruling above.
- `check_denylist_conformance.py` (new) proves the doc and the checker cannot
  silently drift apart again — this is the direct fix for the root cause of this
  whole second round: a checker that under-implements its own spec.

## Finding 2 — the unsourced public-transport claim

Live `showFaq-getting-there-1` and `scripts/seed-show-visitor-info.ts:328` (FAQ
answer) and `scripts/seed-show-visitor-info.ts:257`/live
`showVisitorInfo.publicTransport` (visitor-info prose — the same invented claim,
duplicated in a second location) currently assert, as settled fact, that there is
**no** scheduled public transport to the venue. Nothing sources this. Both
`venue-seed-truth/README.md` and this contract's v1 stated plainly that travel to
the new venue is entirely unresearched — there is no Stellenbosch equivalent of
`cticc-research.golden.md`. A negative claim is still a claim, and a
plausible-sounding unverified one is exactly rule 5's target: "invented specifics
are indistinguishable from researched ones once they are on the page."

The fix is not to assert the opposite (that scheduled transport DOES run — equally
unsourced) nor to require a citation the team cannot produce. The honest framing is
silence, or an explicit "not confirmed" hedge, exactly like every other unresearched
block in this dataset. `check_no_confident_transport_claim.py` enforces the *shape*
of an acceptable answer (no confident claim either way, or a hedge if transport is
mentioned at all) rather than banning specific wording, so paraphrasing the same
invented claim cannot slip past it the way `check_json_denylist.py`'s v1 gap did.

## Finding 3 — the live-document-vs-golden-copy distinction, and an audit of exclusion premises

The architect's v2 briefing said "`showFaq-getting-there-3` is the untouched tone
model" and that claim was allowed to stand for both the LIVE Sanity document (true)
and this golden JSON's separate copy of the same entry (false). `TARGET_FAQ_IDS`
was scoped to exclude `showFaq.getting-there.3` on the strength of the live-only
fact. The golden's copy kept "The venue has not been formally confirmed. We are
planning around the Cape Town International Convention Centre and will update this
page the moment the committee confirms." — containing `convention centre`, already
on this denylist — while the seed script and live document had both already moved
to the corrected tone-model text. **Fixed:** `TARGET_FAQ_IDS` and
`REQUIRED_FAQ_IDS` now include `showFaq.getting-there.3`; the golden JSON's answer
for that entry is corrected to match the seed script/live text verbatim;
`selftest.py` gained a dedicated fixture (`STALE_GETTING_THERE_3_FIXTURE`) proving
this exact shape of gap is caught.

This is a scoping failure with a specific root cause worth generalising: **"the
live document is untouched" and "the golden's copy of it is untouched" are
different claims**, verified by different checks (a live `curl` vs a JSON field
read), and one being true never implies the other. Every future exclusion from a
scoped checker must name which artifact was actually checked, not the artifact the
brief happened to describe.

As requested, this pass also audited every other scope exclusion in
`check_json_denylist.py`, `check_denylist_conformance.py`,
`check_no_confident_transport_claim.py`, and this contract's assertions, for the
same failure mode (excluded on the strength of a brief's claim rather than a
verified fact):

- **Found and corrected:** the "owned by `contract-venue-seed-truth.yaml`"
  attribution for the golden JSON's venue-IDENTITY fields (Finding 1, A13). Grepped
  `contracts/contract-venue-seed-truth.yaml` and
  `contracts/golden/venue-seed-truth/README.md` for any reference to
  `seed-show-visitor-info.golden.json` or `nationalShowVenuePatch` — neither
  contains one. The identity fields were never actually asserted by that contract;
  only this contract's own A13 protects them. Same underlying bug as
  `showFaq.getting-there.3`: an assumed fact stood in for a checked one. Corrected
  everywhere the phrase appeared (`check_json_denylist.py`'s docstring and
  violation message, this README, `phrase-denylist.golden.md`). The ruling itself
  (identity frozen, prose in scope) is unchanged and still sound on its own terms —
  only the ownership attribution was wrong.
- **Checked and confirmed genuinely verified, not assumed:**
  - `showVenue.ts:17`'s field description (A17) — verified by direct grep of the
    file's actual current content, not inherited from a claim.
  - `lib/data/shows.ts`'s `Durban ICC` entry (A18/A27) — verified by grep: a real,
    differently-named, different-city venue, not a guess.
  - `lib/data/events.ts`'s `Kirstenbosch Hall` entries and
    `lib/data/partners.ts`'s `Kirstenbosch NBG` (A28) — verified by grep: real,
    unrelated content, correctly named.
  - The live `society-highveld-orchid-society` / `societyEvent-3-saoc-council-agm-2026`
    "Civic Centre" documents (A29/A30) — verified by live read-only query against
    Sanity, not assumed from a brief.
  - `cticc-research.golden.md` (A20) — verified by grep of its actual attributed
    research-record content.
  - `contracts/golden/f4-seed-page-singletons/nationalShow.golden.json` (A19) —
    correctly flagged, not asserted-as-fixed, and explicitly attributed to
    `contracts/cms-loop-f3-national-show.yaml`, a real contract that does exist.
  None of these needed correction — each rests on a check against the actual
  artifact, not an inherited assumption.
- **Found, not fixed by this amendment (out of scope for this pass, flagged for the
  orchestrator):** re-running `check_json_denylist.py` against the current
  committed state of the golden JSON during this audit found it RED for reasons
  that have nothing to do with `showFaq.getting-there.3` — see "v3" above. The
  golden's `parking`, `accessibility`, `publicTransport`, `gettingThereIntro`,
  `airportRoutes`, `accommodation`, `attractions`, and
  `nationalShowVenuePatch.venue.directionsNote` all still carry the pre-Finding-1
  Cape Town CBD content this document's own "Finding 1" section and the contract's
  `goal:` text both claim was "already corrected" in v2. That claim was not
  verified before being written down — the same failure mode, applied to this
  document's own prior self-description. This amendment does not correct those
  fields (out of the scope given for this pass); it corrects the record to stop
  claiming they are fixed when they are not.

## What this contract does NOT do

- It does not invent replacement detail about the Hangar (parking capacity, an
  accessibility audit, a real drive time, a real transport option). Rule 5 applies
  exactly as it did in `venue-seed-truth` and in v1 of this contract: honest "not
  confirmed yet", in the voice of `showFaq-getting-there-3`, is the only correct
  output — for travel detail AND for public transport.
- It does not touch `showFaq-getting-there-3`, `showFaq-accessibility-2`, or
  `showFaq-general-1`/`showFaq-general-2` — see `phrase-denylist.golden.md` for why
  these are the negative-control roster.
- It does not touch `sanity/schemas/objects/showVenue.ts:17` — "the convention
  centre's official name" is a schema FIELD DESCRIPTION, not prose describing this
  show's venue. It legitimately contains the phrase "convention centre" and must
  survive unchanged — see the self-test in A1 for why a repo-wide grep on this
  phrase is the wrong tool.
- It does not touch `lib/data/shows.ts`'s `Durban ICC` entry, `lib/data/events.ts`'s
  three `Kirstenbosch Hall, Cape Town` entries, `lib/data/partners.ts`'s
  `Kirstenbosch NBG` entry, or the live `society-highveld-orchid-society` /
  `societyEvent-3-saoc-council-agm-2026` documents (`Witbank Civic Centre` /
  `Bloemfontein Civic Centre`) — all real, unrelated, correctly-named venues or
  organisations that the expanded denylist's phrases would false-positive on if
  this fix (or the denylist regex itself) were ever applied repo-wide instead of
  file-scoped. See A28–A30.
- It does not touch `nationalShowVenuePatch.venue.{name, addressLines, city,
  province, postalCode, latitude, longitude, mapsUrl, phone}` in the golden JSON —
  see the current-state vs historical-record ruling above.
- It does not touch `contracts/golden/f4-seed-page-singletons/nationalShow.golden.json:17-18`.
  That golden pins CTICC as the expected output of `seedNationalShow()` and is owned
  by `contracts/cms-loop-f3-national-show.yaml` — fixing it is that contract's job,
  not this one's. Flagged here so a future sweep does not miss it, not asserted here
  so this contract cannot fail for a file it has no authority to fix.
- It does not mutate the live Sanity dataset via any assertion. Every dataset-facing
  check is a read-only `GET`. The orchestrator applies the actual content fix as a
  surgical patch to the named document IDs — never a bulk sweep, never
  `createOrReplace` in the seed scripts.

## The self-correction this contract also requires

`contracts/golden/venue-seed-truth/README.md` states: "swept the whole dataset for
stale venue strings — zero remain." That claim is false — this contract exists
because six fields across three documents/files were missed, twice (v1 missed
some of what v0's discovery found; this v2 corrects v1's own checker gap). Rule: "a
golden that lies is worse than no golden." A16 requires that claim be corrected to
describe what was actually swept (name-anchored strings only) rather than
withdrawn to a vaguer claim that would still overstate coverage.

## The generalised detector

Prose-residue phrases are venue-shape descriptions, not venue names, so they cannot
be a single repo-wide denylist the way `venue-seed-truth`'s name-anchored one was —
several phrases on this expanded list (`Civic Centre`-adjacent text, "Kirstenbosch")
false-positive on real, unrelated, legitimate content elsewhere in this repo. The
detector here is **scoped**: specific phrases and specific structural checks,
applied only to the specific files/document IDs/fields known to carry
venue-dependent prose. See `phrase-denylist.golden.md`, and see A22/`check_denylist_
conformance.py` for the mechanism that now keeps this document and the checker from
drifting apart the way they did between v1 and this version.
