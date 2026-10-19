# nos-critique-r16

Codi's rulings, FINAL, relayed by the lead (saoc-82) on 2026-10-19. BASE `origin/main` `cea06daf`. Every edit stays inside
`docs/rules/no-invention.md` (no new copy, tokens or colours) and `design/design_handoff_saoc/` (README, `colors_and_type.css`,
`src/styles.css`, `ui_kits/`). Nothing under `branding/` changes.

## F1 - NOS consistency

- **Vendor submit buttons.** "Submit application" (`components/vendors/VendorApplyForm.tsx`) and "Continue"
  (`components/vendors/VendorRegistrationCodeEntryForm.tsx`) were violet `bg-accent` buttons. They now render the NOS `Button`
  (`components/nos/Button.tsx`, default `primary` variant), the same component and class list as "Buy ticket" on
  /national-show/wosa-conference. That gives the royal-primary fill, ivory text, a 2px radius and a 50px height. The labels,
  `disabled` and pending logic, and the surrounding markup are unchanged.
- **"Back to tickets" target.** Both copies (`app/(marketing)/tickets/confirmation/page.tsx`,
  `components/tickets/ConfirmationPoller.tsx`) gain `py-0.5` only. That takes the link from 21.7px to about 25.7px tall, over the
  24px target-size floor. The width, font and underline are unchanged.
- **Sentence case.** The h1, title, og:title and subnav label follow the h1 (T3/R64), with proper nouns kept, through 23 exact
  line edits:
  - /national-show/exhibitors becomes "Exhibitor information";
  - /national-show/vendors becomes "Exhibitors and vendors", and its h2 "Showcasing the finest in South African orchid growing";
  - /national-show/vendors/apply becomes "Vendor application";
  - /national-show/vendors/register becomes "Vendor registration";
  - /national-show/vendors/payment and its status page become "Vendor stand payment";
  - /national-show/vendors/photos becomes "Vendor product photos".

  The `components/chrome/nav-config.ts` entry is one string, so the SAOC MegaMenu, mobile menu, NosShowIndex and breadcrumb
  JSON-LD follow it. The lead ruled that this single label change is intended. It supersedes the r13 "Vendor Stand Payment"
  title pin.
- **The Exhibitor h1 comes from the CMS (lead ruling, 2026-10-19).** /national-show/exhibitors renders Sanity
  `showExhibitorInfo.title`.
  - The lead had the title edited in Studio to "Exhibitor information" (`_rev b293KmNbo0z5K9RnfmAhlk`).
  - Only the code fallbacks changed here. The CMS value is not overridden in code.
- **"← Show overview" removed** from /national-show/exhibitors, following the R38 #4 precedent.
- **Programme cards on /national-show/programme.** The page renders the tickets hub's own Programme section: `TicketSection
  id="programme"` with `TicketCard`s for the Symposium, WOSA and Workshops. It uses the same keepsake components and the same
  data (`loadTicketCardViewModels`, `buildSectionLedes`, `PROGRAMME_PRODUCTS`, now exported from
  `lib/data/ticket-presentation.ts` so the hub and this page share one list).
  - The section sits before the "Explore the show" index.
  - The h1 stays "Programme".
  - No copy is new.

## F2 - SAOC chrome on the root 404, handoff primary on the /sponsors CTA

- **Root 404 (`app/not-found.tsx`).** An unmatched URL used to render with no header or footer, leaving a 260px empty band. It
  now composes the SAOC chrome the way `app/(marketing)/layout.tsx` does: `SkipLink`, `UtilityBar`, `Header`, one
  `main#main-content` and `Footer`, all from `@/components/chrome`. The hero ends where the footer begins.
  - The buttons read "Go home" and "Find a society" (sentence case) on both 404 routes.
  - The r15 eyebrow keeps `text-ivory`.
  - The status stays 404.
- **/sponsors CTA.** "Talk to us about sponsorship" moves from `bg-ink` with a square corner to the handoff primary button:
  `bg-primary`, hover `bg-primary-800`, and `rounded-[length:var(--radius-1)]`. Source: `src/styles.css` `.btn` (2px radius) and
  `.btn--primary`, and `colors_and_type.css` `--primary #384138` and `--radius-1: 2px /* buttons, inputs */`. The label and href are
  unchanged.

## F3 - SAOC content wiring

- **/media-kit "Brand assets"** shows exactly three tiles, in this order:
  1. "Full lockup — emblem and name": `/images/saoc-lockup-horizontal-full-name.png`, 3757×493.
  2. "Emblem — full colour": `/images/Eulophia-speciosa-emblem.png`, 1254×1254.
  3. "Emblem — for dark backgrounds": `/images/saoc-emblem-footer-lapis-2x.png`, 640×618, previewed on `--primary-800`.

  Every file is served byte-identical: no recolour and no derivation. The paper/brass lockup set and the old kit emblem path are
  retired from the kit. The grid is three columns at desktop.
  - **8(b) provenance (lead ruling, 2026-10-19).** The full-colour emblem is Brad's consolidated
    `branding/SA Orchid Council/emblem/Eulophia-speciosa-emblem.png`, which is not committed to git. It was copied byte for byte
    from the lead's staged copy (sha256 `c64e8041…ce3f`, 1,153,179 bytes, verified with `goldens/emblem-8b.sha256`). Nothing
    under `branding/` is added, deleted or committed.
  - **Tile descriptions (lead ruling, 2026-10-19).** The tiles reuse the existing BASE sentences, so no copy is new:
    - (a) "Emblem and wordmark, for light backgrounds.";
    - (b) "The SAOC mark on its own, transparent background.";
    - (c) has no description.

    The format line (PNG · W×H · transparent) is read from each file, and all three are RGBA PNGs.
- **"What's on" rows are one link each.** On / (`components/ui/EventRow.tsx`, fed by `EventsStrip`) and on /events
  (`components/events/EventCard.tsx`), each row is now a single link to `/events/<slug>`. Its accessible name is exactly the
  event title (`aria-label`), and nothing interactive sits inside or beside it.
  - On /, the aria-hidden arrow stays inside the link.
  - The hover background moved onto the link, on both routes.
  - A home row without a slug renders unlinked, as before.
  - **Lead-confirmed as written (2026-10-19):**
    - The National Show row goes to `/events/19th-south-african-national-orchid-show`, rather than `eventHref`'s
      /national-show. The /events JSON-LD still uses `eventHref`, unchanged.
    - On /events, the host society name is plain text inside the row link, so each row is one link.
