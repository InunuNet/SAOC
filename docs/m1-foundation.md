# M1 — Foundation

Status: Done. QA: PASS (45/45 assertions, `tsc --noEmit` exits 0).

## What was built

**F1 — Project Scaffold**

Next.js 15 App Router project with TypeScript strict mode, pnpm, and Tailwind CSS v4 (CSS-first config). Includes:

- `app/globals.css` — Google Fonts import, design token `:root` block, and `@theme` Tailwind utility mappings
- `apphosting.yaml` — Firebase App Hosting config with client and admin env var placeholders
- `next.config.ts`, `postcss.config.mjs` (uses `@tailwindcss/postcss`), `tsconfig.json`
- `public/images/` — 5 orchid photos, 7 logo PNGs
- Route group `app/(marketing)/` for all public pages

**F2 — Static Data Layer**

Typed data modules covering all entities the site needs at launch. Data was ported verbatim from `design/design_handoff_saoc/src/data.js` with two field renames: `desc` to `description`, `icon` to `code`.

## Design tokens

Tokens are declared as CSS custom properties in the `:root` block of `app/globals.css`. Tailwind v4 maps them via an `@theme` block so they are available as utility classes.

Token naming convention:

| Token         | Purpose                   |
| ------------- | ------------------------- |
| `--primary`   | Brand green               |
| `--accent`    | Gold accent               |
| `--parchment` | Warm off-white background |
| `--bone`      | Secondary surface         |
| `--ink`       | Default text              |
| `--rule`      | Divider / border          |
| `--muted`     | Subdued text              |

Usage example — a utility class derived from a token:

```html
<p class="text-ink bg-parchment">Body copy</p>
```

Typefaces: Crimson Pro (headings), Manrope (body), JetBrains Mono (code). Loaded via Google Fonts in `globals.css`.

## Data layer

All entities are exported from a single barrel:

```ts
import {
  societies,
  events,
  shows,
  board,
  awards,
  showClasses,
  partners,
  heroImages,
  provinces,
} from '@/lib/data';
```

Individual modules are in `lib/data/`. TypeScript interfaces are in `types/index.ts` and imported as:

```ts
import type { Society, SocietyEvent, NationalShow } from '@/types';
```

**Entities and record counts:** societies (21), events (16), shows (6), board (6), awards (6), showClasses (10), partners (6), heroImages (4), provinces (10 incl. ALL).

## Adding a new data entity

1. Add the TypeScript interface to `types/index.ts`.
2. Create `lib/data/<entity>.ts` — export a typed `const` array using the new interface.
3. Re-export from `lib/data/index.ts`.

```ts
// lib/data/index.ts
export { sponsors } from './sponsors';
```

## Linting and formatting

**ESLint** — flat config (`eslint.config.mjs`, ESLint 9). Active rule sets:

- `next/core-web-vitals` — Next.js recommended rules including React and import hygiene
- `next/typescript` — TypeScript-specific Next.js rules
- `prettier` (via `eslint-config-prettier`) — disables ESLint rules that conflict with Prettier formatting

Run the linter:

```bash
pnpm lint
```

Note: `next lint` emits a deprecation warning about the ESLint API. This is harmless. Migration to `eslint .` is deferred until Next.js 16 guidance stabilises.

**Prettier** — config in `.prettierrc.json`:

| Option          | Value      |
| --------------- | ---------- |
| `printWidth`    | 100        |
| `singleQuote`   | true       |
| `trailingComma` | es5        |
| `semi`          | true       |
| `tabWidth`      | 2          |

Format all source files:

```bash
pnpm format
```

Check formatting without writing (CI-safe):

```bash
pnpm format:check
```

Ignored by Prettier (`.prettierignore`): `.next/`, `node_modules/`, `public/`, `pnpm-lock.yaml`, `next-env.d.ts`, `*.md`, `*.mdx`.

## Sanity CMS (A3)

### Packages

| Package | Purpose |
| --- | --- |
| `sanity` | Core CMS runtime, Studio UI, schema builder |
| `next-sanity` | Next.js adapter: `createClient`, Live API, image helpers |
| `@sanity/image-url` | Builds CDN image URLs from Sanity image references |
| `@sanity/vision` (dev) | In-Studio GROQ query explorer |

### Environment variables

Defined in `.env.local.example`. Copy and fill in before running the Studio locally:

```bash
cp .env.local.example .env.local
```

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Yes | Sanity project ID (public) |
| `NEXT_PUBLIC_SANITY_DATASET` | No | Defaults to `production` |
| `SANITY_API_READ_TOKEN` | Server only | For draft/preview content |
| `SANITY_WEBHOOK_SECRET` | Server only | For on-demand revalidation |

### Studio

Embedded at `/studio` via Next.js catch-all `app/studio/[[...tool]]/`.

- Dev: `http://localhost:3000/studio`
- Prod: `https://saoc.co.za/studio`

Access requires a Sanity account with Editor or Admin role on the project.

### urlFor() helper

Import from `sanity/lib/image.ts` to convert a Sanity image reference to a CDN URL:

```ts
import { urlFor } from '@/sanity/lib/image';

// Inside a component:
<Image src={urlFor(page.heroImage).width(1200).url()} alt="..." />
```

### Content types (11 schemas in `sanity.config.ts`)

| Schema | Purpose |
| --- | --- |
| `homePage` | Singleton — Home page hero + sections |
| `aboutPage` | Singleton — About page content |
| `nationalShow` | Annual national show records |
| `contactPage` | Singleton — Contact page copy + form config |
| `society` | Member society directory entry |
| `boardMember` | Council board member profile |
| `event` | Calendar event |
| `showClass` | Orchid show class/category |
| `award` | Award definition |
| `sponsor` | Sponsor entry with logo |
| `judge` | Judge profile |

`portableText` is a shared object type (not a document) used for rich text fields across schemas.

## A4 — Sanity Schemas

Added 4 document types (2 singletons, 2 collections), bringing the total registered in `sanity.config.ts` to 16.

### All registered types (16)

| Name | Type | Description |
| --- | --- | --- |
| `homePage` | Singleton | Home page hero + sections |
| `aboutPage` | Singleton | About page content |
| `nationalShow` | Singleton | Flagship annual national show record |
| `contactPage` | Singleton | Contact page copy + `formRecipients` config |
| `judgingPage` | Singleton | Judging system page content; references judge directory |
| `membersPage` | Singleton | Members portal page content + downloadable resources |
| `society` | Collection | Member society directory entry |
| `boardMember` | Collection | Council board member profile |
| `event` | Collection | Calendar event |
| `showClass` | Collection | Orchid show class/category |
| `award` | Collection | Award definition |
| `sponsor` | Collection | Sponsor entry with logo |
| `judge` | Collection | Judge profile |
| `show` | Collection | Past/upcoming/future show editions (non-flagship) |
| `province` | Collection | Province reference used by the society filter UI |
| `portableText` | Object | Shared rich text field; not a document |

## A5 — Sanity Seed Script

`scripts/seed-sanity.ts` reads the 8 typed data arrays from `lib/data/` and upserts every record to Sanity using `createOrReplace`. Each document gets a deterministic `_id` via `safeid(type, key)` so the script is safe to run repeatedly — re-running produces no net change when the data is unchanged.

### Dependencies added

| Package | Purpose |
| --- | --- |
| `@sanity/client@^7.22.1` | Sanity write client used by the seed script |
| `dotenv@^17.4.2` | Loads `.env.local` before the client is initialised |

### Data → schema mapping

| `lib/data` export | Sanity type | Key field |
| --- | --- | --- |
| `awards` | `award` | `code` |
| `boardMembers` | `boardMember` | `name` |
| `events` | `societyEvent` | `id` |
| `provinces` | `province` | `code` (the `ALL` sentinel is skipped) |
| `societies` | `society` | `name` |
| `shows` | `show` | `edition` |
| `showClasses` | `showClass` | `id` |
| `partners` | `sponsor` | `name` |

### Running the seed

1. Ensure `.env.local` contains the three required variables (see below).
2. Run:

```bash
pnpm seed
```

The script logs each upserted document type and exits 0 on success.

### Required environment variables

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Sanity project ID |
| `NEXT_PUBLIC_SANITY_DATASET` | Target dataset (e.g. `production`) |
| `SANITY_API_TOKEN` | Write token — create one at sanity.io → project settings → API → Tokens |

`SANITY_API_TOKEN` is distinct from `SANITY_API_READ_TOKEN` used by the Next.js app. The seed token needs **Editor** permissions; the read token only needs **Viewer**.

### Idempotency

`_id` values are generated by `safeid(type, key)`, which slugifies the type and key into a stable string (e.g. `award-fcc`, `society-saoc`). Running `pnpm seed` a second time leaves the dataset unchanged when the source data has not changed. It is safe to run in CI or after schema migrations to repopulate reference data.

## Known issues / next steps

- `heroImages.ts`: `alt` text should be backfilled with credit lines from the source `data.js`.
- Firebase: no project created yet; F10 wires the live integration. Do not add real credentials to `.env.local` until F10 is scoped.
- Chrome components (header/footer/nav) are scoped to F3 in M2.
