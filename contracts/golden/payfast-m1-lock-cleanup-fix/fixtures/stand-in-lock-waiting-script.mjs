// Fixture only -- used by low-timeout.yaml's negative-control assertion
// (contracts/golden/payfast-m1-lock-cleanup-fix/lock-timeout-invariant.golden.md).
// Its only job is to be a script that imports ticketing-hardening/_shared.mjs, so
// check-lock-timeout-invariant.mjs's import-graph walk classifies it as
// "lock-waiting" and therefore subject to the MIN_ASSERTION_TIMEOUT_MS floor.
// Never actually run for real -- low-timeout.yaml is a fixture contract, not a real
// one, and this script is never wired into contract-payfast-m1.yaml itself.
import '../../../../checks/ticketing-hardening/_shared.mjs';

console.log('PASS: stand-in fixture (never meant to run for real)');
