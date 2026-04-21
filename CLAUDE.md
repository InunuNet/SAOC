# SAOC Website — Developer Guide

## Client Context

The **South African Orchid Council (SAOC)** is a non-profit national body coordinating orchid societies across South Africa since 1968. This site replaces their existing broken Joomla site at saoc.co.za.

### Critical scope boundary

**SAOC is not wild orchid conservation.** SAOC focuses on orchids *in cultivation*: growing, showing, hybridising, judging, and community. Wild orchid identification, habitat protection, and conservation belong to **WOSA (Wild Orchids of Southern Africa)** — a separate partner organisation with its own site. Never produce content about wild orchid conservation — link to WOSA for those topics.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 15 (App Router, TypeScript) | RSC-first, Firebase App Hosting native SSR support |
| Styling | Tailwind CSS v4 | CSS-first config, no tailwind.config.ts needed |
| Hosting | Firebase App Hosting | Native Next.js SSR, same ecosystem as Firestore |
| Database | Firestore | Flexible schema for societies, events, shows |
| Auth | Firebase Auth | Scaffolded, not wired to UI until Phase 2 |
| Forms | API route → Firestore | Contact submissions; email via SendGrid/Resend (future) |
| Package manager | pnpm | Faster, stricter hoisting |

---

## Project Structure

```
app/
├── (marketing)/          # Public-facing pages (route group — no URL segment)
│   ├── page.tsx          # Home
│   ├── about/            # About SAOC
│   ├── societies/        # 21 affiliated societies + [slug] individual pages
│   ├── judging/          # Judging system overview
│   ├── events/           # Events calendar
│   ├── national-show/    # Show overview + upcoming + archive/[year]
│   └── contact/          # Contact form
├── api/contact/          # Contact form POST handler
├── layout.tsx            # Root layout (header + footer)
└── globals.css           # Tailwind v4 import only

lib/
├── firebase.ts           # Client Firebase initialisation (singleton)
└── firebase-admin.ts     # Server Firebase Admin initialisation (singleton)

types/
└── index.ts              # Shared TypeScript types (Society, SocietyEvent, NationalShow, etc.)
```

---

## Firebase Setup

### First-time setup

1. Create a Firebase project at console.firebase.google.com
2. Enable Firestore (production mode)
3. Enable Firebase Auth (email/password + Google — for future phase)
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
