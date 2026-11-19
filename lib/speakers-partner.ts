// The hidden Speakers Partner ticket (Brad, 19 Nov 2026): one R950 ticket covering the
// Symposium and the WOSA Conference, sold only through a link the committee emails to speakers,
// behind a shared password. This module is the whole access decision, pure and server-only: the
// password check, the short-lived signed session cookie, and the one predicate the checkout
// route and the page both ask. The password is never stored here: it is read from the
// SPEAKERS_PARTNER_PASSWORD environment variable per request, and an unset or empty value fails
// closed (nobody gets in).
import { createHash, createHmac } from 'node:crypto';

import { SPEAKERS_PARTNER_SLUG } from '@/lib/provisional-figures';
import { constantTimeStringEqual, isWellFormedHexDigest } from '@/lib/recovery-token';

export { SPEAKERS_PARTNER_SLUG };

export const SPEAKERS_PARTNER_PASSWORD_ENV = 'SPEAKERS_PARTNER_PASSWORD';
export const SPEAKERS_PARTNER_COOKIE_NAME = 'speakers_partner_access';
export const SPEAKERS_PARTNER_ROUTE = '/tickets/speakers-partner';
export const SPEAKERS_PARTNER_AUTH_ROUTE = '/api/tickets/speakers-partner/auth';
/** One ticket per order: the quantity checkout accepts for this ticket type. */
export const SPEAKERS_PARTNER_FIXED_QUANTITY = 1;

/** The session lasts long enough to register and pay, no longer. */
export const SPEAKERS_PARTNER_SESSION_TTL_MS = 60 * 60 * 1000;

export const SPEAKERS_PARTNER_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const SPEAKERS_PARTNER_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const SESSION_CONTEXT = 'speakers-partner-session-v1';

/** The configured password, or null when the variable is unset or blank (fail closed). */
export function speakersPartnerPassword(env: Record<string, string | undefined>): string | null {
  const value = env[SPEAKERS_PARTNER_PASSWORD_ENV];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// Both sides are hashed to a fixed-length digest first, so the comparison time depends on
// neither the length of the guess nor how much of it is right.
function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function isSpeakersPartnerPasswordCorrect(
  candidate: unknown,
  password: string | null
): boolean {
  const guess = typeof candidate === 'string' ? candidate : '';
  // Always compare, even when nothing is configured, so an unset secret takes the same path.
  const matches = constantTimeStringEqual(digest(guess), digest(password ?? ''));
  return password !== null && matches;
}

function signExpiry(expiresAtMs: number, password: string): string {
  const key = createHmac('sha256', password).update(SESSION_CONTEXT).digest();
  return createHmac('sha256', key).update(String(expiresAtMs)).digest('hex');
}

export interface SpeakersPartnerSession {
  token: string;
  expiresAt: Date;
}

export function mintSpeakersPartnerSession(password: string, now: Date): SpeakersPartnerSession {
  const expiresAtMs = now.getTime() + SPEAKERS_PARTNER_SESSION_TTL_MS;
  return {
    token: `${expiresAtMs}.${signExpiry(expiresAtMs, password)}`,
    expiresAt: new Date(expiresAtMs),
  };
}

const TOKEN_PATTERN = /^(\d{1,16})\.([0-9a-f]{64})$/;

/** True for a token this server signed with the current password that has not expired. */
export function isSpeakersPartnerSessionValid(
  token: string | null | undefined,
  password: string | null,
  now: Date
): boolean {
  if (!token || password === null) return false;
  const match = TOKEN_PATTERN.exec(token);
  if (!match || !isWellFormedHexDigest(match[2])) return false;
  const expiresAtMs = Number(match[1]);
  const signatureOk = constantTimeStringEqual(match[2], signExpiry(expiresAtMs, password));
  return signatureOk && expiresAtMs > now.getTime();
}

/** The single access check: a request carries a valid session cookie value, now. */
export function hasSpeakersPartnerAccess(
  cookieValue: string | null | undefined,
  env: Record<string, string | undefined>,
  now: Date
): boolean {
  return isSpeakersPartnerSessionValid(cookieValue, speakersPartnerPassword(env), now);
}

/** The ticket types that are never listed publicly and need the speaker session to be bought. */
export function isRestrictedTicketSlug(slug: string): boolean {
  return slug === SPEAKERS_PARTNER_SLUG;
}
