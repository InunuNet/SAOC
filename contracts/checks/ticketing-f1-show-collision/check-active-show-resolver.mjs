#!/usr/bin/env node
// Behavioural proof of lib/show-resolution.ts's resolveActiveShow(), run against the
// three fixtures in contracts/golden/ticketing-f1-show-collision/active-show-fixtures/.
// Real function calls — no source grep. Covers the positive case and BOTH negative
// controls (no active show; two active shows, an editor mistake) required by the
// contract: fail-closed (null), never a guess.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f1-show-collision/check-active-show-resolver.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { resolveActiveShow } from '../../../lib/show-resolution.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(
  __dirname,
  '../../golden/ticketing-f1-show-collision/active-show-fixtures'
);

function loadFixture(name) {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'));
}

const failures = [];

// Positive: exactly one active show resolves to its _id.
{
  const shows = loadFixture('positive-single-active.json');
  const result = resolveActiveShow(shows);
  if (result !== 'show-19-2027') {
    failures.push(
      `positive-single-active.json: expected 'show-19-2027', got ${JSON.stringify(result)}`
    );
  }
}

// Negative control 1: no show has active === true (today's real pre-migration shape).
{
  const shows = loadFixture('negative-none-active.json');
  const result = resolveActiveShow(shows);
  if (result !== null) {
    failures.push(`negative-none-active.json: expected null, got ${JSON.stringify(result)}`);
  }
}

// Negative control 2: two shows both marked active — must fail closed, not pick one.
{
  const shows = loadFixture('negative-two-active.json');
  const result = resolveActiveShow(shows);
  if (result !== null) {
    failures.push(`negative-two-active.json: expected null (ambiguous), got ${JSON.stringify(result)}`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: resolveActiveShow resolves the single active show and fails closed on both negative controls.');
process.exit(0);
