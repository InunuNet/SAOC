---
schema: athanor.mission/v1
slug: saoc-phase-e-seo
goal: Phase E — SEO + social metadata, sitemap, OG images, robots.txt, structured data
created_at: '2026-06-13T01:03:30.421458+00:00'
started_at: '2026-06-13T11:15:00.000000+00:00'
last_active_at: null
status: in_progress
cost_estimate:
  features: 4
  milestones: 1
  total_calls: 8
last_checkpoint:
  milestone: ME-SEO
  feature: E4-1
  ts: null
features:
  - id: E4-1
    title: robots.txt + sitemap.ts
    status: pending
  - id: E4-2
    title: Per-page Sanity metadata (generateMetadata)
    status: pending
  - id: E4-3
    title: OG image generation route (app/og/route.tsx)
    status: pending
  - id: E4-4
    title: Structured data (Organization + Event JSON-LD)
    status: pending
milestones:
  - id: ME-SEO
    title: SEO + social foundation complete (contract gate)
    features: [E4-1, E4-2, E4-3, E4-4]
    status: pending
---

# Mission: saoc-phase-e-seo

## Context

Phase E, task E4: SEO + social for the SAOC website. The site is built on Next.js 15 App Router,
Sanity CMS, Tailwind v4. It's a non-profit orchid council site targeting South African orchid
growers. The domain will be saoc.co.za.

This mission implements:
1. `public/robots.txt` — allow all, point to sitemap
2. `app/sitemap.ts` — Next.js dynamic sitemap pulling routes from Sanity (societies, events, shows)
3. Per-page metadata via `generateMetadata` in each page — Sanity title/description fields
4. OG image generation route (`app/og/route.tsx`) — branded image with title + SAOC logo treatment
5. JSON-LD structured data: Organization (homepage), Event (event pages), BreadcrumbList (all pages)

## Tech constraints
- Sanity client: `lib/sanity.ts` (already exists, uses `@sanity/client`)
- No `any` types, TypeScript strict
- Server Components only — no `'use client'` in SEO components
- Firebase App Hosting deployment target

## Notes

No external accounts needed. Fully autonomous. Dispatch via @architect → @dev → @qa chain.
