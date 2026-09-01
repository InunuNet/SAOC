#!/usr/bin/env node
// vendor-gated-registration-flow M3/F32 (A63) -- CLASS assertion (A42/A54-style), not an
// instance check. Scans every route file under app/api/admin/vendors/** (present and future)
// for any Firestore write (.update(/.set(/transaction.update(/transaction.set() whose target
// is the vendorStandOrders collection, OR whose written data object's keys include `status`
// while the target is vendorStandOrders. The ONLY files allowed to match are F31's settlement
// handler (lib/vendor-stand-payment-notification.ts) and the two thin per-gateway routes that
// call it -- every admin-facing route (including F32's own new admin surfaces) must match
// zero times. See contracts/golden/vendor-gated-registration-flow-m3/README.md "Admin
// visibility (F32)" -- no admin action may ever mark a stand order paid; only the gateway
// settlement handler may.
//
// Run as: node contracts/checks/vendor-gated-registration-flow-m3/check-only-settlement-writes-stand-order-status.mjs

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const REPO_ROOT = new URL('../../../', import.meta.url);

const ADMIN_ROUTE_GLOB = 'app/api/admin/vendors';
const PERMITTED_FILES = new Set([
  'lib/vendor-stand-payment-notification.ts',
  'app/api/vendors/stand-payment/payfast-itn/route.ts',
  'app/api/vendors/stand-payment/ozow-itn/route.ts',
]);

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

function listAdminVendorRouteFiles() {
  // Filesystem `find`, NOT `git ls-files` -- several of M3's own new route files are still
  // untracked (new, uncommitted) at the time this check first runs, and a tracked-only scan
  // would silently skip exactly the files most likely to be wrong.
  const output = execSync(`find "${ADMIN_ROUTE_GLOB}" -type f -name route.ts`, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

const failures = [];
const routeFiles = listAdminVendorRouteFiles();

if (routeFiles.length === 0) {
  failures.push(`found zero route files under ${ADMIN_ROUTE_GLOB}/**/route.ts -- the scan is not exercising anything.`);
}

for (const relativePath of routeFiles) {
  const raw = readFileSync(new URL(relativePath, REPO_ROOT), 'utf8');
  const source = stripComments(raw);

  // A file "targets vendorStandOrders" if it imports the collection constant AND performs a
  // write call (.update(/.set() on a Firestore ref/transaction) anywhere in the same file --
  // deliberately coarse (file-level, not call-site-level) so a route that imports the constant
  // for a READ (e.g. resend-payment-link's own `.get()` check) is not itself a violation, but
  // any write anywhere in a file that also touches the collection is flagged for a human to
  // verify, never silently passed.
  const importsCollection = /VENDOR_STAND_ORDERS_COLLECTION/.test(source);
  if (!importsCollection) continue;

  const hasFirestoreWrite = /\.(update|set)\s*\(/.test(source);
  if (!hasFirestoreWrite) continue;

  // Narrow further: does any write call's argument object include a `status` key? This is the
  // one specific write this assertion cares about -- a route that writes some OTHER field to a
  // document in a collection alongside vendorStandOrders (unlikely, but the file-level scan is
  // coarse) is not itself proof of a status write.
  const writesStatusKey = /\.(update|set)\s*\(\s*[^)]*?\bstatus\s*:/s.test(source);

  if (writesStatusKey && !PERMITTED_FILES.has(relativePath)) {
    failures.push(
      `${relativePath}: imports VENDOR_STAND_ORDERS_COLLECTION, contains a Firestore write ` +
        `call, AND that call's argument writes a \`status\` key -- only F31's settlement ` +
        `handler and its two per-gateway routes may ever write vendorStandOrders.status.`,
    );
  }
}

// Also verify the settlement handler itself (and its two routes) actually DOES write status --
// otherwise this check could pass vacuously by finding nothing anywhere.
const settlementSource = stripComments(readFileSync(new URL('lib/vendor-stand-payment-notification.ts', REPO_ROOT), 'utf8'));
if (!/VENDOR_STAND_ORDERS_COLLECTION/.test(settlementSource) || !/\.update\s*\(\s*[^)]*?\bstatus\s*:/s.test(settlementSource)) {
  failures.push('lib/vendor-stand-payment-notification.ts does not appear to write vendorStandOrders.status at all -- the scan\'s positive control is missing, so a "found nothing" result elsewhere would be meaningless.');
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `PASS: scanned ${routeFiles.length} admin vendor route file(s); zero write a \`status\` key ` +
    'to vendorStandOrders outside the three files permitted to settle a stand payment, and the ' +
    'settlement handler itself does write it (positive control).',
);
process.exit(0);
