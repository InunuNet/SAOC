import { resolveReplyTo } from '@/lib/email';

/**
 * The National Orchid Show's contact constants, the single home for what a ticket or email prints
 * about reaching the show. Lee-Ann's Contact document (24 Oct 2026) gave the telephone number and
 * asked which email address to use; the answer is still open, so the address is behind one switch.
 */

/** The show co-ordinator's number, spaced as she wrote it in her Contact document. */
export const SHOW_OFFICE_PHONE = '073 428 4398';

/**
 * Flip to true only when Brad and Lee-Ann confirm the show mailbox. While false the Questions line
 * keeps printing the SAOC address and the show address is printed nowhere.
 */
export const SHOW_EMAIL_CONFIRMED = false;

export function resolveShowQuestionsEmail(confirmed: boolean = SHOW_EMAIL_CONFIRMED): string {
  return resolveReplyTo(confirmed ? 'nos' : 'saoc');
}

/** The show venue's address, the two lines exactly as Lee-Ann wrote them in her Contact document. */
export const SHOW_ADDRESS_LINES: readonly string[] = [
  'Stellenbosch Airfield',
  'Hangar 25, Orca Aero Solutions, Stellenbosch Airfield, Stellenbosch, Western Cape.',
];

/** Her line beside the number: who answers it. */
export const SHOW_OFFICE_CONTACT_LINE = 'Lee-Ann McCleland - Show co-ordinator';

/** The number as a tel: link target (South African mobile, international form). */
export const SHOW_OFFICE_PHONE_HREF = 'tel:+27734284398';
