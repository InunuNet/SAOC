# nos-home-restore: golden spec

Authority: Brad, 2026-10-29: "we recently updated the NOS Home page removing sections check the history on this for me we need to roll it back we removed sections Lee-Ann(LA) wanted to keep, Stuff about the Orchid Awards Judging Catagories it was our own copy not LA's". Explicit carve-out from the 2026-10-29 copy freeze, for this scope only.

Governing rules: `docs/rules/no-invention.md` (copy from Lee-Ann's Drive only; visuals from `design/design_handoff_saoc/` and `branding/National Show 2027/`); the NOS Design rulings in history (HM-G1 root comms.md; PR #106 17b25555 for the pre-removal design; rulings DS-1, FS-1, C-2, R13 grid-orphan rule as already embodied in the components below). Copy source: `goldens/sources/landing-page-v1.0.md` (frozen copy of `content/drive-source/National Show/1. Home/National Orchid Show Website-Landing Page/v1.0/content.md`, which is not tracked in git). Her copy renders VERBATIM, typos included. Her editorial notes to us are never copy.

## What 17b25555 removed (and this restores, with HER words)

| removed block | restored as | her source |
|---|---|---|
| h2 "Three years in the making, four days on the bench" + the two paragraphs | `intro` band | Section 2 |
| figures row (`3 yr / 10 Judging classes / 18 Editions held`) | three figures `3 Years`, `13 Judging Groups`, `18 National Show Editions` | Section 2 |
| "Thirteen judging groups" JudgingGroupCard grid (her doc says "Ten"; see Sanctioned deviations) | `judging` band, 13 cards | Section 3 |
| "Exhibitor information" ExhibitorStageCard stages (royal) | `plant-entry` band, heading "Plant Entry for SAOC Members", 4 stages | Section 4 |
| "Start planning your entry now." | inside `plant-entry`, with "Register Here" + pending StatusMarker | Section 4 |
| CtaBand | foot of `plant-entry`, her sentence (no separate band; coordinator ruling 2026-10-29) | after Section 4 |

## Block order (decision, placement made explicit)

hero (unchanged) > `intro` > `about` (unchanged) > `judging` > `plant-entry` > `programme` (unchanged) > `exhibit` (unchanged) > `closing` (unchanged). (Coordinator ruling 2026-10-29: her doc goes straight from Section 3 judging to Section 4 plant entry; this also keeps the royal plant-entry band away from the royal closing band.)

Rationale: Section 2 follows the hero in her doc; the judging groups follow the about band now that the `visit` band is removed (see Sanctioned deviations); Section 4 follows Section 3 judging as in her doc; the existing `closing` band stays last and keeps its Tickets / Plan your visit buttons unchanged (HM-G1 closingLinks does not change). `data-hm-section` values, in this order: `intro, about, judging, plant-entry, programme, exhibit, closing`.

## Data path: a sourced module, not Sanity

New `lib/data/nos-home-landing.ts` (plain typed constants: `LANDING_INTRO`, `LANDING_FIGURES`, `JUDGING_GROUPS` with `{ n, name, description: string | null, italics: string[] }`, `PLANT_ENTRY_STAGES`, `LANDING_CTA`), values exactly as `checks/landing-strings.mjs` parses them. Use the PRE-17b25555 components: `SectionHeading`, `JudgingGroupCard`, `ExhibitorStageCard`, `resolveGridLayout` and the `nos-figures`, `nos-stage-card` classes (all still in the tree). Recover markup with `git show 17b25555^:'app/(nos)/national-show/page.tsx'`.

Why not Sanity: a read-only query on 2026-10-29 shows the live `showClass` docs are our invented ten classes (Cattleya Alliance, Cymbidium ... Vandaceous, each with our own description) and `showExhibitorStep` holds seven invented steps; neither matches her 13 groups or 4 stages. Nothing else reads `showClassesQuery` now. Updating Sanity would mean overwriting shared documents (`showExhibitorStep` also feeds /national-show/exhibitors), a content data op with backup and ifRevisionID, to hold text that is frozen, verbatim, and has no editor workflow (Group 11-13 have no description at all). A module is sourced, diffable, reviewable in the PR and gate-checkable without the Sanity fixture. Revisit if the committee wants Studio-editable groups; that is a separate decision.

## Rendering rules

- Judging card: eyebrow `Group N` (her number), h3 her name (e.g. "Laeliinae Species"; the colon of "Group 1: Laeliinae Species" is the doc's list punctuation), description `<p>` verbatim; `<em>` around each italic run in `italics`. Groups 11, 12, 13 have NO description: render no description paragraph, invent nothing. The card's `code` badge shows the group number. The h2 is "Thirteen judging groups" over 13 cards (Brad 2026-10-31; her doc says "Ten").
- Stages: `Stage 01..04` label is the component's, h3 her title, description her text. Stage 03 ends "Judging begins on Wednesday at 12pm" with no full stop.
- "Register Here": plain text (not a link, not a button) with one `StatusMarker kind="confirmation" status="pending" as="span"` inside `[data-hm-register-marker]`. Her note says the form "needs to be provided". Dead link forbidden.
- Foot of `plant-entry`, in this order after the four stages: "Start planning your entry now.", "Register Here" + marker, then "The 19th National Orchid Show opens on 23rd September 2027 in Stellenbosch." as a plain paragraph. No CtaBand, no `data-hm-section="cta"` anywhere.
- Hooks: `data-hm-section` on each NosSection; `[data-hm-figure]` x3 (value then label, text equals "3 Years" etc.); `[data-hm-judging-card]` x13; `[data-hm-stage]` x4. The `closing` band's existing buttons are unchanged.
- Do not touch `branding/`, the hero, the `about`, `programme`, `exhibit`, `closing` bands.

## Gate amendment to nos-content-standard (justified)

Edited in this spec dir, with `goldens/checks.sha256` refreshed: `route-table.json` home (`sections` gains the four bands; `bannedText` loses "Three years", "Ten judging", "Start planning your entry now", which her copy now requires; `pendingMarkerScope` added) and `gate-standard.mjs` homeChecks (the provenance corpus gains her landing doc; bannedPattern is applied to the body minus the one Register Here marker; `homeRestoreChecks` runs on every viewport). Every other existing home assertion stays unchanged and must pass.

## Sanctioned deviations from her copy (Brad 2026-10-31, Lee-Ann approved the page)

1. The judging heading reads "Thirteen judging groups"; her doc v1.0 says "Ten judging groups".
2. The `visit` band ("Visit" h2 and its link register) is removed from the home; the sub-nav carries those links.

The approved page also floats the show-dates card (its track is sticky), so the gate asserts the track is sticky and the card itself static. HM-G1 and FS-1.4 Visit assertions are retired; the home `sections` list and the S-CARD expected list (adds the 13 `[data-hm-judging-card]`) are updated.

## Conflicts found in her doc (reported, not resolved)

1. "Ten judging groups" heading over 13 groups, while her figure says "13 Judging Groups". Resolved by Brad 2026-10-31: the site says "Thirteen judging groups".
2. Her Section 1 asks for a new hero lede ("South Africa’s triennial National Orchid Show, bringing together growers, judges and enthusiasts from all nine provinces.") and the theme line under it. Out of this scope (hero is not a removed block); also in conflict with HM-G1 bannedText "nine provinces". Not applied.
3. "Planning a visit" (Section 3) is her heading for the links list; the live home has the `visit` band headed "Visit". Her six descriptions there are interleaved with "Copy needs to be provided" notes. Left as is.
4. Group 10 "South African, African & Mascarene Species" and the "strictly excluding African/Mascarene species" in Group 2 are hers; no change.
5. Section 4 is numbered twice (plant entry; then "Stay in touch" newsletter and "Explore" links, which is footer content that already exists). Not restored.
6. Resolved by coordinator ruling 2026-10-29: no separate `cta` band, plant-entry sits before programme, `closing` unchanged. Conflicts 2 (hero lede) and 3 ("Planning a visit") stay out of scope under the copy freeze, not the rollback.
7. "if requested can be judges" (judges), "Judging begins on Wednesday at 12pm" (no stop; the show opens Thursday): kept verbatim.
