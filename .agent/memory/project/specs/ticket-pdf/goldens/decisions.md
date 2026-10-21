# NOS A4 ticket PDF — decisions (architect, 2026-10-22)

Source of truth: Codi's review artifact claude.ai/artifact/1Zc87ALWvhA7eRdVkdq12W, version 1792425877-d0a8, read 2026-10-22 (pages 1-2 plus "How it holds up"). It is the golden; where `codi-ruling.md` prose disagrees, the artifact wins (team-lead relay of Codi, final). Brad is reviewing the artifact; any change is relayed by Codi and triggers a spec revision.

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
Logo: only the header horizontal lockup is needed (the artifact has no footer lockup). Export with sharp from `branding/National Show 2027/Logo/NOS-2027-logo-reversed-gold-horizontal.png` (4108x1008, read-only original) to 1600 px wide as `nos-reversed-gold-horizontal-1600.png`. Do not use the feat/email-shell 560 px email PNG (too small for print).

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
