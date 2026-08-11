---
schema: athanor.mission/v1
slug: saoc-pages-editable
goal: Wire every originally-scoped SAOC page into Sanity so Lee-Ann can edit content
  herself, unblock the home-page hero, and turn on Presentation live preview
created_at: '2026-08-11T17:59:00.690950+00:00'
started_at: null
last_active_at: '2026-08-11T18:36:09.392584+00:00'
status: pending
cost_estimate:
  features: 5
  milestones: 3
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F1
  ts: '2026-08-11T18:36:09.392584+00:00'
features:
- id: F1
  inline_brief: null
  title: Unblock home-page hero — fix missing _key on homePage.heroImages
  status: done
  milestone: M1
  completed_at: '2026-08-11T18:36:09.392429+00:00'
  spec: .agent/memory/project/missions/2026-08-11-saoc-pages-editable.md
  contract: contracts/contract-f1-hero-keys.yaml
- id: F2
  inline_brief: 'Audit the 8 originally-scoped pages field by field: which fields
    reach Sanity, which are hardcoded. Known: home hero lede hardcoded in components/home/Hero.tsx
    ~line 84. Output a per-page field table. Do before promising a date on F3.'
  title: Page-by-page editability audit across the 8 originally-scoped pages
  status: done
  milestone: M1
  completed_at: '2026-08-11T18:27:33.994507+00:00'
- id: F3
  inline_brief: Wire every hardcoded field found in F2 into Sanity. Add schema fields
    where missing. Seed must pre-populate each new field from its current hardcoded
    value so Lee-Ann opens real content, never a blank form.
  title: Wire the hardcoded gaps found by F2 into Sanity
  status: pending
  milestone: M2
- id: F4
  inline_brief: Enable Sanity Presentation mode (side-by-side live preview) using
    the existing /api/draft and /api/disable-draft routes. Do NOT reopen the CDN-purge
    investigation — settled.
  title: Enable Sanity Presentation mode (side-by-side live preview)
  status: pending
  milestone: M3
- id: F5
  inline_brief: 'Write plain-language Studio walkthrough notes for Lee-Ann: opening
    Studio, what each page''s fields control, publishing, and using preview. No jargon.'
  title: Secretary handover — Studio walkthrough notes for Lee-Ann
  status: pending
  milestone: M3
milestones:
- id: M1
  title: Know the true size of the job, and the hero is editable
  features:
  - F1
  - F2
  status: done
  gate_ran_at: '2026-08-11T18:36:43.761420+00:00'
  gate_result: pass
- id: M2
  title: Every originally-scoped page is fully editable in Sanity
  features:
  - F3
  status: pending
- id: M3
  title: Lee-Ann can edit confidently and see changes immediately
  features:
  - F4
  - F5
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
2. **Code:** the seeder must generate `_key` on array items so a reseed cannot reintroduce this.

   **CORRECTION (2026-08-11, verified):** this brief originally named `scripts/seed-sanity.ts`.
   That is WRONG — that script's mappers (awards, boardMembers, provinces, societies, events,
   shows, showClasses, sponsors) never touch `homePage` or any array-of-objects field, and it
   needs no change. The real writer is **`scripts/seed-page-singletons.ts`**, from the
   predecessor singletons mission.

Demo-safe home-page fields confirmed wired: Title, Mission Text, Countdown Target Date, and
Hero Images once F1 lands.

### F2 — Page-by-page editability audit

**Do this before promising any date on F3.** Walk each of the 8 scoped pages and record, per
field, whether it reaches Sanity or is frozen in code. Known instance: the home hero lede is
hardcoded in `components/home/Hero.tsx` (~line 84) — that copy is ALSO subject to an unresolved
authority question (reference vs local wording differ; see backlog). Several pages are expected to
be partly CMS-driven and partly static.

Output: a per-page field table. This sizes F3.

**F2 COMPLETE (2026-08-11)** — audit at `.agent/memory/project/f2-editability-audit.md`.
Result: ~75 hardcoded fields. Ranked: National Show landing ~28, Home ~24, Sponsors ~8,
About ~4, Societies ~3, Events ~3, Contact ~3, Judging ~2.

Two findings that change F3's shape, both independently verified:
- **"Judges Training" does not exist** — no route, no component anywhere. Only `/judging`
  exists, carrying a "Becoming a Judge" portable-text section. **Awaiting Brad's call:** build
  a new page, or treat that section as the deliverable. Blocks a real F3 estimate.
- **`contactPage.formRecipients` is a silent no-op** — defined in the schema and editable in
  Studio, but nothing queries or consumes it. Lee-Ann could set the contact-form recipients,
  publish, and change nothing. Delete the field or wire it BEFORE her walkthrough (F5) —
  a field that accepts input and does nothing reads as a broken CMS.

Also incidental: the WOSA URL is hardcoded in three places with three different values
(`wosa.org.za` in the site-wide footer — does not resolve; `wosa.co.za`; `wildorchids.co.za` —
the only correct one). The "19th" edition number is likewise hardcoded in three separate files.

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
