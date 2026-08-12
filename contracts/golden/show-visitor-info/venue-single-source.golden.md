# The venue-change test

> If changing the venue would require a developer to edit a component, the content model is
> wrong. — mission `show-visitor-info`, Context §Scope discipline

CTICC is a **working assumption**, not a confirmed booking. The 2026-08-11 status report still
lists venue and dates as outstanding. Treat every venue value as something that will change.

## The rule, mechanically

An editor changes the venue by editing **one object**: `nationalShow.venue`, in Studio at
`/studio/structure/nationalShow`. No code change, no redeploy, no developer.

Concretely, that means:

1. Every venue-derived value a visitor reads — name, street address, city, postal code, GPS
   coordinates, map link, map image, directions narrative, parking, public transport, distance
   and travel time from each airport, accommodation, nearby attractions — is read from Sanity at
   request time.
2. **No new page or component file may contain a venue literal.** Not `CTICC`, not
   `Cape Town International Convention Centre`, not `Lower Long Street`, not `-33.915`, not
   `18.425`, not `Foreshore`, not a hardcoded `maps.google.com` URL with an address baked in.
   This is asserted by grep over the new file set (A-series `venue-literal` checks) and it
   applies to fallback strings too — a `?? 'CTICC'` fallback is a hardcoded venue.
3. The map is a **link and/or a static image whose `src` comes from Sanity**
   (`venue.mapEmbedUrl` / `venue.mapsUrl`). No maps SDK, no API key, no client-side geocoding.
4. Travel-route content is **data, not prose in a component**. `showVisitorInfo.airportRoutes`
   is an array; each entry carries its own origin, distance, duration and directions. Changing
   venue means rewriting those array entries in Studio — the component just maps over whatever
   is there and renders zero rows if the array is empty.

## What is deliberately NOT changed

`nationalShow.location` (plain string) stays exactly as it is. It predates this mission, the
show landing page hero renders it, and `contracts/checks/cms-loop-f3-national-show/` mutates it
in a verified round-trip check that would break if the hero stopped reading it.

The consequence is a known, accepted, documented redundancy: `location` and `venue.name` both
name the venue, and an editor who changes one and not the other creates drift on the landing
page hero. Three mitigations, all required:

- `location`'s Studio `description` must point at the venue object and say they must be kept
  consistent (asserted).
- `venue` is placed **immediately after** `location` in the field order so they are adjacent in
  Studio (asserted by field order in `nationalShow-venue-object.golden.json`).
- The three new visitor pages and the `/contact` venue block read `venue.*` **only** — never
  `location` (asserted).

Collapsing `location` into `venue.name` is the right end state and is logged as follow-up work,
not done here: it is a change to an existing verified check's preconditions and belongs in its
own pass with that check updated in the same commit.

## Verification

- `check-venue-single-source.mjs` — reads `nationalShow.venue` live from the dataset, then
  fetches `/national-show/plan-your-visit`, `/national-show/what-to-expect` and `/contact` over
  real HTTP and asserts the *dataset's current* venue name and address line appear in the
  rendered HTML. The needle comes from Sanity, never from a literal in the check.
- `check-cms-round-trip.mjs` — patches a visitor-info field in the dataset to a sentinel,
  revalidates, asserts the sentinel reaches the rendered page, then restores the exact captured
  baseline and verifies the restore. Proves the loop causally, not just correlationally.
- Grep assertions prove no venue literal exists in the new source files.
