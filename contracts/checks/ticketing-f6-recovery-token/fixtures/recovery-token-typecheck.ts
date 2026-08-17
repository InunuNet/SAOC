// F6 (ticketing-foundation) — compiler-driven (not source-grep) proof of the exported type
// shapes lib/recovery-token.ts, lib/resend-rate-limit.ts and lib/resend-response.ts must add.
// Run via its own scoped tsconfig (see that file's header) because the root tsconfig.json
// excludes `contracts/` from `pnpm type-check`.
//
// Three things proven here that the runtime checks (A3-A10) cannot see:
//   1. verifyRecoveryToken()'s `compare` option accepts a SignatureCompare-shaped function —
//      the injectable constant-time-comparison hook A4 depends on genuinely exists in the type.
//   2. RateLimitAttempt[] is a real, usable input shape for decideRateLimit()'s priorAttempts.
//   3. decideResendOutcome()'s result.publicResponse is typed exactly as
//      `typeof RESEND_MY_TICKETS_PUBLIC_RESPONSE` — not a widened `{status:number;body:object}`
//      that would let a future edit swap in a differently-shaped response undetected by the
//      compiler.
//
// Run as: npx tsc --noEmit -p contracts/checks/ticketing-f6-recovery-token/tsconfig.typecheck.json

import type {
  MintedRecoveryToken,
  RecoveryTokenVerification,
  SignatureCompare,
} from '../../../../lib/recovery-token';
import {
  constantTimeEqual,
  mintRecoveryToken,
  verifyRecoveryToken,
  RECOVERY_TOKEN_DEFAULT_TTL_MS,
} from '../../../../lib/recovery-token';

import type { RateLimitAttempt, RateLimitDecision } from '../../../../lib/resend-rate-limit';
import {
  decideRateLimit,
  RESEND_RATE_LIMIT_MAX_ATTEMPTS,
  RESEND_RATE_LIMIT_WINDOW_MS,
} from '../../../../lib/resend-rate-limit';

import type { ResendDecisionResult } from '../../../../lib/resend-response';
import { decideResendOutcome, RESEND_MY_TICKETS_PUBLIC_RESPONSE } from '../../../../lib/resend-response';

// --- recovery-token.ts ---

const ttlDefault: number = RECOVERY_TOKEN_DEFAULT_TTL_MS;

const minted: MintedRecoveryToken = mintRecoveryToken({
  orderId: 'order-1',
  secret: 'fake-typecheck-secret',
  now: new Date('2027-01-01T00:00:00Z'),
});

const mintedWithTtl: MintedRecoveryToken = mintRecoveryToken({
  orderId: 'order-1',
  secret: 'fake-typecheck-secret',
  now: new Date('2027-01-01T00:00:00Z'),
  ttlMs: 1000,
});

// The injectable constant-time-comparison hook — a real spy shape, proving `compare` is
// genuinely part of VerifyRecoveryTokenInput, not merely documented in a comment.
const alwaysTrueCompare: SignatureCompare = (_a: Buffer, _b: Buffer) => true;

const verified: RecoveryTokenVerification = verifyRecoveryToken({
  token: minted.token,
  secret: 'fake-typecheck-secret',
  now: new Date('2027-01-01T00:00:00Z'),
});

const verifiedWithSpy: RecoveryTokenVerification = verifyRecoveryToken({
  token: minted.token,
  secret: 'fake-typecheck-secret',
  now: new Date('2027-01-01T00:00:00Z'),
  compare: alwaysTrueCompare,
});

const compareResult: boolean = constantTimeEqual(Buffer.from('a'), Buffer.from('b'));

// --- resend-rate-limit.ts ---

const maxAttempts: number = RESEND_RATE_LIMIT_MAX_ATTEMPTS;
const windowMs: number = RESEND_RATE_LIMIT_WINDOW_MS;

const priorAttempts: RateLimitAttempt[] = [
  { key: 'email:buyer@example.com', at: new Date('2027-01-01T00:00:00Z') },
  { key: 'ip:203.0.113.5', at: new Date('2027-01-01T00:05:00Z') },
];

const rateLimitDecision: RateLimitDecision = decideRateLimit({
  key: 'email:buyer@example.com',
  now: new Date('2027-01-01T00:10:00Z'),
  priorAttempts,
});

const rateLimitDecisionWithOverrides: RateLimitDecision = decideRateLimit({
  key: 'email:buyer@example.com',
  now: new Date('2027-01-01T00:10:00Z'),
  priorAttempts,
  maxAttempts: 5,
  windowMs: 60 * 60 * 1000,
});

// --- resend-response.ts ---

const publicResponseShape: typeof RESEND_MY_TICKETS_PUBLIC_RESPONSE = RESEND_MY_TICKETS_PUBLIC_RESPONSE;

const resendOutcome: ResendDecisionResult = decideResendOutcome({
  orderMatched: true,
  rateLimited: false,
});

// The compiler-enforced identity: publicResponse is typed as the exact literal type of the
// shared constant, not a widened structural shape — a future edit returning a freshly-built
// object with matching content but a different reference would still compile here (TS
// structural typing can't catch that), which is exactly why A10's runtime check exists for
// reference equality specifically.
const publicResponseFromOutcome: typeof RESEND_MY_TICKETS_PUBLIC_RESPONSE = resendOutcome.publicResponse;

export {
  ttlDefault,
  minted,
  mintedWithTtl,
  alwaysTrueCompare,
  verified,
  verifiedWithSpy,
  compareResult,
  maxAttempts,
  windowMs,
  priorAttempts,
  rateLimitDecision,
  rateLimitDecisionWithOverrides,
  publicResponseShape,
  resendOutcome,
  publicResponseFromOutcome,
};
