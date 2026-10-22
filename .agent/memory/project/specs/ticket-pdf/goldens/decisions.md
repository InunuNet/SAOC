# NOS A4 ticket PDF — decisions (architect, 2026-10-22)

Source of truth: Codi's review artifact claude.ai/artifact/1Zc87ALWvhA7eRdVkdq12W, version 1792425877-d0a8, read 2026-10-22 (pages 1-2 plus "How it holds up"). It is the golden; where `codi-ruling.md` prose disagrees, the artifact wins (team-lead relay of Codi, final). Brad's review (brad-review-2026-10-22.md) supersedes the artifact wherever they conflict: new header logo, condensed footer on the page ground, emergency as a one-line footnote, Organiser/Questions as small footer text, instruction line "Present this ticket at the door for check in."

## D1. Library: pdf-lib 1.17.1 + @pdf-lib/fontkit 1.1.1 (exact pins, no caret)

Neither is in package.json or pnpm-lock today (`pnpm add -E pdf-lib@1.17.1 @pdf-lib/fontkit@1.1.1`).

| | pdf-lib | @react-pdf/renderer |
|---|---|---|
| Runtime | pure JS, no wasm, no native, no headless browser | yoga-layout wasm + React reconciler; React 19 / Next 16 server bundling is a known friction point |
| Layout | explicit coordinates: maps 1:1 to the mm measures in the ruling | flexbox: faster to write, harder to hit mm exactly and keep one page per ticket |
| Fonts | embeds TTF/OTF subsets via fontkit; text stays real text | same, weaker variable-font handling |
| Risk | upstream idle since 2021 (stable; generation-only use, never parses untrusted PDFs in production) | larger tree, more moving parts on App Hosting |

Chosen: pdf-lib. Letter-spacing (.08em on the booking ref) via the `setCharacterSpacing` operator (`Tc`), NOT per-glyph
drawing, so text extraction stays whole. QR is drawn as vector rectangles from `QRCode.create(ref).modules`
(`qrcode` is already a dependency), not as a bitmap.

## D2. Endpoint and access rule

`GET /api/tickets/pdf?ref=<order reference>[&position=<bookingRef>]` -> `app/api/tickets/pdf/route.ts`.

Today's proof of ownership on the confirmation page is exactly one thing: the order reference (`m_payment_id`,
a 60-bit random `SAOC-2027-XXXXXXXXXXXX` capability value) in `?ref=`, resolved by `getConfirmedOrderForDisplay(ref)`,
which fails closed unless the order is `paid` and at least one position is `paid`/`checked-in`. No login, no second token.
The PDF endpoint is no weaker and no broader:

1. `ref` must be non-empty and resolve through `getConfirmedOrderForDisplay` to a paid order. Otherwise 404.
2. Only that order's positions are rendered. `position`, when given, must equal the bookingRef of one of THOSE
   positions (render that single page). Any other value, including another order's valid bookingRef, is 404.
3. A bookingRef alone (no order `ref`) is never accepted: `ref` is only matched against orders' `m_payment_id`,
   so a per-ticket door code cannot fetch a PDF.
4. Every failure (missing, unknown, unpaid, wrong position) returns the SAME 404 with the SAME body: no 403/404 oracle.
5. The PDF contains only what the confirmation page already shows for that order (attendee name, ticket type, booking
   reference, QR) plus public show information. No buyer name, email, amount or recovery token.
6. Headers: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="saoc-ticket-<ref>.pdf"`
   (single position: `saoc-ticket-<bookingRef>.pdf`), `Cache-Control: private, no-store`, `X-Robots-Tag: noindex`.
7. The decision lives in a pure function `authoriseTicketPdfRequest` (lib/ticket-pdf-access.ts) with an injected
   `getConfirmedOrder`, so the check script exercises it without Firestore. route.ts exports only GET (Next rule).
8. Never log `ref` or a booking ref beyond an 8-char prefix.

## D3. Email attachment

`lib/confirmation-email.ts` `sendConfirmationEmail` adds a PDF attachment (`application/pdf`,
`saoc-ticket-<orderReference or first bookingRef>.pdf`) beside the existing inline QR PNG attachments (unchanged).
- New optional dep `buildTicketPdf?: (input: TicketPdfInput) => Promise<Uint8Array>` in `SendConfirmationEmailDeps`
  (default = the real builder fed by `loadTicketPdfVisit()`).
- The PDF step has its own try/catch: on ANY throw/reject it `console.error`s the operation name and error
  type/message (no refs, no tokens) and sends the email WITHOUT the PDF. Never rethrows. The QR attachments and the
  existing "empty positions throws" guard are untouched.
- `EmailAttachment.contentId` becomes optional (`contentId?: string`) in lib/email.ts; `buildEmailPayload` already passes
  attachments straight to Resend.
- `SendConfirmationEmailInput` gains optional `orderReference?: string` (footer "ORDER ..." segment and filename). If the
  pinned ITN call site cannot supply it without editing a pinned file, omit it: the PDF drops the "ORDER ..." segment
  and keeps "PAGE n OF N". Do not edit the pinned ITN route to add it.
- emails/OrderConfirmation.tsx wording is NOT changed here (email-shell owns that file on feat/email-shell; the two
  branches touch different regions of lib/confirmation-email.ts / lib/email.ts only if email-shell edits them: it does not).

## D4. One page per ticket position; a multi-ticket order is a multi-page PDF. "Ticket n of N" counts positions in that PDF.

## D5. Confirmation page download

`components/tickets/DownloadTicketButton.tsx` stops compositing a canvas PNG and renders a link to
`/api/tickets/pdf?ref=<order reference>&position=<bookingRef>` (page.tsx already has `confirmedOrder.reference`).
The `label` prop and the page's existing default `'Download ticket'` / Sanity `downloadTicketButtonLabel` are unchanged.
aria-label "as an image" becomes "as a PDF" (functional text). Canvas code, `loadImage`, `.png` filename and the stale
header comment are removed (leave nothing dead).

## D6. Fonts and assets (nothing downloaded)

APPROVED (Codi/team-lead, 2026-10-22): vendor fonts from @fontsource. Use the static (non-variable) files: `@fontsource/karla` 400 and 700,
`@fontsource/fraunces` 300 (latin subset). @fontsource ships .woff/.woff2 (no .ttf); @pdf-lib/fontkit reads .woff, so copy the .woff files
into `lib/ticket-pdf-assets/` and embed with `subset: true`. Install the @fontsource packages as exact-pinned devDependencies only to
obtain the files (nothing imports them at runtime), or copy once and commit the files; record package versions in a comment/README line.
If .woff cannot be embedded, the existing `Fraunces-Light.ttf` / `Karla-Bold.ttf` under `app/(marketing)/national-show/og/fonts/` remain a fallback.
Body prose must never use a standard-14 PDF font (A7 fails any non-embedded font).

Copy the font files and the logo export into `lib/ticket-pdf-assets/` (tracked); load with
`readFile(path.join(process.cwd(), 'lib/ticket-pdf-assets', name))`. Add `outputFileTracingIncludes['/api/tickets/**'] =
['lib/ticket-pdf-assets/**']` in next.config.ts (App Hosting has dropped untraced files before: see the semver note there).
Logos (Brad review (a)-(c), 2026-10-22): TWO assets, from `branding/National Show 2027/Logo/` (read-only originals), exported with sharp into `lib/ticket-pdf-assets/`:
header `NOS-2027-logo-full-colour-reversed-horizontal.jpg` (4108x1008, pre-composited on #221A56; do NOT crop or recolour) -> 1600 px wide JPEG (q>=90) as
`nos-full-colour-reversed-horizontal-1600.jpg`; footer mark `NOS-2027-logo-ink-purple-vertical.png` -> ~600 px wide PNG as `nos-ink-purple-vertical-600.png`
(drawn 16 mm tall, only beside the footer text). No big footer lockup. Do not use the feat/email-shell email PNGs.

## D7. Data

- `lib/ticket-pdf.ts`: `buildTicketPdf(input: TicketPdfInput): Promise<Uint8Array>`; no I/O except font/logo reads.
  Types are fixed by goldens/fixture-order.json (export `TicketPdfInput`, `TicketPdfPosition`, `TicketPdfVisit`).
- `lib/ticket-pdf-data.ts`: `loadTicketPdfVisit(): Promise<TicketPdfVisit>` assembles venue/dates/hours/emergency from the
  existing Sanity data (`showVisitorInfoQuery`, `nationalShowVenueQuery`, show facts). Any value not in that data is `null`
  and renders as the pill "To be confirmed" (Sanity `pendingLabel` if set). Nothing is invented. Loader failure -> all null.
- Per-position day/date label: from the position's `chosenDay` or the ticket type's own window; unknown -> the pill.

## D8. Supersession

The "Download format decision — composited PNG, not PDF" in
`.agent/memory/project/specs/confirmation-page-qr-and-download/goldens/f1-confirmation-qr-details-download.golden.md`
(l.119-143, and l.202 "No PDF generation") is SUPERSEDED by Brad's request via Codi's ruling (2026-10-22). Its A6 download
sub-case (decode the downloaded PNG with jsqr/pngjs) no longer applies to the button; this mission's `qr` check is the
successor (same jsqr/pngjs decode, on the PDF rasterised at 150 dpi). @docs appends a one-line "superseded by ticket-pdf"
pointer to that golden. The old contract's download sub-case (execution/checks/verify_confirmation_page.ts) will fail on
the PNG button: @dev notes it in the dev result; it is not part of this gate.

## D9. Ordering (like email-shell A17)

Codi must approve the rendered PDF before anything ships. `.tmp/sandbox/ticket-pdf/codi-approval.txt` must exist and its
mtime must be >= the mtime of `.tmp/sandbox/ticket-pdf/fixture.pdf` (approval of the render that exists now), and the
`review-order` check runs before the codex_qa and any push/deploy. The orchestrator relays fixture.pdf + page-1.png to Codi
and writes the approval text into that file.

## D10. Codi's final rulings after the build (verbatim relay via team-lead, 2026-10-22; approvals c8529cf2, 4f1a1341, 2c8064af in .tmp/sandbox/ticket-pdf/codi-approval.txt)

These record the shipped layout and supersede layout details above wherever they differ (layout-spec.md is amended to match).
1. Instruction line 8mm under the ticket card. It is no longer at y~250. The visit row moves down to make room, and the 45mm ground above the bottom-anchored footnote and footer is accepted.
2. The Organiser line is dropped from the footer. Footer line 3 is "Show office" + pill, line 4 is Questions. All footer text is 9pt.
3. REG line: "REG# 1978/004040/08 · NPO 043-901".
4. The left booking-ref block is removed. The ref appears only under "Scan at the door".
5. The footer mark (ink-purple vertical) is 16mm. The header uses the full-colour reversed horizontal PNG export at 1600px (the approved equivalent of the .jpg named earlier, from branding/National Show 2027/Logo/), offset so the artwork edge sits on the 13.9mm text edge. Codi approved the render.
6. Pills: 7pt minimum, sentence case as written, tracking 0. They wrap inside the outline for long pendingLabel values and are never truncated (R7).
Also accepted by Codi: QR decode gate A8 (jsQR, 150 dpi raster, exact ref match) for tonight; no tagged structure tree or logo alt text (pdf-lib limitation, backlogged); phone-camera scan at print size is on Brad's morning list.

## D11. Codi's rulings, 2026-10-22 (verbatim relay via team-lead)

1. Pills stay 7pt everywhere, the footer included. A pill is a state marker, and the more specific rule wins over "all footer text 9pt". Codex flagged lib/ticket-pdf.ts:765/1350 for this; it is ruled, not a defect.
2. Tickets with no chosenDay. Codi: "never show a placeholder for known data". A weekend or multi-day pass valid for the whole show must print the show date range exactly as Sanity gives it. The pill is only for a ticket whose own date is genuinely unconfirmed, e.g. WOSA Conference or Symposium with no date in Sanity. If the data can't tell those apart, key it on the ticket type's date source: a show-span type gets the range; a session type with no date gets the pill.

### D11 rev (supersedes the rule that stood here; Codi rejected e8ec042c, confirmed in the repo by team-lead, 2026-10-22)

Codi rejected the "admission gets the show range" rule. The dates already exist in `lib/data/ticket-presentation.ts` (`TICKET_PRODUCTS`, `productIdForSlug`), the same source the live tickets page prints. The earlier rule was wrong in three ways:
- `vip` is kind 'event' at "Thursday 23 September", "16h00 to 19h00"; it was given the show range, which is wrong at the door.
- `sunset-cocktails-single` is kind 'event' at "Thursday 23 September", "18h00 to 21h00" (published); it was given the pill.
- `weekend-pass` and `weekend-pass-early-bird` are kind 'pass' with when "Friday 24 to Sunday 26 September", meta "Entry on all three show days"; the range "Thursday 23 to Sunday 26" was wrong for them.
(My earlier live-Sanity table is withdrawn; Sanity carries no dates for these types.)

Rule: `lib/ticket-pdf-schedule.ts` exports a pure `resolveTicketSchedule(type: { slug: string; requiresDaySelection?: boolean | null }, chosenDay: string | null): { kind: 'chosen-day' | 'product' | 'unconfirmed'; dateText: string | null; metaText: string | null }`, with `productId = productIdForSlug(type.slug)`:
1. `type.requiresDaySelection === true` (early-bird, day-visitor): `chosen-day`, dateText = the formatted `chosenDay` (existing show-day-format helper), metaText null. If chosenDay is unset: `unconfirmed` (pill), never the product's "Friday, Saturday or Sunday".
2. else if the product kind is 'event' or 'pass': `product`, dateText = the product's `when` and metaText = its `meta`, EXACTLY as written in TICKET_PRODUCTS (vip -> "Thursday 23 September" + "16h00 to 19h00"; sunset-cocktails-single -> "Thursday 23 September" + "18h00 to 21h00"; weekend-pass and weekend-pass-early-bird -> "Friday 24 to Sunday 26 September" + "Entry on all three show days").
3. else ('programme', 'workshop', or no product mapped, e.g. field-trip, test and legacy types): `unconfirmed`, null, null: the pill, no date (their published text is "Dates to follow" / "Schedule to follow").
Render: dateText -> the stub's date line, metaText -> its time line, no pill; null -> the "To be confirmed" pill. The email loader (and the route loader) must call the same function; the loader maps each position's ticket-type slug and requiresDaySelection from Sanity and chosenDay from the ticket doc. `TicketPdfPosition` gains `slug: string` (see fixture-order.json).

Fixture (page order): VIP, Sunset Cocktails, Weekend Pass, National Orchid Show Symposium.

A30 (`schedule`): (a) the function over every product slug against TICKET_PRODUCTS (exact strings), the two day-selection slugs with and without a chosenDay, and unmapped/programme/workshop slugs; VIP's text never contains 24/25/26; (b) on the rendered fixture, inside the ticket stub: VIP shows "Thursday 23 September" and "16h00 to 19h00" and none of 24/25/26; Sunset shows its when and meta and no pill; Weekend shows "Friday 24 to Sunday 26 September" and its meta, no pill, no "Thursday"; Symposium shows the pill and no date words.
