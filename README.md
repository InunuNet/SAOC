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

Open [http://localhost:3000](http://localhost:3000). Studio: [http://localhost:3000/studio](http://localhost:3000/studio).

Studio previously had a P0 where the local dev server hard-crashed on every `/studio`
request. Root cause found and fixed (bad `serverExternalPackages` config bundling Sanity
incorrectly), along with a second bug where marketing chrome leaked onto `/studio`. Studio
now mounts locally; one setup step remains (CORS origins + project membership need
confirming in the Sanity dashboard) before it's fully usable — see
[docs/sanity-studio-p0-investigation.md](docs/sanity-studio-p0-investigation.md).

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

**Door test-ticket QR seeder**

```bash
pnpm door:seed      # Create test tickets and QR sheet
pnpm door:teardown  # Delete test tickets
```

Output: `scripts/output/door-test-qr/sheet.html` (gitignored). See [docs/door-test-qr-seeder.md](docs/door-test-qr-seeder.md) for details.

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
| Ticketing M1–M2 | Done | CMS-controlled pricing, buy page, confirmation/cancellation landings, PayFast sandbox integration, and email confirmation with QR codes per position. See [docs/ticketing.md](docs/ticketing.md) (developer) and [docs/ticketing-for-editors.md](docs/ticketing-for-editors.md) (secretary). |
| Ticketing — position expiry write fix | Done | Reserved seat holds now actually release on expiry — fixes a live bug where abandoned carts held seats forever. See [docs/ticketing-position-expiry-write.md](docs/ticketing-position-expiry-write.md). |
| Order reconciliation | Done | Detects orders stranded `reserved` past expiry and emails a human; never auto-settles. See [docs/order-reconciliation.md](docs/order-reconciliation.md). |
| Admin navigation menu | Done | Persistent, capability-aware nav on every `/admin/*` surface, plus a real sign-out. See [docs/admin-nav-menu.md](docs/admin-nav-menu.md). |

Full milestone docs are in [`docs/`](docs/).

## Licence

Proprietary — South African Orchid Council. All rights reserved.
