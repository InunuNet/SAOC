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
| Ticketing Navigation M1 | Done | National Show becomes the one top-level nav item with a mega-menu. Tickets column heading routes to a chooser page; direct sub-links go to Visitor/Exhibitor/Vendor entry. Exhibition category only (Visitor, Exhibitor, Vendor tickets). See [docs/f1-ticketing-nav-restructure.md](docs/f1-ticketing-nav-restructure.md). |
| Ticketing Conferences M1-F1 | Done | Conferences category: six ticket types (SAOC Symposium, WOSA Conference, Joint — each Early-Bird/Normal), provisional estimates, reusing the existing admission-products schema and single-source-of-truth discipline. See [docs/f1-ticketing-conferences.md](docs/f1-ticketing-conferences.md). |
| Ticketing Workshops & Field Trips M1-F2 | Done | Workshops & Field Trips category: four priceable ticket types (Sunset Cocktails Single/Couple, Field Trip Single/All-Outings) with provisional estimates. Capacity numbers resized to close an oversell defect caught by Codex review. Workshops pricing structure documented but not yet sellable (no council-confirmed sessions). See [docs/f2-ticketing-workshops-field-trips.md](docs/f2-ticketing-workshops-field-trips.md). |
| Ticketing Purchase Pages M2-F3 | Done | Category-aware purchase pages for Conferences and Workshops & Field Trips categories. Shared `CategoryTicketsPage` component, two new static routes, `category` field on `ticketType` schema, and migration script for pre-existing documents. Required three defect-repair cycles (null-category read-time fallback, seed-script category omission, unguarded module-scope side effects). See [docs/f3-ticketing-purchase-pages.md](docs/f3-ticketing-purchase-pages.md). |
| Ticketing Navigation M2-F4 | Done | Extends National Show mega-menu's Tickets column to include Conferences and Workshops & Field Trips entries, wiring to F3's purchase pages. Data-driven append — no component changes required. See [docs/f4-ticketing-nav-wiring.md](docs/f4-ticketing-nav-wiring.md). |
| Ticketing Checkout M2-F5 | Done | Full checkout support for Conference and Workshop/Field-Trip/Cocktail ticket types. Implements proper pooled-capacity enforcement with per-product occupancy weighting, replacing F2's interim conservative-number fix. Four Workshop/Field-Trip products (Sunset Cocktails Single/Couple, Field Trip Single/All-Outings) now enforce real physical ceilings (200 heads / 60 seats) through shared-pool accounting. Resolved via five defect-repair cycles (four Codex GPT-5.5 cross-model findings, one @qa-apex coverage-gap discovery). See [docs/f5-ticketing-checkout.md](docs/f5-ticketing-checkout.md). **Mission Two (ticketing-conferences-and-events) complete:** Conferences and Workshops/Field-Trips/Cocktails categories are fully estimated, have purchase pages, are wired into nav, and now have full checkout with correct pooled-capacity enforcement. |

Full milestone docs are in [`docs/`](docs/).

## Licence

Proprietary — South African Orchid Council. All rights reserved.
