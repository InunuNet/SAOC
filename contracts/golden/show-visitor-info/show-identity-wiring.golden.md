# F6 — `/national-show` show-identity wiring

## First: the backlog item is partly stale, and that matters

Backlog P1 "Seeded-but-inert content" (`.agent/memory/project/backlog.md:333`, found 2026-07-30)
says `/national-show` never reads the `nationalShow` singleton and that
`components/show/ShowCountdown.tsx` hardcodes the countdown target. **Both of those specific
claims were fixed on 2026-08-06 by commit `32f3b0f`** ("feat(national-show): wire nationalShow
singleton fields into /national-show"). Verified in the working tree while authoring this
contract:

| Claim in the backlog | Actual state |
|---|---|
| "no `nationalShowQuery`" | `page.tsx:10` imports it, `:109` fetches it |
| title hardcoded | `:112` `sanityShow?.title \|\| '…'` — Sanity first |
| venue hardcoded at ~151 | `:113` `sanityShow?.location \|\| 'CTICC, Cape Town'` — Sanity first, literal only as fallback |
| hero hardcoded | `:114` `urlFor(sanityShow.hero)` |
| exhibitor stages hardcoded | `:115`, rendered at `:375` |
| `ShowCountdown.tsx:5` hardcodes the target | `:192` passes `countdownDate={sanityShow?.countdownDate}`; `DEFAULT_COUNTDOWN_DATE` is a labelled fallback for an absent/invalid value, mirroring `ShowBand.tsx` |

Recording this because acting on the stale text would mean re-doing work that is already done,
and because the backlog entry needs correcting rather than inheriting.

**The underlying concern is still completely valid**, for a different reason: *none of that
wiring has ever been proven at the rendered-page level.* The gate that passed asserted against
the Sanity API, not against the HTML — the same false-green class this whole contract exists to
close. `contracts/checks/cms-loop-f3-national-show/check-headline-round-trip.mjs` even carries a
2026-08-06 note that `location` was "NEVER rendered by the page at all", written before
`32f3b0f` landed and never revisited. So the wiring is asserted by nobody.

That also settles a question left open in `venue-single-source.golden.md`: the landing hero
genuinely does read `nationalShow.location`, so keeping that field — rather than collapsing it
into `venue.name` — remains correct, and `cms-loop-f3`'s round trip should now be able to pass.

## What is still genuinely hardcoded

Verified by reading `app/(marketing)/national-show/page.tsx` on 2026-08-11:

| Line | Literal | Fix |
|---|---|---|
| ~151 | `{ label: 'Dates', value: '18–21 Sep 2027' }` | derive from `showDate` + new `showEndDate`. `showDate` is queried at `:48` and used by nothing — a live inert field |
| ~151 | `{ label: 'Host', value: 'Western Cape' }` | new `hostRegion` field |
| ~151 | `{ label: 'Cycle', value: 'Triennial' }` | **leave alone** — a standing fact about the show's constitution, not a per-edition value |
| 163 | `{toRomanOrdinal(19)} · Nineteenth Edition` | new `edition` number field |
| 113 | fallback `'CTICC, Cape Town'` | replace the fallback with a neutral, non-venue string. The `||` order is already correct (Sanity wins); the problem is the literal itself |
| 75 | `'Arrive at the CTICC from 07:00 …'` in the `EXHIBITOR_STAGES` fallback constant | reword to "the venue" |
| ~470 | "The 19th National Orchid Show opens in September 2027 in Cape Town." | derive edition, month/year and city from `edition`, `showDate` and `venue.city` |

The commit message for `32f3b0f` explicitly deferred the first two as "a content-model decision
for Brad/committee, not something to route around here." F1 of this mission *is* that content-
model pass, so the decision is now made: add the fields.

## Schema additions to `nationalShow` (F1, alongside `venue`)

| Field | Type | Note |
|---|---|---|
| `showEndDate` | `datetime` | A single `showDate` cannot express a range, which is why the Dates cell stayed hardcoded. This is the missing half |
| `edition` | `number` | e.g. 19. Drives the hero eyebrow and the CTA sentence |
| `hostRegion` | `string` | e.g. the host province. Drives the Host meta cell |

## Seeding (create-if-absent, `setIfMissing`, same rules as everything else)

```
showDate:    2027-09-18T09:00:00+02:00   (matches the countdownDate already in the dataset)
showEndDate: 2027-09-21T17:00:00+02:00
edition:     19
hostRegion:  Western Cape
```

Live dataset state, read 2026-08-11: `title` and `location` are set, `countdownDate` is
`2027-09-18T09:00:00+02:00`, and `showDate` / `edition` are **null** — so `setIfMissing` will
write all four without touching anything an editor has already set.

**These dates are not confirmed.** `confirmations.dates` seeds as `pending`, and the landing
page must render the pending marker beside the hero meta grid. Seeding a plausible date range
*without* that marker would be exactly the invention this mission forbids; seeding it *with* the
marker makes an inert field live and honestly labelled at the same time.

## Rendered proof — the point of F6

`check-show-identity-rendered.mjs` reads `nationalShow` live from the dataset and requires the
rendered `/national-show` HTML to contain the dataset's `title`, `location`, `hostRegion`, the
`edition` in roman-ordinal form, and the `showDate`/`showEndDate` year — needles from Sanity,
never from the check.

The countdown needs Playwright rather than HTTP: `ShowCountdown` deliberately renders a frozen
`00/00/00` server snapshot and only computes the real value after hydration (that is the
hydration fix from `contracts/f1-countdown-hydration.yaml` — do not undo it). So the check loads
the page in a browser, waits for a tick, reads the rendered Days value, and requires it to match
the day count computed from the dataset's `countdownDate` within a tolerance of 1 day. That
proves the prop is genuinely driving the target, which nothing has ever proven.
