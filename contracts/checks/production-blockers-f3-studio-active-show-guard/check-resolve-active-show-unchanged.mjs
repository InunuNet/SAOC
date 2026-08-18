#!/usr/bin/env node
// Regression proof: adding the Studio-side guard must not change
// lib/show-resolution.ts's resolveActiveShow() fail-closed behaviour, which
// ticketTypeMatchesActiveShow() (app/api/tickets/checkout/route.ts) depends on to reject
// every ticket type when zero or more than one show resolves active. This feature adds
// no code to either function — this check re-asserts their existing contract directly
// (self-contained in this feature's checks, not a dependency on
// contracts/checks/ticketing-f1-show-collision/) so a future edit to show-resolution.ts
// cannot silently regress the one invariant this guard is built to reduce the odds of
// ever being hit.
//
// Run as: node --import tsx/esm
//   contracts/checks/production-blockers-f3-studio-active-show-guard/check-resolve-active-show-unchanged.mjs

import { resolveActiveShow } from '../../../lib/show-resolution.ts';

const failures = [];

// Zero shows active — must fail closed to null, not silently pick a default.
{
  const shows = [
    { _id: 'show-18-2024', active: false },
    { _id: 'show-19-2027', active: false },
  ];
  const result = resolveActiveShow(shows);
  if (result !== null) {
    failures.push(`zero active: expected null, got ${JSON.stringify(result)}`);
  }
}

// Exactly one show active — must resolve to it.
{
  const shows = [
    { _id: 'show-18-2024', active: false },
    { _id: 'show-19-2027', active: true },
  ];
  const result = resolveActiveShow(shows);
  if (result !== 'show-19-2027') {
    failures.push(`one active: expected 'show-19-2027', got ${JSON.stringify(result)}`);
  }
}

// Two shows active (the exact editor mistake this feature's Studio guard exists to
// prevent) — must still fail closed to null, never guess.
{
  const shows = [
    { _id: 'show-18-2024', active: true },
    { _id: 'show-19-2027', active: true },
  ];
  const result = resolveActiveShow(shows);
  if (result !== null) {
    failures.push(`two active: expected null (ambiguous), got ${JSON.stringify(result)}`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: resolveActiveShow() fail-closed behaviour is unchanged by the Studio guard.');
process.exit(0);
