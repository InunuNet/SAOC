#!/usr/bin/env node
// PRIMARY assertion (A1). Behavioural, not a source grep: loads `/` under a
// ~3s `_next/**` throttle and asserts zero page errors and zero
// hydration-mismatch console errors.
//
// This is the check @architect ran as a negative control against the
// UNFIXED lib/hooks/useCountdown.ts on 2026-07-29 and confirmed it FAILS
// (see contracts/f1-countdown-hydration.yaml header comment for the
// captured output) — proving this check can actually detect the bug it
// exists to catch, before @dev is dispatched to fix it.
//
// Exit 0 only on a genuine pass. Any inability to run (browser missing,
// server unreachable) is a FAIL, never a silent skip (Athanor#1322).
import { collectHydrationSignals, fail, pass, BASE_URL } from './_shared.mjs';

let signals;
try {
  signals = await collectHydrationSignals({ path: '/' });
} catch (err) {
  fail(`could not execute the check against ${BASE_URL} — ${err?.message ?? err}`);
}

const { pageErrors, hydrationConsoleErrors } = signals;
const allIssues = [...pageErrors, ...hydrationConsoleErrors];

if (allIssues.length > 0) {
  fail(
    `${allIssues.length} hydration-related issue(s) loading / under throttle:\n` +
      allIssues.map((m, i) => `  [${i + 1}] ${m}`).join('\n'),
  );
}

pass('no page errors and no hydration-mismatch console errors loading / under a throttled _next/** load');
