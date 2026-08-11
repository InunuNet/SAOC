---
schema: athanor.mission/v1
slug: saoc-pages-editable
goal: Wire every originally-scoped SAOC page into Sanity so Lee-Ann can edit content
  herself, unblock the home-page hero, and turn on Presentation live preview
created_at: '2026-08-11T17:59:00.690950+00:00'
started_at: null
last_active_at: null
status: pending
cost_estimate:
  features: 5
  milestones: 3
  total_calls: 0
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features:
  - id: F1
    inline_brief: >-
      Fix homePage.heroImages missing _key (4 items, only occurrence in the dataset). Check first whether Brad already clicked Studio's 'Add missing keys'. Regardless, fix scripts/seed-sanity.ts to generate _key on array items so a reseed cannot reintroduce it.
    title: Unblock home-page hero — fix missing _key on homePage.heroImages
    status: pending
    milestone: M1
  - id: F2
    inline_brief: >-
      Audit the 8 originally-scoped pages field by field: which fields reach Sanity, which are hardcoded. Known: home hero lede hardcoded in components/home/Hero.tsx ~line 84. Output a per-page field table. Do before promising a date on F3.
    title: Page-by-page editability audit across the 8 originally-scoped pages
    status: pending
    milestone: M1
  - id: F3
    inline_brief: >-
      Wire every hardcoded field found in F2 into Sanity. Add schema fields where missing. Seed must pre-populate each new field from its current hardcoded value so Lee-Ann opens real content, never a blank form.
    title: Wire the hardcoded gaps found by F2 into Sanity
    status: pending
    milestone: M2
  - id: F4
    inline_brief: >-
      Enable Sanity Presentation mode (side-by-side live preview) using the existing /api/draft and /api/disable-draft routes. Do NOT reopen the CDN-purge investigation — settled.
    title: Enable Sanity Presentation mode (side-by-side live preview)
    status: pending
    milestone: M3
  - id: F5
    inline_brief: >-
      Write plain-language Studio walkthrough notes for Lee-Ann: opening Studio, what each page's fields control, publishing, and using preview. No jargon.
    title: Secretary handover — Studio walkthrough notes for Lee-Ann
    status: pending
    milestone: M3
milestones:
  - id: M1
    title: Know the true size of the job, and the hero is editable
    features: [F1, F2]
    status: pending
  - id: M2
    title: Every originally-scoped page is fully editable in Sanity
    features: [F3]
    status: pending
  - id: M3
    title: Lee-Ann can edit confidently and see changes immediately
    features: [F4, F5]
    status: pending
---

# Mission: Make the originally-scoped SAOC pages editable in Sanity

## Context

**Brad's directive, 2026-08-11.** Lee-Ann wants to make the content edits herself. Every page
that was scoped in the accepted 28-May proposal must be wired into Sanity so she can, and so we
can start replacing placeholder content with real material.

**Scope** = the 8 pages actually priced, plus the Show landing page:
Home, About, Societies, Judging, Judges Training, Events, Sponsors, Contact + National Show landing.

**Target: end of week (2026-08-14).** Brad meets Lee-Ann at 10:00 on 2026-08-12 and will issue a
revised priority list afterwards — but this wiring work stands regardless of what that meeting
reprioritises. Re-read this mission against the new priority list when it arrives.

**Pressure note:** Brad has said explicitly that if Sanity can't be made to work properly he'll
consider another CMS. Assessment given and accepted: **stay with Sanity.** Both failures hit so
far were our own bugs — the seed script omitting `_key`, and a cargo-culted `serverExternalPackages`
entry in `next.config.ts` — not Sanity limitations. Do not fight the platform; use it as intended.

## Features

### F1 — Unblock the home-page hero (missing `_key`)

`homePage.heroImages` holds 4 items with `_key: null`. Sanity locks any array whose items lack
keys, which is the yellow "Missing keys" banner blocking hero editing in Studio. Verified via full
dataset export (104 docs) as the **only** occurrence anywhere in the dataset.

Two halves, and the second is the one that matters long-term:
1. **Data:** Studio's "Add missing keys" button fixes the 4 items in one click, then Publish.
   Brad was told he can do this himself before the demo — **check whether it's already done before
   touching the data.**
2. **Code:** `scripts/seed-sanity.ts` must generate `_key` on array items so a reseed cannot
   reintroduce this. This half is required regardless of what Brad did manually.

Demo-safe home-page fields confirmed wired: Title, Mission Text, Countdown Target Date, and
Hero Images once F1 lands.

### F2 — Page-by-page editability audit

**Do this before promising any date on F3.** Walk each of the 8 scoped pages and record, per
field, whether it reaches Sanity or is frozen in code. Known instance: the home hero lede is
hardcoded in `components/home/Hero.tsx` (~line 84) — that copy is ALSO subject to an unresolved
authority question (reference vs local wording differ; see backlog). Several pages are expected to
be partly CMS-driven and partly static.

Output: a per-page field table. This sizes F3.

### F3 — Wire the gaps

Implement what F2 finds. Schema changes will be needed where fields don't exist yet. **Seed must
pre-populate every new field from the current hardcoded value** so Lee-Ann opens real content, not
blank forms — this is a standing project rule and it matters more than usual here, because blank
forms will read to the client as a broken CMS.

### F4 — Presentation mode

Sanity's side-by-side live preview. Draft-mode routes already exist at `/api/draft` +
`/api/disable-draft`. This is the real answer to "why do edits take so long to appear" — preview
bypasses both caches and renders live from Sanity.

**Related decision, settled — do not reopen.** There are two caches: Next.js (purged instantly by
the revalidate webhook — works) and the Firebase App Hosting CDN in front of it, which has **no
purge API on the platform**. `revalidate = 60` plus stale-while-revalidate means a public visitor
can see stale content well past 60s, and on a quiet site nothing triggers the background refresh
at all. That explains the old F1 tally of 1 pass / 4 fails against a 120s bound in mission
`cms-loop-and-wiring`. Brad's call: stop fighting the CDN, use Presentation/draft for editors,
accept public-visitor staleness. **Do not restart the CDN-purge investigation.**

### F5 — Secretary handover

Short, plain-language walkthrough notes for Lee-Ann: how to open Studio, what each page's fields
control, how to publish, and how to use preview. No jargon. She is the primary user.

## Out of scope — do not drift into these

- **Any logo or branding implementation.** Scott granted permission to redo the assets and a new
  Show logo exists, but Brad will supply a proper Claude Design prompt with assets when ready.
  Do not touch `branding/`.
- **Members Page** — its document exists with zero fields set. Phase 2. Leave it.
- **Phase 2 generally** — shared relational database, unified multi-category booking, journal
  archive, awards archive, Symposium/WOSA/Workshop pages.
- **PayFast work** — Brad will supply his own sandbox credentials separately.

## Known adjacent defects (fix only if cheap and in the way)

- `/national-show/archive` renders all 5 past shows, and `/archive/2012`, `/2018`, `/2024` all
  return 200 — but **nothing on the archive page links to them.** Built, reachable by URL,
  unreachable by clicking.
- The footer WOSA link on every page points to `https://wosa.org.za`, which **does not resolve at
  all** (DNS failure). The real site is `wildorchids.co.za` (200).
- `homePage.countdownDate` is empty; the live countdown is fed by `nationalShow.countdownDate`.
  Two fields do overlapping jobs — worth consolidating during F3.

## Notes

Predecessor mission `cms-loop-and-wiring` should be closed out rather than continued — its F1/F2
verification is superseded by the "stop fighting the CDN" decision above.
