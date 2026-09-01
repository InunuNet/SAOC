import {
  buildSupporterRegistration,
  validateSupporterRegistrationInput,
  type SupporterRegistrationStatus,
} from '@/lib/supporter-registrations';
import {
  decideConfirmationEmailCooldown,
  decideSupporterRegistrationRateLimit,
  type SupporterRegistrationAttemptRecord,
} from '@/lib/supporter-registration-rate-limit';
import type { MintedSupporterRegistrationToken } from '@/lib/supporter-registration-token';
import type { SupporterRegistrationConfirmationInput } from '@/lib/supporter-registration-confirmation';

/**
 * Pure orchestrator for POST /api/supporters/register (mission public-supporter-registration,
 * F1). See
 * .agent/memory/project/specs/public-supporter-registration/goldens/supporter-registration-data-model.md
 * "Order of operations" for the exact step sequence and
 * .agent/memory/project/specs/public-supporter-registration/goldens/README.md for the full
 * decision record.
 *
 * Fully injectable -- no Firebase Admin SDK import, no Resend import, no network -- so every
 * load-bearing property (consent literalness, no parallel validation, both throttles genuinely
 * wired in, no email enumeration, zero admin-authorization meaning) is proven offline against
 * this function directly, never by source-grep.
 *
 * ZERO authorization meaning: nothing here grants a capability, admin surface, or role. Do not
 * import lib/admin-auth.ts or lib/admin-roles.ts here.
 */

export interface ExistingSupporterRegistration {
  id: string;
  /** The real Firestore implementation of `findByEmail` MUST exclude `status: 'unsubscribed'`
   *  documents, so this handler only ever sees 'pending' | 'confirmed' here -- a previously
   *  unsubscribed email is always treated as having no existing record (fresh consent on
   *  re-opt-in). See the golden README's "Consent design -- Re-consent on re-opt-in." */
  status: SupporterRegistrationStatus;
}

export interface SupporterRegistrationHandlerDeps {
  now: Date;
  source: string;

  rateLimitKey: string;
  getPriorAttempts: (key: string) => SupporterRegistrationAttemptRecord[];
  recordAttempt: (key: string, at: Date) => void;

  findByEmail: (email: string) => Promise<ExistingSupporterRegistration | null>;

  getLastConfirmationSentAt: (email: string) => Date | null;
  recordConfirmationSent: (email: string, at: Date) => void;

  write: (doc: ReturnType<typeof buildSupporterRegistration>) => Promise<{ id: string }>;
  refreshConsent: (id: string, consentTimestamp: Date) => Promise<void>;

  mintConfirmToken: (registrationId: string) => MintedSupporterRegistrationToken;
  sendConfirmationEmail: (input: SupporterRegistrationConfirmationInput) => Promise<void>;
  onEmailError?: (error: unknown) => void;
}

export type SupporterRegistrationHandlerResult =
  | { status: 201 | 200; body: { success: true } }
  | { status: 400; body: { success: false; fieldErrors: string[] } }
  | { status: 429; body: { success: false; retryAfterMs: number } }
  | { status: 500; body: { success: false; error: string } };

/** Fallback only -- decideSupporterRegistrationRateLimit always returns a non-null retryAfterMs
 *  when allowed is false, so this branch is defensive, not load-bearing. */
const SUPPORTER_REGISTER_DEFAULT_RETRY_AFTER_MS = 60 * 60 * 1000;

/** Canonical production origin. `SITE_URL` is only available at Firebase App Hosting runtime,
 *  matching the same fallback pattern as lib/confirmation-email.ts and
 *  app/api/tickets/checkout/route.ts -- read at call time, never at module scope. */
const DEFAULT_SITE_URL = 'https://saoc.co.za';

function resolveSupporterSiteUrl(): string {
  const raw = process.env['SITE_URL']?.trim().replace(/\/+$/, '');
  return raw ? raw : DEFAULT_SITE_URL;
}

function buildConfirmUrl(token: string): string {
  return `${resolveSupporterSiteUrl()}/api/supporters/confirm?token=${encodeURIComponent(token)}`;
}

/**
 * Mints a confirm token for `registrationId`, sends the confirmation email (failure caught and
 * routed to `deps.onEmailError`, never propagated -- same commit-before-email, non-fatal-email
 * posture as lib/vendor-registration-handler.ts), then records the send for the per-email
 * cooldown.
 */
async function mintAndSendConfirmation(
  registrationId: string,
  built: { email: string; firstName: string | null },
  deps: SupporterRegistrationHandlerDeps,
): Promise<void> {
  const minted = deps.mintConfirmToken(registrationId);
  try {
    await deps.sendConfirmationEmail({
      to: built.email,
      firstName: built.firstName,
      confirmUrl: buildConfirmUrl(minted.token),
    });
  } catch (error) {
    deps.onEmailError?.(error);
  }
  deps.recordConfirmationSent(built.email, deps.now);
}

export async function handleSupporterRegistration(
  rawInput: unknown,
  deps: SupporterRegistrationHandlerDeps,
): Promise<SupporterRegistrationHandlerResult> {
  // 1. IP rate limit, checked and recorded BEFORE any parsing/validation of rawInput. The
  // attempt is recorded UNCONDITIONALLY, before branching on the decision.
  const decision = decideSupporterRegistrationRateLimit(
    deps.rateLimitKey,
    deps.now,
    deps.getPriorAttempts(deps.rateLimitKey),
  );
  deps.recordAttempt(deps.rateLimitKey, deps.now);

  if (!decision.allowed) {
    return {
      status: 429,
      body: {
        success: false,
        retryAfterMs: decision.retryAfterMs ?? SUPPORTER_REGISTER_DEFAULT_RETRY_AFTER_MS,
      },
    };
  }

  // 2. The REAL validator -- never a second, hand-written validation routine.
  const validation = validateSupporterRegistrationInput(rawInput);
  if (!validation.valid) {
    return { status: 400, body: { success: false, fieldErrors: validation.errors } };
  }

  // 3. Safe only because step 2 already proved the shape. `firstName` is optional on raw
  // input -- validation lets it through as `undefined` when omitted -- but
  // buildSupporterRegistration's contract requires `string | null` (never `undefined`), so it
  // is normalized here, not force-cast. Getting this wrong (e.g. casting rawInput's
  // `firstName?: unknown` straight to `string | null`) crashes inside buildSupporterRegistration
  // on `undefined.trim()` for the single most common submission shape: email-only.
  const rawRecord = rawInput as { email: string; firstName?: string | null; consentMarketing: true };
  const validated = {
    email: rawRecord.email,
    firstName: rawRecord.firstName ?? null,
    consentMarketing: rawRecord.consentMarketing,
  };
  const built = buildSupporterRegistration(validated, deps.now, deps.source);

  // 4. Look up any existing record for this email. The real Firestore implementation excludes
  // 'unsubscribed' documents, so `existing === null` also covers "previously unsubscribed."
  const existing = await deps.findByEmail(built.email);

  // 5. Branch on existing status. Every reachable branch below funnels into the SAME success
  // body shape (step 6) -- no branch-distinguishing field, so a caller cannot enumerate
  // whether an arbitrary address is already registered.
  if (existing === null) {
    let writeResult: { id: string };
    try {
      writeResult = await deps.write(built);
    } catch {
      return { status: 500, body: { success: false, error: 'Failed to save registration.' } };
    }
    await mintAndSendConfirmation(writeResult.id, built, deps);
    return { status: 201, body: { success: true } };
  }

  if (existing.status === 'confirmed') {
    // No write, no token mint, no email send at all -- a confirmed record is final for this
    // route.
    return { status: 200, body: { success: true } };
  }

  // existing.status === 'pending'
  const cooldownDecision = decideConfirmationEmailCooldown(
    deps.now,
    deps.getLastConfirmationSentAt(built.email),
  );

  if (!cooldownDecision.allowed) {
    // Silently suppressed -- the mail-bomb defense. No write, no token mint, no email send.
    return { status: 200, body: { success: true } };
  }

  await deps.refreshConsent(existing.id, deps.now);
  await mintAndSendConfirmation(existing.id, built, deps);
  return { status: 200, body: { success: true } };
}
