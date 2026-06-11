---
schema: athanor.mission/v1
slug: saoc-full-platform
goal: 'Deliver SAOC full digital platform: Phase A foundation (Next.js 15+TS+Tailwind v4+Sanity+Firebase), Phase B 8 CMS pages, Phase C events calendar, Phase D Stripe ticketing+admin, Phase E polish+launch'
created_at: '2026-06-06T06:30:00.000000+00:00'
started_at: null
last_active_at: null
status: active
cost_estimate:
  features: 9
  milestones: 1
  total_calls: 11
last_checkpoint:
  milestone: MA
  feature: A9
  ts: '2026-06-11T00:00:00.000000+00:00'
  note: 'A8 (CI on PRs) done — gate 8/8 PASS. A9 (next/font migration) is next.'
features:
  - id: A1
    title: 'Lockfile + Next.js sanity check'
    status: done
    started_at: '2026-06-06T12:00:00.000000+00:00'
    completed_at: '2026-06-06T12:00:00.000000+00:00'
  - id: A2
    title: 'ESLint flat config + Prettier'
    status: done
    started_at: '2026-06-06T12:00:00.000000+00:00'
    completed_at: '2026-06-06T12:00:00.000000+00:00'
  - id: A3
    title: 'Sanity install + Studio route'
    status: done
    started_at: '2026-06-08T00:00:00.000000+00:00'
    completed_at: '2026-06-08T12:00:00.000000+00:00'
  - id: A4
    title: 'Sanity schemas (7 content types)'
    status: done
    started_at: '2026-06-08T12:00:00.000000+00:00'
    completed_at: '2026-06-08T13:00:00.000000+00:00'
  - id: A5
    title: 'Seed Sanity from lib/data/'
    status: done
    started_at: '2026-06-08T13:00:00.000000+00:00'
    completed_at: '2026-06-08T14:00:00.000000+00:00'
  - id: A6
    title: 'next-sanity wiring with draft mode'
    status: done
    started_at: '2026-06-08T14:00:00.000000+00:00'
    completed_at: '2026-06-08T15:30:00.000000+00:00'
  - id: A7
    title: 'Firebase project provisioning (InunuNet account)'
    status: done
    started_at: '2026-06-08T15:30:00.000000+00:00'
    completed_at: '2026-06-08T16:30:00.000000+00:00'
  - id: A8
    title: 'CI on PRs'
    status: done
    started_at: '2026-06-08T16:30:00.000000+00:00'
    completed_at: '2026-06-11T00:00:00.000000+00:00'
  - id: A9
    title: 'next/font migration'
    status: pending
milestones:
  - id: MA
    name: 'Phase A — Foundation'
    status: in_progress
    features:
      - A1
      - A2
      - A3
      - A4
      - A5
      - A6
      - A7
      - A8
      - A9
notes: 'Full 5-phase brief. Supersedes abandoned narrow-scope mission 2026-06-01-saoc-website-build. M1–M4 legacy work unverified against this brief — re-audit required.'
---

# SAOC Full Platform Mission Plan

slug: saoc-full-platform

## Mission Brief

Deliver the South African Orchid Council's full digital platform across five phases: (A) foundational stack — Next.js 15 + TS strict + Tailwind v4 + Sanity CMS + Firebase App Hosting on the InunuNet account; (B) seven CMS-driven content pages wired to Sanity schemas; (C) an events calendar; (D) 2027 National Show ticketing via Yoco Online Gateway with admin dashboard, door check-in, and transactional email; (E) accessibility/performance polish, Secretary training for Sanity Studio, DNS cutover, and launch. The aesthetic is the editorial sage/parchment/brass system defined in `design/design_handoff_saoc/` (Crimson Pro serif, Manrope sans, JetBrains Mono mono). The previous narrow 7-page mission (`2026-06-01-saoc-website-build`) is abandoned; M1–M4 work exists in-repo but is unverified against this expanded brief and must be re-audited before being counted as done.

## Stack Summary

| Layer                   | Choice                                      | Notes                                                                                                               |
| ----------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Framework               | Next.js 15 (App Router, TS strict)          | Confirm latest stable on lockfile; React 19 already present                                                         |
| Package manager         | pnpm                                        | Lockfile committed; verify clean install                                                                            |
| Styling                 | Tailwind v4 (CSS-first)                     | Tokens in `app/globals.css`; no `tailwind.config.ts`. Postcss plugin = `@tailwindcss/postcss`                       |
| Typography              | Crimson Pro / Manrope / JetBrains Mono      | Loaded via Google Fonts in `globals.css` (consider migrating to `next/font` for self-host + CLS control)            |
| CMS                     | Sanity                                      | Studio routed at `/studio`; `next-sanity` SDK; free tier; 7 schemas for Phase B                                     |
| Hosting                 | Firebase App Hosting (InunuNet GCP account) | Connected to `InunuNet/SAOC` GitHub; `apphosting.yaml` present, needs review                                        |
| Auth (members portal)   | Firebase Auth (TBD)                         | Page 6 only; deferred until Phase B6                                                                                |
| Payments                | Yoco or Stripe                              | Phase D only. Yoco signup broken 2026-06-06; Stripe SA (ZAR) is fallback. Decision before Phase D contract.         |
| Email                   | cPanel SMTP (Nodemailer)                    | Explicit in proposal — InunuNet cPanel server. SPF/DKIM/DMARC must be verified on saoc.co.za before Phase D launch. |
| Calendar data (Phase C) | Sanity (primary) or Firebase RTDB           | Default Sanity; revisit if Secretary wants live edit                                                                |
| Icons                   | Lucide (1.5 stroke); Unicode `→` for arrows | Per design system                                                                                                   |
| Lint/format             | ESLint + Prettier                           | `next lint` in scripts; Prettier NOT yet installed                                                                  |

## Existing Work Audit (M1–M4)

Each item assessed against the new full brief. Verdict legend: **KEEP** = compatible as-is; **REWORK** = exists but needs wiring/refactor; **UNKNOWN** = needs explicit re-QA; **MISSING** = does not exist.

### M1 — Foundation

| Item                  | Path                                    | Verdict | Reason                                                                                                                                                                              |
| --------------------- | --------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js 15 scaffold   | `app/`, `next.config.ts`                | KEEP    | App Router shell, TS strict, marketing route group present. Verify on latest 15.x patch.                                                                                            |
| Tailwind v4 CSS-first | `app/globals.css`, `postcss.config.mjs` | KEEP    | `@tailwindcss/postcss` configured per learned note; tokens populated from design handoff.                                                                                           |
| Design tokens         | `app/globals.css` (266 lines)           | KEEP    | Sage/parchment/brass palette, type scale, fonts all in place.                                                                                                                       |
| TS strict config      | `tsconfig.json`                         | KEEP    | `strict: true`, `@/*` alias configured.                                                                                                                                             |
| Typed data layer      | `lib/data/*.ts`, `types/index.ts`       | REWORK  | Currently hard-coded TypeScript modules. Must be replaced by Sanity-fetched data for Phase B. Keep as fallback/seed source.                                                         |
| Firebase SDK          | `package.json` (`firebase@^11`)         | REWORK  | Dependency present but NO Firebase project provisioned, NO credentials in `.env.local`, NO App Hosting connection. `apphosting.yaml` present but unverified.                        |
| pnpm lockfile         | `pnpm-lock.yaml`                        | KEEP    | Present and clean per last build. Re-verify after Sanity + ESLint/Prettier deps added.                                                                                              |
| ESLint / Prettier     | —                                       | MISSING | `next lint` script exists but no flat config, no Prettier dep, no `.prettierrc`. Phase A task.                                                                                      |
| Sanity CMS            | —                                       | MISSING | No `sanity/` schema dir, no `next-sanity` dep, no Studio route. Phase A task.                                                                                                       |
| `.env.local.example`  | `.env.local.example`                    | REWORK  | Covers Firebase client + admin keys; must add `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `SANITY_API_READ_TOKEN`, Yoco keys (Phase D), email API key (Phase D). |

### M2 — Chrome (global shell)

| Item                  | Path                                                    | Verdict | Reason                                                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root layout           | `app/layout.tsx`                                        | KEEP    | Mounts UtilityBar / Header / Footer correctly.                                                                                                                                                                         |
| Marketing route group | `app/(marketing)/layout.tsx`                            | REWORK  | Currently a passthrough — Breadcrumb injection deferred to M4 per learned notes. Wire Breadcrumb here in Phase B.                                                                                                      |
| UtilityBar            | `components/chrome/UtilityBar.tsx`                      | KEEP    | Server component; matches design spec.                                                                                                                                                                                 |
| Header                | `components/chrome/Header.tsx`                          | UNKNOWN | Client component. Verify nav items match final IA (About · Societies · Shows · Judging · Members · Contact). Current spec uses "National Show" + "Events" + "Learn (Soon)" — Phase B IA collapses Shows+National Show. |
| Footer                | `components/chrome/Footer.tsx` (+ `NewsletterForm.tsx`) | REWORK  | Server shell + client form. Newsletter form is stubbed — wire to real provider (Resend audience or Mailchimp) in Phase E.                                                                                              |
| MobileMenu            | `components/chrome/MobileMenu.tsx`                      | UNKNOWN | Nav items must match Header changes.                                                                                                                                                                                   |
| SearchOverlay         | `components/chrome/SearchOverlay.tsx`                   | REWORK  | Currently filters static `lib/data/`. Must switch to Sanity GROQ search across societies + events + shows in Phase B.                                                                                                  |
| Breadcrumb            | `components/chrome/Breadcrumb.tsx`                      | UNKNOWN | Built but not wired into `(marketing)/layout.tsx`. Must integrate in Phase B.                                                                                                                                          |

### M3 — Home Page

| Item                     | Path                                                         | Verdict | Reason                                                                                 |
| ------------------------ | ------------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------- |
| Page composition         | `app/(marketing)/page.tsx`                                   | REWORK  | Composes 7 home sections; must accept Sanity-fetched props instead of hard-coded data. |
| Hero (4-image crossfade) | `components/home/Hero.tsx`                                   | REWORK  | Image set + headline must come from Sanity `homePage` document.                        |
| MissionBlock             | `components/home/MissionBlock.tsx`                           | REWORK  | Copy + 4-up stats from Sanity.                                                         |
| NavCards                 | `components/home/NavCards.tsx`                               | REWORK  | Card targets + counts from Sanity references.                                          |
| ShowBand (countdown)     | `components/home/ShowBand.tsx` + `lib/hooks/useCountdown.ts` | REWORK  | Show meta + countdown target from Sanity `nationalShow` doc.                           |
| EventsStrip              | `components/home/EventsStrip.tsx`                            | REWORK  | Pull next 5 events from Sanity (currently static).                                     |
| YearbookStrip            | `components/home/YearbookStrip.tsx`                          | REWORK  | Yearbook meta from Sanity.                                                             |
| PartnersSection          | `components/home/PartnersSection.tsx`                        | REWORK  | Partner list from Sanity.                                                              |
| useCountdown hook        | `lib/hooks/useCountdown.ts`                                  | KEEP    | Pure utility, no data dependency.                                                      |

### M4 — Interior Pages (F5 About only)

| Item       | Path                             | Verdict | Reason                                                                                                                                         |
| ---------- | -------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| About page | `app/(marketing)/about/page.tsx` | REWORK  | Built with hard-coded `PILLARS`, `TIMELINE`, and `boardMembers` import. Convert all three to Sanity-driven content. PageHero + structure stay. |
| PageHero   | `components/ui/PageHero.tsx`     | KEEP    | Reusable shell, accepts props; no rework needed.                                                                                               |
| EventRow   | `components/ui/EventRow.tsx`     | KEEP    | Pure presentational; will accept Sanity event objects shaped to the existing prop interface.                                                   |

### Net audit summary

- **KEEP (8):** scaffold, Tailwind v4, design tokens, tsconfig, lockfile, root layout, UtilityBar, useCountdown, PageHero, EventRow.
- **REWORK (15):** every data-bound component (all 7 home sections, About page, SearchOverlay, Footer newsletter, marketing layout, lib/data layer, Firebase wiring, env example, apphosting.yaml review).
- **UNKNOWN (3):** Header nav IA, MobileMenu nav IA, Breadcrumb integration.
- **MISSING (3):** Sanity install + schemas + Studio route, ESLint flat config + Prettier, Firebase project provisioning.

Verdict: M1–M4 give us a strong visual + structural starting point but **zero Phase B compatibility** at the data layer. No code needs deletion; everything reworkable can be retrofitted page-by-page during Phase B.

## Phase A Tasks — Foundation

Ordered. Each is a candidate contract.

1. **A1: Lockfile + Next.js sanity check** — `pnpm install`, `pnpm build`, `pnpm type-check` all green. Confirm `next@15.x` is the latest stable patch; bump if not. Verify `react@19` compatibility. _Gate: build succeeds; tsc clean._
2. **A2: ESLint flat config + Prettier** — Install `eslint`, `eslint-config-next`, `prettier`, `eslint-config-prettier`, `@trivago/prettier-plugin-sort-imports` (or stylistic equivalent). Create `eslint.config.mjs` (flat) + `.prettierrc.json` + `.prettierignore`. Add `pnpm format` and `pnpm format:check` scripts. _Gate: `pnpm lint` + `pnpm format:check` green on current code._
3. **A3: Sanity install + Studio route** — `pnpm add sanity @sanity/vision next-sanity styled-components @portabletext/react`. Create `sanity.config.ts`, `sanity.cli.ts`, `app/studio/[[...tool]]/page.tsx`, `sanity/env.ts`, `sanity/lib/client.ts`, `sanity/lib/image.ts`. Deploy Studio (`sanity deploy`) and capture URL. _Gate: `/studio` loads locally; Sanity project ID committed to `.env.local.example`._
4. **A4: Sanity schemas (7 content types)** — Define schemas: `homePage` (singleton), `aboutPage` (singleton), `society` (collection, 21 docs), `show` (collection: 2024 past + 2027 upcoming + future), `judgingPage` (singleton + accredited judges array or referenced `judge` doc), `membersPage` (singleton; portal scope TBD), `contactPage` (singleton with form recipients), plus support types: `partner`, `boardMember`, `event`, `award`, `showClass`, `province`. _Gate: `sanity dataset import` round-trips a seed export; schemas validate._
5. **A5: Seed Sanity from `lib/data/`** — Author a one-shot import script (`scripts/seed-sanity.ts`) that maps the existing typed-data modules to Sanity documents and pushes via `@sanity/client`. Preserves all current copy as a starting point Secretary can edit. _Gate: `/studio` shows all 21 societies + sample events + board + partners._
6. **A6: next-sanity wiring with draft mode** — Implement `sanity/lib/fetch.ts` with tagged fetches for ISR, draft-mode toggle route (`app/api/draft/route.ts`), and a `defineQuery` GROQ helper. Add `sanity/queries.ts` with reusable queries (homeQuery, societyListQuery, etc.). _Gate: home page renders Sanity data when route fetched; type-check clean (use `sanity-codegen` or `@sanity/codegen` for typed GROQ)._
7. **A7: Firebase project provisioning (InunuNet account)** — Create Firebase project under InunuNet GCP. Enable App Hosting. Connect to `InunuNet/SAOC` GitHub repo. Generate service account key. Populate `.env.local` (Brad runs this; deliverable is a checklist + verification). Review/update `apphosting.yaml` to include `runConfig.env` references for Sanity vars. _Gate: staging URL responds 200 with home page; auto-deploy on push to main confirmed._
8. **A8: CI on PRs** — Add `.github/workflows/ci.yml` running `pnpm install`, `pnpm lint`, `pnpm type-check`, `pnpm build` on PRs. _Gate: a noop PR runs the workflow and goes green._
9. **A9: `next/font` migration (optional but recommended)** — Replace the Google Fonts CSS `@import` with `next/font/google` for Crimson Pro, Manrope, JetBrains Mono. Eliminates CLS, self-hosts fonts, removes external blocking request. _Gate: Lighthouse CLS < 0.1; fonts render identically._

## Phase B Tasks — 7 CMS Content Pages

Each page = contract; chain order = retrofit home/about first (existing assets), then build greenfield pages.

### B1: Home (`/`) — retrofit

- Wire each home section to Sanity via `homeQuery`.
- Replace `lib/data/heroImages.ts` with Sanity image array (Sanity image pipeline + `next/image` loader).
- Countdown target read from `nationalShow` doc.
- _Gate: home renders identically; editing copy in Studio reflects after revalidation._

### B2: About (`/about`) — retrofit

- Wire PILLARS, TIMELINE, board to Sanity (`aboutPage` + `boardMember` collection).
- Preserve current PageHero, layout, prose styling.
- _Gate: visual diff matches pre-rework; Studio edit propagates._

### B3: Societies (`/societies`) — greenfield

- Server-fetched 21 societies from Sanity.
- Client island for province chip filter + free-text search (preserves URL state via `?province=&q=`).
- Society card per design handoff §3 (mark badge + province tag + region/founded + Meets/Venue/Members + arrow).
- Empty state with reset.
- "Start one" CTA band.
- _Gate: all 21 societies render; filter combinations match design prototype behaviour._

### B4: Shows & Events / National Show (`/shows`) — greenfield

- **Decision needed (open question):** does `/shows` consolidate the design-handoff "Events" page + "National Show" page, or are they separate routes `/shows` (past + upcoming) and `/national-show` (flagship)? Brief lists "Shows & Events" as the page; recommend `/shows` as the index and `/shows/2027-national` for the flagship.
- Show hero (760px, diagonal sage→ink, countdown, meta grid).
- Past shows grid (3-col cards with edition tag, stats).
- Class & judging grid (10 classes from `showClass` schema).
- Exhibitor info stages.
- _Gate: countdown ticks; class grid hydrates from Sanity; past-shows route renders._

### B5a: Judging system overview (`/judging`) — greenfield

### B5b: Judges Training (`/judging/training`) — greenfield (separate page per proposal)

- PageHero + how-it-works copy + stats (judges / students / regions).
- Awards grid (6 cards, 2px brass top-border, mono code + description).
- Become-a-judge split with 4-step pathway.
- Accredited judges list (table or directory; behind disclosure if PII concerns).
- _Gate: awards + steps render from Sanity; judge directory respects privacy decisions._

### B6: Members portal (`/members`) — Phase 1 scaffolding only (UI deferred to Phase 2)

- **Decision needed (open question):** scope is TBD per brief. MVP recommendation: Firebase Auth-gated landing with downloadable resources (judging handbook, yearbook PDFs, society admin forms) + member-only events. Defer roster/profile features to Phase E or post-launch.
- Login page (Firebase Auth — email/password or magic link).
- Server-side session check via Firebase Admin in `app/(members)/layout.tsx`.
- Members landing fetches `membersPage` Sanity doc + restricted assets.
- _Gate: unauthed user redirected; authed user sees gated content._

### B6b: Sponsors (`/sponsors`) — greenfield (in proposal, missed in initial plan)

- PageHero + sponsor grid from Sanity `sponsor` collection (logo, tier, URL, description).
- Tier groupings (Title / Gold / Silver / Supporting).
- CTA for new sponsors.
- _Gate: sponsor grid renders from Sanity; tiers grouped correctly._

### B7: Contact (`/contact`) — greenfield

- PageHero + 2-col layout: direct lines (Sanity) + contact form (client).
- Form: Name (required), Email (regex), Topic (select), Society (optional select), Message (≥10 chars). Client + server validation.
- Server route `app/api/contact/route.ts` sends via Resend/SendGrid to address from `contactPage.recipients`.
- Success panel + reset.
- Spam protection: honeypot + Cloudflare Turnstile (or hCaptcha) before launch.
- _Gate: valid submission lands in inbox; invalid submission blocked; honeypot triggers silently._

### B-cross: SearchOverlay rewire

- After Phase B pages exist, replace static search with Sanity GROQ across `society` + `event` + `show` + page-level docs.
- Debounced GROQ via a `/api/search` route or direct client-side using a read-only Sanity client.

### B-cross: Breadcrumb integration

- Wire Breadcrumb into `app/(marketing)/layout.tsx` (or per-page) using Next.js `usePathname` + a route-to-label map from Sanity navigation singleton.

## Phase C Tasks — Events Calendar (`/events`)

- **C1:** Decide source-of-truth: Sanity `event` collection (default) vs Firebase RTDB for live secretary edits. Default Sanity.
- **C2:** Calendar view: month grid + list view toggle (matches design prototype kind chips + month select).
- **C3:** Event detail page `/events/[slug]` with venue map (Google Maps embed or static image), host society link, kind badge.
- **C4:** ICS export per event + a feed `/events.ics` for subscribe-to-calendar.
- **C5:** "Submit an event" form (members-only or council-only) writing back to Sanity via authenticated mutation.
- _Gate: events grouped by month match design; ICS feed validates in Google Calendar._

## Phase D Tasks — 2027 National Show Ticketing

- **D1: Choose email provider** — Resend (preferred for DX + React Email) or SendGrid. Decision blocker.
- **D2: Yoco Online Gateway integration** — Server-side checkout session creation, success/cancel routes, webhook handler for `payment.success` + `payment.failed`. Store transaction refs in Firebase Firestore.
- **D3: Ticket model** — Firestore collection `tickets` with: `id`, `email`, `name`, `type` (single-day/multi-day/exhibitor), `qty`, `total`, `yocoRef`, `status`, `qrCode`, `purchasedAt`. PDF ticket generator (server-side via `@react-pdf/renderer` or Puppeteer).
- **D4: Buy flow** — `/shows/2027-national/tickets` → select tier → email/name → Yoco redirect → confirmation page. React Email template for booking confirmation with QR + PDF attachment.
- **D5: Admin dashboard** — `/admin` route, Firebase Auth + custom claims (`role: admin`). Tables: sold tickets, attendee list, refunds, daily totals, CSV export. Refund handler hits Yoco API + updates Firestore.
- **D6: Door check-in** — `/admin/door` mobile-first scanner using `html5-qrcode`. Scan → lookup ticket → mark `checkedInAt` → audible/visual confirm. Manual lookup by reference as fallback.
- **D7: Idempotency + reconciliation** — Webhook idempotency (Yoco can retry); nightly reconciliation script comparing Yoco transactions to Firestore tickets.
- _Gate: end-to-end test purchase in Yoco sandbox → email arrives → QR scans at door → admin shows the sale._

## Phase E Tasks — Polish, Testing, Training, Launch

- **E1: Accessibility audit** — axe-core in CI; manual keyboard pass; verify focus states, skip links, semantic landmarks, alt text on all Sanity images.
- **E2: Performance audit** — Lighthouse CI in workflow; target ≥90 mobile across all routes; image optimisation review (Sanity image pipeline + `next/image`); bundle analyzer pass.
- **E3: Secretary training materials** — Loom recordings + written guide for Sanity Studio covering: editing pages, adding societies, adding events, scheduling show classes, swapping hero images. Stored in `docs/secretary/`.
- **E4: SEO + social** — Per-page metadata via Sanity, OG image generation route (`app/og/[slug]/route.tsx`), `robots.txt`, `sitemap.ts`, structured data (Organization, Event, BreadcrumbList).
- **E5: Backups + observability** — Sanity dataset snapshot cron, Firestore daily backup, Firebase App Hosting log alerts, Sentry (or Cloudflare equivalent) for error tracking.
- **E6: Legal pages** — Privacy, Constitution, Media kit (linked from footer) — all CMS-driven.
- **E7: DNS cutover** — Final apex/`www` CNAME swap to Firebase App Hosting; preserve any email MX records; 24h TTL pre-cut.
- **E8: Launch checklist** — Pre-launch matrix (broken-link crawler, form smoke test, payment sandbox→live switch, email deliverability check, analytics live, 301 redirects from any legacy paths, status page).

## First Mission: What @architect should tackle first

**Mission A1+A2 combined — "Phase A bedrock"** (small, scoped, unblocks everything).

Scope:

1. Verify Next.js 15 + React 19 install on a fresh `pnpm install`.
2. Run `pnpm build` + `pnpm type-check`; fix any drift from harness/template updates since 2026-06-05.
3. Add ESLint flat config (`eslint.config.mjs`) using `eslint-config-next` flat preset.
4. Add Prettier + `eslint-config-prettier`; create `.prettierrc.json` (single quotes, semicolons, 100 char line per project coding rules), `.prettierignore`.
5. Add `pnpm format` and `pnpm format:check` scripts.
6. Run `pnpm format` once across the repo so all subsequent diffs are formatting-neutral.

Why first: (a) no Sanity decision is required, (b) no external account setup is needed, (c) it surfaces any silent drift in the existing build/type/lint pipeline before any new feature work, (d) clean lint+format baseline is a precondition for the CI workflow in A8 and every subsequent contract gate.

Architect deliverables:

- `contract-phase-a-bedrock.yaml` with shell assertions covering: deps install, lint, type-check, build, presence of `eslint.config.mjs` + `.prettierrc.json` + format scripts.
- Golden files: target `eslint.config.mjs`, target `.prettierrc.json`, updated `package.json` scripts block.
- Handoff to @dev with explicit list of formatting rules.

After A1+A2 lands, the next architect mission is **A3+A4: Sanity install + 7 schemas** — the single biggest unblocker for all of Phase B.

## Open Questions

These need Brad's explicit input before the relevant contracts can be written. None block the first mission (A1+A2 bedrock).

1. **Information architecture — `/shows` vs `/national-show`** — Brief lists "Shows & Events" as the page. Recommend `/shows` as the index (past + upcoming) and `/shows/2027-national` for the flagship show. Confirm or override.
2. **Members portal scope (B6)** — Brief marks portal scope as TBD. MVP recommendation: gated downloads + member-only events. Confirm or expand (e.g. member directory, profile editing, society admin panel).
3. **Calendar source (Phase C)** — Default Sanity. Override only if Secretary needs real-time edit propagation more than versioning + draft mode.
4. **Email provider (Phase D)** — Resend (recommended for DX, React Email native, generous free tier) vs SendGrid (more legacy, larger free tier). Decision blocks D1.
5. **Yoco account** — Who holds the merchant account: SAOC or InunuNet on behalf of? Affects Yoco API keys and the bank settlement flow. Decision blocks D2.
6. **Accredited judges directory (B5)** — Show full directory publicly, or behind members login? PII considerations.
7. **Newsletter provider** — Footer form currently stubbed. Resend audience, Mailchimp, Buttondown, or Beehiiv? Affects Phase E launch readiness.
8. **`next/font` migration (A9)** — Recommended but technically optional. Approve or defer to Phase E performance pass.
9. **Sanity dataset naming** — `production` + `staging` (recommended) or single dataset? Affects Studio deploy + draft workflows.
10. **GitHub remote confirmation** — Learned log corrected from `BDauth/SAOC` to `InunuNet/SAOC` on 2026-06-05. Re-confirm before Firebase App Hosting connect.

## References

- Brief: this mission's task instructions (5-phase scope).
- Design: `/Users/vetus/ai/SAOC/design/design_handoff_saoc/README.md`, `design_system_README.md`, `colors_and_type.css`, `screenshots/01–07`.
- Tokens already in repo: `app/globals.css` (266 lines, populated 2026-06-01).
- Prior mission (abandoned): `.agent/memory/project/missions/2026-06-01-saoc-website-build.md`.
- Learned log: `.agent/memory/project/learned.md` — especially Session Reset (2026-06-05) entries.
- Proposal: `documents/SAOC_Website_Proposal_28-05-2026.pdf` (not text-extractable in this environment; visual review recommended).
