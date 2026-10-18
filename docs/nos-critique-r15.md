# nos-critique-r15

## F1 - the public build withholds the unsourced per-society estimates

The lead's ruling (FINAL, 2026-10-18) passed by a 2/3 vote, consistent with F24 vote 1C: "withhold on public, show marked on
preview". On the public build, three things are withheld:
- the per-society estimate pill ("Founded YYYY · ~N members", tagged estimated);
- the /societies caption saying those figures are our own estimates;
- the /societies/<slug> "General description" marker.

The switch is the existing `withholdPlaceholderProse()` (`lib/data/show-pages.ts`, unchanged), and the beta preview is
byte-unchanged.

- **Withheld in the data, on the server.** The new pure helper `lib/data/society-withhold.ts`
  `withholdSocietyEstimates(society, withhold)` behaves as follows:
  - when not withholding, it returns the same object;
  - when withholding, it nulls `founded` / `memberCount` and clears the matching flag, but only where that field's own
    placeholder flag is true;
  - sourced figures (flag false or absent) pass through untouched, and the input is never mutated.

  SocietyCard and SocietiesClient are client components, so a render prop would still ship the figures in the RSC payload.
  Nulling them on the server removes them from the HTML as well, and the existing render logic does the rest:
  - the card keeps its region and loses the estimated tag;
  - the caption's condition is false;
  - SocietyFacts renders nothing when no figure or confirmed meeting remains.
- **Wiring.**
  - `app/(marketing)/societies/page.tsx` maps its list through the helper.
  - `app/(marketing)/societies/[slug]/page.tsx` calls `withholdPlaceholderProse()` and passes the withheld society to
    SocietyFacts and SocietyAbout.
  - SocietyCard, SocietyFacts, SocietiesClient, SocietiesFallback and show-pages.ts are byte-identical.
- **SocietyAbout.** It gains an optional `withhold` prop (default false):
  - on public, the generic SAOC-voiced fallback prose is not rendered, and neither is its marker;
  - if the society also has no description and no website, the whole section returns null, so the eyebrow is never left over
    nothing;
  - a real Sanity description renders as before.

  The prose goes with its marker because keeping it unmarked would present unconfirmed copy as confirmed. It also repeats
  the unsourced society count that F24 1C already withholds on /societies.
- **Out of scope:** the society page CTA body repeats the same count ("SAOC coordinates 21 affiliated societies"). That is
  left to the lead.

## F2 - the header focus ring reaches 3:1 (WCAG 1.4.11)

Under the lead's ruling (FINAL, 2026-10-18), `focus-visible:ring-ink/40` painted rgb(155,156,150) on the parchment header,
which is 2.49:1. It now uses the handoff's focus token at full strength, `focus-visible:ring-primary` (--primary #384138),
which measures 9.53:1.

- Lines: the 5 focus rings in `components/chrome/Header.tsx` (logo, nav links, Contact, search, menu) and the
  `components/chrome/MegaMenu.tsx` header-bar trigger. `ring-2`, `ring-offset-2` and `ring-offset-parchment` are unchanged.
- Handoff basis:
  - `design/design_handoff_saoc/README.md:192`: "Focus = `--primary` border";
  - `src/styles.css`: `.field input:focus { border-color: var(--primary) }`;
  - `colors_and_type.css:11`: `--primary: #384138`.

  No new colour or opacity.
- Out of scope: the other `ring-ink/40` uses (MegaMenu panel links, MobileMenu, SaocLockup, form and ticket components) are
  left unchanged for the lead.

## F3 - two small-text colours reach 4.5:1

Both edits follow the lead's ruling (FINAL, 2026-10-18), and each is one line.

- **/refunds "PROVISIONAL" sup** (`components/ui/ProvisionalFigure.tsx`):
  - `text-muted` measured 4.44:1 on the mark's tint and becomes `text-primary`, which measures 8.07:1;
  - handoff basis: `.eyebrow` on a tint is --primary (`src/styles.css` `.eyebrow { background: var(--bone); color: var(--primary) }`).
- **404 eyebrow "404 — Page not found"** (`app/not-found.tsx`, NotFoundSection, used by the root 404 and the marketing
  not-found):
  - `text-accent` measured 2.24:1 worst-case on the photographic ground and becomes `text-ivory`, which measures 6.60:1;
  - handoff basis: `.eyebrow--light` is --ivory (`src/styles.css` `.eyebrow--light { color: var(--ivory) }`,
    `colors_and_type.css:20`), the same token as this section's h1.
