# F4 Ticket stub redesign: golden spec

Source: Brad, 2026-11-11, verbatim: "We can use the XIX to depict the 19th, but then we need to say
National Orchid Show or National something. Doesn't need to be as long as it's on the main stub of
the ticket. You can have creative... autonomy on the ticket stub, put an orchid, put something
beautiful on there, because it's a stub." Earlier: "XIX stays on the tickets... It's a decorative
design little thing, and shall not be replaced."

## Required

1. The decorative XIX numeral stays on the stub. Not replaced, not removed.
2. A short label reads exactly `National Orchid Show` as real embedded text (Karla-Bold). `caps()`
   uppercases, so draw it with `drawText` so the extracted text reads `National Orchid Show`. It sits
   directly under or beside the XIX so the two read as one mark. The full event name stays on the main
   body of the ticket as today.
3. One orchid treatment from ONE approved asset only:
   `branding/National Show 2027/emblem/Disa graminifolia.png` (1254x1254 RGBA, the NOS emblem orchid).
   Not the 10032px large files. Downscale once to 600x600 and commit as
   `lib/ticket-pdf-assets/disa-graminifolia-600.png` (assertion A20 looks for a 600x600 image in the PDF).
4. On-screen ticket (`components/tickets/keepsake/parts.tsx` TicketStub, caption `nk-numlab`): XIX keeps
   `data-ticket-numeral`; the caption reads `National Orchid Show` for XIX products. Reuse the existing
   `TICKET_EMBLEM` or the same PNG; no other new image.

## Placement and restraint (apply the impeccable, frontend-design and accessibility skills)

- PDF: `drawStub`/`drawSchedule` in `lib/ticket-pdf.ts`. Orchid drawn FIRST (behind text) in the stub
  area left of `PERFORATION_X`, low presence (pdf-lib `opacity` 0.12 to 0.18), fitted wholly inside the
  stub panel (no bleed off any edge, no clipping; amended 2026-11-11 by orchestrator ruling) so it reads
  as a quiet flourish, not a second logo.
- It never enters `TICKET_PDF_QR_BOX_MM`, the booking ref, the `SCAN AT THE DOOR` line or the attendee
  name block, and never crosses the perforation.
- Contrast with the orchid at final opacity: label 4.5:1, XIX 3:1. Label at least 7pt.
- Print legibility: legible in greyscale on a laser printer; no text over dense orchid detail.
- Colours and fonts: existing tokens only (ROYAL, OLIVE, INK, MUTED; Fraunces + Karla). No new colour
  or font. Logo fonts are logo-only.
- Restraint: one orchid, one label; no new rules, borders or ornaments.

## Which tickets show it

ALL 8 ticket types carry the XIX numeral, the `National Orchid Show` label and the orchid (Brad:
"XIX stays on the tickets"; "put an orchid... because it's a stub"). No current sample ticket prints
XIX (pdftotext returns 0 hits on all). @dev makes the stub render these on every ticket regardless of
product kind, in `lib/ticket-pdf.ts` and, where the numeral is gated on `kind === 'event'`,
`lib/ticket-pdf-data.ts`, and in the on-screen stub. A23 checks all eight PDFs. Say in the dev result
what the stub shows for tickets with a buyer-chosen day numeral (23, 24): XIX is the show-wide mark
and stays alongside it.

## Out of scope

Checkout, email bodies, F1 to F3 behaviour, `lib/ticketing-test-mode.ts`, any copy beyond
`National Orchid Show`.

## Review artefact

A24 renders page 1 of the Symposium ticket to `.tmp/sandbox/ticket-stub/stub-symposium.png`; view it
before reporting.
