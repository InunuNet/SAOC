// F31-A1 - mapStatus on the REAL Ozow and PayFast adapters against goldens/f31/state-table.json.
// Run from the repo root: pnpm exec tsx contracts/checks/launch-weekend/f31/check-a-mapping.mts
import { readFileSync } from 'node:fs';
import { createOzowProvider } from '../../../../lib/payments/ozow.ts';
import { createPayfastProvider } from '../../../../lib/payments/payfast.ts';
import { makeChecker } from './_lib.mts';

const table = JSON.parse(readFileSync('.agent/memory/project/specs/launch-weekend/goldens/f31/state-table.json', 'utf8'));
const { eq, finish } = makeChecker('F31-A1 status mapping');
const ozow = createOzowProvider({ env: {} });
for (const row of table.rows) eq(`Ozow ${row.ozowStatus}`, ozow.mapStatus(row.ozowStatus), row.mapsTo);
for (const raw of table.unmapped.examples) eq(`Ozow unmapped ${JSON.stringify(raw)}`, ozow.mapStatus(raw), 'unknown');
// Only the exact string 'Complete' may ever be 'paid'.
for (const row of table.rows) if (row.ozowStatus !== 'Complete') eq(`${row.ozowStatus} is not paid`, ozow.mapStatus(row.ozowStatus) === 'paid', false);
// PayFast must be byte-for-byte unchanged.
const payfast = createPayfastProvider();
eq('PayFast COMPLETE', payfast.mapStatus('COMPLETE'), 'paid');
eq('PayFast FAILED', payfast.mapStatus('FAILED'), 'failed');
eq('PayFast PENDING', payfast.mapStatus('PENDING'), 'pending');
eq('PayFast CANCELLED', payfast.mapStatus('CANCELLED'), 'cancelled');
eq('PayFast other', payfast.mapStatus('ABANDONED'), 'unknown');
finish();
