import { randomBytes } from 'node:crypto';

/**
 * Crockford base32 — no I, L, O or U, so a reference survives being read aloud or
 * hand-copied at a door without ambiguity.
 * See contracts/golden/ticketing-hardening/booking-ref-format.golden.txt.
 */
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Human-recognisable on a bank statement and in the PayFast merchant dashboard. */
export const BOOKING_REF_PREFIX = 'SAOC-2027-';

/** 12 chars x 5 bits = ~60 bits of entropy. */
const RANDOM_SEGMENT_LENGTH = 12;

/**
 * The booking reference is simultaneously the door code and the PayFast
 * `m_payment_id`, so it must not be enumerable. The previous form was
 * `SAOC-2027-` + 6 digits: a 1,000,000-value space that can be walked, and small
 * enough to collide by birthday paradox after a few hundred sales.
 *
 * The 5-bit mask is exact for a 32-symbol alphabet, so the length guard in the loop is
 * unreachable today — 32 divides 256 and every masked byte lands inside the alphabet. It
 * is retained on purpose: shorten the alphabet and the guard becomes live rejection
 * sampling, where `byte % length` would silently bias the distribution instead.
 */
export function generateBookingRef(): string {
  let segment = '';
  while (segment.length < RANDOM_SEGMENT_LENGTH) {
    const bytes = randomBytes(RANDOM_SEGMENT_LENGTH);
    for (const byte of bytes) {
      if (segment.length === RANDOM_SEGMENT_LENGTH) break;
      const index = byte & 0x1f;
      if (index < CROCKFORD_ALPHABET.length) segment += CROCKFORD_ALPHABET[index];
    }
  }
  return `${BOOKING_REF_PREFIX}${segment}`;
}
