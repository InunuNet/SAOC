#!/usr/bin/env node
// P0 contract admin-vendor-listing-serialization -- A15. Mirrors
// check-vendor-application-structural-genericity.mjs exactly, for VendorSubmission -- the
// same requirement (team-lead, post-Codex GPT-5.5 finding): prove the conversion binds to
// SHAPE (anything with a callable `.toDate()`, at any depth, inside arrays too), not to a
// hardcoded field-name list, so a field added to the type tomorrow is converted correctly
// without anyone needing to remember to update an allowlist.
//
// Two synthetic fields, names invented for this check, appearing nowhere in types/index.ts or
// in any implementation this project has shipped: `futureShippingManifestTimestamp`
// (top-level) and a Timestamp nested inside `nestedVehicleTable[0].inspectedAt`
// (array-of-objects -- M2 added real repeating vehicle/equipment tables to VendorSubmission;
// this simulates a hypothetical Timestamp-bearing field inside one).
//
// RED proof: same as its sibling -- import fails against HEAD; separately re-verified RED
// against a reconstruction of the actual shipped VENDOR_SUBMISSION_TIMESTAMP_FIELDS allowlist
// bug (architect pass, 2026-09-01).
//
// Run as: node --import tsx/esm contracts/checks/admin-vendor-listing-serialization/check-vendor-submission-structural-genericity.mjs

import { Timestamp } from 'firebase-admin/firestore';

const failures = [];

const futureFieldSource = new Date('2027-04-01T00:00:00.000Z');
const inspectedAtSource = new Date('2027-04-02T00:00:00.000Z');

const seededData = {
  businessName: 'Future-Proofed Orchid Nursery',
  status: 'approved',
  submittedAt: Timestamp.fromDate(new Date('2027-02-10T08:00:00.000Z')),
  // Synthetic, never named in types/index.ts or any implementation this project has shipped:
  futureShippingManifestTimestamp: Timestamp.fromDate(futureFieldSource),
  nestedVehicleTable: [
    { vehicleType: 'bakkie', inspectedAt: Timestamp.fromDate(inspectedAtSource) },
  ],
};
const seededId = 'sub-structural-fixture-1';

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

let serializeVendorSubmission;
try {
  ({ serializeVendorSubmission } = await import('../../../lib/firestore-serialization.ts'));
} catch (err) {
  failures.push(
    `GATE IMPORT FAILED: lib/firestore-serialization.ts's serializeVendorSubmission could not ` +
      `be imported -- ${err instanceof Error ? err.message : String(err)}`,
  );
}

if (serializeVendorSubmission) {
  let result;
  try {
    result = serializeVendorSubmission(seededId, seededData);
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

    const gotTop = result.futureShippingManifestTimestamp;
    if (!(gotTop instanceof Date)) {
      failures.push(`GATE FAILED: result.futureShippingManifestTimestamp is not a Date instance (got ${typeof gotTop}).`);
    } else if (gotTop.getTime() !== futureFieldSource.getTime()) {
      failures.push('GATE FAILED: result.futureShippingManifestTimestamp is not millisecond-exact.');
    }

    const gotNested = result.nestedVehicleTable?.[0]?.inspectedAt;
    if (!(gotNested instanceof Date)) {
      failures.push(
        `GATE FAILED: result.nestedVehicleTable[0].inspectedAt is not a Date instance (got ${typeof gotNested}) -- ` +
          'nested array-of-objects Timestamps (the shape M2\'s repeating equipment/vehicle tables use) must convert too.',
      );
    } else if (gotNested.getTime() !== inspectedAtSource.getTime()) {
      failures.push('GATE FAILED: result.nestedVehicleTable[0].inspectedAt is not millisecond-exact.');
    }
  }
}

if (failures.length > 0) {
  console.error('FAIL: admin-vendor-listing-serialization A15 (structural genericity -- VendorSubmission)');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}

console.log('PASS: serializeVendorSubmission() converts Timestamp-shaped values by SHAPE, not by a hardcoded field-name list.');
process.exit(0);
