// A4 — one ticket, one admission. Two CONCURRENT scans of the same paid ticket must
// admit exactly once (the read-then-write in the current route lets both win), and a
// later sequential re-scan must be refused WITHOUT overwriting the original
// checkedInAt — the timestamp is the audit record of when that person actually walked
// in, and a re-scan must not rewrite history.

import { loadCheckin, shared } from './_checkin-harness.mts';

const s = await shared();

await s.withCleanup(
  'A4 concurrent double scan admits exactly once, timestamp immutable',
  async () => {
    const { checkInByBookingRef } = await loadCheckin();
    const id = s.runId();
    const bookingRef = `HARDEN-DOUBLE-${id}`;
    const ref = await s.createTicketDoc({
      bookingRef,
      attendeeEmail: s.sentinelEmail(`double-${id}`),
      status: 'paid',
      purchasedAt: new Date(),
    });

    const results = await Promise.all([
      checkInByBookingRef(bookingRef),
      checkInByBookingRef(bookingRef),
    ]);
    const admitted = results.filter((r) => r.ok === true).length;
    s.assert(
      admitted === 1,
      `two concurrent scans admitted ${admitted} time(s) — expected exactly 1 (results: ${JSON.stringify(results)})`
    );
    const loser = results.find((r) => r.ok === false);
    s.assert(
      loser?.code === 'already-checked-in' && loser?.httpStatus === 409,
      `the losing scan should report 'already-checked-in' / 409, got '${loser?.code}' / ${loser?.httpStatus}`
    );

    const afterRace = await s.readTicketById(ref.id);
    s.assert(
      afterRace?.status === 'checked-in',
      `expected 'checked-in', got '${afterRace?.status}'`
    );
    const firstStamp = afterRace?.checkedInAt?.toMillis?.() ?? null;
    s.assert(firstStamp != null, 'checkedInAt was not stamped by the winning scan');

    const rescan = await checkInByBookingRef(bookingRef);
    s.assert(
      rescan.ok === false && rescan.code === 'already-checked-in' && rescan.httpStatus === 409,
      `a re-scan of an admitted ticket must be refused with 409 already-checked-in, got ${JSON.stringify(rescan)}`
    );

    const afterRescan = await s.readTicketById(ref.id);
    s.assert(
      (afterRescan?.checkedInAt?.toMillis?.() ?? null) === firstStamp,
      'a refused re-scan overwrote the original checkedInAt timestamp'
    );
  }
);
