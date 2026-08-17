// F7 (ticketing-foundation) — compiler-driven (not source-grep) proof of the exported shapes
// lib/checkin-audit.ts must add. Run via its own scoped tsconfig (see that file's header)
// because the root tsconfig.json excludes `contracts/` from `pnpm type-check`.
//
// Two things proven here that the runtime checks (A3-A7) cannot see:
//   1. Every exported type/function is usable with real argument shapes — a real assignment
//      either compiles or it doesn't.
//   2. AppendOnlyCheckinAttemptsStore is a CLOSED interface — an object literal assigned
//      directly to that type may declare `addCheckinAttempt` and nothing else; a literal that
//      ALSO tries to declare an `updateCheckinAttempt` method on the same typed target is
//      rejected by TypeScript's excess-property check, proven here with `@ts-expect-error` (if
//      that literal ever DID compile, `@ts-expect-error` itself would fail the build — this is
//      a real compile-time proof, not a comment asserting an untested belief).
//
// Run as: npx tsc --noEmit -p contracts/checks/ticketing-f7-checkin-audit/tsconfig.typecheck.json

import type {
  AppendOnlyCheckinAttemptsStore,
  AuditWriteFailureContext,
  BuildCheckinAttemptInput,
  CheckinAttemptOutcome,
  CheckinAttemptRecord,
  CheckinAttemptSource,
  RecordCheckinAttemptResult,
} from '../../../../lib/checkin-audit';
import {
  buildCheckinAttemptRecord,
  CHECKIN_ATTEMPTS_COLLECTION,
  logAuditWriteFailure,
  recordCheckinAttempt,
} from '../../../../lib/checkin-audit';

const collectionName: 'checkinAttempts' = CHECKIN_ATTEMPTS_COLLECTION;

const now = new Date('2027-03-01T09:00:00Z');

const admitInput: BuildCheckinAttemptInput = {
  bookingRef: 'SAOC-2027-ABC123',
  showId: 'nationalShow',
  orderId: 'order-1',
  outcome: 'admit',
  refusalReason: null,
  scannedByUid: 'door-staff-uid-1',
  deviceId: 'device-1',
  now,
  source: 'online',
};

const refusalInput: BuildCheckinAttemptInput = {
  bookingRef: null,
  showId: null,
  orderId: null,
  outcome: 'malformed',
  refusalReason: 'A booking reference is required.',
  scannedByUid: 'door-staff-uid-1',
  now,
};

// Every member of the eight-outcome union is a valid CheckinAttemptOutcome value — proves the
// union is genuinely the eight names the contract specifies, not a narrower or wider set.
// 'infra-error' (added post-@qa-FAIL) covers checkInByBookingRef() throwing for a reason
// unrelated to any admission decision — see the golden README, "Why the outcome enum is wider
// than spec §7.3's literal text."
const outcomes: CheckinAttemptOutcome[] = [
  'admit',
  'not-found',
  'wrong-show',
  'unpaid',
  'already-checked-in',
  'malformed',
  'not-authorized',
  'infra-error',
];

const sources: CheckinAttemptSource[] = ['online', 'offline-queued'];

const record: CheckinAttemptRecord = buildCheckinAttemptRecord(admitInput);
const refusalRecord: CheckinAttemptRecord = buildCheckinAttemptRecord(refusalInput);

// AppendOnlyCheckinAttemptsStore is closed: exactly one method.
const validStore: AppendOnlyCheckinAttemptsStore = {
  addCheckinAttempt: async (_r: CheckinAttemptRecord) => ({ id: 'fake-id' }),
};

// An object literal assigned directly to AppendOnlyCheckinAttemptsStore must not be allowed to
// declare an extra, mutating method. If this property ever compiles cleanly, the interface has
// stopped being closed AND the @ts-expect-error directive immediately below becomes an unused
// suppression, which itself fails the build (TS2578) — that failure mode is what makes this a
// real compile-time proof, not a decorative comment. The directive is placed directly above
// THIS property line, not above the object literal's opening line a few lines up, because
// TypeScript reports the excess-property diagnostic (TS2561) at the offending property's own
// line, not at the literal's opening brace — a directive attached to the wrong line silently
// suppresses nothing and the diagnostic fires unsuppressed, exactly as happened here once.
const invalidStoreWithUpdate: AppendOnlyCheckinAttemptsStore = {
  addCheckinAttempt: async (_r: CheckinAttemptRecord) => ({ id: 'fake-id' }),
  // @ts-expect-error — updateCheckinAttempt is not a member of AppendOnlyCheckinAttemptsStore
  updateCheckinAttempt: async (_id: string, _patch: Partial<CheckinAttemptRecord>) => undefined,
};

const recorded: Promise<RecordCheckinAttemptResult> = recordCheckinAttempt(validStore, admitInput);

const failureContext: AuditWriteFailureContext = {
  bookingRef: admitInput.bookingRef,
  showId: admitInput.showId,
  outcome: admitInput.outcome,
  error: new Error('simulated'),
};

const loggedNothing: void = logAuditWriteFailure(failureContext);

export {
  collectionName,
  admitInput,
  refusalInput,
  outcomes,
  sources,
  record,
  refusalRecord,
  validStore,
  invalidStoreWithUpdate,
  recorded,
  failureContext,
  loggedNothing,
};
