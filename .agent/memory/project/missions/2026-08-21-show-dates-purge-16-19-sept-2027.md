---
schema: athanor.mission/v1
slug: show-dates-purge-16-19-sept-2027
goal: 'Purge the stale, never-confirmed ''18-21 September 2027'' National Show placeholder
  dates and replace with Lee-Ann''s confirmed real dates, Thu 16 - Sun 19 September
  2027, everywhere they''re hardcoded. Confirmed via live Sanity query 2026-08-22:
  the production nationalShow document''s showDate/showEndDate/countdownDate fields
  still hold 2027-09-18/2027-09-21 (the old placeholder), which drives the live home-page
  countdown and show pages — this is a real, currently-live incorrect date shown to
  the public, not just a docs issue. F1: fix the three source-of-truth seed scripts
  that would re-introduce the stale dates on any future reseed (scripts/seed-page-singletons.ts:216
  countdownDate, scripts/seed-show-visitor-info.ts:128-129 showDate/showEndDate, lib/data/events.ts:171-172
  date/endDate) to 2027-09-16/2027-09-19 respectively (countdownDate should point
  at the show''s actual start, 2027-09-16T09:00:00+02:00). F2: re-seed/patch the live
  production Sanity nationalShow document''s showDate, showEndDate, and countdownDate
  fields directly to match (idempotent script or a one-off patch, documented either
  way) and browser-verify the home-page countdown and /national-show pages now show
  the correct dates. F3: grep sweep and fix any remaining docs (docs/show-visitor-info.md,
  docs/show-visitor-info-for-editors.md, docs/payment-seam.md, docs/f1-ticketing-conferences.md,
  and any others found by a fresh grep) that state the old 18-21 date as fact rather
  than as a historical note about the old placeholder having existed. Do not touch
  lib/show-identity.ts''s date-formatting example comment (18-21 September 2027) if
  it''s purely illustrative and doesn''t hardcode real show data — verify which category
  it falls into before deciding whether to edit it. Real dates confirmed by Lee-Ann
  per project memory project_show_dates_placeholder — do not re-verify with Brad,
  this is already resolved and sourced.'
created_at: '2026-08-21T22:54:47.169375+00:00'
started_at: '2026-08-21T22:54:47.169375+00:00'
last_active_at: '2026-08-22T00:10:07.871455+00:00'
completed_at: '2026-08-22T00:10:07.871455+00:00'
status: done
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features:
- id: F1
  status: done
  tier: standard
  title: Fix the three source-of-truth seed/data scripts that would re-introduce the stale 18-21 Sept dates
  inline_brief: 'Three checked-in files hardcode the invented 18-21 September 2027 placeholder
    and would re-seed it on any future run: scripts/seed-page-singletons.ts:216 sets
    countdownDate to ''2027-09-18T09:00:00+02:00'' -- change to ''2027-09-16T09:00:00+02:00''
    (the show''s actual start, per the mission brief). scripts/seed-show-visitor-info.ts:128-129
    sets showDate to ''2027-09-18T09:00:00+02:00'' and showEndDate to
    ''2027-09-21T17:00:00+02:00'' -- change to ''2027-09-16T09:00:00+02:00'' /
    ''2027-09-19T17:00:00+02:00''. That file''s own comment above SHOW_IDENTITY currently says
    "The dates mirror the countdownDate already in the dataset" -- update or remove that comment
    since it will no longer be accurate framing once F2 patches the live document independently
    (do not leave a comment claiming a mirroring relationship that this mission is about to
    break). lib/data/events.ts:171-172 (event id 15, the 19th National Show entry) sets
    date: ''2027-09-18'' and endDate: ''2027-09-21'' -- change to date: ''2027-09-16'' and
    endDate: ''2027-09-19''. This file is scripts/seed-sanity.ts''s source array (mapped via
    createOrReplace with deterministic ids) -- confirm scripts/seed-sanity.ts still reads this
    array unchanged; do not touch scripts/seed-sanity.ts itself. Do not touch
    lib/show-identity.ts''s ''18-21 September 2027'' JSDoc example (line 19) -- read the function
    it documents (formatShowDateRange) to confirm it is purely an illustrative format example
    with no real show data hardcoded, not a literal this mission needs to purge; if that
    confirmation fails, flag it rather than editing blind.'
- id: F2
  status: done
  tier: standard
  title: Patch the three LIVE Sanity documents still holding the stale dates, and verify by direct query
  inline_brief: 'A live query against the production Sanity dataset (project 26yfbug4, dataset
    production) on 2026-08-22 found the stale 2027-09-18/2027-09-21 dates live in THREE
    documents, not the one the original brief named -- @architect must scope all three:
    (1) nationalShow (_id: "nationalShow") -- showDate, showEndDate, countdownDate. (2) show
    (_id: "show-19-2027", the ACTIVE=true show document that lib/data/day-selection or
    equivalent ticketing code reads showDate/showEndDate from for the day-selection window per
    docs/f5-day-selection-attendees.md -- this is MORE load-bearing than nationalShow for
    ticketing, not less) -- startDate, endDate. This document was last patched by
    scripts/migrate-show-sales-fields.ts using setIfMissing, which means it already has these
    fields SET (to the stale values) -- a setIfMissing-based fix will silently no-op and leave
    it wrong; the new patch must use .set(), not .setIfMissing(), for these two fields
    specifically. (3) societyEvent (_id:
    "societyEvent-15-19th-south-african-national-orchid-show", seeded from lib/data/events.ts
    id 15 by scripts/seed-sanity.ts via createOrReplace) -- date, endDate. Because
    scripts/seed-sanity.ts uses createOrReplace keyed on a deterministic id, this THIRD document
    would actually self-correct if F1''s events.ts fix is re-seeded via that script -- but do
    not rely on someone remembering to re-run it; patch it directly in the same one-off script
    as the other two, and treat a future createOrReplace reseed as merely consistent with the
    corrected value, not the mechanism this mission depends on. Write ONE new idempotent one-off
    script (see scripts/migrate-show-sales-fields.ts for the closest existing pattern: reads
    .env.local directly for NEXT_PUBLIC_SANITY_PROJECT_ID/NEXT_PUBLIC_SANITY_DATASET/
    SANITY_API_TOKEN, supports --dry-run, uses createClient with useCdn: false) that patches all
    three documents to the corrected dates in one run, safe to re-run (a second run patches the
    same already-correct values, a no-op in effect). Then write and run a second small script
    (or a --verify mode of the same script) that queries all three documents live and asserts
    every field holds the exact new value, exiting non-zero on any mismatch -- this becomes the
    gate assertion, not an agent_review step. Also browser-verify the home-page countdown and
    /national-show pages render the corrected dates after patching.'
- id: F3
  status: done
  tier: standard
  title: Docs sweep -- fix editor/reference docs stating the old date as current fact
  inline_brief: 'Re-grepped 2026-08-22: two docs state the OLD 18-21 September date as a
    present-tense fact describing current seeded/confirmed state, and must change to
    "16-19 September 2027": docs/show-visitor-info.md:189 ("Seeded venue (client-confirmed
    2026-08-12): ... edition 19, 18-21 September 2027, host region Western Cape") and
    docs/show-visitor-info-for-editors.md:56 ("Confirmed venue: ... 18-21 September 2027
    (client-confirmed 2026-08-12)") -- the latter is the doubly-wrong one presented directly to
    Lee-Ann as already-confirmed. Four other docs mention 18-21 in a clearly historical/
    illustrative context describing the INCIDENT of the old placeholder having existed (contrasting
    it with the real dates or citing it as the defect-class example) and must be LEFT UNCHANGED:
    docs/payment-seam.md:495-496, docs/f1-ticketing-conferences.md:52, docs/f4-admission-products.md:47,
    docs/f5-day-selection-attendees.md:86 (a prohibitive example of what NOT to hardcode, not a
    date claim at all). Run a fresh grep for "18.21 Sept" / "18–21 September" / "2027-09-18" /
    "2027-09-21" across the whole tree (excluding node_modules, .claude/worktrees,
    .agent/memory/project/missions/, .agent/memory/project/learned.md,
    .agent/memory/project/backlog.md, .agent/memory/project/provisional-figures.md,
    .agent/memory/project/goals.md, Plans/, and contracts/golden/ -- all of those are
    legitimate historical/audit-trail records of the OLD mission and defect history, not
    current-fact claims, and this mission does not rewrite project history or memory) before
    finalizing scope -- fix any other present-tense factual doc found, leave any other
    historical/illustrative one alone.'
milestones:
- id: M1
  title: Show-dates purge (code + live Sanity data + docs)
  features:
  - F1
  - F2
  - F3
  status: done
  gate_result: pass
---

# Mission: Purge the stale, never-confirmed '18-21 September 2027' National Show placeholder dates and replace with Lee-Ann's confirmed real dates, Thu 16 - Sun 19 September 2027, everywhere they're hardcoded. Confirmed via live Sanity query 2026-08-22: the production nationalShow document's showDate/showEndDate/countdownDate fields still hold 2027-09-18/2027-09-21 (the old placeholder), which drives the live home-page countdown and show pages — this is a real, currently-live incorrect date shown to the public, not just a docs issue. F1: fix the three source-of-truth seed scripts that would re-introduce the stale dates on any future reseed (scripts/seed-page-singletons.ts:216 countdownDate, scripts/seed-show-visitor-info.ts:128-129 showDate/showEndDate, lib/data/events.ts:171-172 date/endDate) to 2027-09-16/2027-09-19 respectively (countdownDate should point at the show's actual start, 2027-09-16T09:00:00+02:00). F2: re-seed/patch the live production Sanity nationalShow document's showDate, showEndDate, and countdownDate fields directly to match (idempotent script or a one-off patch, documented either way) and browser-verify the home-page countdown and /national-show pages now show the correct dates. F3: grep sweep and fix any remaining docs (docs/show-visitor-info.md, docs/show-visitor-info-for-editors.md, docs/payment-seam.md, docs/f1-ticketing-conferences.md, and any others found by a fresh grep) that state the old 18-21 date as fact rather than as a historical note about the old placeholder having existed. Do not touch lib/show-identity.ts's date-formatting example comment (18-21 September 2027) if it's purely illustrative and doesn't hardcode real show data — verify which category it falls into before deciding whether to edit it. Real dates confirmed by Lee-Ann per project memory project_show_dates_placeholder — do not re-verify with Brad, this is already resolved and sourced.

## Context

(Add context here)

## Notes

