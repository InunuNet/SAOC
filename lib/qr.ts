import { toDataURL } from 'qrcode';

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
