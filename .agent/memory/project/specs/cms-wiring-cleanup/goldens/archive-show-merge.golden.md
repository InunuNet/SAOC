# Golden: how a national show is assembled for the archive pages

Authoritative for `lib/data/mergeShows.ts` and both archive routes. If the implementation
and this file disagree, this file is right.

## The problem this solves

Two sources describe the same shows, and **neither is a superset of the other**:

| Field | `lib/data/shows.ts` (static) | Sanity `show` schema | Notes |
|---|---|---|---|
| `year` | yes | yes | join key |
| `status` | yes | yes | `'past' \| 'upcoming'` |
| `venue` | yes | `location` | different names, same thing |
| `entries` | yes | yes | |
| `edition` | **yes** | no field | Roman numeral on both pages |
| `month` | **yes** | no field | |
| `host` | **yes** | no field | host province |
| `days` | **yes** | no field | "Duration" stat |
| `visitors` | **yes** | no field | |
| `trophies` | **yes** | no field | |
| `note` | **yes** | no field | |
| `title` | no | yes | |
| `exhibitors` | no | **yes** | |
| `awards` | no | **yes** | |

Seven fields exist only in the static array. So "replace static with Sanity" loses data —
which is exactly what `archive/page.tsx` does today: because Sanity `show` documents
exist, it takes the Sanity branch wholesale and substitutes `edition: 0`,
`month: 'September'`, `host = location`, and `visitors = exhibitors`. Confirmed live
2026-08-11: the list renders bare years where the detail page renders "XVIII" for the
same show, and it labels 2021 "September" when the static record says October.

## The rule

Union on `year`. Per field: **a defined Sanity value wins; otherwise the static value;
otherwise undefined.** Never the reverse — a published edit must never be masked by a
hardcoded literal.

```
merged[year] = {
  ...staticEntry,                              // supplies edition/month/host/days/visitors/trophies/note
  ...definedFieldsOf(sanityEntry),             // overrides year/status/venue/entries and adds title/exhibitors/awards
}
```

Explicit mappings:

- Sanity `location` → `venue`. It is the venue string, not the host province.
- Sanity `exhibitors` → **`exhibitors`**, a new optional field on the `NationalShow`
  type. It must NOT be mapped onto `visitors`; those are different counts and the
  current list page conflates them.
- `host` has no Sanity counterpart. It comes from static only, and is `undefined` for a
  Sanity-only year — see below.

## Sanity-only years (the case the whole feature exists for)

A `show` document created in the Studio for a year absent from the static array yields a
merged record with `edition`, `month`, `host`, `days`, `visitors`, `trophies` all
undefined. Both pages must render it without crashing and without inventing values:

- `edition` undefined or `0` → render the **year** in place of "Edition XVIII", never
  "Edition " with nothing after it, and never a fabricated number.
- `month`, `host`, `days`, `visitors`, `trophies` undefined → render `—` in a stat cell,
  or omit the element entirely where the layout allows. Do not substitute a default like
  `'September'`.
- The prose paragraph on the detail page interpolates `month`, `venue` and `host` into a
  sentence. With those undefined it must degrade to a sentence that still reads correctly
  rather than emitting "held in undefined at undefined".

## Both pages read the same merge

`archive/page.tsx` (list) and `archive/[year]/page.tsx` (detail) must call the same
helper. They currently disagree about the 2024 show; a fix that leaves them on separate
code paths would let them drift again. `check-archive-merge-fidelity.mjs` asserts the
agreement directly.

## `generateStaticParams`

Must union static years and Sanity `status == 'past'` years, so a Studio-added show is
prerendered rather than relying on the dynamic fallback.

## Not in scope

- Adding `edition` / `month` / `host` / `days` / `visitors` / `trophies` fields to the
  `show` schema. That is a schema-design decision that ties into the still-open National
  Show brand-architecture question, and it is not needed to close the 404.
- Making the archive list cards clickable. That is the latent trap the backlog names, and
  it becomes safe once this feature lands — but it is a design/IA change, not this fix.
