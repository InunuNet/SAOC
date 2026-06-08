# SAOC — South African Orchid Council Website

Public website for the South African Orchid Council. Built with Next.js 15 and deployed via Firebase App Hosting.

## Development

**Prerequisites**

- Node.js 22+
- pnpm 9+

**Install**

```bash
pnpm install
```

**Dev server**

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

**Lint**

```bash
pnpm lint
```

**Format**

```bash
pnpm format          # write in-place
pnpm format:check    # check only (CI-safe)
```

**Type check**

```bash
pnpm run type-check
```

**Environment**

Copy the example file and fill in the Firebase values:

```bash
cp .env.local.example .env.local
```

The required variables are listed in `.env.local.example`. Firebase credentials are not yet active (see [docs/m1-foundation.md](docs/m1-foundation.md#known-issues--next-steps)).

## Project Structure

```
app/              — Next.js App Router root (layout, globals.css)
app/(marketing)/  — Public marketing pages
components/       — React components (chrome/, ui/)
components/chrome/— Global chrome: UtilityBar, Header, MobileMenu, SearchOverlay, Footer, Breadcrumb
lib/data/         — Static typed data modules
public/images/    — Orchid photos and logo PNGs
types/            — TypeScript interfaces
```

## Tech Stack

| Layer           | Choice                                                   |
| --------------- | -------------------------------------------------------- |
| Framework       | Next.js 15 (App Router)                                  |
| Styles          | Tailwind CSS v4 (CSS-first; tokens in `app/globals.css`) |
| Language        | TypeScript 5 (strict)                                    |
| Package manager | pnpm                                                     |
| Hosting         | Firebase App Hosting                                     |

## Milestones

| Milestone       | Status | Notes                                             |
| --------------- | ------ | ------------------------------------------------- |
| M1 — Foundation | Done   | Scaffold + static data layer                      |
| M2 — Chrome     | Done   | Global chrome: header, footer, search, mobile nav |

Full milestone docs are in [`docs/`](docs/).

## Licence

Proprietary — South African Orchid Council. All rights reserved.
