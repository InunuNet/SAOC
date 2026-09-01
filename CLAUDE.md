# SAOC Website — Developer Guide

## Client Context

The **South African Orchid Council (SAOC)** is a non-profit national body coordinating orchid societies across South Africa since 1968. This site replaces their existing broken Joomla site at saoc.co.za.

### Critical scope boundary

**SAOC is not wild orchid conservation.** SAOC focuses on orchids *in cultivation*: growing, showing, hybridising, judging, and community. Wild orchid identification, habitat protection, and conservation belong to **WOSA (Wild Orchids of Southern Africa)** — a separate partner organisation with its own site. Never produce content about wild orchid conservation — link to WOSA for those topics.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 16 (App Router, TypeScript), Node 22 runtime | RSC-first, Firebase App Hosting native SSR support |
| Styling | Tailwind CSS v4 | CSS-first config, no tailwind.config.ts needed |
| Hosting | Firebase App Hosting | Native Next.js SSR, same ecosystem as Firestore |
| CMS | Sanity (Studio at `/studio`) | Structured content editing (events, national show, media kit, etc.) via `next-sanity` |
| Database | Firestore | Contact submissions, ticket sales/check-in, event submissions |
| Auth | Firebase Auth | Email/password, Google, Microsoft, and Apple sign-in for `/admin`; session cookies via `firebase-admin/auth` |
| Forms | API route → Firestore + Resend | Contact and event submissions written to Firestore; confirmation email sent via Resend |
| Payments | PayFast (sandbox) | Ticket checkout + ITN webhook verification (`lib/payfast.ts`) |
| Package manager | pnpm | Faster, stricter hoisting |

---

## Project Structure

```
app/
├── (marketing)/          # Public-facing pages (route group — no URL segment)
│   ├── page.tsx          # Home
│   ├── about/             # About SAOC
│   ├── societies/         # 21 affiliated societies + [slug] individual pages
│   ├── judging/           # Judging system overview
│   ├── events/            # Events calendar + [slug] detail
│   ├── national-show/     # Show overview + upcoming + archive/[year] + vendors showcase + gated registration flow
│   │   ├── vendors/       # Vendor showcase (public) + application form (public) + registration form (gated by token, M1)
│   ├── media-kit/         # Media kit
│   ├── sponsors/          # Sponsors
│   ├── constitution/      # Constitution
│   ├── privacy/           # Privacy policy
│   ├── terms/             # Terms
│   └── contact/           # Contact form
├── admin/                # Firebase Auth-gated admin (login, door check-in scanner, vendor review)
│   └── vendors/           # Vendor management (application review + full submission review; gated: review-vendor-applications)
│       └── applications/  # Vendor applications (short form, M1)
├── studio/               # Sanity Studio, mounted at /studio (see sanity.config.ts)
├── api/
│   ├── contact/           # Contact form POST handler → Firestore + Resend
│   ├── events/             # Event submission + per-event .ics export
│   ├── events.ics/         # Combined events feed
│   ├── tickets/            # PayFast checkout + ITN webhook → Firestore `tickets`
│   ├── vendors/            # Vendor application (short form, M1) → `vendorApplications`; full registration (gated by token, M1) → `vendorSubmissions`; proof-of-payment upload
│   ├── admin/               # Session (Firebase Auth), check-in, CSV export; vendor review and payment routes
│   │   ├── vendors/        # Vendor review workflow (F6) and payment/booth allocation (F7)
│   │   └── reconcile-orders/ # Cloud Scheduler-triggered: alerts on orders stranded `reserved` past expiry (docs/order-reconciliation.md)
│   ├── draft/ + disable-draft/  # Sanity draft-mode preview toggles
│   └── revalidate/          # Sanity webhook → on-demand ISR revalidation
├── layout.tsx             # Root layout (html/body/fonts/globals)
└── globals.css            # Tailwind v4 import only

sanity/
├── schemas/                # Document + object schema types
└── lib/                    # Sanity client helpers

lib/
├── firebase.ts             # Client Firebase initialisation (singleton)
├── firebase-admin.ts       # Server Firebase Admin initialisation (singleton)
├── payfast.ts               # PayFast signature + sandbox constants
├── email.ts                 # Resend email sending
└── data/                    # Server-side data-fetch helpers

types/
└── index.ts                # Shared TypeScript types (Society, SocietyEvent, NationalShow, etc.)
```

---

## Firebase Setup

### First-time setup

1. Create a Firebase project at console.firebase.google.com
2. Enable Firestore (production mode)
3. Enable Firebase Auth (email/password sign-in is enabled by default; Google, Microsoft, and Apple sign-in require additional provider configuration in the Firebase Console — see `docs/admin-access.md`)
4. Enable Firebase App Hosting

### Environment variables

Copy `.env.local.example` → `.env.local` and fill in your values.

**Client vars** (`NEXT_PUBLIC_*`): from Firebase console → Project Settings → Your apps → Web app config.

**Admin vars** (`FIREBASE_*`): from Firebase console → Project Settings → Service Accounts → Generate new private key. Download the JSON and copy the three fields.

The `FIREBASE_PRIVATE_KEY` contains literal `\n` characters in the JSON — paste the whole quoted string including the quotes. The `initAdmin()` function handles the `.replace(/\\n/g, '\n')`.

### Collections

| Collection | Purpose |
|-----------|---------|
| `societies` | 21 affiliated societies — add as Firestore docs, no code change needed |
| `events` | Society events and shows — add as Firestore docs |
| `nationalShows` | Past and upcoming national shows — add as Firestore docs |
| `contactSubmissions` | Written by the `/api/contact` route — do not edit manually |
| `adminSettings` | Operational settings written and read by admin-only API routes. Contains one doc per named setting (e.g. `activePaymentGateway`, `ozowSandboxTestMode`). See [docs/payment-gateway-selection.md](docs/payment-gateway-selection.md) and the `ozow-sandbox-toggle` contract for the stored shapes and access patterns. |
| `vendorApplications` | Short vendor application form submissions (M1, mission vendor-gated-registration-flow). Status: `pending` / `approved` / `declined`. Single-use registration tokens are issued on approval and claimed on full-registration submission. See [docs/vendor-gated-registration-flow.md](docs/vendor-gated-registration-flow.md) |
| `vendorSubmissions` | Full vendor registration form submissions (gated by token, M1; field set corrected M2). Token-gated via M1's single-use HMAC workflow (see [docs/vendor-gated-registration-flow.md § M1](docs/vendor-gated-registration-flow.md#m1-checkpoint)). M2 (F13-F21, gated) added ~60 new fields (online presence, booth sizing, repeating equipment tables, vehicle registrations, insurance policy numbers, food certifications, marketing uploads, signature block) and deprecated-in-place the old field shapes (see [docs/vendor-gated-registration-flow.md § M2](docs/vendor-gated-registration-flow.md#m2-full-registration-form-corrections)); pre-M2 documents remain queryable and backward-compatible. |
| `orders` / `tickets` | Ticket orders and their positions. Requires a deployed Firestore composite index on `orders(status, expiresAt)` (`firestore.indexes.json`) for `POST /api/admin/reconcile-orders` to query stranded orders — see [docs/order-reconciliation.md](docs/order-reconciliation.md). Positions carry `chosenDay: string \| null` (F5) validated server-side against the active show's window — see [docs/f5-day-selection-attendees.md](docs/f5-day-selection-attendees.md) |
| `ticketType` (Sanity) | The five admission products (Early-Bird Exhibition, Day Visitor, Early-Bird Weekend Pass, Weekend Pass, VIP). F4 adds five schema fields: `provisional`, `earlyBirdCutoff`, `releasedQuantity`, `requiresDaySelection`, `requiresAttendeeNames` — see [docs/f4-admission-products.md](docs/f4-admission-products.md) |

### Admin authorisation

All `/admin` surfaces are gated through one shared helper, `lib/admin-auth.ts` —
`admin === true` custom claim, `email_verified === true`, and live membership of
`ADMIN_EMAIL_ALLOWLIST`, all re-checked per request; fails closed on every unenumerated
state. See [`docs/admin-access.md`](docs/admin-access.md) for the policy, the debugging
`reason` values, and known traps (unverified-email lockouts, an empty allowlist that
fails closed silently).

---

## Adding Data (No Code Changes Needed)

### Add a society
Add a document to the `societies` Firestore collection. Required fields: `name`, `slug`, `province`, `city`, `venue`, `meetingDay`, `meetingTime`, `email`. See `types/index.ts` for the full `Society` type.

The `slug` must be URL-safe (e.g. `orchid-society-of-pretoria`). It's used for `/societies/[slug]` routes.

### Add an event
Add a document to the `events` collection. `societyId` references the society document ID. `startDate` and `endDate` are Firestore Timestamps.

### Add a past national show
Add a document to the `nationalShows` collection. `edition` is the show number (e.g. 18), `year` is the calendar year. `startDate` and `endDate` are Timestamps. Optional: `grandChampion`, `reserveChampion`, `categoryWinners`, `galleryImages`.

---

## Coding Conventions

- **TypeScript strict mode** — no `any`, no type assertions without a comment explaining why
- **Server Components by default** — only add `'use client'` when you need browser APIs, event handlers, or useState/useEffect
- **No client-side data fetching for static/Firestore content** — fetch server-side in Server Components or API routes using the Admin SDK
- **Admin SDK in API routes** — never import `firebase-admin` in client components or pages that ship to the browser
- **Conventional commits** — `feat:`, `fix:`, `chore:`, `docs:`, `style:`, `refactor:`, `test:`
- **No invented brand assets** — do not add colours, logos, fonts, or visual design decisions. Wait for Claude Design handoffs.

---

## Design Handoff Workflow

Visual design is produced in **Claude Design** (claude.ai/design) as a separate workstream. Design approval happens there, not in this repo.

When a design handoff arrives, it will be delivered as a bundle containing:
- Design spec (colours, typography, spacing tokens)
- Component structure (which components to create, their props)
- Implementation notes

Implement handoffs faithfully against the existing page structure. Do not restructure routes or rename pages to fit the design — adapt the design to the structure.

Tailwind v4 uses CSS custom properties for theming. When the brand tokens arrive, add them to `app/globals.css` as `@theme` variables.

---

## Running Locally

```bash
pnpm install
cp .env.local.example .env.local   # fill in Firebase credentials
pnpm dev
```

App runs at http://localhost:3000.

---

## Deployment

Firebase App Hosting handles deployment. See `apphosting.yaml` (to be created at deploy time). The hosting backend reads `FIREBASE_*` secrets from Secret Manager — do not commit `.env.local`.
