# Codex adversarial review: ticket-pdf

Review the full diff (lib/ticket-pdf.ts, lib/ticket-pdf-data.ts, lib/ticket-pdf-access.ts, lib/ticket-pdf-assets/,
app/api/tickets/pdf/route.ts, lib/confirmation-email.ts, lib/email.ts, components/tickets/DownloadTicketButton.tsx,
app/(marketing)/tickets/confirmation/page.tsx, next.config.ts, package.json/pnpm-lock) against
.agent/memory/project/specs/ticket-pdf/goldens/decisions.md and layout-spec.md (the Codi artifact 1Zc87ALWvhA7eRdVkdq12W v1792425877-d0a8 is the golden; the ruling's fold rule/royal footer band are NOT to be built).
Hunt for:
1. ACCESS: any way to obtain another order's PDF or ticket data: `position` param not constrained to the resolved order's positions,
   a bookingRef accepted without the order ref, differing 404 bodies/statuses (oracle), unpaid/reserved orders served, buyer
   name/email/amount/recovery token reaching the PDF, ref values logged in full, cacheable responses (Cache-Control must be private, no-store).
2. EMAIL: a PDF failure that can still block or throw out of sendConfirmationEmail; attachment mishandled (contentId, contentType, filename
   injection from order data); QR inline attachments changed; the pinned ITN route edited.
3. COPY: any visible PDF string not in goldens/copy-baseline/allowed-strings.txt or fixture data; invented dates/times/gates/phone numbers
   instead of the "To be confirmed" pill; review-only dashed orange outlines left in.
4. PDF: non-embedded fonts, text drawn as images, letter-spacing done per glyph (breaks extraction), QR not vector or quiet zone < 4 modules,
   QR encoding anything but the bookingRef verbatim, wrong page size, bands overlapping, a page that can overflow when a name is very long
   (name must shrink/wrap inside the stub, never run under the QR tile).
5. DEPLOY: assets not traced into the App Hosting bundle (next.config outputFileTracingIncludes), unpinned pdf-lib/fontkit, headless browser
   or native dependency introduced, canvas/PNG download code left behind in DownloadTicketButton.tsx.
6. Existing wording changes anywhere else (emails/OrderConfirmation.tsx must be untouched).
Verdict PASS/FAIL with file:line findings.
