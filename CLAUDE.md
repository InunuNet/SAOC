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
| Payments | Ozow — active gateway, chosen by Lee-Ann, set in /admin/settings. All testing uses Ozow's sandbox test mode, a separate admin toggle. PayFast integration retained, never used for testing | Ticket checkout + payment-notification webhooks (`lib/ozow.ts`, `lib/payments/`); see `docs/payment-gateway-selection.md` |
| Package manager | pnpm | Faster, stricter hoisting |

---

## Detailed reference

- Project Structure: see PROJECT_GUIDE.md
- Firebase Setup: see PROJECT_GUIDE.md
- Adding Data: see PROJECT_GUIDE.md
- Design Handoff Workflow: see PROJECT_GUIDE.md

---

## Coding Conventions

- **TypeScript strict mode** — no `any`, no type assertions without a comment explaining why
- **Server Components by default** — only add `'use client'` when you need browser APIs, event handlers, or useState/useEffect
- **No client-side data fetching for static/Firestore content** — fetch server-side in Server Components or API routes using the Admin SDK
- **Admin SDK in API routes** — never import `firebase-admin` in client components or pages that ship to the browser
- **Conventional commits** — `feat:`, `fix:`, `chore:`, `docs:`, `style:`, `refactor:`, `test:`
- **No invented brand assets** — do not add colours, logos, fonts, or visual design decisions. Wait for Claude Design handoffs.
- **Firestore builders: coalesce optionals or strip undefined** — builders that construct Firestore documents from optional-field drafts must never leave `undefined` own-properties on the output. Either coalesce to `null` (`field: input.field ?? null`) or strip undefined keys before writing. See `docs/firestore-undefined-write-safety.md` and the safe reference pattern in `buildMultiReservationDocs()` and M3 stand-payment write.

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
