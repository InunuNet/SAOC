---
schema: athanor.plan/v1
slug: phase-b-continuation
title: "Phase B continuation: B4–B7 remaining pages"
created_at: '2026-06-12T00:00:00.000000+00:00'
status: ready
parent_mission: saoc-full-platform
---

# Phase B Continuation Plan — B4 through B7

## Context

Phase B builds 7 CMS-driven content pages on top of the Phase A foundation (Next.js 15 + Sanity + next/font). B1 (Home), B2 (About), B3 (Societies) are done or in-flight. This plan covers B4–B7.

**Mandatory chain for every feature:**
`research → @architect (contract+goldens) → @dev → @qa → @docs → contract gate → @maintainer`

Research files for B4 already written: `.agent/memory/scratch/research-b4-national-show.md`

---

## B4: National Show page (`/national-show`)

**Type:** Greenfield
**Research:** `.agent/memory/scratch/research-b4-national-show.md`

**Scope:**
- Rebuild `app/(marketing)/national-show/page.tsx` — async Server Component
- Fetch `nationalShowQuery` (title, showDate, location, hero, countdownDate, exhibitorStages)
- `components/shows/ShowHero.tsx` — `'use client'` client island with `useCountdown` hook
- `components/shows/PastShowsGrid.tsx` — static Server Component (lib/data/shows.ts — Sanity schema too sparse)
- `components/shows/ShowClassGrid.tsx` — static, 10 classes from lib/data/showClasses.ts
- `components/shows/index.ts` — barrel

**Key constraints:**
- No new Sanity queries needed (`nationalShowQuery` already exists)
- Countdown in a client island — reuse `lib/hooks/useCountdown.ts`
- Past shows and show classes are static (Sanity schema lacks edition/entries/visitors/trophies fields)
- Hero image from Sanity via urlFor; fallback to existing public image

**Contract assertions (draft):**
- B4a: `app/(marketing)/national-show/page.tsx` uses `nationalShowQuery`
- B4b: `components/shows/ShowHero.tsx` exists
- B4c: `ShowHero.tsx` contains `useCountdown`
- B4d: `components/shows/PastShowsGrid.tsx` exists
- B4e: `components/shows/ShowClassGrid.tsx` exists
- B4f: page.tsx does NOT contain `[Placeholder`
- B4g: `ShowHero.tsx` is a client component (`'use client'`)
- B4h: page.tsx uses `lib/data/showClasses` or imports showClasses

---

## B5: Judging pages (`/judging` + `/judging/training`)

**Type:** Greenfield (two pages)
**Research needed:** Yes — check `sanity/schemas/documents/judgingPage.ts` schema

**Scope:**
- `app/(marketing)/judging/page.tsx` — Judging system overview
  - PageHero + how-it-works prose + stats (judges/students/regions)
  - Awards grid (6 cards from lib/data/awards.ts — no Sanity schema for awards)
  - Become-a-judge split section with 4-step pathway (Sanity or static)
  - Accredited judges list (check if `judgingPage` schema has this; if not, static placeholder)
- `app/(marketing)/judging/training/page.tsx` — Judges Training
  - PageHero + training programme details (Sanity-driven if schema supports it)

**Key questions to resolve in research:**
- What fields does `sanity/schemas/documents/judgingPage.ts` actually have?
- Is there a `judge` collection schema? (Check sanity/schemas/)
- Awards grid: use `lib/data/awards.ts` (static) — no awards schema exists

---

## B6: Contact page (`/contact`)

**Type:** Greenfield (form + API route)
**Research needed:** Yes — check existing `app/api/contact/route.ts`

**Scope:**
- Replace `app/(marketing)/contact/page.tsx` placeholder
- PageHero + 2-col layout: direct contact info (Sanity `contactPage`) + form
- Form fields: Name (required), Email (regex), Topic (select), Society (optional select), Message (≥10 chars)
- Client-side validation + server-side validation in API route
- `app/api/contact/route.ts` — already exists; verify it works with `firebase-admin` (now installed)
- Success/error state
- Spam: honeypot field (Cloudflare Turnstile deferred to Phase E)

**Key constraints:**
- Email sending deferred — API route writes to Firestore `contactSubmissions` for now
- Check if `contactPage` Sanity schema has `recipients` field

---

## B7: Sponsors page (`/sponsors`)

**Type:** Greenfield (simplest B-series page)
**Research needed:** Check if `sponsor` collection documents are seeded in Sanity

**Scope:**
- `app/(marketing)/sponsors/page.tsx` — Server Component
- Fetch `partnersQuery` (already exists — fetches `sponsor` documents)
- PageHero + sponsor grid grouped by tier (Title / Gold / Silver / Supporting)
- Each card: logo (urlFor), name, description, website link
- "Become a sponsor" CTA (static copy)
- Create `components/sponsors/` directory with SponsorGrid component

**Key constraints:**
- `partnersQuery` already exists in `sanity/queries.ts`
- Logo via `urlFor()` with null guard (same pattern as societies)
- Tier grouping client-side (simple array filter, no new client island needed)

---

## Execution order

B4 → B5 (two pages, one feature) → B6 → B7

B4 research is ready. Start B4 @architect immediately on resume.
B5 research must be written before @architect dispatch.
B6 research must check `app/api/contact/route.ts` before @architect dispatch.
B7 is the simplest — research is minimal, start last.

---

## Open questions for Brad

1. **B5 judge directory** — show full list publicly or behind members login? PII concerns.
2. **B6 email** — Resend vs cPanel SMTP? (Proposal says cPanel). Needs decision before implementing send.
3. **B7 sponsors** — Any real sponsor content to seed? Or placeholder tier structure OK for now?
