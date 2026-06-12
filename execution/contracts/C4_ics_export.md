# Contract C4: ICS Calendar Export

- **Slug:** `saoc-c4-ics-export`
- **Spec:** `saoc-full-platform`
- **Phase:** 1
- **Created:** 2026-06-12
- **Status:** pending
- **Autonomy:** high
- **Author:** @architect

---

## 1. Feature Spec

C4 adds RFC 5545 calendar (`.ics`) export so visitors can subscribe to the SAOC
events feed or add a single event to their personal calendar. Two route handlers
plus one pure formatting helper. No client components, no new dependencies — ICS
is hand-rolled string assembly in `lib/ics.ts`.

### Route 1 — Feed: `GET /api/events.ics`

- **Input:** none (no params, no body).
- **Source:** `sanityFetch<SanityEvent[]>({ query: upcomingEventsQuery, tags: ['events', 'sanity'] })`.
- **Fallback:** when `sanityFetch` returns `null` or `[]`, map the static
  `events` array from `lib/data/events.ts` (`SocietyEvent` shape) into the ICS
  feed so the endpoint never 500s pre-Sanity. An empty result set still returns
  a valid (event-less) VCALENDAR — never a 404 or error.
- **Output:** `200` with a single `VCALENDAR` body containing one `VEVENT` per
  upcoming event.
- **Headers:**
  - `Content-Type: text/calendar; charset=utf-8`
  - `Content-Disposition: attachment; filename="saoc-events.ics"`
- **Caching:** Server Component / route caching via `next: { tags: ['events', 'sanity'] }` inherited from `sanityFetch`; the route is dynamic-safe.

### Route 2 — Single event: `GET /api/events/[slug]/ics`

- **Input:** dynamic route param `slug` (string). In Next.js 15 `params` is a
  `Promise` — the handler signature is
  `(req: NextRequest, { params }: { params: Promise<{ slug: string }> })` and the
  body must `await params`.
- **Source:** `sanityFetch<SanityEvent | null>({ query: eventBySlugQuery, params: { slug }, tags: ['events', 'sanity'] })`, with fallback lookup in `lib/data/events.ts` by a slugified title match when Sanity is unavailable.
- **Output (found):** `200` with a `VCALENDAR` wrapping exactly one `VEVENT`.
- **Output (not found):** `404`. Prefer calling `notFound()` (renders the app
  404) OR returning `new NextResponse('Event not found', { status: 404 })`. The
  golden checks for status `404` — either is acceptable; `notFound()` is the
  Next.js-idiomatic choice and matches the C1 detail-page convention.
- **Headers (found):**
  - `Content-Type: text/calendar; charset=utf-8`
  - `Content-Disposition: attachment; filename="{slug}.ics"`

### Error cases summary

| Case | Route | Result |
|------|-------|--------|
| Unknown slug | single | `404` |
| No upcoming events | feed | `200`, valid empty VCALENDAR (no VEVENT) |
| Sanity unavailable (null) | both | static fallback, never 500 |
| Event missing `endDate` | both | DTEND omitted OR derived (see notes) |

---

## 2. File List

| Path | Action | Purpose |
|------|--------|---------|
| `lib/ics.ts` | create | Pure ICS formatting utilities (no React, no Next imports) |
| `app/api/events.ics/route.ts` | create | Feed endpoint (`GET`) — the literal directory name is `events.ics` |
| `app/api/events/[slug]/ics/route.ts` | create | Single-event endpoint (`GET`) |

Notes on paths:
- The feed route directory is **`app/api/events.ics/`** (a folder literally named
  `events.ics`) so the URL resolves to `/api/events.ics`. Do not create a
  `route.ts` named with an extension.
- The single route nests under the existing `app/api/events/` tree:
  `app/api/events/[slug]/ics/route.ts` → `/api/events/{slug}/ics`.

### `lib/ics.ts` — required exports

```ts
// Convert an ISO date string to ICS UTC stamp: "YYYYMMDDTHHMMSSZ"
export function toIcsDate(iso: string): string

// RFC 5545 TEXT escaping: backslash, comma, semicolon, newline
export function escapeIcsText(value: string): string

// Build one VEVENT block from a normalised event
export function buildVEvent(input: IcsEventInput): string

// Wrap VEVENT blocks in a VCALENDAR with the SAOC PRODID
export function buildVCalendar(events: IcsEventInput[]): string

export type IcsEventInput = {
  slug: string;
  title: string;
  start: string;        // ISO
  end?: string | null;  // ISO, optional
  description?: string | null;
  venue?: string | null;
  location?: string | null;
};
```

---

## 3. Acceptance Tests (Goldens)

Plain-text, executable assertions. Build first so routes exist, then probe with
`curl` against `pnpm dev` (or assert on file content for static checks). Each
golden is independently verifiable.

```
G1  HELPER EXISTS
    lib/ics.ts exists and exports toIcsDate, escapeIcsText, buildVCalendar.
    PASS: grep finds "export function toIcsDate" AND "buildVCalendar" in lib/ics.ts

G2  FEED ROUTE EXISTS
    app/api/events.ics/route.ts exists and exports a GET handler.
    PASS: file exists AND grep finds "export async function GET"

G3  SINGLE ROUTE EXISTS
    app/api/events/[slug]/ics/route.ts exists and exports a GET handler.
    PASS: file exists AND grep finds "export async function GET"

G4  FEED — VALID HEADER + PRODID
    GET /api/events.ics returns 200, Content-Type "text/calendar; charset=utf-8",
    and the body begins with BEGIN:VCALENDAR containing
    PRODID:-//SAOC//South African Orchid Council//EN and VERSION:2.0.
    PASS: response 200; body contains "BEGIN:VCALENDAR", the exact PRODID line,
          and ends with "END:VCALENDAR"

G5  FEED — CONTAINS ALL UPCOMING EVENTS
    The feed emits one VEVENT per upcoming event from upcomingEventsQuery
    (or the static fallback when Sanity is null).
    PASS: count of "BEGIN:VEVENT" occurrences == number of upcoming events;
          each event title appears in a SUMMARY line

G6  FEED — CONTENT-DISPOSITION
    Feed response sets Content-Disposition: attachment; filename="saoc-events.ics".
    PASS: response header matches exactly

G7  FEED — EMPTY CALENDAR IS VALID
    When there are zero upcoming events, GET /api/events.ics still returns 200
    with a well-formed VCALENDAR and zero VEVENT blocks.
    PASS: response 200; body has BEGIN:VCALENDAR + END:VCALENDAR;
          "BEGIN:VEVENT" count == 0

G8  SINGLE — 200 + CORRECT VEVENT
    GET /api/events/{known-slug}/ics returns 200 with exactly one VEVENT whose
    SUMMARY is the event title and UID is "{slug}@saoc.co.za".
    PASS: response 200; body contains one "BEGIN:VEVENT", a SUMMARY line with the
          title, and "UID:{slug}@saoc.co.za"

G9  SINGLE — UNKNOWN SLUG 404
    GET /api/events/does-not-exist-xyz/ics returns 404.
    PASS: response status == 404

G10 DATES — UTC FORMAT
    DTSTART (and DTEND when present) are formatted YYYYMMDDTHHMMSSZ (trailing Z).
    DTSTAMP is present and also Z-suffixed.
    PASS: body lines match regex ^DTSTART:[0-9]{8}T[0-9]{6}Z$ ;
          ^DTSTAMP:[0-9]{8}T[0-9]{6}Z$ present;
          if event has endDate, ^DTEND:[0-9]{8}T[0-9]{6}Z$ present

G11 SINGLE — CONTENT-DISPOSITION FILENAME
    GET /api/events/{slug}/ics sets
    Content-Disposition: attachment; filename="{slug}.ics".
    PASS: header filename equals the requested slug + ".ics"

G12 TEXT ESCAPING
    A SUMMARY/DESCRIPTION/LOCATION containing a comma, semicolon, or newline is
    escaped (\, \; \n) and no raw unescaped comma/semicolon leaks into a value.
    PASS: escapeIcsText("a, b; c\nd") === "a\\, b\; c\\nd"
          (unit-level assert against lib/ics.ts)

G13 BUILD CLEAN
    Project builds with no TypeScript errors and both ICS routes appear in the
    route manifest.
    PASS: pnpm build succeeds; output lists /api/events.ics and
          /api/events/[slug]/ics
```

### Suggested machine-runnable assertions (YAML-style, single-line commands)

```
G1   grep -q 'export function toIcsDate' /Users/vetus/ai/SAOC/lib/ics.ts && grep -q 'buildVCalendar' /Users/vetus/ai/SAOC/lib/ics.ts
G2   test -f /Users/vetus/ai/SAOC/app/api/events.ics/route.ts && grep -q 'export async function GET' /Users/vetus/ai/SAOC/app/api/events.ics/route.ts
G3   test -f '/Users/vetus/ai/SAOC/app/api/events/[slug]/ics/route.ts' && grep -q 'export async function GET' '/Users/vetus/ai/SAOC/app/api/events/[slug]/ics/route.ts'
G4   grep -q 'PRODID:-//SAOC//South African Orchid Council//EN' /Users/vetus/ai/SAOC/lib/ics.ts
G6   grep -q 'saoc-events.ics' /Users/vetus/ai/SAOC/app/api/events.ics/route.ts
G9   grep -Eq 'notFound|404' '/Users/vetus/ai/SAOC/app/api/events/[slug]/ics/route.ts'
G10  grep -q 'Z' /Users/vetus/ai/SAOC/lib/ics.ts
G13  pnpm build 2>&1 | tail -8 | grep -qE 'events.ics|Route|Compiled'
```

Runtime goldens (G4–G11) are best verified by @qa with `pnpm dev` + `curl -i`;
the grep forms above are the CI gate proxies that confirm the contract shape.

---

## 4. Implementation Notes

### ISO → ICS UTC (`toIcsDate`)

```ts
export function toIcsDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date for ICS: ${iso}`);
  }
  // Use UTC getters so the output is timezone-stable.
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}
```

- Output is exactly 16 chars: `YYYYMMDDTHHMMSSZ`. The trailing `Z` marks UTC —
  no `TZID` parameter is needed, which keeps the feed import-portable.
- `DTSTAMP` uses generation time: `toIcsDate(new Date().toISOString())`.
- Date-only Sanity values (e.g. `"2025-03-15"`) parse as UTC midnight, which is
  acceptable for all-day-style events. Do NOT switch to `VALUE=DATE` — keep the
  uniform UTC datetime form so the goldens’ single regex matches every line.

### DTEND handling

- If `end` (endDate) is present, emit `DTEND:{toIcsDate(end)}`.
- If absent, omit DTEND (most calendar clients treat a VEVENT with only DTSTART
  as a point/all-day event). Do not invent a duration.

### Text escaping (`escapeIcsText`) — order matters

Escape backslash FIRST, then the structural characters, so you never double-escape:

```ts
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')   // backslash -> \\
    .replace(/;/g, '\;')      // semicolon -> \;
    .replace(/,/g, '\\,')      // comma     -> \,
    .replace(/\r?\n/g, '\\n'); // newline   -> \n
}
```

Apply to every TEXT-valued property: `SUMMARY`, `DESCRIPTION`, `LOCATION`.
Do NOT escape `UID`, `DTSTART`, `DTEND`, `DTSTAMP`, or `PRODID` (no user text).

### VEVENT / VCALENDAR assembly

- **Line endings:** RFC 5545 requires CRLF (`\r\n`) between content lines. Join
  with `\r\n`. (Most clients tolerate `\n`, but emit CRLF to be correct.)
- **VCALENDAR skeleton:**
  ```
  BEGIN:VCALENDAR
  VERSION:2.0
  PRODID:-//SAOC//South African Orchid Council//EN
  CALSCALE:GREGORIAN
  ...VEVENT blocks...
  END:VCALENDAR
  ```
- **VEVENT skeleton:**
  ```
  BEGIN:VEVENT
  UID:{slug}@saoc.co.za
  DTSTAMP:{now}
  DTSTART:{start}
  DTEND:{end}            (only if end present)
  SUMMARY:{escaped title}
  DESCRIPTION:{escaped description}   (only if present)
  LOCATION:{escaped venue + ", " + location}  (only if either present)
  END:VEVENT
  ```
- **LOCATION composition:** join the non-empty of `venue` and `location` with
  `", "` BEFORE escaping (so the joining comma is then escaped to `\,` per spec).
- **Line folding (optional, nice-to-have):** RFC 5545 recommends folding lines
  longer than 75 octets by inserting CRLF + a single space. Not required by the
  goldens; implement only if trivial. Keep it out of scope if it complicates the
  helper.

### Response construction (Next.js 15 route handler)

```ts
return new NextResponse(body, {
  status: 200,
  headers: {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'attachment; filename="saoc-events.ics"',
  },
});
```

- Use `NextResponse` (string body) — do NOT use `NextResponse.json`.
- Single route: derive filename from the awaited `slug`.
- Keep both handlers as Server route handlers (no `'use client'`). No new npm
  deps — assembly is plain string work in `lib/ics.ts`.

### Slug normalisation for static fallback

The static `lib/data/events.ts` `SocietyEvent` has no `slug` field. For the
fallback path, slugify the title (`lowercase`, spaces → `-`, strip non-alnum) to
produce a stable `slug`/`UID`. The Sanity path already supplies `slug` directly.
