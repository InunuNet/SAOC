/**
 * F7 (ticketing-foundation) — check-in audit trail: pure decision/construction logic for the
 * `checkinAttempts` append-only collection (spec §7.3). See
 * contracts/golden/ticketing-f7-checkin-audit/README.md for the full decision record — the
 * outcome enum's two documented additions beyond spec §7.3's literal text, why the write does
 * NOT share a Firestore transaction with the admission decision, PII minimisation, and every
 * defeating mutation.
 *
 * Pure, side-effect-free — no Firestore, no network, no Date.now()/new Date() call anywhere in
 * this file. Time is always the caller-supplied `now`, mirroring lib/recovery-token.ts's and
 * lib/admin-auth.ts's injected-time pattern.
 *
 * ZERO authorization meaning: a CheckinAttemptRecord carries no roles/admin/capabilities field,
 * and nothing derived from one may ever be fed into lib/admin-auth.ts's capability resolution.
 */

export const CHECKIN_ATTEMPTS_COLLECTION = 'checkinAttempts';

/**
 * Widened by three members beyond spec §7.3's literal five ('malformed', 'not-authorized',
 * 'infra-error') — see golden README "Judgement call 1" for why folding them into an existing
 * name would corrupt any future "count outcomes by type" query. 'infra-error' was added after
 * @qa found the route's catch block for an unrelated throw (e.g. a Firestore outage
 * mid-transaction) produced zero audit records — neither an admission decision was reached nor
 * a known refusal reason applies, so it needs its own honestly-named outcome rather than being
 * folded into 'unpaid' or 'not-found'.
 */
export type CheckinAttemptOutcome =
  | 'admit'
  | 'not-found'
  | 'wrong-show'
  | 'unpaid'
  | 'already-checked-in'
  | 'malformed'
  | 'not-authorized'
  | 'infra-error';

export type CheckinAttemptSource = 'online' | 'offline-queued';

/**
 * The ENTIRE field set of an audit record. No attendeeName/attendeeEmail/buyerEmail, raw QR
 * payload, or signed token field exists here — see golden README "PII minimisation".
 */
export interface CheckinAttemptRecord {
  bookingRef: string | null;
  showId: string | null;
  orderId: string | null;
  outcome: CheckinAttemptOutcome;
  refusalReason: string | null;
  scannedByUid: string | null;
  deviceId: string | null;
  scannedAt: Date;
  source: CheckinAttemptSource;
  syncedAt: Date | null;
}

export interface BuildCheckinAttemptInput {
  bookingRef: string | null;
  showId: string | null;
  orderId: string | null;
  outcome: CheckinAttemptOutcome;
  refusalReason: string | null;
  scannedByUid: string | null;
  deviceId?: string | null;
  now: Date;
  source?: CheckinAttemptSource;
}

/**
 * Pure construction, no I/O. Three unconditional, fail-closed-by-construction rules (golden
 * README "buildCheckinAttemptRecord"):
 *  1. `outcome === 'admit'` always forces `refusalReason` to `null` in the output, regardless
 *     of what the caller passed.
 *  2. `syncedAt` is always `null` — reconciling an offline-queued entry is spec §7.4's job, not
 *     F7's.
 *  3. `source` defaults to `'online'` when the caller omits it.
 *
 * The return statement is an explicit field list, not a spread of `input` — this is what keeps
 * a smuggled, unrecognised input property (e.g. a loosely-typed caller's `qrPayload` or
 * `attendeeEmail`) from ever reaching the output.
 */
export function buildCheckinAttemptRecord(input: BuildCheckinAttemptInput): CheckinAttemptRecord {
  return {
    bookingRef: input.bookingRef,
    showId: input.showId,
    orderId: input.orderId,
    outcome: input.outcome,
    refusalReason: input.outcome === 'admit' ? null : input.refusalReason,
    scannedByUid: input.scannedByUid,
    deviceId: input.deviceId ?? null,
    scannedAt: input.now,
    source: input.source ?? 'online',
    syncedAt: null,
  };
}

/**
 * Exactly ONE method, deliberately — the append-only guarantee is structural, not a convention
 * a future edit could quietly break by adding an update/delete/set method here. A thin
 * Firestore adapter implementing this via `.add()` only (and nothing else) is the sole
 * Firestore-touching code F7 introduces; it lives outside this module.
 */
export interface AppendOnlyCheckinAttemptsStore {
  addCheckinAttempt: (record: CheckinAttemptRecord) => Promise<{ id: string }>;
}

export type RecordCheckinAttemptResult = { recorded: true; id: string } | { recorded: false; error: unknown };

/**
 * Builds the record via buildCheckinAttemptRecord() and writes it via the injected store.
 * NEVER throws itself: a rejection from `addCheckinAttempt` is caught and returned as
 * `{recorded: false, error}`, never rethrown and never left as an unhandled rejection. This is
 * the "a failed audit write must not silently succeed OR abort the check-in" guarantee — the
 * caller decides what to do with the admission result independently of what this returns.
 */
export async function recordCheckinAttempt(
  store: AppendOnlyCheckinAttemptsStore,
  input: BuildCheckinAttemptInput,
): Promise<RecordCheckinAttemptResult> {
  const record = buildCheckinAttemptRecord(input);
  try {
    const { id } = await store.addCheckinAttempt(record);
    return { recorded: true, id };
  } catch (error) {
    return { recorded: false, error };
  }
}

export interface AuditWriteFailureContext {
  bookingRef: string | null;
  showId: string | null;
  outcome: CheckinAttemptOutcome;
  error: unknown;
}

/**
 * The "surface loudly" half. ERROR-level only (never console.log/console.warn, per
 * .claude/rules/coding.md's failure-that-doesn't-abort-the-caller convention) — the one
 * sanctioned console.error in this feature. Never throws; called by the route/checkin
 * integration whenever recordCheckinAttempt() returns `{recorded: false}`.
 */
export function logAuditWriteFailure(context: AuditWriteFailureContext): void {
  console.error('[checkin-audit] Failed to write checkinAttempts record', {
    bookingRef: context.bookingRef,
    showId: context.showId,
    outcome: context.outcome,
    error: context.error,
  });
}
