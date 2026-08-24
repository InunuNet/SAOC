# Corrected field text — venue-never-changed-copy-fix

Brad, 2026-08-24 (live screenshot of `/national-show/plan-your-visit`): "The show's
venue never changed. We just had the wrong venue in the beginning. We must take any
reference to the venue changing off the website, please." The site must read as if
the venue was simply always The Hangar, Stellenbosch Flying Club — never framed as
"we used to say X, now it's Y."

Every value below is EXACT — `@dev` copies it verbatim, does not paraphrase. No new
facts are introduced (no accommodation names, no drive times) — this is a
reframing/removal task, per the same discipline `contracts/golden/venue-prose-residue/`
already established for the adjacent CTICC-identity defect class.

## Three artifacts that must all end up holding this exact text

1. **`scripts/seed-show-visitor-info.ts`** — the source. `seedVisitorInfo()` uses
   `createIfNotExists`, so editing this file alone does **not** change the live
   document (it already exists — see `scripts/fix-visitor-info-dates-confirmed.ts`'s
   own header comment for the identical situation on the `dates` field). This file
   fix is necessary for correctness of any FUTURE fresh dataset, but is not
   sufficient on its own.
2. **`contracts/golden/show-visitor-info/seed-show-visitor-info.golden.json`** — the
   copy-source golden for #1, under `showVisitorInfoDocument`. Must match #1
   verbatim for the six fields below (this is the same file `venue-prose-residue`'s
   A12 also asserts against, for a **different, non-overlapping** phrase list — see
   README "Coordination with venue-prose-residue").
3. **The live Sanity `showVisitorInfo` document** (`_id: "showVisitorInfo"`,
   dataset `production`) — the actually-rendered content. Requires a one-off
   `.patch().set()` script, modelled on `scripts/fix-visitor-info-dates-confirmed.ts`
   (which solves the exact same "already exists, `createIfNotExists` won't touch it"
   problem for a sibling field on this same document). See README "The live-document
   patch."

## Field-by-field

### `researchLabel`

- OLD: `Researched by the web team against the working venue — not yet confirmed by the show committee`
- NEW: `Researched by the web team — not yet confirmed by the show committee`

### `planIntro`

- OLD: `Everything you need to get to the National Orchid Show and make a day of it. Travel and accommodation guidance below is our own research against the working venue; the show committee will confirm the final details.`
- NEW: `Everything you need to get to the National Orchid Show and make a day of it. Travel and accommodation guidance for the venue is still being put together; the show committee will confirm the final details.`

### `gettingThereIntro`

- OLD: `The show venue has changed to the Stellenbosch Flying Club. Travel, parking and accommodation guidance for the new venue has not been worked out yet — the previous guidance was written for a Cape Town city-centre venue and no longer applies.`
- NEW: `Travel, parking and accommodation guidance for the Stellenbosch Flying Club has not been worked out yet. It will be published here once it is ready.`

### `parking`

- OLD: `Parking arrangements have not been confirmed for the new venue.`
- NEW: `Parking arrangements have not been confirmed.`

### `accommodationIntro`

- OLD: `Accommodation guidance for the Stellenbosch area is still being put together. The previous list was written for a Cape Town city-centre venue and has been removed rather than left to mislead.`
- NEW: `Accommodation guidance for the Stellenbosch area is still being put together.`

### `accessibility`

- OLD: `Accessibility details have not been confirmed for the new venue.`
- NEW: `Accessibility details have not been confirmed.`

## Code comments (source file only — not live-rendered, but part of the same
narrative and explicitly named in the mission brief)

### Comment above `const AIRPORT_ROUTES` (scripts/seed-show-visitor-info.ts, currently lines ~163-168) — OUT OF SCOPE, DO NOT TOUCH

AMENDED 2026-08-24: this comment is NOT rewritten by this contract, despite an
earlier version of this doc saying otherwise. It is
`contract-venue-prose-residue.yaml`'s A10 negative control — pinned verbatim,
including the phrase "city-centre convention centre", as a dated historical
record of the CTICC research phase. It is a `//` code comment, never rendered on
the live site, so Brad's "take any reference to the venue changing off the
website" instruction does not reach it. Leave it exactly as-is:

```
// The venue changed from the previous working-venue assumption (a Cape Town
// city-centre convention centre) to Stellenbosch Airfield. That travel research no
// longer applies to the new venue and none of it has been redone yet, so these
// arrays are cleared rather than reintroduce stale content or invent new
// airfield-specific detail. Matches the live Sanity dataset, which was cleared the
// same way — see contracts/golden/venue-seed-truth/README.md.
```

`check-seed-script.sh` (A1) excludes exactly this block from its denylist scan
before checking the rest of the file — see that script's own header comment and
README.md "What this contract does NOT do" for the full reasoning.

### Comment above `const CONFIRMATIONS` (scripts/seed-show-visitor-info.ts, currently lines 207-211)

- OLD:
  ```
  // One status per content block. The venue is client-confirmed (2026-08-12) and the
  // show dates are client-confirmed (Lee-Ann, 2027-09-16 to 2027-09-19); everything
  // else is still pending — the travel/accommodation research done against the
  // previous working venue no longer applies to the new one and has not been redone,
  // so those blocks are pending, not research.
  ```
- NEW:
  ```
  // One status per content block. The venue is client-confirmed (2026-08-12) and the
  // show dates are client-confirmed (Lee-Ann, 2027-09-16 to 2027-09-19); everything
  // else is still pending — travel and accommodation research for the venue has not
  // been done yet, so those blocks are pending, not research.
  ```

## `docs/show-visitor-info-for-editors.md` (line ~63)

This line quotes the live `researchLabel` tag verbatim for Lee-Ann. It must be
updated to match the new `researchLabel` text exactly, or the doc becomes wrong the
moment the field changes.

- OLD: `Researched by the web team against the working venue — not yet confirmed by the show committee`
- NEW: `Researched by the web team — not yet confirmed by the show committee`
  (same substitution as the `researchLabel` field above, inside the surrounding
  sentence — do not touch the sentence's surrounding words, only this quoted phrase)

## What this golden does NOT touch (see README for the full ruling)

- `nationalShowVenuePatch.venue.directionsNote` in the golden JSON — owned by
  `venue-prose-residue`'s A13/A12, currently a known pre-existing defect there
  (flagged in that contract's own v3 "Finding" as unfixed), out of scope here.
- Every `showFaq-*` document (live and golden) — already clean, verified by direct
  query, listed as negative controls.
- `docs/show-visitor-info.md`'s "venue-change guarantee" language and
  `docs/show-visitor-info-for-editors.md`'s "if it ever changes again in 2030" —
  legitimate descriptions of the Studio mechanism's general capability, not a claim
  that the 2027 show's venue itself changed. Negative controls.
