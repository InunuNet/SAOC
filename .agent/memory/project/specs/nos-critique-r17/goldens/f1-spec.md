# nos-critique-r17 F1 — the exhibitor card goes to the vendor application flow

BASE: `origin/main` `5c093d6e` (r16 merged). Branch `fix/nos-critique-r17`, worktree `.tmp/sandbox/critique-r17`.
Ruling: Brad's beta review, relayed by the lead (saoc-82) on 2026-10-19, verbatim:

> "Exhibitor and Trader do the same vendor application flow."

Golden: `f1-edits.json`. Footprint: `f1-footprint.json`.
Sources: `docs/rules/no-invention.md` (no new copy); `design/design_handoff_saoc/`; `branding/National Show 2027/`.

## 1. The edit

/national-show/tickets, "Exhibiting or trading?" (`FOOT_OPTIONS` in `app/(marketing)/national-show/tickets/page.tsx`):

| card | line | BASE | target |
|---|---|---|---|
| `#exhibit` "I'm exhibiting orchids" | 56 body | "See what is involved in exhibiting at the National Show. Entry sales are not yet open — they open closer to the show." | "See what is involved in exhibiting at the National Show." |
| `#exhibit` | 57 cta | "Exhibitor entry" | unchanged |
| `#exhibit` | 58 href | `/national-show/exhibitors` | `/national-show/vendors/apply`, the same as `#trade` |
| `#trade` "I'm a nursery or trader" | 65 href | `/national-show/vendors/apply` | unchanged |

The sentence is removed and nothing replaces it. The remaining body is one complete sentence, so it is neither empty nor broken: **no STOP**.
Note for the lead: the kept sentence still reads "See what is involved in exhibiting", while the CTA now opens the vendor application.
The ruling allows no new copy, so the wording stays as it is.

## 2. Every other link to the old target `/national-show/exhibitors` (public and preview, BASE build, 47 routes from sitemap.xml)

Both modes give the same result. None of these is the dead-end exhibitor *entry* CTA. Each is an information link to the grower entry guide (labelled "Exhibitor
information/info/entry guide"), or it is the page itself. **None is in the golden, and none changes.**

| site | label | source | where rendered |
|---|---|---|---|
| SAOC home ShowBand tertiary CTA | Exhibitor info | `components/home/ShowBand.tsx:157` | / |
| NOS show overview, "Start planning your entry now." | Exhibitor information (ghost button beside "Find your society") | `app/(marketing)/national-show/page.tsx:626` | /national-show |
| NOS header mega menu + mobile drawer | Exhibitor entry guide (descriptor "Entry process, fees, classes, judging and eligibility…") | `components/chrome/nav-config.ts:251-254` | 36 NOS pages |
| NosShowIndex "Explore the show pages" | Exhibitor entry guide | `components/nos/NosShowIndex.tsx:36` | 32 NOS pages |
| NosSubNav "Exhibit & trade pages" | Exhibitor entry guide | nav-config (same leaf) | 10 exhibit/trade pages |
| SAOC search overlay quick link | Exhibit at the National Show | `components/chrome/SearchOverlay.tsx:37` | rendered only when the overlay is opened |
| sitemap.xml | — | `app/sitemap.ts` (from the route list) | /sitemap.xml |
| JSON-LD | its own breadcrumb only | `/national-show/exhibitors` itself | that page |
| not rendered | — | `components/show/ShowSectionNav.tsx:92` (dead), `content/national-show-routes.json:221` | — |

"Exhibit at the National Show" (search) is the only label that reads as an action. Flagging it for the lead; it is not in the golden.

## Checks

The `f1-static.mjs` checks:

- S1: exactly the two line edits.
- S2: no invention.
- S3: the docs have a "## F1" section.

The `f1-rendered.mjs` checks run on public and preview builds at 1280 and 390:

- R1: the CTA is named "Exhibitor entry" and its href equals the trader CTA's.
- R2: the body is exact and the removed sentence appears nowhere on the page.
- R3: both CTAs land on the same URL with a 200.
