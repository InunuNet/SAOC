# Ticket Confirmation Email QR — CID Inline Attachment Fix

## The Problem

The ticket confirmation email displayed a broken-image placeholder instead of the QR code in Gmail and other email clients that do not support `data:` URIs in HTML email. The booking reference QR was being embedded as a `data:image/png;base64,...` URI — a valid data URI that renders fine in browsers, but which Gmail treats as untrusted external content and refuses to display inline.

This affected only the email delivery path. The confirmation landing page (`/tickets/confirmation`) and downloaded ticket canvas both rendered the same QR correctly, since they render inside the browser's own DOM, not an email client.

## Root Cause

Email clients treat `data:` URIs as external content for security reasons. Gmail in particular strips or blocks them to prevent phishing and injection attacks. The QR code was embedded directly as a base64-encoded data URI in the HTML, with no way for the email client to verify or render it safely.

## The Solution: CID-Referenced Inline Attachments

Instead of embedding the QR as a data URI, we now:

1. Generate the QR as a PNG buffer (`generateBookingRefQrPngBuffer`)
2. Add it to the email payload as an attachment with a unique `Content-ID` (CID)
3. Reference it in the HTML using `<img src="cid:qr-{bookingRef}">` instead of a data URI

This pattern leverages email's native MIME structure — attachments are part of the message envelope itself, not external content. Email clients treat CID-referenced inline attachments the same as locally-embedded images, rendering them safely without network requests or proxy concerns.

**Why this matters for future inline email images:** Any future inline assets in email (product images, diagrams, charts) should follow this CID pattern instead of data URIs. Gmail and other modern clients will render CID-referenced attachments reliably; data URIs remain blocked. This is not specific to QR codes — it is a general lesson about email and untrusted content handling.

## What Changed

- **`lib/qr.ts`**: New `generateBookingRefQrPngBuffer()` function that returns a PNG buffer; the existing `generateBookingRefQrDataUri()` remains unchanged (used by confirmation page and download)
- **`lib/email.ts`**: Added `EmailAttachment` type and optional `attachments` parameter to `buildEmailPayload()` and `sendEmail()`
- **`lib/confirmation-email.ts`**: For each order position, generates a PNG buffer, assigns it a unique CID, and passes attachments to the mailer
- **`emails/OrderConfirmation.tsx`**: Changed from `src={qrDataUri}` to `src={`cid:${qrContentId}`}`

## Verification

The fix was verified by:
1. **Automated checks** — asserting that the mailer receives an attachments array with real PNG buffers and valid Content-IDs, and that the rendered HTML contains `cid:` references matching those IDs
2. **Real send test** — Brad sent a test order through the ticketing flow in the sandbox environment and opened the confirmation email in Gmail, confirming the QR code renders correctly (no broken-image placeholder)

See `contracts/golden/ticket-confirmation-email-qr-fix-f1/README.md` for the full decision record, including how this decision reconciles with a prior F11 contract that had evaluated and rejected (flat) attachments, and why CID-referenced inline attachments are a materially different and correct mechanism.

## Security & Side Effects

- The booking reference itself (visible as text and encoded in the QR) remains unchanged — sharing/forwarding behavior unchanged
- No new secrets introduced in the email envelope
- All other email confirmations (`ContactConfirmation`, `VendorApprovalConfirmation`, etc.) are unaffected — the `attachments` parameter is optional and additive
- The visible booking reference text fallback (F11) remains in place; clients that fail to render inline images still have the readable booking ref

## Related Documentation

- [docs/ticketing.md](ticketing.md) — Developer reference for the full ticketing flow
- [docs/email-dns-setup.md](email-dns-setup.md) — Email DNS and SPF/DKIM configuration
- [docs/email-reply-to.md](email-reply-to.md) — Reply-To and sender configuration
- [contracts/golden/ticket-confirmation-email-qr-fix-f1/README.md](../contracts/golden/ticket-confirmation-email-qr-fix-f1/README.md) — Full decision record and reconciliation with prior F11 contract
