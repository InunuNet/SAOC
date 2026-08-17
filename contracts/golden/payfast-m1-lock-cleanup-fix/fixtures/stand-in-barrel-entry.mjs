// Fixture only -- used by barrel-import-evasion.yaml's negative-control assertion
// (contracts/golden/payfast-m1-lock-cleanup-fix/lock-timeout-invariant.golden.md,
// "Regression fixture: barrel-import evasion"). This is the entry script the fixture
// contract's command actually invokes. It does NOT import ticketing-hardening/_shared.mjs
// directly, and it does NOT go through payfast-m1/_itn-harness.mts -- it reaches
// _shared.mjs only via stand-in-barrel-intermediate.mjs's `export * from`. A check that
// only follows one hardcoded hop through _itn-harness.mts (the original defeat @qa
// found) would classify this script as "not lock-waiting" and wrongly PASS a
// timeout_seconds of 10. The generic recursive walk must classify it as lock-waiting.
import './stand-in-barrel-intermediate.mjs';

console.log('PASS: stand-in barrel-entry fixture (never meant to run for real)');
