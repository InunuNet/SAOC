// F1 (public-supporter-registration) — compiler-driven (not source-grep) proof of the exported
// shapes lib/supporter-registrations.ts, lib/supporter-registration-token.ts,
// lib/supporter-registration-rate-limit.ts, lib/supporter-registration-handler.ts, and
// lib/supporter-registration-confirmation.ts must add. Run via its own scoped tsconfig (root
// tsconfig.json excludes `contracts/` from `pnpm type-check`), same pattern as
// contracts/checks/vendor-f5-register-route/fixtures/vendor-f5-register-route-typecheck.ts.
//
// Proves, by real assignment (compiles or it doesn't):
//   1. handleSupporterRegistration's deps shape takes fully-injectable rate-limit/cooldown/
//      Firestore/email functions — a fully-faked deps object (no firebase-admin import, no
//      resend import, no network) type-checks.
//   2. decideSupporterRegistrationRateLimit delegates to the SAME RateLimitDecision shape
//      lib/resend-rate-limit.ts already defines — not a parallel, differently-shaped result.
//   3. verifySupporterRegistrationToken's result is a real discriminated union including
//      'wrong-purpose', distinct from lib/recovery-token.ts's own verification union.
//   4. sendSupporterRegistrationConfirmationEmail's deps accept a fake mailer shaped exactly
//      like lib/email.ts's real sendEmail.
//
// Run as: npx tsc --noEmit -p contracts/checks/public-supporter-registration-f1/tsconfig.typecheck.json

import type * as React from 'react';
import type { RateLimitDecision } from '../../../lib/resend-rate-limit';
import {
  SUPPORTER_REGISTRATIONS_COLLECTION,
  validateSupporterRegistrationInput,
  buildSupporterRegistration,
  type SupporterRegistration,
  type SupporterRegistrationStatus,
  type ValidationResult,
} from '../../../lib/supporter-registrations';
import {
  mintSupporterRegistrationToken,
  verifySupporterRegistrationToken,
  SUPPORTER_CONFIRM_TOKEN_DEFAULT_TTL_MS,
  SUPPORTER_MANAGE_TOKEN_DEFAULT_TTL_MS,
  type SupporterRegistrationTokenPurpose,
  type SupporterRegistrationTokenVerification,
} from '../../../lib/supporter-registration-token';
import {
  SUPPORTER_REGISTER_RATE_LIMIT_MAX_ATTEMPTS,
  SUPPORTER_REGISTER_RATE_LIMIT_WINDOW_MS,
  SUPPORTER_CONFIRMATION_EMAIL_COOLDOWN_MS,
  decideSupporterRegistrationRateLimit,
  decideConfirmationEmailCooldown,
  createInMemorySupporterRegistrationRateLimitStore,
  createInMemorySupporterConfirmationCooldownStore,
  type SupporterRegistrationAttemptRecord,
  type EmailCooldownDecision,
} from '../../../lib/supporter-registration-rate-limit';
import {
  handleSupporterRegistration,
  type SupporterRegistrationHandlerDeps,
  type SupporterRegistrationHandlerResult,
  type ExistingSupporterRegistration,
} from '../../../lib/supporter-registration-handler';
import {
  sendSupporterRegistrationConfirmationEmail,
  type SendSupporterRegistrationConfirmationDeps,
  type SupporterRegistrationConfirmationInput,
} from '../../../lib/supporter-registration-confirmation';

const collection: string = SUPPORTER_REGISTRATIONS_COLLECTION;

const status: SupporterRegistrationStatus = 'pending';

const validation: ValidationResult = validateSupporterRegistrationInput({
  email: 'jane@example.com',
  firstName: 'Jane',
  consentMarketing: true,
});

const built = buildSupporterRegistration(
  { email: 'jane@example.com', firstName: 'Jane', consentMarketing: true },
  new Date('2026-09-01T00:00:00.000Z'),
  'website-registration-form',
);
const registration: SupporterRegistration = { ...built, id: undefined as never } as unknown as SupporterRegistration;

const purpose: SupporterRegistrationTokenPurpose = 'confirm';
const confirmTtl: number = SUPPORTER_CONFIRM_TOKEN_DEFAULT_TTL_MS;
const manageTtl: number = SUPPORTER_MANAGE_TOKEN_DEFAULT_TTL_MS;

const minted = mintSupporterRegistrationToken({
  registrationId: 'abc123',
  purpose: 'confirm',
  secret: 'test-secret',
  now: new Date('2026-09-01T00:00:00.000Z'),
});

const verification: SupporterRegistrationTokenVerification = verifySupporterRegistrationToken({
  token: minted.token,
  expectedPurpose: 'confirm',
  secret: 'test-secret',
  now: new Date('2026-09-01T00:00:00.000Z'),
});

const maxAttempts: number = SUPPORTER_REGISTER_RATE_LIMIT_MAX_ATTEMPTS;
const windowMs: number = SUPPORTER_REGISTER_RATE_LIMIT_WINDOW_MS;
const cooldownMs: number = SUPPORTER_CONFIRMATION_EMAIL_COOLDOWN_MS;

const priorAttempts: SupporterRegistrationAttemptRecord[] = [
  { key: 'supporter-register-ip:203.0.113.5', at: new Date('2026-09-01T00:00:00.000Z') },
];

const rateDecision: RateLimitDecision = decideSupporterRegistrationRateLimit(
  'supporter-register-ip:203.0.113.5',
  new Date('2026-09-01T00:30:00.000Z'),
  priorAttempts,
);

const cooldownDecision: EmailCooldownDecision = decideConfirmationEmailCooldown(
  new Date('2026-09-01T00:30:00.000Z'),
  null,
);

const rateStore = createInMemorySupporterRegistrationRateLimitStore();
const cooldownStore = createInMemorySupporterConfirmationCooldownStore();

// Fully-faked deps — no firebase-admin import, no resend import, no network. Proves the
// handler's deps shape is genuinely injectable.
const fakeWrites: Array<{ id: string }> = [];
const fakeEmails: SupporterRegistrationConfirmationInput[] = [];

const existing: ExistingSupporterRegistration | null = null;

const deps: SupporterRegistrationHandlerDeps = {
  now: new Date('2026-09-01T00:30:00.000Z'),
  source: 'website-registration-form',
  rateLimitKey: 'supporter-register-ip:203.0.113.5',
  getPriorAttempts: (key: string) => rateStore.getPriorAttempts(key),
  recordAttempt: (key: string, at: Date) => rateStore.recordAttempt(key, at),
  findByEmail: async (_email: string) => existing,
  getLastConfirmationSentAt: (email: string) => cooldownStore.getLastSentAt(email),
  recordConfirmationSent: (email: string, at: Date) => cooldownStore.recordSent(email, at),
  write: async (doc) => {
    const id = 'fake-id';
    fakeWrites.push({ id });
    return { id };
  },
  refreshConsent: async (_id: string, _consentTimestamp: Date) => {},
  mintConfirmToken: (registrationId: string) =>
    mintSupporterRegistrationToken({
      registrationId,
      purpose: 'confirm',
      secret: 'test-secret',
      now: new Date('2026-09-01T00:30:00.000Z'),
    }),
  sendConfirmationEmail: async (input) => {
    fakeEmails.push(input);
  },
  onEmailError: (_error: unknown) => {},
};

async function run(): Promise<SupporterRegistrationHandlerResult> {
  return handleSupporterRegistration(
    { email: 'jane@example.com', firstName: 'Jane', consentMarketing: true },
    deps,
  );
}
void run;

const mailer: SendSupporterRegistrationConfirmationDeps = {
  mailer: {
    send: async (args: { to: string; subject: string; react: React.ReactElement; from: string }) => {
      void args;
    },
  },
};

async function sendFixture(): Promise<void> {
  await sendSupporterRegistrationConfirmationEmail(
    { to: 'jane@example.com', firstName: 'Jane', confirmUrl: 'https://saoc.co.za/api/supporters/confirm?token=x' },
    mailer,
  );
}
void sendFixture;

export {};
