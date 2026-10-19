# nos-critique-r16 F3 — SAOC content wiring (media-kit brand tiles, event rows as single links)

BASE: `origin/main` `cea06daf`. Branch `fix/nos-critique-r16`. Ruling: Codi, FINAL, relayed by the lead (saoc-82) on 2026-10-19.
Goldens: `f3-media.json`, `f3-events.json`. Footprint: `f3-footprint.json`, plus the 8(b) emblem `dest` (`public/images/Eulophia-speciosa-emblem.png`).
Sources: `docs/rules/no-invention.md`; `design/design_handoff_saoc/`; `branding/`.

## 8. /media-kit "Brand assets": exactly three tiles

BASE has four tiles: "Emblem — Eulophia speciosa" (`/downloads/media-kit/saoc-emblem.png`) and three 767×700 paper lockups (ink, sage, flat).
Target, in this order:

| tile | file | sha256 | size | preview ground |
|---|---|---|---|---|
| (a) Full lockup — emblem and name | /images/saoc-lockup-horizontal-full-name.png | 75a14c5b…e914 | 3757×493 | as today |
| (b) Emblem — full colour | /images/Eulophia-speciosa-emblem.png (new) | c64e8041…ce3f | 1254×1254, 1,153,179 bytes | as today |
| (c) Emblem — for dark backgrounds | /images/saoc-emblem-footer-lapis-2x.png | 27aa24de…3f6a | 640×618 | --primary-800 rgb(34, 40, 31) |

Retire the whole paper and brass set from the kit (`saoc-logo-{ink,sage,flat}-{paper,brass}`), along with the old kit emblem path. No recolour, no
derivation. Every served file must hash to its golden sha256. Previews go through the existing `/images/_opt/*.webp` loader.

**8(b) provenance (lead ruling, 2026-10-19).** At BASE the ruling's `branding/SA Orchid Council/emblem/Eulophia-speciosa-emblem.png` was not
in git; only `Eulophia-speciosa r1.png`–`r4.png` were (their shas are kept under `superseded` in `f3-media.json`). The lead ruled the source to
be Brad's consolidated emblem at that path, which is not committed. The lead staged a byte-identical copy at
`.tmp/sandbox/r16-assets/Eulophia-speciosa-emblem.png` (1,153,179 bytes, sha256 `c64e8041ee1045fbc3ef247f46b59b6fa70f60321daa0fdfc20af5632170ce3f`).
The dev copies it byte for byte to `public/images/Eulophia-speciosa-emblem.png`. Nothing under `branding/` is added, deleted or committed: that is
Brad's workstream, and the r1–r4 deletions stay his to commit. `branding/` is in no footprint, and f3-static S2 FAILS if any `branding/` path changes.

**DECISION NEEDED, tile descriptions and format lines.** The ruling names the tiles but gives no descriptions. Recommendation: (a) reuses
"Emblem and wordmark, for light backgrounds."; (b) reuses "The SAOC mark on its own, transparent background."; (c) gets no description.
The format line ("PNG · W×H · transparent") is derived from the file itself. The no-invention check (S3) only accepts strings already present at BASE.

## 9. "What's on" rows become one link each

Rows: on / these are the `EventsStrip` `EventRow` articles under `[data-home-section="events"]`. At BASE they have no link. On /events they are the
`EventCard` rows in `main`. At BASE each title links to `eventHref(event)`, which sends the National Show to /national-show, and the host
society is a second link.

Target: each row is exactly one link to `/events/<slug>`. Its accessible name is exactly the event title (use `aria-label` or
`aria-labelledby`, because the row also contains a date, kind and venue). Nothing interactive sits inside it or beside it in the row. On / the
aria-hidden → arrow stays inside the link. The hover background change stays.

**Slug verification (done FIRST, public build of BASE).** The rows on both / and /events render one event,
"19th South African National Orchid Show". `/events/19th-south-african-national-orchid-show` answers 200. No STOP.

DECISION NEEDED:

- **Destination.** `eventHref` sends the National Show to /national-show. The ruling says `/events/<slug>`, and the golden follows the ruling.
- **/events host link.** "One link per row" turns the host-society link into plain text.

## Checks

The `f3-static.mjs` checks:

- S1: tile names, order and paths, with the retired set gone.
- S2: the sha256 of each file (the pinned c64e8041… for (b)), lockup and dark emblem unchanged against BASE, no `branding/` change.
- S3: no invention.
- S4: the docs have a "## F3" section.

The `f3-rendered.mjs` checks run on public and preview builds at 1280 and 390:

- R1: the tiles, the served bytes and the previews.
- R2: one titled link per row, which answers 200 and whose h1 equals the title.
- R3: the arrow and the hover.
