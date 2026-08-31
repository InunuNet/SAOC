#!/usr/bin/env node
// F13 (vendor-gated-registration-flow, M2) — A39: F13's category-list correction retired the
// old 'food-retailer' VendorCategory member in favour of 'food-beverage-retailer'.
// isFoodRetailer() (lib/vendor-register-form-payload.ts) gates every food-vendor-only field
// (foodHandlingCertificateNumber, foodItemList, foodHealthTradingDocumentation) and the
// checkbox rendering in VendorCategoryFieldset.tsx. Without updating its string literal in
// lockstep with F13's rename, every food-vendor-only field becomes permanently unreachable --
// the fieldset never offers 'food-retailer' as a selectable value again, so the gate can never
// open. @dev fixed the literal as part of F13; this closes the gap flagged in review: nothing
// in F13's own assertion set (A22-A26) previously exercised isFoodRetailer's behaviour at all.
//
// Real behavioural call against the production function, not a grep for the string --
// mirrors the technique used by every other boundary check in this mission (e.g. A29's sibling
// pattern once F15 lands, A33's marketing-upload boundaries today).
//
// FAILS ON: isFoodRetailer() failing to gate open for the current 'food-beverage-retailer'
// category value, gating open for the retired 'food-retailer' value (a residual reference that
// should not exist), or 'food-beverage-retailer' being absent from
// VENDOR_CATEGORY_OPTIONS in the fieldset component (which would make the category unreachable
// through the UI even if isFoodRetailer's own logic were correct).
//
// Run as: npx tsx contracts/checks/vendor-gated-registration-flow-m2/check-food-retailer-gate-tracks-f13-rename.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { isFoodRetailer } from '../../../lib/vendor-register-form-payload.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const failures = [];

const baseState = { vendorCategory: [] };

// (1) The current, correct category value must open the gate.
{
  const state = { ...baseState, vendorCategory: ['food-beverage-retailer'] };
  if (isFoodRetailer(state) !== true) {
    failures.push("isFoodRetailer(['food-beverage-retailer']) must be true, got false -- the gate would never open for the real F13 category value.");
  }
}

// (2) The retired category value must NOT open the gate (proves the literal was actually
// renamed, not left matching the old value in addition to the new one).
{
  const state = { ...baseState, vendorCategory: ['food-retailer'] };
  if (isFoodRetailer(state) !== false) {
    failures.push("isFoodRetailer(['food-retailer']) must be false -- 'food-retailer' is a retired F13 value and should not match.");
  }
}

// (3) An unrelated category must not open the gate.
{
  const state = { ...baseState, vendorCategory: ['orchids'] };
  if (isFoodRetailer(state) !== false) {
    failures.push("isFoodRetailer(['orchids']) must be false.");
  }
}

// (4) The category must actually be selectable through the UI -- isFoodRetailer's logic being
// correct is worthless if VENDOR_CATEGORY_OPTIONS never offers the value it checks for.
{
  const fieldsetSource = readFileSync(path.join(ROOT, 'components/vendors/VendorCategoryFieldset.tsx'), 'utf8');
  const startIdx = fieldsetSource.indexOf('const VENDOR_CATEGORY_OPTIONS');
  const closeIdx = fieldsetSource.indexOf('\n];', startIdx);
  const block = startIdx === -1 ? '' : fieldsetSource.slice(startIdx, closeIdx === -1 ? undefined : closeIdx);
  if (!block.includes("value: 'food-beverage-retailer'")) {
    failures.push("VENDOR_CATEGORY_OPTIONS does not offer 'food-beverage-retailer' -- isFoodRetailer's gate is unreachable through the real UI.");
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log("PASS: isFoodRetailer() tracks F13's category rename ('food-beverage-retailer' opens the gate, retired 'food-retailer' does not), and the category is reachable through VENDOR_CATEGORY_OPTIONS.");
process.exit(0);
