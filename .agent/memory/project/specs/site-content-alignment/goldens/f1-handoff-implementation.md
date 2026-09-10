# F1 — Handoff implementation delta

Inventory only, per team lead's correction (2026-09-09): the design handoff at
`design/design_handoff_saoc/` is approved and binding. Nothing below proposes,
extends, or reinterprets it — it records what the handoff defines and how far the
repo already implements it, so F2+ dev work knows exactly what is new structure
versus what already exists.

## Token parity — exact, no gap

`app/globals.css:1-95` (`:root` block) is a line-for-line match of
`design/design_handoff_saoc/colors_and_type.css:1-95` — same variable names, hex
values, comments: full palette (`--primary`/`-800`/`-700`/`-100`, `--accent`/`-soft`,
`--parchment`/`--ivory`/`--bone`, `--ink`/`--muted`, `--rule`/`-soft`), full type
scale (`--display-*`, `--body-*`, `--mono-*` + tracking), 8-pt spacing scale
(`--space-0`…`--space-10`), radii (`--radius-0/1/pill`), the one permitted shadow
(`--shadow-float`), motion tokens (`--ease`, `--dur-fast/med/slow`). The `@theme`
block (`app/globals.css:92-109`) is the Tailwind v4 bridge exposing these as
`--color-*`/`--font-family-*` utilities — an implementation detail the handoff
itself doesn't need, not a deviation. **No token gap.**

## Component parity — built, name-for-name, framework-appropriate

Handoff's `ui_kits/website/components.jsx` exports `Logo`, `Eyebrow`, `Button`,
`NavBlock`, `SocietyCard`, `EventRow`, `Header`, `Footer`. The fuller mockup
(`src/pages-interior.jsx`, `pages-home.jsx`, `pages-show-events-contact.jsx`,
`chrome.jsx`) additionally defines `PageHero`, `Breadcrumb`, `SearchOverlay`,
`UtilityBar`, and per-page compositions (`AboutPage`, `SocietiesPage`,
`JudgingPage`, `ShowPage`, `EventsPage`, `ContactPage`).

Live-repo cross-check: `components/chrome/Header.tsx`, `Footer.tsx`,
`Breadcrumb.tsx`, `MegaMenu.tsx`/`MobileMenu.tsx` (mockup's `SearchOverlay` role),
`components/ui/PageHero.tsx`, `components/societies/SocietyCard.tsx`,
`components/ui/EventRow.tsx` all exist and consume the token set correctly
(`Header.tsx` uses `bg-parchment`/`shadow-float`/`border-rule`; `PageHero.tsx` uses
the exact `--primary-800` gradient scrim the handoff specifies for photo
text-contrast; `Footer.tsx` uses `bg-primary-800`, the stacked logo layout, and the
`SKILL.md` wordmark tagline copy verbatim). **Materially complete implementation of
the handoff's chrome + hero + card/row vocabulary — not a from-scratch build.**

`components/show/*` (`VenueCard`, `TravelRoutes`, `AccommodationList`,
`ShowSectionNav`, `ShowFaqList`, `VisitorInfoBlock`, `ExhibitorSection`,
`ExhibitorSteps`, `ExhibitorKeyDates`, `ExhibitorQuestions`, `EntryFormLink`,
`ShowCountdown`) and `components/home/*` (`NavCards`, `ShowBand`) are SAOC-repo
extensions built on top of the handoff's token/type system, for content the
handoff's own `ShowPage` mockup only sketched at coarser grain. Consistent with
the system (same tokens, same mono-eyebrow/hairline-rule conventions) — more
granular than the 7-screenshot mockup needed to show, not a deviation from it.

## The one real gap: no generic "content page" wrapper

No single "hero + N sections" wrapper component exists — each interior page
composes `PageHero` + its own section markup by hand.
**This is not a gap against the handoff** — the handoff's own per-page files (`AboutPage`/`SocietiesPage`/
`JudgingPage` in `pages-interior.jsx`) are also hand-composed; "compose PageHero +
bespoke sections per page" IS the handoff's pattern, and the repo already follows
it. If F2+ wants a more templated wrapper for the five gap routes (Symposium,
WOSA Conference, International Exhibitors, National Show About, Programme), that
is new structure beyond what the handoff defines — a scoping decision for whoever
picks up those features, not invented here.

## Handoff visual coverage stops at 7 screens

Screenshots: `01-home`, `02-about`, `03-societies`, `04-judging`,
`05-national-show`, `06-events`, `07-contact`. The 5 gap routes (Symposium, WOSA
Conference, International Exhibitors, National Show About, Programme) have
**neither Lee-Ann copy nor a handoff mockup screen** — net-new territory for
whoever builds them, but strictly within the existing token/component vocabulary
above. No new visual decision is licensed by their absence from the mockup set.

## Branding assets (noted, not touched)

`branding/SA Orchid Council/` (SAOC emblem, 4 revisions, favicon, 2 logo PDFs) and
`branding/National Show 2027/` (Show emblem, PNG/SVG, 1 logo PDF, archive zip) are
Brad's active design workstream (`project_design_folders_brad_active` memory) —
left alone.
