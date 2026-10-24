# /events redesign (EV-1..EV-6)

Mission `events-redesign`, F1. Spec and goldens: `.agent/memory/project/specs/events-redesign/`. Governing rule: [`docs/rules/no-invention.md`](rules/no-invention.md): no new copy, no new tokens; every visible string already exists or is listed in `goldens/copy.json` with a source.

## What changed

Top to bottom, `/events` is now:

1. `PageHero` (unchanged: eyebrow "SAOC calendar", h1 "Events", the existing lede).
2. `ShowBand`, the same component as the home page, fed by `nationalShowQuery`. It gains one optional prop, `detailsHref`, which overrides only the "Show details" href; `/events` points it at the show's own `/events/<slug>` page. Labels and the other two hrefs are untouched, and the home page renders byte-identically (the default stays `nosUrl('/')`).
3. `EventsAbout` (`data-events-about`): the write-up (`eventsPage.intro`, max 62ch) on the left, "Find your society" (`/societies`) on the right.
4. The list (`data-events-list`): month `<h2>` in the serif at 24px/400, then one row per event. The National Show and any `isFeatured` event are excluded from the list, because the band already shows them.

The row (`EventCard`, `data-event-row`) follows the handoff event row: date block (day or `23–26` range, MON, year, with a 2px accent left border), `kind · location` eyebrow, serif title, venue, host society right-aligned, and a decorative arrow. Hover and focus are a title underline plus a 2px left bar; there is no box, ring or tint (NAV-1 family). Every row, chip, select and action is at least 44px tall.

Pure helpers live in `lib/events-list.ts` (erasable TypeScript, run directly by `checks/logic.mjs`).

## Public vs preview gate (EV-6)

`withholdPlaceholderProse()` in `lib/data/show-pages.ts` is the only switch (`true` is public, `false` is preview, driven by `SHOW_PLACEHOLDER_PREVIEW` plus the beta wall). No second switch was added.

| | Public | Preview |
|---|---|---|
| AI placeholder rows | none | listed, marked, unlinked, never in JSON-LD, `.ics` or sitemap |
| Empty `eventsPage.intro` | write-up column renders nothing; "Find your society" stays | awaiting-copy marker (`ConfirmationBadge`) |
| Zero rows to list | list section and controls omitted: hero, band, about/actions only | same rule, applied to the rows that remain |
| "No events" box or sentence | never | never |

Controls (Kind chips, Month select) render only when the list holds six or more rows (`EVENT_CONTROLS_MIN`), because filters that cannot narrow anything are noise. Chips come from the data (`kindOptions`), never from a fixed list.

## Root cause: the date-only National Show

The 19th National Show's `societyEvent` holds date-only strings (`2027-09-23`, `2027-09-26`, written by `scripts/fix-show-dates-23-26-sept-2027.ts`). GROQ's `dateTime("2027-09-23")` is `null`, so `upcomingEventsQuery`'s `dateTime(...) >= dateTime($todayStart)` filter silently dropped the show. `/events` and the home "What's on" strip share that query, so both lost the real show (the home strip read "No upcoming events scheduled." directly under the ShowBand).

The fix is in code, with no change to data. The filter gains a date-only branch:

```
dateTime(coalesce(endDate, date)) >= dateTime($todayStart)
  || (!defined(dateTime(coalesce(endDate, date))) && coalesce(endDate, date) >= $todayDate)
```

`upcomingEventsParams()` in `lib/sast-date.ts` now returns `{ todayStart, todayDate }`, where `todayDate` is the South African calendar date. `/api/events.ics` and the home strip pick the show up through the same query with no edits. GROQ's `now()` stays unused. `scripts/checks/events-until-last-day.mjs` asserts the new params keys.

Follow-up outside this change's footprint: `scripts/checks/societies-hidden-leak.mjs` runs `upcomingEventsQuery` with only `todayStart`; it needs `todayDate` added to its params.

## `eventsPage.intro` and how to move it

A new singleton document, `eventsPage` (`sanity/schemas/documents/eventsPage.ts`: `title` and `intro`, a `portableText`), registered in `sanity/schemas/index.ts` and pinned in `sanity/structure.ts`. `eventsPageQuery` (`sanity/queries.ts`) selects `intro`; only `app/(marketing)/events/page.tsx` reads it. No Sanity content was created: the field is empty until Lee-Ann supplies wording. To move the write-up elsewhere, change the query and the `intro` prop passed to `EventsAbout`; nothing else depends on the field.

## COPY GAP: calendar-subscribe label

`EVENTS_CALENDAR_SUBSCRIBE_LABEL` (`components/events/EventsAbout.tsx`) is `null`, so the `/api/events.ics` button does not render. The ruling asks for a subscribe button, but no approved label exists. NOS Design recommends "Subscribe to calendar"; that is NOT approved and is deliberately not typed anywhere in code. It goes to Lee-Ann's doc or to Brad. Once a label is approved, set the constant to that string and the button appears, styled as the outline button.

## Decisions taken (spec section 9)

- `ShowBand` takes an optional `detailsHref` and no new label. The ruling's "19th National Show, 2027" secondary label has no source in the repo, so the existing "Show details" button is reused.
- Public with an empty intro: only the write-up column collapses; "Find your society" stays so a zero-listed page still has an onward link.
- The home strip keeps the show as a row; excluding it there would recreate the "No upcoming events scheduled." contradiction under the band.
- The eyebrow second half is the event's own `location` field: the society province is not part of the `upcomingEventsQuery` projection (and province display is gated elsewhere until every society has one).
