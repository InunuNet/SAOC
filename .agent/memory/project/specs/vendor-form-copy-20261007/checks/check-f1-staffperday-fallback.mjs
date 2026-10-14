#!/usr/bin/env node
// F1 (vendor-form-copy-20261007) -- amendment 2026-10-08 (SAOC lead, via team-lead): the
// approval-confirmation email's staff-attendance display must be additive and backward-
// compatible, never a replacement. This is a fixture/behavioural check against the real
// decision function, not a grep -- a grep can only prove a field NAME appears somewhere in
// the file, not that the fallback logic actually picks the right branch for a given input.
//
// Exercises emails/VendorApprovalConfirmation.tsx's exported resolveStaffAttendanceDisplay()
// (the pure decision function @dev must add there, alongside the file's existing exported
// formatBoothNumber/formatOptionalField/formatRegistrationCodeForReadAloud helpers -- same
// "formatting lives in the email file, not the lib file" convention the file's own header
// comment already documents) against four fixtures:
//
//   1. legacy-only   (only staffPerDay set)       -> mode 'legacy', pre-feature document.
//   2. breakdown-only (only staffCount* set)       -> mode 'breakdown', post-feature document.
//   3. neither        (both absent)                -> mode 'none' (existing "Not specified"
//                                                       behaviour, unchanged).
//   4. both present  (staffPerDay AND staffCount*) -> mode 'breakdown'. Architect's explicit
//      priority rule: the per-day breakdown wins when both are present, because it is the
//      more granular, newer-shaped data. This case cannot arise from this feature's own write
//      path (new submissions never set staffPerDay; old ones never have staffCount*), but the
//      function must still have a defined, non-ambiguous answer for it -- e.g. a future manual
//      Firestore edit, or a migration script, should not get undefined behaviour.
//
// Run as:
//   npx tsx .agent/memory/project/specs/vendor-form-copy-20261007/checks/check-f1-staffperday-fallback.mjs

import { resolveStaffAttendanceDisplay, formatOptionalField } from '../../../../../../emails/VendorApprovalConfirmation.tsx';

const failures = [];
function fail(msg) {
  failures.push(msg);
}

function assertMode(label, result, expectedMode) {
  if (!result || result.mode !== expectedMode) {
    fail(`${label}: expected mode "${expectedMode}", got ${JSON.stringify(result)}`);
  }
}

// 1. Legacy-only -- the shape every pre-feature vendorSubmissions document has.
{
  const result = resolveStaffAttendanceDisplay({
    staffPerDay: 4,
    staffCountSetupDay: null,
    staffCountDay1: null,
    staffCountDay2: null,
    staffCountDay3: null,
    staffCountBreakdownDay: null,
  });
  assertMode('legacy-only', result, 'legacy');
  if (result?.value !== formatOptionalField(4)) {
    fail(`legacy-only: expected formatted value "${formatOptionalField(4)}", got ${JSON.stringify(result?.value)}`);
  }
}

// 2. Breakdown-only -- the shape every post-feature vendorSubmissions document has. Only one
// of the five fields set is enough to switch modes -- a vendor may leave some days blank.
{
  const result = resolveStaffAttendanceDisplay({
    staffPerDay: null,
    staffCountSetupDay: 2,
    staffCountDay1: null,
    staffCountDay2: null,
    staffCountDay3: null,
    staffCountBreakdownDay: null,
  });
  assertMode('breakdown-only (single day set)', result, 'breakdown');
  if (!Array.isArray(result?.days) || result.days.length !== 5) {
    fail(`breakdown-only: expected 5 day entries, got ${JSON.stringify(result?.days)}`);
  }
}

// 3. Neither present -- a totally blank submission (either vintage). Must fall back to the
// existing "Not specified" behaviour, never to the literal word "undefined" or an exception.
{
  const result = resolveStaffAttendanceDisplay({
    staffPerDay: null,
    staffCountSetupDay: null,
    staffCountDay1: null,
    staffCountDay2: null,
    staffCountDay3: null,
    staffCountBreakdownDay: null,
  });
  assertMode('neither present', result, 'none');
}

// 4. Both present -- architect's priority rule: breakdown wins.
{
  const result = resolveStaffAttendanceDisplay({
    staffPerDay: 9,
    staffCountSetupDay: 2,
    staffCountDay1: 3,
    staffCountDay2: null,
    staffCountDay3: null,
    staffCountBreakdownDay: null,
  });
  assertMode('both present (priority rule)', result, 'breakdown');
}

if (failures.length > 0) {
  console.error('FAIL:');
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
console.log('PASS: staff-attendance fallback logic is additive and backward-compatible across all four fixtures.');
