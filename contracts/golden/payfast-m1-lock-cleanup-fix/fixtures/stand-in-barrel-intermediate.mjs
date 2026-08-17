// Fixture only -- used by stand-in-barrel-entry.mjs / barrel-import-evasion.yaml
// (contracts/golden/payfast-m1-lock-cleanup-fix/lock-timeout-invariant.golden.md,
// "Regression fixture: barrel-import evasion"). Its only job is to re-export
// ticketing-hardening/_shared.mjs through a genuinely resolvable intermediate hop, so
// check-lock-timeout-invariant.mjs's import-graph walk must actually recurse through a
// FILE (not just follow one hardcoded name) to classify the entry script as
// lock-waiting. Unlike stand-in-lock-waiting-script.mjs's deliberately-broken path (for
// A3), this relative path is correct and resolves on disk for real -- the walk is
// expected to open this file and keep going, not just pattern-match a specifier string.
export * from '../../../checks/ticketing-hardening/_shared.mjs';
