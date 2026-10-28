# council-copy-fixes goldens

- `copy-map.json` is the single source of truth: ten source-string corrections from the council correction sheets updated 2026-10-27, plus the pin files, plumbing files and frozen/historical paths. Every check reads it; none hard-codes a string.
- Source of each row: `.tmp/sandbox/council-sheet-1028/change-list.md` (analyst mapping), verbatim dumps in `.tmp/sandbox/leeann-xlsx-1028/{nos,saoc}.txt`. The `sheet` field of each entry names the row.
- Out of scope, waiting on Lee-Ann: the waste-label scope change (R8), the terms clause removal (R19), anything about the show name (Q-NAME), every class C and D row. Sanity items (FAQ answers, society committee) are already applied by the lead.

## Rulings the architect took (flag to the lead)

1. **C10 Storage wording.** The reviewer wrote `PLEASE NOTE: the organisers of the event...`. The golden uses that: `PLEASE NOTE: the organisers of the event cannot be held liable`, replacing `However, the organizers`. The lead's brief said "prefix PLEASE NOTE:", which read literally would give `PLEASE NOTE: However, the organisers`; that is awkward and not the reviewer's text. Flip the `after` string in `copy-map.json` if the lead wants the literal reading; every check follows the map.
2. **C02b is an addition.** `app/(nos)/national-show/page.tsx:96` (`EXHIBIT_LEAD`, rendered on the NOS home) is the identical `who’s subscriptions` sentence. Leaving it would put the typo on the home after the exhibitors page is fixed. Strike the entry to drop it.
3. **Frozen text is not edited.** Lee-Ann's Drive copies and the sha256-frozen mirrors in `nos-content-standard/goldens/sources/` keep her wording. The two content gates (`gate-standard.mjs`, `gate-verbatim.mjs`) read them through `_lib.mjs`; @dev adds a pure `applyCouncil()` there driven by `nos-content-standard/goldens/council-overrides.json` (shape: `council-overrides-shape.json`).
4. `scripts/seed-show-faq.ts` keeps the old FAQ wording: the Sanity items it seeds are already corrected in Sanity, and the seed is out of this feature's scope.
