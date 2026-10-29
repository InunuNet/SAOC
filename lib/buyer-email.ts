/**
 * The one canonical buyer identity, used for BOTH the per-buyer checkout request limit and the
 * held-seat buyerKey stamp, so plus-tagged and gmail dot variants of one mailbox are one buyer.
 *
 * Trims and lowercases; strips everything from the first `+` in the local part (unless that would
 * empty it); for exactly gmail.com and googlemail.com removes local-part dots and folds
 * googlemail.com to gmail.com. Malformed input (no `@`, or more than one) is only trimmed and
 * lowercased: validation lives elsewhere. Idempotent.
 */

const GMAIL_DOMAIN = 'gmail.com';
const GOOGLEMAIL_DOMAIN = 'googlemail.com';

export function normalizeBuyerEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  let local = parts[0];
  let domain = parts[1];

  // anchor: buyer-plus-strip
  const plus = local.indexOf('+');
  if (plus > 0) local = local.slice(0, plus);

  if (domain === GMAIL_DOMAIN || domain === GOOGLEMAIL_DOMAIN) {
    // anchor: buyer-gmail-dots
    const folded = local.replaceAll('.', '');
    local = folded;
    domain = GMAIL_DOMAIN;
  }
  return `${local}@${domain}`;
}

/**
 * The checkout buyer limiter key: the (trusted-hop actor, normalised email) pair, JSON-encoded so
 * no separator can collide. There is deliberately no global per-email key: knowing someone's
 * address gives no lever over them from another address. The result is only ever a hash input.
 */
export function buyerPairKey(actorKey: string, rawEmail: string): string {
  // anchor: buyer-pair-actor
  return JSON.stringify([actorKey, normalizeBuyerEmail(rawEmail)]);
}
