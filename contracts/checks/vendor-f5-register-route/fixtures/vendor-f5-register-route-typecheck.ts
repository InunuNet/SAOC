// F5 (vendor-registration) — compiler-driven (not source-grep) proof of the exported shapes
// lib/vendor-registration-handler.ts, lib/vendor-registration-rate-limit.ts, and
// lib/vendor-registration-confirmation.ts must add. Run via its own scoped tsconfig (see that
// file's header) because the root tsconfig.json excludes `contracts/` from `pnpm type-check`.
//
// Proves, by real assignment (compiles or it doesn't), not by grep:
//   1. handleVendorRegistration's deps shape takes injectable write/rateLimit/email functions
//      — a fully-faked deps object (no Firestore, no Resend, no network) type-checks.
//   2. decideVendorRegistrationRateLimit delegates to the SAME RateLimitDecision shape
//      lib/resend-rate-limit.ts already defines (F6, ticketing-foundation) — not a
//      parallel, differently-shaped rate-limit result type.
//   3. sendVendorRegistrationConfirmationEmail's deps accept a fake mailer shaped exactly
//      like lib/email.ts's real `sendEmail`, so a fixture test needs zero Resend adapter code.
//
// Run as: npx tsc --noEmit -p contracts/checks/vendor-f5-register-route/tsconfig.typecheck.json

import type { RateLimitDecision } from '../../../../lib/resend-rate-limit';
import {
  VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS,
  VENDOR_REGISTER_RATE_LIMIT_WINDOW_MS,
  decideVendorRegistrationRateLimit,
  createInMemoryVendorRegistrationRateLimitStore,
  type VendorRegistrationAttemptRecord,
  type VendorRegistrationRateLimitStore,
} from '../../../../lib/vendor-registration-rate-limit';
import {
  handleVendorRegistration,
  type VendorRegistrationHandlerDeps,
  type VendorRegistrationHandlerResult,
} from '../../../../lib/vendor-registration-handler';
import {
  sendVendorRegistrationConfirmationEmail,
  type SendVendorRegistrationConfirmationDeps,
  type VendorRegistrationConfirmationInput,
} from '../../../../lib/vendor-registration-confirmation';
import type { VendorSubmission } from '../../../../types/index';

const maxAttempts: 3 = VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS;
const windowMs: number = VENDOR_REGISTER_RATE_LIMIT_WINDOW_MS;

const priorAttempts: VendorRegistrationAttemptRecord[] = [
  { key: 'vendor-register-ip:203.0.113.5', at: new Date('2026-08-18T00:00:00.000Z') },
];

const decision: RateLimitDecision = decideVendorRegistrationRateLimit(
  'vendor-register-ip:203.0.113.5',
  new Date('2026-08-18T00:30:00.000Z'),
  priorAttempts,
);

const store: VendorRegistrationRateLimitStore = createInMemoryVendorRegistrationRateLimitStore();

// Fully-faked deps — no Firestore Admin SDK import, no Resend import, no network. Proves the
// handler's deps shape is genuinely injectable, the same "no adapter code needed for a
// fixture" property lib/confirmation-email.ts's ConfirmationEmailMailer already established.
const fakeWrites: Array<Omit<VendorSubmission, 'id'>> = [];
const fakeEmails: VendorRegistrationConfirmationInput[] = [];

const deps: VendorRegistrationHandlerDeps = {
  now: new Date('2026-08-18T00:30:00.000Z'),
  rateLimitKey: 'vendor-register-ip:203.0.113.5',
  getPriorAttempts: (key: string) => store.getPriorAttempts(key),
  recordAttempt: (key: string, at: Date) => store.recordAttempt(key, at),
  write: async (doc) => {
    fakeWrites.push(doc);
    return { id: 'fake-submission-id' };
  },
  sendConfirmationEmail: async (input) => {
    fakeEmails.push(input);
  },
  // G1 (vendor-flow-notifications) -- VendorRegistrationHandlerDeps gained this required dep;
  // this typed fixture proves a fully-faked implementation of the CURRENT deps shape still
  // type-checks (no Firestore, no Resend, no network).
  sendAdminNotice: async (_input: {
    businessName: string;
    contactPersonName: string;
    vendorSubmissionId: string;
  }) => {},
  onEmailError: (_error: unknown) => {},
};

const resultPromise: Promise<VendorRegistrationHandlerResult> = handleVendorRegistration(
  { businessName: 'Test Nursery' },
  deps,
);

const emailDeps: SendVendorRegistrationConfirmationDeps = {
  mailer: {
    send: async (_args: { to: string; subject: string; react: unknown }) => {},
  },
};

const emailPromise: Promise<void> = sendVendorRegistrationConfirmationEmail(
  {
    businessName: 'Test Nursery',
    contactPersonName: 'Jane Grower',
    contactEmail: 'jane@example.com',
  },
  emailDeps,
);

export {
  maxAttempts,
  windowMs,
  priorAttempts,
  decision,
  store,
  deps,
  resultPromise,
  emailDeps,
  emailPromise,
  fakeWrites,
  fakeEmails,
};
