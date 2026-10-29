// Golden for lib/recovery-expiry.ts (mission nos-recovery-ttl, spec D1-D4). Frozen by @architect.
// Run: pnpm exec tsx .agent/memory/project/specs/nos-recovery-ttl/goldens/recovery-expiry.golden.ts
// Also run under several TZ values (contract A2): the result must never depend on the server zone.
// Rule under test: expiry = the active show's end date as a SAST calendar day, plus 7 whole days, to the END of
// that day (the instant SAST midnight starting day end+8; verifyRecoveryToken treats now >= expiry as expired).
import assert from 'node:assert/strict';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../../../..');
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const NOW = new Date('2026-10-29T08:00:00.000Z');

async function main(): Promise<void> {
  const mod = await import(path.join(ROOT, 'lib/recovery-expiry.ts'));
  const { computeRecoveryExpiry, resolveRecoveryExpiry, RecoveryExpiryError } = mod as {
    computeRecoveryExpiry: (i: { showEnd: unknown; now: Date }) => Date;
    resolveRecoveryExpiry: (i: { showWindow: unknown; now: Date }) => { ok: boolean; expiresAt?: Date; code?: string };
    RecoveryExpiryError: new (code: string) => Error & { code: string };
  };
  assert.equal(typeof computeRecoveryExpiry, 'function', 'computeRecoveryExpiry export');
  assert.equal(typeof resolveRecoveryExpiry, 'function', 'resolveRecoveryExpiry export');

  const iso = (value: string) => new Date(value);
  const exp = (showEnd: string, now: Date = NOW) => computeRecoveryExpiry({ showEnd: iso(showEnd), now }).toISOString();

  // --- 1. The pinned worked example: show ends Sunday 26 Sep 2027 (SAST) -> last valid instant 3 Oct 2027 23:59:59.999 SAST.
  assert.equal(exp('2027-09-26T00:00:00+02:00'), '2027-10-03T22:00:00.000Z', 'SAST midnight start of 26 Sep');
  assert.equal(exp('2027-09-26T12:00:00+02:00'), '2027-10-03T22:00:00.000Z', 'midday 26 Sep');
  assert.equal(exp('2027-09-26T23:59:59.999+02:00'), '2027-10-03T22:00:00.000Z', 'last millisecond of 26 Sep SAST');
  assert.equal(exp('2027-09-26T21:59:59.999Z'), '2027-10-03T22:00:00.000Z', 'same instant written in UTC');
  assert.equal(exp('2027-09-26T22:00:00.000Z'), '2027-10-04T22:00:00.000Z', 'UTC 22:00 is already 27 Sep in SAST, so a day later (generous side, never short)');
  assert.equal(exp('2027-09-25T22:00:00.000Z'), '2027-10-03T22:00:00.000Z', 'UTC 22:00 on the 25th is SAST midnight of the 26th');
  assert.equal(exp('2027-09-25T21:59:59.999Z'), '2027-10-02T22:00:00.000Z', 'one ms earlier is still the 25th SAST');

  // --- 2. Month, year and leap-year arithmetic (Date.UTC day overflow, not a fixed 30/31 table).
  assert.equal(exp('2027-10-28T10:00:00Z'), '2027-11-04T22:00:00.000Z', 'month rollover Oct->Nov');
  assert.equal(exp('2027-12-28T10:00:00Z'), '2028-01-04T22:00:00.000Z', 'year rollover Dec->Jan');
  assert.equal(exp('2028-02-21T10:00:00Z'), '2028-02-28T22:00:00.000Z', 'leap year: 21 Feb + 8 = 29 Feb 2028 00:00 SAST');
  assert.equal(exp('2028-02-22T10:00:00Z'), '2028-02-29T22:00:00.000Z', 'leap year: 22 Feb + 8 = 1 Mar 2028 00:00 SAST');
  assert.equal(exp('2027-02-21T10:00:00Z'), '2027-02-28T22:00:00.000Z', 'non-leap: 21 Feb + 8 = 1 Mar 2027 00:00 SAST');
  assert.equal(exp('2027-02-20T10:00:00Z'), '2027-02-27T22:00:00.000Z', 'non-leap: 20 Feb + 8 = 28 Feb 2027 00:00 SAST');
  assert.equal(exp('2100-02-21T10:00:00Z'), '2100-02-28T22:00:00.000Z', '2100 is not a leap year');
  assert.equal(exp('2000-02-21T10:00:00Z', iso('2000-01-01T00:00:00Z')), '2000-02-28T22:00:00.000Z', '2000 is a leap year (29 Feb exists)');

  // --- 3. Independent of "now" as long as now is before the expiry (it is absolute, not now + n).
  const reference = exp('2027-09-26T12:00:00+02:00');
  for (const nowIso of ['2026-10-29T00:00:00Z', '2027-01-01T00:00:00Z', '2027-09-26T10:00:00Z', '2027-10-03T21:59:59.999Z']) {
    assert.equal(exp('2027-09-26T12:00:00+02:00', iso(nowIso)), reference, `expiry independent of now (${nowIso})`);
  }

  // --- 4. Boundary against now: refused at and after the expiry, accepted 1 ms before.
  const expiry = iso(reference);
  assert.doesNotThrow(() => computeRecoveryExpiry({ showEnd: iso('2027-09-26T12:00:00+02:00'), now: new Date(expiry.getTime() - 1) }));
  for (const offset of [0, 1, MS_PER_DAY]) {
    assert.throws(
      () => computeRecoveryExpiry({ showEnd: iso('2027-09-26T12:00:00+02:00'), now: new Date(expiry.getTime() + offset) }),
      (error: unknown) => error instanceof RecoveryExpiryError && error.code === 'already-expired',
      `now = expiry + ${offset}ms must refuse with already-expired`,
    );
  }
  assert.throws(
    () => computeRecoveryExpiry({ showEnd: iso('2020-01-01T00:00:00Z'), now: NOW }),
    (error: unknown) => error instanceof RecoveryExpiryError && error.code === 'already-expired',
    'a show that ended long ago refuses (an order placed after show end + 7 days)',
  );

  // --- 5. Fail closed: missing or malformed input throws a typed error, never a default.
  const refusal = (showEnd: unknown, code: string, now: Date = NOW) =>
    assert.throws(
      () => computeRecoveryExpiry({ showEnd, now }),
      (error: unknown) => error instanceof RecoveryExpiryError && error.code === code,
      `showEnd=${String(showEnd)} must refuse with ${code}`,
    );
  refusal(null, 'no-active-show');
  refusal(undefined, 'no-active-show');
  refusal(new Date('not a date'), 'invalid-show-end');
  refusal('2027-09-26T00:00:00+02:00', 'invalid-show-end'); // strings are not Dates: the reader parses, this stays strict
  refusal(1_790_000_000_000, 'invalid-show-end');
  refusal({}, 'invalid-show-end');
  refusal(new Date(8.64e15), 'invalid-show-end'); // max Date: +8 days overflows to NaN
  assert.throws(
    () => computeRecoveryExpiry({ showEnd: iso('2027-09-26T00:00:00Z'), now: new Date('nope') }),
    (error: unknown) => error instanceof RecoveryExpiryError && error.code === 'invalid-now',
    'invalid now refuses',
  );

  // --- 6. Property: for every instant, expiry is a SAST midnight, strictly after end + 7 days, and at most end + 8 days.
  const start = Date.parse('2026-10-29T00:00:00Z');
  const stop = Date.parse('2031-03-05T00:00:00Z'); // spans 2028 leap day and several month ends
  const probe = (ms: number) => {
    const showEnd = new Date(ms);
    const result = computeRecoveryExpiry({ showEnd, now: new Date(start - MS_PER_DAY) }).getTime();
    assert.equal((result + 2 * MS_PER_HOUR) % MS_PER_DAY, 0, `expiry is a SAST midnight (${showEnd.toISOString()})`);
    assert.ok(result > ms + 7 * MS_PER_DAY, `never cuts the buyer short of end + 7 days (${showEnd.toISOString()})`);
    assert.ok(result <= ms + 8 * MS_PER_DAY, `never more than a day beyond end + 7 days (${showEnd.toISOString()})`);
  };
  for (let ms = start; ms < stop; ms += 5 * MS_PER_HOUR + 7 * 60_000) probe(ms);
  for (const edge of ['2027-09-25T21:59:59.999Z', '2027-09-25T22:00:00.000Z', '2028-02-28T21:59:59.999Z', '2028-02-28T22:00:00.000Z', '2028-02-29T22:00:00.000Z']) probe(Date.parse(edge));

  // --- 7. Same SAST calendar day as lib/show-window-lookup computeShowDays (the F5 convention), so the two never drift.
  const { computeShowDays } = (await import(path.join(ROOT, 'lib/show-window-lookup.ts'))) as {
    computeShowDays: (w: { startDate: Date; endDate: Date }) => string[];
  };
  for (const endIso of ['2027-09-26T00:00:00+02:00', '2027-09-26T23:59:59.999+02:00', '2027-09-26T22:00:00Z', '2028-02-21T10:00:00Z']) {
    const endDate = iso(endIso);
    const days = computeShowDays({ startDate: new Date(endDate.getTime() - MS_PER_DAY), endDate });
    const lastDay = days[days.length - 1];
    const dayPlusEight = new Date(Date.parse(`${lastDay}T00:00:00Z`) + 8 * MS_PER_DAY - 2 * MS_PER_HOUR);
    assert.equal(computeRecoveryExpiry({ showEnd: endDate, now: NOW }).toISOString(), dayPlusEight.toISOString(), `agrees with computeShowDays last day for ${endIso}`);
  }

  // --- 8. resolveRecoveryExpiry: the non-throwing form the checkout route uses.
  const ok = resolveRecoveryExpiry({ showWindow: { startDate: iso('2027-09-24T00:00:00+02:00'), endDate: iso('2027-09-26T12:00:00+02:00') }, now: NOW });
  assert.deepEqual(Object.keys(ok).sort(), ['expiresAt', 'ok'], 'success shape is exactly { ok, expiresAt }');
  assert.equal(ok.ok, true);
  assert.equal(ok.expiresAt?.toISOString(), reference);
  const deny = (showWindow: unknown, code: string, now: Date = NOW) => {
    const result = resolveRecoveryExpiry({ showWindow, now });
    assert.deepEqual(result, { ok: false, code }, `showWindow=${JSON.stringify(showWindow)} -> { ok:false, code:${code} }`);
    assert.ok(!('expiresAt' in result), 'a refusal never carries an expiry (no silent default)');
  };
  deny(null, 'no-active-show');
  deny({ startDate: iso('2027-09-24T00:00:00Z'), endDate: new Date('x') }, 'invalid-show-end');
  deny({ startDate: iso('2019-01-01T00:00:00Z'), endDate: iso('2019-01-03T00:00:00Z') }, 'already-expired');
  deny({ startDate: iso('2027-09-24T00:00:00Z'), endDate: iso('2027-09-26T00:00:00Z') }, 'invalid-now', new Date('x'));
  // An unexpected error (not a RecoveryExpiryError) must propagate, not be swallowed into a refusal.
  assert.throws(() => resolveRecoveryExpiry({ showWindow: { get endDate(): Date { throw new TypeError('boom'); } }, now: NOW }), TypeError);

  console.log('recovery-expiry golden: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
