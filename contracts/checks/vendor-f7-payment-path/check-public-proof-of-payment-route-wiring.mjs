#!/usr/bin/env node
// F7 (vendor-registration) -- A10: route-wiring discriminator for the PUBLIC proof-of-payment
// route. Unlike A9 (the admin payment route), this route must NOT be capability-gated -- it
// is the public-submitter half of the payment path, reached by a vendor who already has their
// own submission id from the F5 confirmation email. Same self-test-before-trust technique as
// A9/F6's A8: a frozen KNOWN-UNWIRED fixture must be rejected, this contract's own
// architect-authored WIRED golden must be accepted, before the real file is ever checked.
//
// Requires: imports and calls the REAL handleProofOfPaymentUpload() from
// '@/lib/vendor-proof-of-payment-handler' (never reimplementing rate-limiting, upload
// validation, or the non-enumerable existence check inline in the route itself); does NOT
// import '@/lib/admin-auth' or '@/lib/admin-roles' at all -- a route that is supposed to stay
// public should never even import the gate; and never returns a distinct 404-shaped response
// for a missing submission (that would defeat the handler's own non-enumerable posture at the
// route layer, even if the handler itself is correct).
//
// DEFEATING MUTATION: hand-rolling upload/rate-limit logic inline instead of delegating to
// handleProofOfPaymentUpload(); importing lib/admin-auth.ts/lib/admin-roles.ts at all; or the
// route itself returning a 404 (or any other existence-shaped branch) for a missing
// submission instead of always forwarding the handler's own response verbatim.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f7-payment-path/check-public-proof-of-payment-route-wiring.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

function isWiredCorrectly(source) {
  const importsHandler =
    /import\s*\{[^}]*\bhandleProofOfPaymentUpload\b[^}]*\}\s*from\s*['"]@\/lib\/vendor-proof-of-payment-handler['"]/.test(
      source,
    );
  const callsHandler = /handleProofOfPaymentUpload\(\s*\{/.test(source);

  const importsAdminAuth = /from\s+['"](@\/lib\/admin-auth|\.\.?\/.*admin-auth)['"]/.test(source);
  const importsAdminRoles = /from\s+['"](@\/lib\/admin-roles|\.\.?\/.*admin-roles)['"]/.test(source);
  const staysPublic = !importsAdminAuth && !importsAdminRoles;

  // The route must not itself branch on a 404-shaped existence check (that would leak
  // existence at the route layer regardless of what the handler proves offline).
  const noRouteLevel404 = !/status:\s*404/.test(source);

  return importsHandler && callsHandler && staysPublic && noRouteLevel404;
}

const unwiredFixturePath = path.join(__dirname, 'fixtures/proof-of-payment-route-unwired.fixture.ts.txt');
const wiredGoldenPath = path.join(
  REPO_ROOT,
  'contracts/golden/vendor-f7-payment-path/proof-of-payment-route-wired.expected.ts.txt',
);
const realPath = path.join(REPO_ROOT, 'app/api/vendors/[id]/proof-of-payment/route.ts');

const failures = [];
const unwired = readFileSync(unwiredFixturePath, 'utf8');
const wired = readFileSync(wiredGoldenPath, 'utf8');

if (isWiredCorrectly(unwired)) {
  failures.push(
    'SELF-TEST FAILED -- the discriminator reports the KNOWN-UNWIRED fixture as wired. ' +
      'The discriminator is broken and cannot be trusted against the real file.',
  );
} else if (!isWiredCorrectly(wired)) {
  failures.push(
    "SELF-TEST FAILED -- the discriminator reports this contract's own architect-authored " +
      'WIRED golden as unwired. The discriminator is broken and cannot be trusted against the real file.',
  );
} else {
  let realSource;
  try {
    realSource = readFileSync(realPath, 'utf8');
  } catch (error) {
    failures.push(`Could not read ${realPath}: ${error.message}`);
  }
  if (realSource !== undefined && !isWiredCorrectly(realSource)) {
    failures.push(
      `${realPath} does not pass the public-route wiring discriminator. Compare against ` +
        `${wiredGoldenPath} for the exact expected wiring.`,
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: app/api/vendors/[id]/proof-of-payment/route.ts imports and calls the real ' +
    'handleProofOfPaymentUpload() (never reimplementing rate-limiting/validation/existence ' +
    'logic inline), imports neither lib/admin-auth.ts nor lib/admin-roles.ts -- staying ' +
    'genuinely public -- and never returns a route-level 404 for a missing submission, which ' +
    "would leak existence even if the handler's own response is non-enumerable. The " +
    'discriminator passed its self-test before checking the real file.',
);
process.exit(0);
