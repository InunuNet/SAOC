// footer-newsletter-subscribe -- attempt store stays bounded under a key flood. Run: npx tsx <this file>
import { createAttemptStore, MAX_TRACKED_KEYS } from '../../../../../../lib/newsletter-rate-store.ts';
import { decideRateLimit } from '../../../../../../lib/resend-rate-limit.ts';

const failures = [];
const check = (name, ok) => { if (!ok) failures.push(name); };
const HOUR = 60 * 60 * 1000;
const T0 = Date.UTC(2027, 0, 5);
const at = (ms) => new Date(T0 + ms);
const countTracked = (store, prefix, n) => {
  let tracked = 0;
  for (let i = 0; i < n; i++) if (store.getPriorAttempts(`${prefix}:${i}`).length > 0) tracked++;
  return tracked;
};

// the cap holds under a flood of distinct live keys
const CAP = 50;
const small = createAttemptStore(HOUR, CAP);
for (let i = 0; i < CAP * 20; i++) small.recordAttempt(`flood:${i}`, at(i));
const tracked = countTracked(small, 'flood', CAP * 20);
check(`map never exceeds the cap (tracked ${tracked})`, tracked <= CAP);
check('newest keys survive, oldest evicted', small.getPriorAttempts(`flood:${CAP * 20 - 1}`).length === 1 && small.getPriorAttempts('flood:0').length === 0);

// the default cap is the exported constant and a flood past it stays bounded
const big = createAttemptStore(HOUR);
for (let i = 0; i < MAX_TRACKED_KEYS + 500; i++) big.recordAttempt(`k:${i}`, at(i));
const bigTracked = countTracked(big, 'k', MAX_TRACKED_KEYS + 500);
check(`default cap holds (tracked ${bigTracked})`, bigTracked <= MAX_TRACKED_KEYS);

// expired keys are pruned from the head without needing the cap
const aging = createAttemptStore(HOUR, 1000);
aging.recordAttempt('old', at(0));
aging.recordAttempt('new', at(HOUR + 1));
check('expired key pruned on the next record', aging.getPriorAttempts('old').length === 0 && aging.getPriorAttempts('new').length === 1);

// per-key limiting still works, including a hot key flooded past the per-key trim
const limited = createAttemptStore(HOUR, CAP);
const MAX = 5;
let allowed = 0;
for (let i = 0; i < 200; i++) {
  const prior = limited.getPriorAttempts('ip:1');
  limited.recordAttempt('ip:1', at(i));
  if (decideRateLimit({ key: 'ip:1', now: at(i), priorAttempts: prior, maxAttempts: MAX, windowMs: HOUR }).allowed) allowed++;
}
check(`only ${MAX} of 200 attempts allowed (got ${allowed})`, allowed === MAX);
check('hot key history is trimmed', limited.getPriorAttempts('ip:1').length <= 50);
check('other key unaffected', decideRateLimit({ key: 'ip:2', now: at(300), priorAttempts: limited.getPriorAttempts('ip:2'), maxAttempts: MAX, windowMs: HOUR }).allowed);

if (failures.length) { console.error('FAIL', failures); process.exit(1); }
console.log('rate store checks pass');
