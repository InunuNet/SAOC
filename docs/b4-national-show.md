# B4 — National Show page

The National Show page lives at `/national-show` and documents the SAOC's triennial flagship
competition. It is a single async Server Component with no client-side routing. A small client
island handles the live countdown; everything else renders server-side.

## Route and rendering

| Route | Component | Rendering |
|---|---|---|
| `/national-show` | `app/(marketing)/national-show/page.tsx` | Async Server Component |
| Countdown | `components/show/ShowCountdown.tsx` | Client Component (`'use client'`) |

The page fires two `sanityFetch` calls in parallel via `Promise.all`. Both resolve before any JSX
is returned. If Sanity is unreachable or returns an empty array, the page falls back to static data
without error — see Static fallback below.

## Sanity queries

Both queries are defined in `sanity/queries.ts` and use `defineQuery` from `next-sanity` so that
`@sanity/codegen` can generate typed result types.

**`showClassesQuery`** — fetches all `showClass` documents ordered by the `order` field ascending.
Fields returned: `_id`, `code`, `name`, `description`. The `code` field is a short letter code
(e.g. `C`, `Ph`, `N`); `name` is the full group label; `description` is a one-line scope
statement.

**`pastShowsQuery`** — fetches all `show` documents where `status == "past"`, ordered by `year`
descending. Fields returned: `_id`, `title`, `slug` (projected from `slug.current`), `year`,
`location`, `entries`, `exhibitors`, `awards`. All fields except `_id` and `year` are nullable —
the page guards each before rendering.

Cache tags used:

| Query | Tags |
|---|---|
| `showClassesQuery` | `['showClass', 'sanity']` |
| `pastShowsQuery` | `['show', 'sanity']` |

The revalidation webhook at `app/api/revalidate/route.ts` calls `revalidateTag('sanity')` on any
Sanity publish, which flushes both caches.

## Static fallback

The fallback triggers independently for each data type. For show classes: if `sanityFetch` returns
`null` or an empty array, the page uses the 10 entries in `lib/data/showClasses.ts`. For past
shows: if `sanityFetch` returns `null` or an empty array, the page uses the entries in
`lib/data/shows.ts` filtered to `status === 'past'`, limited to five results. The two sources are
never merged — as soon as Sanity returns at least one document the static list is dropped entirely.

## ShowCountdown client island

`components/show/ShowCountdown.tsx` is a `'use client'` component that counts down to the 19th
National Show opening. The target date is hardcoded in the module:

```ts
const TARGET_MS = new Date('2027-09-18T09:00:00+02:00').getTime();
```

The component initialises its state to zero and starts a one-second `setInterval` inside
`useEffect`, so the server render always outputs `00 00 00 00` (no hydration mismatch). It is
wrapped in a `<Suspense fallback={null}>` boundary inside the Show Hero section, meaning the hero
renders immediately and the countdown fills in on the client without blocking the page.

The `ShowCountdown` export is re-exported from `components/show/index.ts`.

## Page sections

| Section | Notes |
|---|---|
| Show Hero | Full-bleed background image, 4-up meta grid (dates, host, venue, cycle), countdown island, two CTA links |
| About / stats | Two-column layout: prose description on the left, 4-up stat grid on the right (hardcoded values) |
| Three-year cycle | Inline `CYCLE_YEARS` constant — editions 18 (2024), 19 (2027), 20 (2030) |
| Show class grid | `classes` array — 10 cards, one per judging group |
| Exhibitor information | Four-stage timeline from inline `EXHIBITOR_STAGES` constant |
| Past editions | Grid of up to six past show cards from `pastShows`; hidden entirely if the array is empty |
| CTA band | Two links: `/societies` and `/contact` |

The Three-year cycle section and Exhibitor stages section both use module-level constants rather
than Sanity queries — their content is not editable from Studio.

## Updating show content

**Via Sanity Studio** — to add or update a past show, create or edit a `show` document and set
`status` to `"past"`. The `year`, `location`, `entries`, `exhibitors`, and `awards` fields map to
the Past editions grid. To add or update a judging class, create or edit a `showClass` document;
the `order` field controls display order.

**Via static data** — if Sanity is not yet populated, edit `lib/data/shows.ts` for show history or
`lib/data/showClasses.ts` for the ten judging groups. Static fallbacks are replaced automatically
once Sanity returns data.

**Hardcoded content** — the upcoming show details (edition XIX, dates, host, venue), the
three-year cycle table, and the exhibitor stages are all defined as inline constants in
`app/(marketing)/national-show/page.tsx`. They must be updated in source when the show details
change.
