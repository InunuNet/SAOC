// F4 (conference-workshop-tickets, M2) — A1: resolveDayQualifiedPoolKey() is a pure
// helper exporting from lib/checkout-reservation.ts that returns
// `${poolKeyBase}::${chosenDay}` only when requiresDaySelection is true, poolKeyBase
// unchanged otherwise. This is the ONE new thing route.ts needs to make Friday/
// Saturday/Sunday independent 1000-caps — planPooledCapacity() itself stays unmodified
// (A3's own grep assertion); only the KEY shape fed into it changes.
import { loadRepoModule, finish } from './_lib.mjs';

let mod;
try {
  mod = await loadRepoModule('lib/checkout-reservation.ts');
} catch (error) {
  finish('check-day-qualified-pool-key.mjs', [`could not import lib/checkout-reservation.ts: ${error.message}`]);
}

if (typeof mod.resolveDayQualifiedPoolKey !== 'function') {
  finish('check-day-qualified-pool-key.mjs', [
    `lib/checkout-reservation.ts does not export resolveDayQualifiedPoolKey — got ${typeof mod.resolveDayQualifiedPoolKey}`,
  ]);
}

const { resolveDayQualifiedPoolKey } = mod;
const failures = [];

function check(name, actual, expected) {
  if (actual !== expected) {
    failures.push(`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

check(
  'requiresDaySelection=true qualifies the key with the chosen day',
  resolveDayQualifiedPoolKey('day-visitor', '2027-09-24', true),
  'day-visitor::2027-09-24',
);
check(
  'requiresDaySelection=true with a different day produces a DIFFERENT key (independence)',
  resolveDayQualifiedPoolKey('day-visitor', '2027-09-25', true),
  'day-visitor::2027-09-25',
);
check(
  'requiresDaySelection=false leaves poolKeyBase unchanged, regardless of chosenDay',
  resolveDayQualifiedPoolKey('admission-early-bird', '2027-09-24', false),
  'admission-early-bird',
);
check(
  'requiresDaySelection=false with no chosenDay at all still leaves poolKeyBase unchanged',
  resolveDayQualifiedPoolKey('weekend-pass', undefined, false),
  'weekend-pass',
);

finish(
  'check-day-qualified-pool-key.mjs',
  failures,
  'resolveDayQualifiedPoolKey() day-qualifies only when requiresDaySelection is true.',
);
