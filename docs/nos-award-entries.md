# NOS Award Entries

Authority: Brad's relayed council thread of 2026-10-28 (`.agent/memory/project/specs/nos-award-entries/goldens/source-council-thread.md`). Governing rule: [no-invention](rules/no-invention.md).

## What changed

On the NOS host, people who submit plants for judging are **Award Entries**, not exhibitors. Only stand bookers are Retail Vendors or Display Exhibitors.

- The page moved from `/exhibitors` (internal `/national-show/exhibitors`) to `/award-entries` (internal `/national-show/award-entries`).
- `proxy.ts` sends both old paths to `/award-entries` with a single permanent 308 hop on the NOS host and on the SAOC host. The query string is kept.
- The page title, h1, breadcrumb, header menu, footer, show index and home band CTA read "Award Entries".
- Below the shared Q&A the page has two sequential sections, "National Show Awards" then "SAOC Awards". Each shows only its heading, the bare definition sentence from Brad's thread, and the existing awaiting-committee-copy marker.

## Terminology

| Class | Meaning | Wording |
|---|---|---|
| a | Plant entrant for judging | Award Entries |
| b | Stand-booking vendor or exhibitor | Retail Vendors / Display Exhibitors; existing stand wording is kept |
| c | Identifier, path, file name, unrendered code | Unchanged (components, ids, CSS hooks, Sanity types) |

The heading-versus-label rule: the section headings are the award names (19:13 wording). The "National Show Award Entries -" and "SAOC Award Entries -" labels are not rendered; the lede is the bare sentence after the dash.

## Handed to SAOC

Sanity-held strings that still say "exhibitor" for plant entrants are listed in `.agent/memory/project/specs/nos-award-entries/goldens/sanity-for-saoc.md`. This change never writes Sanity or Drive. `scripts/seed-show-faq.ts` carries the matching FAQ edits so a reseed cannot revert them.

## Open decisions

Recorded as D1-D12 in the spec: the `/vendors` title and group label, "Exhibit & trade", the archive statistic label, and the tickets "I'm exhibiting orchids" card wait on Lee-Ann. The full audit is `goldens/exhibitor-audit.md` and the sign-off list of remaining visible "exhibitor" text is `goldens/exhibitor-visible-list.md`.
