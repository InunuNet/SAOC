#!/usr/bin/env node
// P0 contract admin-vendor-listing-serialization -- A14.
//
// Direct response to the team-lead's requirement #2 after the Codex GPT-5.5 finding: "Add an
// assertion that would fail if a NEW timestamp field were added to the type and left
// unconverted. A hardcoded allowlist re-breaks silently on the next schema change; the check
// should bind to the type or to shape, not to a list of names someone has to remember to
// update."
//
// A1 already proves every NAMED Timestamp-shaped field on VendorApplication today converts
// correctly. It cannot, by construction, prove anything about a field that does not exist
// yet. This check instead proves the STRUCTURAL property directly: `serializeVendorApplication`
// converts ANY value exposing a callable `.toDate()` -- at any key, at any depth, including
// inside a nested array of objects (the shape M2's repeating equipment/vehicle tables use
# elsewhere in this codebase) -- regardless of whether that key name is one this check, or the
// implementation, has ever seen before. Two synthetic fields are injected with deliberately
// invented names that appear NOWHERE in types/index.ts or in any allowlist any version of this
// module has ever shipped with: `futureApprovalTimestamp` (top-level) and a Timestamp buried
// inside `nestedEquipmentTable[0].calibratedAt` (array-of-objects, matching how a future
// repeating-table field would actually arrive from Firestore).
//
// If this check passes, an implementation that hardcodes a field-name list CANNOT be what
// produced it -- passing requires converting fields the implementation was never told the name
// of, which only a shape-based (duck-typed `.toDate()`) walk can do. This is the check the
// team lead asked for: it binds to shape, not to a list of names someone has to remember to
// update, and it will still catch a real future regression (someone reintroducing a
// hardcoded list) without needing this check itself edited when the type gains a field.
//
// RED proof (run against HEAD before the fix lands): lib/firestore-serialization.ts does not
// exist yet -- import throws, exit 1. Separately re-verified (architect pass, 2026-09-01)
// against a reconstruction of the actual shipped allowlist bug -- this check goes RED against
// it (the synthetic fields are never in any hardcoded list, so they survive as Timestamp
// instances), which is exactly the property a hardcoded list can never satisfy no matter how
// many real field names are added to it.
//
// Run as: node --import tsx/esm contracts/checks/admin-vendor-listing-serialization/check-vendor-application-structural-genericity.mjs

import { Timestamp } from 'firebase-admin/firestore';

const failures = [];

const futureApprovalTimestampSource = new Date('2027-03-01T00:00:00.000Z');
const calibratedAtSource = new Date('2027-03-02T00:00:00.000Z');

// A synthetic document shape: a real, populated VendorApplication-like document PLUS two
// fields under names this codebase has never used, one top-level and one nested inside an
// array of objects -- simulating a future schema addition before anyone updates any allowlist.
const seededData = {
  businessName: 'Future-Proofed Orchids',
  status: 'approved',
  submittedAt: Timestamp.fromDate(new Date('2027-01-05T12:00:00.000Z')),
  // Synthetic, never named in types/index.ts or any implementation this project has shipped:
  futureApprovalTimestamp: Timestamp.fromDate(futureApprovalTimestampSource),
  nestedEquipmentTable: [
    { equipmentName: 'Misting rig', calibratedAt: Timestamp.fromDate(calibratedAtSource) },
  ],
};
const seededId = 'app-structural-fixture-1';

function findTimestampInstances(value, pathLabel, hits) {
  if (value === null || value === undefined) return;
  if (value instanceof Timestamp) {
    hits.push(pathLabel);
    return;
  }
  if (value instanceof Date) return;
  if (Array.isArray(value)) {
    value.forEach((entry, i) => findTimestampInstances(entry, `${pathLabel}[${i}]`, hits));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      findTimestampInstances(entry, `${pathLabel}.${key}`, hits);
    }
  }
}

let serializeVendorApplication;
try {
  ({ serializeVendorApplication } = await import('../../../lib/firestore-serialization.ts'));
} catch (err) {
  failures.push(
    `GATE IMPORT FAILED: lib/firestore-serialization.ts's serializeVendorApplication could not ` +
      `be imported -- ${err instanceof Error ? err.message : String(err)}`,
  );
}

if (serializeVendorApplication) {
  let result;
  try {
    result = serializeVendorApplication(seededId, seededData);
  } catch (err) {
    failures.push(`GATE THREW: ${err instanceof Error ? err.stack : String(err)}`);
  }

  if (result) {
    const gateHits = [];
    findTimestampInstances(result, 'result', gateHits);
    if (gateHits.length > 0) {
      failures.push(
        `GATE FAILED: unnamed/synthetic fields still carry Timestamp instance(s) at: ${gateHits.join(', ')} -- ` +
          'the implementation is bound to a list of known field names, not to shape. A field added to the ' +
          'type tomorrow and never added to that list would still crash the page.',
      );
    }

    const gotTop = result.futureApprovalTimestamp;
    if (!(gotTop instanceof Date)) {
      failures.push(`GATE FAILED: result.futureApprovalTimestamp is not a Date instance (got ${typeof gotTop}).`);
    } else if (gotTop.getTime() !== futureApprovalTimestampSource.getTime()) {
      failures.push('GATE FAILED: result.futureApprovalTimestamp is not millisecond-exact.');
    }

    const gotNested = result.nestedEquipmentTable?.[0]?.calibratedAt;
    if (!(gotNested instanceof Date)) {
      failures.push(
        `GATE FAILED: result.nestedEquipmentTable[0].calibratedAt is not a Date instance (got ${typeof gotNested}) -- ` +
          'nested array-of-objects Timestamps (the shape repeating equipment/vehicle tables use) must convert too.',
      );
    } else if (gotNested.getTime() !== calibratedAtSource.getTime()) {
      failures.push('GATE FAILED: result.nestedEquipmentTable[0].calibratedAt is not millisecond-exact.');
    }
  }
}

if (failures.length > 0) {
  console.error('FAIL: admin-vendor-listing-serialization A14 (structural genericity -- VendorApplication)');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}

console.log('PASS: serializeVendorApplication() converts Timestamp-shaped values by SHAPE, not by a hardcoded field-name list.');
process.exit(0);
