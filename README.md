# SAOC Website

The **South African Orchid Council (SAOC)** is a non-profit national body that has coordinated orchid societies across South Africa since 1968. This repository contains the Phase 1 MVP rebuild of saoc.co.za — replacing a broken Joomla site with a modern Next.js application backed by Firebase.

## What This Repo Is

Next.js 15 (App Router, TypeScript) + Firebase (Firestore, Auth, App Hosting), scaffolded as Phase 1 MVP. Visual design is handled separately in Claude Design; this repo ships structure, data access, and server logic.

## Quick Start

```bash
pnpm install
cp .env.local.example .env.local   # fill in Firebase credentials
pnpm dev
```

Open http://localhost:3000.

See [CLAUDE.md](./CLAUDE.md) for the full developer guide (Firebase setup, Firestore collection shapes, coding conventions, design handoff workflow, deployment).

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 15 (App Router, TypeScript) | RSC-first, Firebase App Hosting native SSR support |
| Styling | Tailwind CSS v4 | CSS-first config, no `tailwind.config.ts` needed |
| Hosting | Firebase App Hosting | Native Next.js SSR, same ecosystem as Firestore |
| Database | Firestore | Flexible schema for societies, events, shows |
| Auth | Firebase Auth | Scaffolded, not wired to UI until Phase 2 |
| Forms | API route → Firestore | Contact submissions; email via SendGrid/Resend (future) |
| Package manager | pnpm | Faster, stricter hoisting |

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Dev server with Turbopack |
| `pnpm build` | Production build |
| `pnpm start` | Run production build |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier — write |
| `pnpm format:check` | Prettier — check only |

## Design

Visual design is produced in **Claude Design** as a separate workstream and approved there before implementation. Handoff bundles land in this repo as design specs with component structure and tokens — see CLAUDE.md for the workflow. Do not invent colours, fonts, logos, or visual decisions in this repo.

## License

Proprietary — South African Orchid Council.
