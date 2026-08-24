import { toBuffer, toDataURL } from 'qrcode';

/**
 * F11 (ticketing-foundation) — QR generation for the confirmation email (spec §6, §7.1).
 *
 * Encodes the position's `bookingRef` VERBATIM — the plain, unsigned booking reference — as a
 * PNG data URI. This is confirmed-correct-as-designed per spec §7.1/§6, not a placeholder
 * pending a signed secret: the booking reference is a door code, not a wallet key, and
 * `lib/checkin.ts`'s `admit()` looks a ticket up by exactly this field
 * (`where('bookingRef', '==', bookingRef)`), never by Firestore document id.
 */
export async function generateBookingRefQrDataUri(bookingRef: string): Promise<string> {
  if (bookingRef.trim().length === 0) {
    throw new Error('generateBookingRefQrDataUri: bookingRef must not be empty');
  }
  return toDataURL(bookingRef, { type: 'image/png' });
}

/**
 * ticket-confirmation-email-qr-fix (F1) — QR generation for the confirmation EMAIL only.
 *
 * Same bookingRef-verbatim encoding as generateBookingRefQrDataUri above, but returns a raw
 * PNG Buffer for use as a Resend CID-referenced inline attachment, not a data: URI — Gmail (and
 * likely other clients) mishandles data: URIs in HTML email. lib/orders.ts's confirmation-page
 * render and DownloadTicketButton.tsx's canvas download are unaffected and keep using
 * generateBookingRefQrDataUri.
 */
export async function generateBookingRefQrPngBuffer(bookingRef: string): Promise<Buffer> {
  if (bookingRef.trim().length === 0) {
    throw new Error('generateBookingRefQrPngBuffer: bookingRef must not be empty');
  }
  return toBuffer(bookingRef, { type: 'png' });
}
