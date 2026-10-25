# /events redesign: implementation spec (feat/events-redesign)

Authority, in order: `nos-design-ruling-ev.md` (EV-1..EV-6, FINAL, implement as written), `design/design_handoff_saoc/` (golden `src/pages-show-events-contact.jsx`, see `event-row.golden.md`), `docs/rules/no-invention.md`. Contract: `../contract-f1.yaml`. Write only the files in `goldens/footprint.json`.

## 1. Root cause of "real show missing / home says No upcoming events" (measured, not guessed)

The 19th National Show's `societyEvent` (`societyEvent-15-19th-south-african-national-orchid-show`) holds DATE-ONLY strings (`2027-09-23`, `2027-09-26`; written by `scripts/fix-show-dates-23-26-sept-2027.ts`). GROQ `dateTime("2027-09-23")` is `null`, so `upcomingEventsQuery`'s filter drops the show. Live read-only measurement (`checks/live-query.mjs`): `dateTime(...) = null`, `defined(...) = false`. `/events` AND the home "What's on" strip share this query, so both lose the show. Placeholders are NOT the cause on the home page (it never reads them; it only reads Sanity).

Fix in code, not data (no live-content write): in `sanity/queries.ts` `upcomingEventsQuery` the filter becomes

```
*[_type == "societyEvent" && (dateTime(coalesce(endDate, date)) >= dateTime($todayStart) || (!defined(dateTime(coalesce(endDate, date))) && coalesce(endDate, date) >= $todayDate))] | order(date asc){ ...unchanged projection... }
```

`upcomingEventsParams()` in `lib/sast-date.ts` returns `{ todayStart, todayDate }` where `todayDate = sastDate(now)` (existing export). Update `scripts/checks/events-until-last-day.mjs` to the new filter string and `Object.keys(...) === 'todayStart,todayDate'` (its `isUpcoming` assertions stay). `app/api/events.ics/route.ts` already calls `upcomingEventsParams()`, so it gains the show for free; do not edit it. Home needs no file change: the strip lists the show again once the query returns it (it is NOT excluded on home; excluding it would re-create the "No upcoming events scheduled." contradiction directly under the ShowBand).

## 2. Gate (EV-6) and what each mode shows

`withholdPlaceholderProse()` (lib/data/show-pages.ts) is THE switch; do not add a second one. true = public, false = preview.
- Public: no placeholder rows, no awaiting-copy markers, no "no events" box. Preview: placeholders as today (marked, unlinked, never in JSON-LD, .ics, sitemap).
- `listed = [...sanityEvents, ...placeholders]` sorted by date, as today. `splitListed(listed)` -> `featured` (the National Show) and `rest`.
- Zero rows in `rest`: omit the list section AND the controls entirely; the page is hero -> ShowBand -> about/actions. Delete the old "No upcoming events scheduled." block and the old "Featured events" section.

## 3. `lib/events-list.ts` (new, pure, erasable TS; no `@/` imports; relative imports end in `.ts`; runs under Node type stripping)

Exports (tested by `checks/logic.mjs`):
- `EVENT_CONTROLS_MIN = 6`; `showEventControls(count: number): boolean` (count >= 6).
- `NATIONAL_SHOW_TITLE = /national.*show/i` (moved from `components/events/event-link.ts`, which now imports it); `isNationalShowEvent(e)`.
- `splitListed(listed)` -> `{ featured, rest }`: `rest` excludes `isFeatured === true` and `isNationalShowEvent`; order preserved; `featured` holds those rows.
- `groupByMonth(events)` -> `[{ key: 'YYYY-MM', month: 'November 2026', events }]` ascending, month computed in `Africa/Johannesburg` (an instant 00:30 SAST on 1 Nov is November).
- `eventDateBlock(date, endDate)` -> `{ d, m, y }`: `d` is the SAST day, `23–26` for a multi-day event; `m` is `en-ZA` short month uppercased; `y` the year.
- `listSectionVisible(restCount)` (count > 0).
- `kindOptions(events)` -> distinct non-empty `kind` values, first-seen order (chips come from data, never invented).
Delete the local `monthLabel`/`groupByMonth` from the page and reuse these.

## 4. Page (`app/(marketing)/events/page.tsx`), top to bottom

1. `PageHero` unchanged (EV-1: eyebrow "SAOC calendar", h1 "Events", the existing lede; the mirror-PR layout already ships via PageHero).
2. `<ShowBand show={show} detailsHref={...} />` (EV-2). Fetch `nationalShowQuery` with the existing `sanityFetch` (tags `['nationalShow','sanity']`). `ShowBand` gets ONE optional prop, `detailsHref?: string`, overriding only the href of the existing "Show details" button; default stays `nosUrl('/')`, so the home page is byte-identical. Pass `/events/<slug>` of the Sanity event matching `isNationalShowEvent` (omit the prop if none). Do not change "Book tickets", "Show details", "Exhibitor info" labels or the other two hrefs. See DECISION NEEDED in section 9.
3. `<EventsAbout intro={eventsPage?.intro} withhold={withholdPlaceholderProse()} />` (EV-3), `data-events-about`, `saoc-container`, two columns >= 768, stacked below. Left: `max-w-[62ch]`, renders the portable text via the same `PortableText` renderer other CMS pages use (copy the neighbour's import, e.g. `app/(marketing)/judging/page.tsx`); empty + preview -> `<ConfirmationBadge status="pending" />`; empty + public -> left column renders nothing and the actions column keeps its place (DECISION in section 9). Right: "Find your society" -> `/societies` (outline button, >= 44px) and the calendar-subscribe slot:
   `export const EVENTS_CALENDAR_SUBSCRIBE_LABEL: string | null = null;` (in `components/events/EventsAbout.tsx`). The `/api/events.ics` button renders only when the constant is non-null. **COPY GAP**: no source for the label; NOS Design recommends "Subscribe to calendar", NOT approved; it goes to Lee-Ann's doc or Brad. Do not type that string anywhere in code.
4. List section `data-events-list` only when `listSectionVisible(rest.length)`: `<EventsList events={rest} />` (client component, receives serialisable rows incl. the placeholder flag). It renders `data-events-controls` only when `showEventControls(rest.length)`: Kind chips (labels: "All kinds" + `kindOptions`), "Month" native select ("All months" + the group labels), all `min-h-11` (44px); filtering narrows the same `MonthGroup`s client-side. No "View/Timeline", no result-count line (not in the ruling).
5. `MonthGroup`: `<h2 className="font-serif text-[24px] font-normal ...">`, `<ul>` of rows. `EventCard` becomes the event row per `event-row.golden.md`, with `data-event-row` on the row root, `min-h-11`, `group` + `group-hover:underline group-focus-visible:underline`, a 2px left accent bar, `eventDateBlock`, `kind · province`, host `text-right`, `→`. Keep `aria-labelledby`/`aria-describedby` linking, the unlinked placeholder behaviour and `PlaceholderMarker`.
6. JSON-LD: keep one `eventJsonLd` per REAL Sanity event (the show included); never placeholders.

## 5. `eventsPage.intro` (isolated, movable)

One new file `sanity/schemas/documents/eventsPage.ts` (`name: 'eventsPage'`, fields: `title` string and `intro` `portableText`; model it on `judgingPage.ts`), one import + one array entry in `sanity/schemas/index.ts`, `'eventsPage'` in `sanity/structure.ts` singleton list and title map, and `eventsPageQuery` (`*[_type == "eventsPage"][0]{ intro }`) in `sanity/queries.ts`. Nothing else reads it but the events page. No Sanity content is created or written (the field is empty; preview shows the marker).

## 6. Targets, sizes, tokens
All interactive elements this change adds are >= 44px tall (rows, chips, select, about actions). No new colours, fonts or sizes beyond the handoff/ruling values; use existing Tailwind tokens (`text-primary`, `border-rule`, `text-muted`, `bg-accent`...).

## 7. Docs
`docs/events-redesign.md`: what changed, the gate table, the date-only root cause and fix, the `eventsPage.intro` field and how to move it, and **COPY GAP** (`EVENTS_CALENDAR_SUBSCRIBE_LABEL` is null; recommended label unapproved; who decides). Cite `docs/rules/no-invention.md` and `SHOW_PLACEHOLDER_PREVIEW`/`withholdPlaceholderProse()`.

## 8. Verify before handing to QA
`pnpm tsc --noEmit` (or the repo's typecheck), `pnpm lint`, `python3 execution/contract.py gate` (all assertions), and screenshots at 1280/768/390 in both modes.

## 9. Decisions made here (tell Brad's orchestrator)
- DECISION NEEDED (non-blocking, copy): EV-2 says the primary action is the event page and the secondary is the existing "19th National Show, 2027" button. No such label exists in the repo (ShowBand's labels are "Book tickets", "Show details", "Exhibitor info"). Built with existing labels only: "Book tickets" stays primary (NOS tickets), "Show details" points at `/events/<slug>` on this page only. Recommendation: keep; any new label needs an approved source.
- Public + empty `eventsPage.intro`: only the left (write-up) column collapses; "Find your society" stays so the page keeps an action. Alternative (collapse the whole section) would leave no onward link on a zero-listed page.
- Home strip keeps the show as a row (see section 1).

## 10. Addendum (dev finding, same root cause)
- `societyUpcomingEventsQuery` (sanity/queries.ts, per-society page) takes the identical date-only filter as `upcomingEventsQuery` and keeps `&& hostSociety->slug.current == $slug`. The society page already spreads `upcomingEventsParams()`, so `todayDate` reaches it.
- `scripts/checks/societies-hidden-leak.mjs` passes `{ todayStart, todayDate }` to `upcomingEventsQuery` (use a date-only-safe far-past `todayDate`, e.g. '2000-01-01').
- Both paths are on goldens/footprint.json; `checks/logic.mjs` asserts them.
