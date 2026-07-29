#!/usr/bin/env node
// SECONDARY reinforcement only (A2) — a source grep, never the primary
// evidence of a fix. Confirms @dev did not "fix" the mismatch by papering
// over it with suppressHydrationWarning, which the brief forbids, on either
// the touched hook or its consumer(s).
//
// Negative control: this check currently PASSES against the unfixed
// baseline (the bug exists but suppressHydrationWarning was never used to
// hide it) — recorded here so its pass/fail meaning is not mistaken for
// "the bug is fixed". A1 (no-hydration-error-throttled.mjs) is the only
// check that proves the fix; this one only guards against a specific way
// of faking it.
import { readFileSync } from 'node:fs';
import { fail, pass } from './_shared.mjs';

const TOUCHED_FILES = [
  'lib/hooks/useCountdown.ts',
  'components/home/ShowBand.tsx',
];

const offenders = [];
for (const file of TOUCHED_FILES) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch (err) {
    fail(`could not read ${file} to check for suppressHydrationWarning — ${err?.message ?? err}`);
  }
  if (/suppressHydrationWarning/.test(content)) {
    offenders.push(file);
  }
}

if (offenders.length > 0) {
  fail(`suppressHydrationWarning found in forbidden file(s): ${offenders.join(', ')}`);
}

pass('no suppressHydrationWarning in lib/hooks/useCountdown.ts or components/home/ShowBand.tsx');
