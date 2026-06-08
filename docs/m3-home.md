# M3 — Home Page

## Route

`app/(marketing)/page.tsx` — assembled from seven section components.

## Components

| Component         | File                                  | Description                                                                |
| ----------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| `Hero`            | `components/home/Hero.tsx`            | 4-image crossfade hero: eyebrow pill, h1 with italic em, two CTAs, dot nav |
| `MissionBlock`    | `components/home/MissionBlock.tsx`    | 2-col: left copy + right 4-up stat row (societies/year/shows/judges)       |
| `NavCards`        | `components/home/NavCards.tsx`        | 4-col grid of navigation cards; hover: lift 4px + accent border            |
| `ShowBand`        | `components/home/ShowBand.tsx`        | Full-bleed dark band: bench image, 4-up meta, live countdown to 2027-09-18 |
| `EventsStrip`     | `components/home/EventsStrip.tsx`     | "What's on" strip using EventRow; links to full calendar                   |
| `YearbookStrip`   | `components/home/YearbookStrip.tsx`   | --bone bg, 2-col: yearbook copy + Subscribe/Past buttons + image           |
| `PartnersSection` | `components/home/PartnersSection.tsx` | Centered 6-cell serif partner name grid on parchment                       |
| `EventRow`        | `components/ui/EventRow.tsx`          | Shared: 110px date block + body + host + arrow; used in Home + Events      |

## Rendering

All home section components are Server Components (no browser APIs). `ShowBand` uses a client
sub-component for the countdown (`useEffect`/`setInterval`).

## Design Constraints Applied

- One `--primary` dark band per page: `ShowBand` fulfils this requirement.
- No emoji anywhere.
- Each `<h1>` / `<h2>` contains exactly one `<em>` italic word.
- Eyebrows use JetBrains Mono uppercase with `0.18–0.22em` tracking.
- Cards use `1px solid var(--rule)` borders, `border-radius: 0`.
- All hovers: `150ms ease` transition, buttons darken + lift 1px.

## Countdown

`ShowBand` counts down to `2027-09-18T09:00:00+02:00`. Days/Hours/Minutes/Seconds
displayed in serif 42px `--accent-soft` numbers with mono uppercase labels.

## Data Sources

- Stat numbers in `MissionBlock` are hardcoded (21 societies, 1968, 18 shows, 56 judges).
- `EventsStrip` data from `lib/data/events.ts` (first 5 upcoming events).
- `PartnersSection` partner names from `lib/data/partners.ts`.
- `NavCards` cards are static (About / Societies / Judging / National Show).
