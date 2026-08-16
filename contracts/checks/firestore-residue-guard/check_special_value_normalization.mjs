#!/usr/bin/env -S pnpm exec tsx
// A13: Firestore-native value normalization (Timestamp / GeoPoint /
// DocumentReference) cannot be exercised through --fixture (JSON has no
// function values, so a duck-typed `{ toDate: fn }` shape cannot round-trip
// through a JSON fixture file — see contracts/golden/firestore-residue-guard/
// README.md, "Firestore-native value types"). This check imports the
// scanner's exported `toPlainValue` normalizer directly and exercises it
// against hand-built duck-typed fake Timestamp/GeoPoint/DocumentReference
// objects, proving the normalizer converts each to a string a marker pattern
// could actually match, INSTEAD of silently falling through generic
// Object.entries() recursion the way the Sanity guard's walk() originally did
// for numeric leaves (that guard's QA gap #2).
//
// Run with: pnpm exec tsx contracts/checks/firestore-residue-guard/check_special_value_normalization.mjs

import { toPlainValue } from '../../../scripts/scan-firestore-residue.ts';

let failures = 0;

function check(name, actual, expected) {
  if (actual !== expected) {
    failures += 1;
    console.error(`FAIL: ${name}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
  } else {
    console.log(`PASS: ${name}`);
  }
}

// Duck-typed fake Timestamp — matches the shape the Admin SDK's real
// firebase-admin/firestore Timestamp class exposes: a toDate() method.
const fakeTimestamp = {
  toDate: () => new Date('2026-08-12T09:15:00.000Z'),
};
check(
  'Timestamp-shaped value normalizes to its ISO string via toDate()',
  toPlainValue(fakeTimestamp),
  '2026-08-12T09:15:00.000Z',
);

// Duck-typed fake GeoPoint — numeric latitude/longitude, no toDate.
const fakeGeoPoint = { latitude: -33.9249, longitude: 18.4241 };
check(
  'GeoPoint-shaped value normalizes to "lat,lng"',
  toPlainValue(fakeGeoPoint),
  '-33.9249,18.4241',
);

// Duck-typed fake DocumentReference — string path, firestore/parent marker.
const fakeDocRef = {
  path: 'tickets/abc123',
  firestore: {},
  parent: {},
};
check(
  'DocumentReference-shaped value normalizes to its path',
  toPlainValue(fakeDocRef),
  'tickets/abc123',
);

// A plain nested object/array must fall through unchanged (recursion still
// happens in walk(), not here) — proves the normalizer isn't over-broad.
const plainNested = { a: 1, b: ['x', 'y'] };
const plainResult = toPlainValue(plainNested);
check(
  'Plain object falls through unchanged (identity)',
  JSON.stringify(plainResult),
  JSON.stringify(plainNested),
);

if (failures > 0) {
  console.error(`\nFAIL: ${failures} normalization case(s) failed.`);
  process.exit(1);
}
console.log('\nPASS: all Firestore-native value normalization cases passed.');
