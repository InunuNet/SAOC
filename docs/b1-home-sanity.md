# B1 — Home page Sanity wiring

The home page (`app/(marketing)/page.tsx`) now fetches live content from Sanity CMS on every
request and passes it as typed props to each component. All props are optional — the page
renders correctly from static fallbacks when Sanity is unreachable or unconfigured.

## What changed

Four components that previously rendered only hard-coded content now accept an optional Sanity
prop: `Hero`, `ShowBand`, `EventsStrip`, and `PartnersSection`. The page runs all four queries
in parallel with `Promise.all` and passes the results directly as props.

## Data sources

| Component | Query constant | Sanity document type | Prop |
|---|---|---|---|
| `Hero` | `homePageQuery` | `homePage` | `images?: SanityImageSource[] \| null` |
| `ShowBand` | `nationalShowQuery` | `nationalShow` | `countdownDate?: string \| null` |
| `EventsStrip` | `upcomingEventsQuery` | `societyEvent` | `events?: SanityEvent[] \| null` |
| `PartnersSection` | `partnersQuery` | `sponsor` | `partners?: SanityPartner[] \| null` |

Query constants live in `sanity/queries.ts`. Cache tags follow the pattern `['<docType>', 'sanity']`
so the ISR webhook at `app/api/revalidate/route.ts` can bust the cache on any Studio publish.

## Null safety

Every Sanity prop is typed `T | null | undefined`. Components handle the absent case:

- `Hero` — falls back to `staticHeroImages` from `lib/data/` when `images` is falsy or empty.
- `ShowBand` — parses `countdownDate` with `new Date()` and guards with `isNaN(candidate.getTime())`; falls back to the hard-coded ISO string `DEFAULT_COUNTDOWN_DATE` when the value is missing or unparseable.
- `EventsStrip` — coalesces `events ?? []`; renders an empty list rather than crashing when null.
- `PartnersSection` — coalesces `partners ?? []`; renders an empty grid when null.

## Adding a hero image in Studio

In Sanity Studio, open the **Home Page** document (there is only one). Scroll to the **Hero
images** field and click "Add item". Upload an image from your local machine or drag one in from
the media library. Publish the document. The home page cache is invalidated automatically by the
revalidation webhook and the new image will appear on the live site within seconds.

## Local development without Sanity credentials

`pnpm dev` works out of the box without a `.env.local` file. When `NEXT_PUBLIC_SANITY_PROJECT_ID`
is absent, `sanityFetch` returns `null` for every query. Each component's static fallback takes
over so the full page renders — hero carousel, countdown timer, event rows, and partner grid are
all visible using the seed data in `lib/data/`. Configure `.env.local` (see `README.md`) when you
need to test live Sanity content locally.
