/**
 * Two independent abuse throttles for POST /api/supporters/register (mission
 * public-supporter-registration, F1). See
 * .agent/memory/project/specs/public-supporter-registration/goldens/README.md "Abuse
 * protection -- two independent throttles, not one" for the full decision record.
 *
 * Deliberately thin: `decideSupporterRegistrationRateLimit` delegates to the REAL
 * `decideRateLimit()` (lib/resend-rate-limit.ts) with supporter-specific overrides -- no
 * sliding-window arithmetic is reimplemented here, and these constants are NOT aliased to
 * VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS/WINDOW_MS (lib/vendor-registration-rate-limit.ts) or
 * RESEND_RATE_LIMIT_MAX_ATTEMPTS/WINDOW_MS (lib/resend-rate-limit.ts) -- independently tuned for
 * this route.
 */

import { decideRateLimit, type RateLimitDecision } from '@/lib/resend-rate-limit';

/** Looser than the vendor route's 3/hour -- a public list signup is a lower-stakes, more casual
 *  action than a vendor application. Placeholder, not a Council-approved value. */
export const SUPPORTER_REGISTER_RATE_LIMIT_MAX_ATTEMPTS = 5;

export const SUPPORTER_REGISTER_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export interface SupporterRegistrationAttemptRecord {
  key: string;
  at: Date;
}

export function decideSupporterRegistrationRateLimit(
  key: string,
  now: Date,
  priorAttempts: SupporterRegistrationAttemptRecord[],
): RateLimitDecision {
  return decideRateLimit({
    key,
    now,
    priorAttempts,
    maxAttempts: SUPPORTER_REGISTER_RATE_LIMIT_MAX_ATTEMPTS,
    windowMs: SUPPORTER_REGISTER_RATE_LIMIT_WINDOW_MS,
  });
}

export interface SupporterRegistrationRateLimitStore {
  getPriorAttempts(key: string): SupporterRegistrationAttemptRecord[];
  recordAttempt(key: string, at: Date): void;
}

/**
 * The only impure piece of the per-IP throttle: a module-level array wrapped in the two store
 * methods. Not persistent across cold starts or multiple Firebase App Hosting instances -- see
 * the golden README's "What this contract does NOT prove".
 */
export function createInMemorySupporterRegistrationRateLimitStore(): SupporterRegistrationRateLimitStore {
  const attempts: SupporterRegistrationAttemptRecord[] = [];

  return {
    getPriorAttempts(key: string): SupporterRegistrationAttemptRecord[] {
      return attempts.filter((attempt) => attempt.key === key);
    },
    recordAttempt(key: string, at: Date): void {
      attempts.push({ key, at });
    },
  };
}

// --- Independent throttle: per-email confirmation-send cooldown (the mail-bomb defense) ---
//
// Defends a THIRD PARTY against being email-bombed: an IP-only limit does nothing to stop
// someone submitting the same victim's address repeatedly from rotating IPs. Keyed on the
// submitted email itself, independent of the per-IP limiter above.

export const SUPPORTER_CONFIRMATION_EMAIL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export interface EmailCooldownDecision {
  allowed: boolean;
  retryAfterMs: number | null;
}

/** `lastSentAt: null` (never sent before) is always allowed. Otherwise allowed iff
 *  `now - lastSentAt >= SUPPORTER_CONFIRMATION_EMAIL_COOLDOWN_MS`. */
export function decideConfirmationEmailCooldown(
  now: Date,
  lastSentAt: Date | null,
): EmailCooldownDecision {
  if (lastSentAt === null) {
    return { allowed: true, retryAfterMs: null };
  }

  const elapsedMs = now.getTime() - lastSentAt.getTime();
  if (elapsedMs >= SUPPORTER_CONFIRMATION_EMAIL_COOLDOWN_MS) {
    return { allowed: true, retryAfterMs: null };
  }

  return { allowed: false, retryAfterMs: SUPPORTER_CONFIRMATION_EMAIL_COOLDOWN_MS - elapsedMs };
}

export interface SupporterConfirmationCooldownStore {
  getLastSentAt(email: string): Date | null;
  recordSent(email: string, at: Date): void;
}

/** The only impure piece of the per-email cooldown: a module-level Map wrapped in the two store
 *  methods. Not persistent across cold starts or multiple Firebase App Hosting instances. */
export function createInMemorySupporterConfirmationCooldownStore(): SupporterConfirmationCooldownStore {
  const lastSentAt = new Map<string, Date>();

  return {
    getLastSentAt(email: string): Date | null {
      return lastSentAt.get(email) ?? null;
    },
    recordSent(email: string, at: Date): void {
      lastSentAt.set(email, at);
    },
  };
}
