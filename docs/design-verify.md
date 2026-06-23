# Design Verify — Implementation Notes

Mission: `design-verify` | Status: complete

## What changed

### `app/globals.css`
Expanded from a minimal token set to the full Claude Design reference spec:

- **Semantic aliases** (`--bg`, `--fg`, `--fg-on-dark`, `--link`, `--link-underline`) for readable component CSS
- **Type scale** — `--display-xl` through `--body-xs` and `--mono-*` for consistent sizing
- **Spacing** — 8-pt grid (`--space-0` through `--space-10`) plus `--section-y`, `--container-pad`, `--container-max`
- **Radii** — `--radius-0` (cards), `--radius-1` (buttons), `--radius-pill` (eyebrows only)
- **Elevation** — `--shadow-float` for floating menus; cards use borders not shadows
- **Motion** — `--ease`, `--dur-fast`, `--dur-med`, `--dur-slow`
- **Semantic CSS classes** — `.on-dark`, `.eyebrow`, `.inline-link`, `.lede`, `.caption`, `.mono-label`
- **Body defaults** — `background: var(--bg)`, `color: var(--fg)`, `font-family: var(--sans)`

### `components/chrome/Header.tsx`
- Logo text abbreviated to **"SA Orchid Council"** (full name retained in `aria-label` for accessibility)
- Tagline updated to **"Making a difference since 1968"**
- Contact CTA button changed from `bg-accent` to `bg-primary-800` per design spec

### `app/(marketing)/about/page.tsx`
- Hero eyebrow changed from "Since 1968" → **"Our heritage"**
- Hero heading changed to **"A federated body of growers, since 1968."**

### Component passes (contracts 2 and 3)
All cards (`SocietyCard`, `EventCard`, `AwardsGrid`, `JudgesDirectory`, `BoardGrid`, `SponsorGrid`, `ContactForm`) already used `rounded-sm` or no rounding — spec-compliant.
Hero and PageHero already use the design-spec clamp sizes.
EventCard already uses `font-serif` for editorial date display.

## Assertions

All A1–A11, B1–B6, C1–C6 verified green (2026-06-23).

## Known limitations

- Visual QA against reference screenshots requires human review (browser rendering)
- Typography loading verified at token level; actual web font delivery confirmed via `pnpm build` exit 0
