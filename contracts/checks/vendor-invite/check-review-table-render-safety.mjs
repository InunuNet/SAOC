#!/usr/bin/env node
// vendor-invite F1 — A7: render-safety proof of the real
// components/admin/VendorApplicationReviewTable.tsx, via react-dom/server's
// renderToStaticMarkup (no test framework is installed in this repo — same reasoning as every
// other behavioural check here: compose the REAL implementation, don't mock it).
//
// Proves: (a) a fixture VendorApplication that omits vendorCategory and indicativeBoothCount
// entirely does not throw and renders the '—' fallback, rather than crashing on
// `.join(', ')` of undefined; (b) a fixture with origin: 'invited' renders an "Invited"
// marker; (c) a fixture with NO origin key at all (every pre-mission document) does NOT
// render that marker.
//
// DEFEATING MUTATION: the original unguarded `row.vendorCategory.join(', ')` /
// `row.indicativeBoothCount` source throws a TypeError on fixture (a) — this check must FAIL
// (not silently pass) against that source, which is why it imports and renders the REAL
// component rather than asserting on source text.
//
// Run as: npx tsx contracts/checks/vendor-invite/check-review-table-render-safety.mjs

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const { VendorApplicationReviewTable } = await import(
  '../../../components/admin/VendorApplicationReviewTable.tsx'
);

const failures = [];

const BASE = {
  id: 'app-1',
  businessName: 'Highveld Orchid Nursery',
  contactPersonName: 'Thandi Nkosi',
  contactEmail: 'thandi@highveldorchids.example',
  status: 'approved',
  submittedAt: new Date('2026-10-08T09:00:00.000Z'),
};

// (a) Missing vendorCategory/indicativeBoothCount entirely — must not throw, must show '—'.
{
  const invited = { ...BASE, origin: 'invited', registrationCodeId: '4821' };
  let markup;
  let threw;
  let thrownError;
  try {
    markup = renderToStaticMarkup(React.createElement(VendorApplicationReviewTable, { applications: [invited] }));
    threw = false;
  } catch (error) {
    threw = true;
    thrownError = error;
  }

  if (threw) {
    failures.push(`(a) rendering a VendorApplication missing vendorCategory/indicativeBoothCount threw: ${thrownError instanceof Error ? thrownError.message : String(thrownError)}`);
  } else {
    if (!markup.includes('—')) {
      failures.push("(a) expected the '—' fallback to appear for the missing vendorCategory/indicativeBoothCount fields, but it did not");
    }
    // (b) origin: 'invited' must render an Invited marker on this same fixture.
    if (!/Invited/i.test(markup)) {
      failures.push("(b) expected an 'Invited' marker for a row with origin: 'invited', but none was found in the rendered markup");
    }
  }
}

// (c) No origin key at all (every pre-mission, publicly-applied document) must NOT render the
// Invited marker, and must still render correctly with vendorCategory/indicativeBoothCount
// present (the pre-mission, already-working case must not regress).
{
  const publicApplication = {
    ...BASE,
    status: 'pending',
    vendorCategory: ['orchids', 'succulents'],
    indicativeBoothCount: 2,
  };
  delete publicApplication.origin;

  let markup;
  let threw;
  try {
    markup = renderToStaticMarkup(React.createElement(VendorApplicationReviewTable, { applications: [publicApplication] }));
    threw = false;
  } catch (error) {
    threw = true;
    failures.push(`(c) rendering a normal pre-mission public application threw: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!threw) {
    if (/Invited/i.test(markup)) {
      failures.push("(c) expected NO 'Invited' marker for a row with no origin key at all, but one was found");
    }
    if (!markup.includes('orchids, succulents')) {
      failures.push('(c) expected the existing vendorCategory rendering to be unaffected for a normal public application');
    }
    if (!/>2</.test(markup) && !markup.includes('>2<')) {
      // Loose check: the indicativeBoothCount value 2 should appear somewhere in the markup.
      if (!markup.includes('2')) {
        failures.push('(c) expected the existing indicativeBoothCount rendering (2) to be unaffected for a normal public application');
      }
    }
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  "PASS: VendorApplicationReviewTable renders a row missing vendorCategory/indicativeBoothCount " +
    "without throwing (showing the '—' fallback), shows an 'Invited' marker only for " +
    "origin: 'invited', and still renders a normal pre-mission public application unaffected.",
);
process.exit(0);
