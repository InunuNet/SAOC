// F4 (conference-workshop-tickets, M2) — A4: a day-visitor reservation for Friday and one
// for Saturday draw from INDEPENDENT 1000-unit counters — selling out Friday does not
// block Saturday. Proven by composing the real resolveDayQualifiedPoolKey() (A1) with the
// real, UNMODIFIED planPooledCapacity() (lib/checkout-reservation.ts:440) — exactly the
// shape route.ts's day-qualified call site must build. Fails today because
// resolveDayQualifiedPoolKey doesn't exist yet (A1) — the property is new, even though
// planPooledCapacity itself needs no change.
import { loadRepoModule, finish } from './_lib.mjs';

let mod;
try {
  mod = await loadRepoModule('lib/checkout-reservation.ts');
} catch (error) {
  finish('check-day-caps-independent.mjs', [`could not import lib/checkout-reservation.ts: ${error.message}`]);
}

const { resolveDayQualifiedPoolKey, planPooledCapacity } = mod;
if (typeof resolveDayQualifiedPoolKey !== 'function') {
  finish('check-day-caps-independent.mjs', ['resolveDayQualifiedPoolKey is not exported (see A1)']);
}
if (typeof planPooledCapacity !== 'function') {
  finish('check-day-caps-independent.mjs', ['planPooledCapacity is not exported — this should already exist, unmodified']);
}

const failures = [];
const FRIDAY = '2027-09-24';
const SATURDAY = '2027-09-25';
const DAY_CAP = 1000;

const fridayKey = resolveDayQualifiedPoolKey('day-visitor', FRIDAY, true);
const saturdayKey = resolveDayQualifiedPoolKey('day-visitor', SATURDAY, true);

if (fridayKey === saturdayKey) {
  failures.push(`Friday and Saturday resolved to the SAME pool key (${JSON.stringify(fridayKey)}) — they must be independent`);
}

// Friday is already sold out (1000/1000) — one more request for Friday must be rejected,
// while the SAME call's Saturday counter (0/1000, even though this is the SAME
// planPooledCapacity() invocation) must still succeed — proving the two days do not share
// one aggregate counter.
const result = planPooledCapacity({
  requestedQtyByType: { [fridayKey]: 1, [saturdayKey]: 1 },
  soldCountsByType: { [fridayKey]: DAY_CAP, [saturdayKey]: 0 },
  capacityByType: { [fridayKey]: DAY_CAP, [saturdayKey]: DAY_CAP },
  poolConfigByType: {},
});

if (result.kind !== 'over-capacity') {
  failures.push(`expected an over-capacity result (Friday is sold out), got ${JSON.stringify(result)}`);
} else {
  if (!result.ticketTypes.includes(fridayKey)) {
    failures.push(`over-capacity result does not name the sold-out Friday key ${JSON.stringify(fridayKey)}: ${JSON.stringify(result.ticketTypes)}`);
  }
  if (result.ticketTypes.includes(saturdayKey)) {
    failures.push(`Saturday's key ${JSON.stringify(saturdayKey)} was wrongly rejected alongside Friday's sellout — the two days are not independent`);
  }
}

finish(
  'check-day-caps-independent.mjs',
  failures,
  'Friday (sold out) and Saturday (available) resolve independently from the same day-visitor product.',
);
