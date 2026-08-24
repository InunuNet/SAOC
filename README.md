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
| Admin Settings — Chrome Fix M1-F1 | Gated (pending deploy) | Adds missing site chrome to `/admin/settings`, capability-gates Settings link in AdminNav, and proves the fix is live on beta.saoc.co.za via authenticated browser verification (two viewports, 7 DOM checks). Fixes root cause of ozow-sandbox-toggle F1 shipping without live-URL verification. See [docs/f1-admin-settings-deploy-and-chrome-fix.md](docs/f1-admin-settings-deploy-and-chrome-fix.md). |
| Ticketing Navigation M1 | Done | National Show becomes the one top-level nav item with a mega-menu. Tickets column heading routes to a chooser page; direct sub-links go to Visitor/Exhibitor/Vendor entry. Exhibition category only (Visitor, Exhibitor, Vendor tickets). See [docs/f1-ticketing-nav-restructure.md](docs/f1-ticketing-nav-restructure.md). |
| Ticketing Conferences M1-F1 | Done | Conferences category: six ticket types (SAOC Symposium, WOSA Conference, Joint — each Early-Bird/Normal), provisional estimates, reusing the existing admission-products schema and single-source-of-truth discipline. See [docs/f1-ticketing-conferences.md](docs/f1-ticketing-conferences.md). |
| Ticketing Workshops & Field Trips M1-F2 | Done | Workshops & Field Trips category: four priceable ticket types (Sunset Cocktails Single/Couple, Field Trip Single/All-Outings) with provisional estimates. Capacity numbers resized to close an oversell defect caught by Codex review. Workshops pricing structure documented but not yet sellable (no council-confirmed sessions). See [docs/f2-ticketing-workshops-field-trips.md](docs/f2-ticketing-workshops-field-trips.md). |
| Ticketing Purchase Pages M2-F3 | Done | Category-aware purchase pages for Conferences and Workshops & Field Trips categories. Shared `CategoryTicketsPage` component, two new static routes, `category` field on `ticketType` schema, and migration script for pre-existing documents. Required three defect-repair cycles (null-category read-time fallback, seed-script category omission, unguarded module-scope side effects). See [docs/f3-ticketing-purchase-pages.md](docs/f3-ticketing-purchase-pages.md). |
| Ticketing Navigation M2-F4 | Done | Extends National Show mega-menu's Tickets column to include Conferences and Workshops & Field Trips entries, wiring to F3's purchase pages. Data-driven append — no component changes required. See [docs/f4-ticketing-nav-wiring.md](docs/f4-ticketing-nav-wiring.md). |
| Ticketing Checkout M2-F5 | Done | Full checkout support for Conference and Workshop/Field-Trip/Cocktail ticket types. Implements proper pooled-capacity enforcement with per-product occupancy weighting, replacing F2's interim conservative-number fix. Four Workshop/Field-Trip products (Sunset Cocktails Single/Couple, Field Trip Single/All-Outings) now enforce real physical ceilings (200 heads / 60 seats) through shared-pool accounting. Resolved via five defect-repair cycles (four Codex GPT-5.5 cross-model findings, one @qa-apex coverage-gap discovery). See [docs/f5-ticketing-checkout.md](docs/f5-ticketing-checkout.md). **Mission Two (ticketing-conferences-and-events) complete:** Conferences and Workshops/Field-Trips/Cocktails categories are fully estimated, have purchase pages, are wired into nav, and now have full checkout with correct pooled-capacity enforcement. |
| National Show Menu M1 | Done | Two-column mega-menu surfaces four previously unlinked show-info pages ("What to Expect", "Plan Your Visit", "FAQ", "Archive") in a new "About the Show" column alongside the existing Tickets column. Adds honest "not yet open" messaging to exhibitor entry points. See [docs/f1-national-show-menu-restructure.md](docs/f1-national-show-menu-restructure.md). |
| Backlog Sweep — A11y & UI Quick Fixes M1 | Done | Five independent quick fixes reusing existing patterns: footer dead link (wosa.org.za → wildorchids.co.za), invisible focus rings on cream-background buttons (reused nav-link pattern site-wide), low-contrast form error text (reused admin error callout), 375px horizontal overflow in ShowBand, and accessible-name concatenation in PartnersSection. See [docs/f1-backlog-a11y-ui-quickfixes.md](docs/f1-backlog-a11y-ui-quickfixes.md). |
| Backlog Sweep 2 — Dead Links & A11y M1 | Done | Five independent fixes: WOSA link corrected (wosa.co.za to wildorchids.co.za), events.ics routing redirect added, constitution page disclaimer added (aligned with privacy/terms), national show archive cards converted to interactive Link elements with keyboard navigation, and vendor registration email validation with client/server consistency (including a worked example of Codex GPT-5.5 cross-model review finding a real trim-mismatch bug that Claude's @qa missed). See [docs/f2-backlog-sweep-2-dead-links-and-a11y.md](docs/f2-backlog-sweep-2-dead-links-and-a11y.md). |
| Show Dates Purge M1 | Done | Three integrated features: fixed hardcoded stale-date literals in seed scripts (2027-09-18/21 → 2027-09-16/19), wrote and executed an idempotent production Sanity patch script to correct pre-existing documents, and swept documentation to remove stale-date claims. Mid-mission discovery of live-data corruption (`countdownDate` set to test-sentinel `2098-12-31`) confirmed this project's "contract checks mutate live content" defect class; re-patch and full QA re-verification completed. Four rounds of Codex GPT-5.5 cross-model review caught formatting issues, contradictory copy, stale contract/golden files from prior missions, and stale comments — a worked example of why mandatory independent QA catches defect classes same-model review misses. See [docs/f3-show-dates-purge-16-19-sept-2027.md](docs/f3-show-dates-purge-16-19-sept-2027.md). |
| Venue — "Never Changed" Narrative Removal M1-F1 | Done | Removes framing suggesting the show venue changed from CTICC to The Hangar, Stellenbosch Flying Club; the venue was never changed, only corrected from an early incorrect placeholder. Six live Sanity prose fields on `showVisitorInfo` rewritten, seed script updated, patch applied and verified on production. Deliberate exception: developer-facing code comment (lines ~163-168 in `seed-show-visitor-info.ts`) left unchanged, protected by `venue-prose-residue` contract's A10 negative control. See [docs/f1-venue-never-changed-copy-fix.md](docs/f1-venue-never-changed-copy-fix.md). |

Full milestone docs are in [`docs/`](docs/).

## Licence

Proprietary — South African Orchid Council. All rights reserved.
