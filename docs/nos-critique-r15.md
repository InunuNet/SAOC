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
- **Amendment (lead ruling, FINAL 2026-10-18): the society page CTA body.** That body repeats the same unsourced count
  ("SAOC coordinates 21 affiliated societies across South Africa. …").
  - It is now `body={withhold ? undefined : '<the BASE sentence>'}` on the same `withhold` const, the idiom /about's CTA uses.
  - There is no `marked` prop, so the beta preview stays unchanged.
  - The band keeps its eyebrow, heading and both buttons. `CTASection` already omits an absent body, and CTASection.tsx is
    unchanged.

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

## F2b - the remaining SAOC focus rings reach 3:1 (WCAG 1.4.11)

The lead's ruling (FINAL, 2026-10-18) finishes what F2 started. The remaining SAOC uses of `focus-visible:ring-ink/40`
measured 2.44-2.49:1. They now use `focus-visible:ring-primary`: the handoff's focus token at full strength (--primary
#384138, `design/design_handoff_saoc/README.md:192` "Focus = `--primary` border"). It is one substitution per line on 18 lines,
and nothing else changes in those files.

- `components/chrome/MegaMenu.tsx`: the five panel lines (111, 118, 153, 268, 269).
- `components/chrome/MobileMenu.tsx`: the ten off-canvas drawer lines (126, 145, 180, 181, 200, 226, 252, 293, 306, 318).
- `components/contact/ContactForm.tsx:195` and `components/members/SuggestionForm.tsx:171`.
- MegaMenu.tsx:118 and MobileMenu.tsx:226 render only for a nav column with a `headingHref`, and every column has none today.
  They take the substitution but have no rendered stop.
- The 3:1 claim covers the SAOC lines above, not `components/tickets/DownloadTicketButton.tsx:110`. That button renders on
  /tickets/confirmation, which sits inside `.nos-theme` (`app/(marketing)/tickets/layout.tsx`). There the
  `nos-theme.css:257` reset sets `box-shadow: none`, so its ring is suppressed, and the NOS outline is its focus indicator,
  as on the vendor forms below (Codi's lane). Its class was still swapped to `ring-primary` for token consistency, with no
  visible effect. It is checked statically only: it renders only for a confirmed order, which the rendered check cannot
  reach.

Exclusions (byte-unchanged, keeping `ring-ink/40`):

- **`components/chrome/SaocLockup.tsx`.** This is the footer lockup on `bg-primary-800`. A --primary ring there would measure
  only 1.42:1. Its focus indicator is the white ring-offset band, which measures 15.09:1 against the footer. f2b-rendered R5
  guards that band at 1280 and 390.
- **The ten `.nos-theme` vendor components** (`components/vendors/*`). These render only under `.nos-theme`. There, the
  unlayered reset `.nos-theme :focus-visible:not(.group)` (`app/(marketing)/national-show/nos-theme.css:257`) removes the
  box-shadow and paints its own outline, so the ring class is dead. NOS focus is Codi's lane.
- **`nos-theme.css` itself.** Its one match is a comment inside that reset block, not a class use.
