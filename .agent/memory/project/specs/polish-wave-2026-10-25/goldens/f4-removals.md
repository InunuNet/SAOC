# F4 — removals only, no new copy

## Specification
1. components/judging/JudgesDirectory.tsx:21-22. Delete the clause "Log in through your affiliated society". Deleting only that clause
   leaves ", or get in touch with the council directly." which cannot start a sentence, so the paragraph becomes exactly:
   `The full accredited judges directory is available to SAOC members. Get in touch with the council directly.`
   Every word is already on the page; one comma, "or" and a capital change. Keep the existing "Contact SAOC →" link. See COPY GAP in README.
2. NOS /programme H2 duplicates the H1. TicketSection (components/tickets/keepsake/TicketSection.tsx) gains `hideHeading?: boolean` (default
   false). When true it renders no `<h2>`, drops `aria-labelledby`, and sets `aria-label={title}` on the `<section>`. app/(nos)/national-show/programme/page.tsx
   passes `hideHeading` on its single TicketSection. The tickets hub and /workshops keep their visible H2 (the static check fails if they get the prop).
   Keep the `.nk-head` lede if one is present (programme passes none today). No other change.
3. app/(marketing)/sponsors/page.tsx:67 — remove `eyebrow="Our sponsors"` (heading stays "Sponsors"). In the "Become a sponsor" card
   (page.tsx:145-156) the body must be left-aligned at every width: wrapper `items-start` (not `items-center`), the `<p>` `text-left` and no
   `mx-auto`; the `<h2>` carries `text-center` so the heading stays centred when the section's `text-center` is removed. Only the body moves.
   (The body renders on the beta preview only; the public build withholds it, so this is verified statically.)
4. YearbookStrip: EXCLUDED, see README. Do not touch components/home/YearbookStrip.tsx.
5. Docs: docs/polish-wave-f4-removals.md — the four edits and the COPY GAP.

## Checks
f4-removals-static.mjs (exact judges sentence, hideHeading wiring and scope, sponsors tokens), f4-removals-rendered.mjs (/judging, /programme,
/sponsors x 4 viewports: no "Log in through", one h1 and no duplicate h2 with aria-label section kept, no "Our sponsors" element, no overflow).
Baseline red on all three pages.
