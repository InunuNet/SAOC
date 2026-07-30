#!/usr/bin/env node
// A1 — PRIMARY: the deployed home page (F2_CHECK_BASE_URL, default the real prod
// host) produces zero page errors and zero hydration-mismatch console errors under
// a throttled load. This is the check that proves F1's useCountdown fix actually
// reached real users — not just that it works on localhost.
//
// NEGATIVE CONTROL (recorded 2026-07-29 by @architect, run against the CURRENT
// deployed prod host BEFORE this feature's deploy step — see contract header for
// the full transcript):
//
//   $ node contracts/checks/f2-deploy-next16/no-hydration-error-deployed.mjs
//   FAIL: 1 hydration-related issue(s) loading / under throttle:
//     [1] Minified React error #418; visit https://react.dev/errors/418...
//   EXIT CODE: 1
//
// That is the real pre-deploy baseline (prod still on the old build) — this check
// can and does fail against it. It must flip to PASS once F1+F2 are live.
//
// Never skips green on a broken environment — unreachable host or browser-launch
// failure is a hard FAIL (Athanor#1322), never a silent skip.
import { collectHydrationSignals, fail, pass, BASE_URL } from './_shared.mjs';

let signals;
try {
  signals = await collectHydrationSignals('/');
} catch (err) {
  fail(`could not execute the check against ${BASE_URL} — ${err?.message ?? err}`);
}

const { pageErrors, hydrationConsoleErrors } = signals;
const allIssues = [...pageErrors, ...hydrationConsoleErrors];

if (allIssues.length > 0) {
  fail(
    `${allIssues.length} hydration-related issue(s) loading ${BASE_URL}/ under throttle:\n` +
      allIssues.map((m, i) => `  [${i + 1}] ${m}`).join('\n')
  );
}

pass(`no page errors and no hydration-mismatch console errors loading ${BASE_URL}/`);
