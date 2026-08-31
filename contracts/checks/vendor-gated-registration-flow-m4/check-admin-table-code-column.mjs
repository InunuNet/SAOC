#!/usr/bin/env node
// vendor-gated-registration-flow M4/F25 -- behavioural proof (real react-dom/server output,
// same technique as contracts/checks/ticketing-f4-admission-products/check-provisional-badge-
// gated.mjs) that VendorApplicationReviewTable.tsx renders a "Code" column populated from
// registrationCodeId ONLY for approved applications (never for pending/declined, where nothing
// has been minted), and a locked badge/marker gated on registrationCodeLockedAt.
//
// Run as: node --import tsx/esm contracts/checks/vendor-gated-registration-flow-m4/check-admin-table-code-column.mjs

import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

import { VendorApplicationReviewTable } from '../../../components/admin/VendorApplicationReviewTable.tsx';

const failures = [];
const stripTags = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const BASE = {
  businessName: 'Fynbos Pottery',
  contactPersonName: 'Jane Vendor',
  contactEmail: 'jane@example.com',
  contactCellPhone: '0821234567',
  vendorCategory: ['pottery-ceramics'],
  indicativeBoothCount: 1,
  submittedAt: new Date('2027-01-01T00:00:00Z'),
};

function render(applications) {
  return renderToStaticMarkup(React.createElement(VendorApplicationReviewTable, { applications }));
}

// --- Approved, unlocked: code renders, no locked marker ----------------------------------------
{
  const html = render([
    {
      ...BASE,
      id: 'approved-unlocked',
      status: 'approved',
      registrationCodeId: '4821',
      registrationCodeLockedAt: null,
    },
  ]);
  const text = stripTags(html);
  if (!text.includes('4821')) {
    failures.push(`approved application with registrationCodeId "4821" did not render the code; rendered text: "${text}"`);
  }
  if (/locked/i.test(text)) {
    failures.push(`approved-but-unlocked application rendered a locked marker when registrationCodeLockedAt was null; rendered text: "${text}"`);
  }
}

// --- Approved, locked: locked badge/marker renders ----------------------------------------------
{
  const html = render([
    {
      ...BASE,
      id: 'approved-locked',
      status: 'approved',
      registrationCodeId: '1357',
      registrationCodeLockedAt: new Date('2027-01-02T00:00:00Z'),
    },
  ]);
  const text = stripTags(html);
  if (!text.includes('1357')) {
    failures.push(`approved+locked application did not render its registrationCodeId; rendered text: "${text}"`);
  }
  if (!/locked/i.test(text)) {
    failures.push(`approved application with registrationCodeLockedAt set did not render a locked marker; rendered text: "${text}"`);
  }
}

// --- Pending: no code column value, even though registrationCodeId is technically absent -------
{
  const html = render([
    {
      ...BASE,
      id: 'pending-app',
      status: 'pending',
    },
  ]);
  const text = stripTags(html);
  if (/\b4821\b|\b1357\b/.test(text)) {
    failures.push(`pending application rendered a stray registration code; rendered text: "${text}"`);
  }
}

// --- Negative control: a NON-approved application that somehow carries a stale registrationCodeId
//     (e.g. a declined application from a prior approve/decline cycle) must NOT render the code --
//     "nothing has been minted for this application's current status" is a status property, not
//     merely a field-presence check, and this is the case that would catch a `row.registrationCodeId
//     ?? '--'` implementation that forgot the status gate entirely.
// -------------------------------------------------------------------------------------------------
{
  const html = render([
    {
      ...BASE,
      id: 'declined-with-stale-code',
      status: 'declined',
      registrationCodeId: '9999',
    },
  ]);
  const text = stripTags(html);
  if (text.includes('9999')) {
    failures.push('a declined application with a stale registrationCodeId rendered the code -- the "Code" column must be gated on status === "approved", not just field presence.');
  }
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: VendorApplicationReviewTable renders the Code column populated only for approved ' +
    'applications (never for pending/declined, even with a stale registrationCodeId present), ' +
    'and a locked marker gated on registrationCodeLockedAt.',
);
process.exit(0);
