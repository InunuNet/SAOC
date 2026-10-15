# Launch events honesty (launch-weekend F4)

Governing rule: [docs/rules/no-invention.md](rules/no-invention.md).

## What was removed, and why

17 `societyEvent` documents were seeded on 2026-06-30 from `lib/data/events.ts`, a scaffold with
no source. They were invented, yet showed on the events page, the home strip, society pages,
the calendar feeds, `llms-full.txt` and the client bundle. Only the 19th National Show
(`societyEvent-15-19th-south-african-national-orchid-show`) is sourced.

- `lib/data/events.ts` is deleted, as is every static fallback onto it: events page, society
  page, `EventsStrip`, `SearchOverlay` (event search is gone), both ICS routes, and `mapEvents`
  in `scripts/seed-sanity.ts` (a re-seed can no longer recreate the invented docs).
- `SocietyEvents` lost its `live` prop and `FallbackEventRow`.
- With no events, the events page and home strip show the existing sentence
  "No upcoming events scheduled." plus the `ConfirmationBadge` pending marker. No new copy.
- `/api/events.ics` returns a valid empty calendar; an unknown `/api/events/[slug]/ics` is 404.

## Unpublish script

```
pnpm exec tsx scripts/unpublish-invented-events.ts --dry-run | --apply
```

No flag prints usage and exits 2. Token `SANITY_API_TOKEN` is read from `.env.local` (only for
`--apply`) and never printed.

- Targets are the explicit seeded id list inside the script. Any other published `societyEvent`
  prints `UNLISTED <id>` and exits 3 without writing (it may be a real, new event). A missing
  National Show doc also exits 3.
- `--apply` first writes every target doc to
  `.tmp/sandbox/launch-weekend-f4-backup/<ISO timestamp>.json` and re-reads it to verify the
  count (exit 1 before any write otherwise).
- Each doc moves in one transaction locked to the fetched `_rev` (`ifRevisionID`): a document
  edited in the meantime fails the transaction and the script stops. No field is edited.
- Unpublished docs become drafts, so they stay in Studio.

Applied to production on 2026-10-16: 17 unpublished, National Show kept.

## Restoring a real event

If one of these turns out to be real, find its draft in Studio, add the source (and correct
details), then publish it. If the draft is gone, recreate it from the backup JSON. A re-run of
the script after publishing a listed id would unpublish it again, so delete that id from the
script's list first.

## refresh-llms

`scripts/refresh-llms.ts` now sets `perspective: 'published'`. With a token the Sanity client
returns drafts by default, so the unpublished events leaked back into `public/llms-full.txt`
(the nightly job passes the token). Known and unfixed: that file prints `[object Object]` under
About.

Checks: `contracts/checks/launch-weekend/f4/`.
