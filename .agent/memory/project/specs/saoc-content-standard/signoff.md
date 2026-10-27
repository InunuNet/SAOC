# saoc-content-standard — sign-off pack (for NOS Design, before contract)

Author: @architect. Date 2026-10-25. Ruling implemented: DS-1 r2 and DS-1 r2 · SAOC (nos-design-rulings.md). Base: fix/polish-wave-2-2026-10-25 (#98).
Every fact value below is copied from its source; labels (dt) are presentation and are listed so they can be ruled on. Nothing is invented. A route with fewer than 2 sourced facts is flagged.

## (a) Hero facts per route (dd = value, dt = label)

### Event detail /events/[slug]   (3 items for kind=show, 2 otherwise)
Source: Sanity `societyEvent` doc `societyEvent-15-19th-south-african-national-orchid-show` (the only event record today) and the `nationalShow` singleton.
| dd (verbatim from record) | dt | source |
|---|---|---|
| 23–26 September 2027 | Dates | `societyEvent-15-...`.`date` = 2027-09-23, `.endDate` = 2027-09-26, formatted by the existing `formatShowDateRange()` (lib/show-identity.ts:22), the same helper Home/ShowBand use |
| The Hangar, Stellenbosch Flying Club | Venue | `societyEvent-15-...`.`venue` (identical to `nationalShow.venue.name`) |
| Western Cape | Host region | `nationalShow`.`hostRegion` (show kind only; same field ShowBand's "Host Region" reads) |
Other event records: Dates + `venue`; plus `hostSociety.name` if set. Absent fields drop the item; no "To be confirmed" filler in the facts row.
Not used: "4 days" (ShowBand `formatDuration`) is derived, not stored; left out.

### About /about   (recommend 3, fallback 2)
Source: `content/drive-source/SAOC /2. About/About page - South African Orchid Council/v1.0/content.md`. Replaces HERITAGE_STATS (app/(marketing)/about/page.tsx) and the stats band.
| dd | dt | source |
|---|---|---|
| 28 July 1968 | Founded, Bloemfontein | content.md:5 ("traced to **28 July 1968**" ... "met in Bloemfontein") |
| 15 | Accredited SAOC Judges, September 1968 | content.md:7 ("**15 people were registered as Accredited SAOC Judges**") |
| 4 | Founding societies | content.md:5 names four societies (Cape, Natal, Transvaal, Northern Transvaal). The count is derived by counting the named list, not stated as a number. This was the existing third stat. DECISION FOR NOS DESIGN: keep, or drop to 2 items. Architect recommends keep (it is countable on the line, no judgement involved) |
Not used: "1968" alone (content.md:3) would duplicate 28 July 1968.

### Judging /judging   (1 item only)
| dd | dt | source |
|---|---|---|
| 6 | Award tiers | count of Sanity `award` docs: award-am-saoc, award-fcc-saoc, award-hcc-saoc, award-ccm-saoc, award-cbr-saoc, award-jc-saoc (awardsQuery, sanity/queries.ts:339; existing fallback stat, judging/page.tsx:54) |
Judging has no Drive doc and `judgingPage.stats` is null. Year, judge counts, society counts are excluded (Lee-Ann, 24 Oct 2026, judging/page.tsx:52). DECISION FOR NOS DESIGN: a centred row of ONE fact is below the "2-4 items" rule. Architect recommends allowing 1 fact (merging the one-stat band into the hero was the ruling; a lone fact reads fine centred). Alternative: no facts row on Judging and the band is simply deleted.

### Media kit /media-kit   (1 item only)
| dd | dt | source |
|---|---|---|
| 1968 | Founding year | `QUICK_FACTS` in app/(marketing)/media-kit/MediaKitPageBody.tsx:29, = About content.md:3 ("Established in **1968**") |
Same 1-item question as Judging. Page is admin-gated (lib/media-kit-gate.ts), so first-screen checks run signed in or against the body component. Same recommendation: allow 1.

### Members /members   (none)
No sourced fact. The page states "Not yet available" and has no Drive doc or Sanity values (`membersPage` has no content fields). No facts row.

### Sponsors /sponsors   (none)
No sourced fact. Six `sponsor` docs exist (sponsor-american-orchid-society ... sponsor-world-orchid-conference) but all have `tier: null`; a count of partners is not a fact Lee-Ann supplied. No facts row. (Existing hero CTA "Talk to us about sponsorship" stays as the hero action.)

### Privacy, Terms, Constitution   (none; hero facts not required)
- Terms has one dated record, `content/legal/terms.ts:6` ("**Last updated:** 24/10/2026"), and registration number 1978/004040/08 (terms.ts:7). They stay inside the document body, not the hero (a revision date is document metadata, and a single fact does not justify a row on a legal page).
- Privacy: no dated line. Constitution (Drive v1.0): 43 words, no facts.

### Home /   (one fact, not a row)
Next to the National Show CTA ("19th National Show, 2027", components/home/Hero.tsx:53): `formatShowDateRange(show.showDate, show.showEndDate)` from the `nationalShow` singleton = "23–26 September 2027" (showDate 2027-09-23T09:00+02:00, showEndDate 2027-09-26T17:00+02:00). No new copy. Rendered as plain text beside/below the CTA; the CTA label is unchanged.

## (b) Photo assignment, Event detail
Proposed: `/images/orchid-dark.jpg` ("harlequin Phalaenopsis, evening mood"), already in `lib/hero-source-widths.json` (5184 px, enough for 2056@2).
Approval trail: design/design_handoff_saoc/README.md:225 (the five orchid images "are the only orchid images"), design_system_README.md:124 (orchid-dark described), src/data.js:457 (mapped to the `judging` slot) and src/data.js:464-465 (past shows use yellow/violet). It is the least-used SAOC hero: today it appears only as the Judging PhotoBand (judging/page.tsx:208) and the 404 (app/not-found.tsx:20).
Why not the others on this route: yellow is the photo inside the ShowBand that sits on the same page (two identical photos stacked), purple is the Events list hero, violet is Society detail, pink is Contact. Dark is also the safest ground for the dd text contrast gate (>= 4.5 on photo pixels behind each fact).
Constraint to flag: SAOC has 5 photographs and 12+ hero routes, so repeats across routes are unavoidable until the Council supplies real show photography. The rule applied: no repeat of the photo used by the page's own band or by its parent list page.

## Other things NOS Design should know
1. Shared components: no branch (`origin/feat/nos-pagehero`, `origin/nos-site`, `origin/feat/nos-site-split`) has a PageHero facts slot. NOS has `components/nos/LongFormPage.tsx`, `ShowFacts.tsx` and `NosHero.tsx` under its own tokens, with a different grid (4fr aside / 7fr). Proposal: build SAOC's `PageHero` `facts` prop + `DocumentLayout` (7fr/5fr) in components/ui/ and expose a token-neutral `HeroFacts` markup contract (a `dl` with `data-hero-facts`) so NOS can adopt it; not forcing NOS to migrate.
2. The f184d55 commit is not in this repo's object store; I read DS-1 / DS-1 r2 / DS-1 r2 · SAOC from the NOS Design checkout's nos-design-rulings.md (lines 2530-2579).
3. Media kit `Last updated: October 2026` is hard-coded text (MediaKitPageBody.tsx:348); untouched by this standard.
