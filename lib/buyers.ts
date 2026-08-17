/**
 * `buyers/{uid}` document shape and POPIA newsletter consent recording. See
 * contracts/golden/ticketing-f5-buyers/README.md for the decision record (spec §8.2-§8.4, §8.6).
 *
 * Pure, side-effect-free construction module — no Firebase Admin SDK, no Firestore read or
 * write, no network. Mirrors the pattern established by lib/admin-roles.ts (F3) and
 * lib/admin-auth.ts's pure helpers (F4). Time is always injected via a `now` argument, never
 * read from Date.now() inside these builders.
 *
 * ZERO authorization meaning: nothing in this module grants a capability, admin surface access,
 * or role based on a buyers document or a buyerUid. Do not import lib/admin-auth.ts or
 * lib/admin-roles.ts here.
 */

export const BUYERS_COLLECTION = 'buyers';

export interface NewsletterOptIn {
  optedIn: boolean;
  optInAt: Date | null;
  source: string | null;
}

export interface Buyer {
  uid: string;
  email: string;
  displayName?: string;
  newsletterOptIn: NewsletterOptIn;
  createdAt: Date;
}

/**
 * Builds a POPIA-compliant consent record. No argument, or `optedIn: false` regardless of what
 * else is passed alongside it, always forces `optInAt`/`source` to null — see the golden README
 * for why this is an unconditional zeroing, not a default-when-absent. Only `optedIn: true` with
 * `source` and `now` supplied produces a real, auditable consent record.
 */
export function buildNewsletterOptIn(input?: {
  optedIn: boolean;
  source: string;
  now: Date;
}): NewsletterOptIn {
  if (!input || !input.optedIn) {
    return { optedIn: false, optInAt: null, source: null };
  }
  return { optedIn: true, optInAt: input.now, source: input.source };
}

/**
 * Builds a `buyers/{uid}` document. `newsletterOptIn` defaults to the unticked shape when the
 * caller doesn't supply one.
 */
export function buildBuyerDocument(input: {
  uid: string;
  email: string;
  displayName?: string;
  newsletterOptIn?: { optedIn: boolean; source: string; now: Date };
  now: Date;
}): Buyer {
  return {
    uid: input.uid,
    email: input.email,
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    newsletterOptIn: buildNewsletterOptIn(input.newsletterOptIn),
    createdAt: input.now,
  };
}
