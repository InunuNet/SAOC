# NOS home restore

Mission `nos-home-restore`. The National Orchid Show home (`/national-show`, served as `/` on the NOS host)
carries Lee-Ann's landing-page copy again. Lee-Ann and Brad approved the page as it stands (Brad 2026-10-31).

## What the page shows

In order, after the hero:

1. `intro` — tagline h2, her two paragraphs, three figures (`3 Years`, `13 Judging Groups`, `18 National Show Editions`).
2. `about` — About v1.2 lead and body, with the floating show-dates and hours card.
3. `judging` — h2 "Thirteen judging groups" over 13 cards, her names and descriptions, italic runs as `<em>`. Groups 11-13 have no description in her doc, so none is rendered.
4. `plant-entry` — "Plant Entry for SAOC Members", four stages, "Start planning your entry now.", "Register Here" as plain text with one pending status marker (her form is not supplied; no dead link), then her closing sentence.
5. `programme`, `exhibit`, `closing` — unchanged.

The show-dates card floats beside the bands (`.nos-hm-float`); its track is sticky, the card itself is static.

## Sources

- Copy: `lib/data/nos-home-landing.ts`, a plain typed module. Every string is verbatim from her landing doc v1.0 (frozen at `.agent/memory/project/specs/nos-home-restore/goldens/sources/landing-page-v1.0.md`). Her editorial notes to us are never rendered.
- Not Sanity: the live `showClass` / `showExhibitorStep` documents hold our old invented copy and were left untouched.
- Rule: `docs/rules/no-invention.md`.

## Sanctioned deviations from the original restore scope (Brad 2026-10-31)

1. The judging heading reads "Thirteen judging groups"; her doc says "Ten judging groups" over 13 groups.
2. The "Visit" band is removed from the home; the sub-nav carries those links.
3. The hero carries her landing doc Section 1 lede ("South Africa’s triennial National Orchid Show ... all nine provinces.") and the Theme line under Dates / Venue. The original contract excluded these; the approved page applies them, so HM-G1 now compares the lede to her doc and "nine provinces" is no longer banned.

## Gate changes

- `nos-content-standard/goldens/route-table.json` home: `visit` dropped from `sections` and `h2s`; `visitLinks` / `visitColumns` removed.
- `nos-content-standard/checks/gate-standard.mjs`: HM-G1 Visit assertion retired; the hero lede is compared to her landing doc; the dates card is sticky from 1024 and static below.
- `nos-content-standard/checks/fs-checks.mjs`: FS-1.4 Visit assertions retired; the hours card is sticky from 1024; Programme h3 is a fixed 22px; S-CARD gains `plainCards` (the 13 `.nos-jg-card`, white, radius 10, shadowed, not `.ds-card`).
- `nos-content-standard/goldens/fs-rulings.json`: Visit ruling removed, `plainCards` for `/`, Programme h3 fixed 22px.
- `route-table.json` home also drops `nine provinces` from `bannedText` and renames the first Exhibit link to "Award Entries" (the nav label since #146).
- `nos-home-restore/checks/home-restore-checks.mjs`: HR-2 compares figures with whitespace ignored (value and label are separate spans); HR-9 no longer expects the "Visit" h2.
- `nos-home-restore` spec and contract prose say "Thirteen"; `checks.sha256` pins refreshed.
- `saoc-mono-floor/checks/nos-baseline.json`: the `/`, `/faq` and `/plan-your-visit` entries (1280 and 390) refreshed from the approved build (2563583f); the `/faq` and `/plan-your-visit` drift predates this branch (stale baseline from c0e4e380, this branch touches only home-scoped CSS). A `refreshedFrom` field records this; `origin` still names c0e4e380.
