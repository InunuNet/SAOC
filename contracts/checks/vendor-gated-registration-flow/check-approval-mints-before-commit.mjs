#!/usr/bin/env node
// vendor-gated-registration-flow M1 fix pass -- guards the ordering fix in
// app/api/admin/vendors/applications/[id]/review/route.ts.
//
// The defect: the status transition to `approved` was committed BEFORE the registration secret
// was read and the token minted. With VENDOR_REGISTRATION_TOKEN_SECRET unset, the application
// was left permanently `approved` with no link ever sent -- and the review machine (correctly)
// refuses to re-approve an approved application, so no operator could clear it from the UI.
//
// LIMITATION, stated plainly: this is a SOURCE-ORDER assertion, not a behavioural one. Running
// the real route needs a Firebase Admin credential and an authenticated admin session cookie,
// neither of which exists in this environment, so this check cannot prove the runtime effect --
// only that the shape which produced it is gone and cannot silently return. The closed-machine
// behaviour it depends on IS proven behaviourally, by
// check-application-review-transitions.mjs.
//
// Run as: node contracts/checks/vendor-gated-registration-flow/check-approval-mints-before-commit.mjs

import { readFileSync } from 'node:fs';

const ROUTE = 'app/api/admin/vendors/applications/[id]/review/route.ts';
const raw = readFileSync(new URL(`../../../${ROUTE}`, import.meta.url), 'utf8');

// Strip comments before any ordering assertion. This file's own header comment mentions
// `ref.update()` in prose; matching that would make every ordering check below pass or fail for
// the wrong reason. Blanked to spaces rather than removed so offsets stay meaningful.
const source = raw
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));

const failures = [];

const mintAt = source.indexOf('mintVendorRegistrationToken({');
const secretAt = source.indexOf('process.env.VENDOR_REGISTRATION_TOKEN_SECRET');
const firstUpdateAt = source.indexOf('ref.update(');

if (mintAt === -1) failures.push(`${ROUTE}: no mintVendorRegistrationToken({...}) call found.`);
if (secretAt === -1) failures.push(`${ROUTE}: no VENDOR_REGISTRATION_TOKEN_SECRET read found.`);
if (firstUpdateAt === -1) failures.push(`${ROUTE}: no ref.update(...) call found.`);

if (failures.length === 0) {
  if (secretAt > firstUpdateAt) {
    failures.push(
      `${ROUTE}: the registration secret is read AFTER the first ref.update() -- an approval can ` +
        `commit before the secret is known to exist.`,
    );
  }
  if (mintAt > firstUpdateAt) {
    failures.push(
      `${ROUTE}: the token is minted AFTER the first ref.update() -- an approval can commit and ` +
        `then fail to mint, leaving the application terminally approved with no link.`,
    );
  }
}

// The missing-secret branch must RETURN (refusing the whole operation), never log-and-continue.
const missingSecretBranch = source.slice(secretAt, mintAt === -1 ? undefined : mintAt);
if (!/return NextResponse\.json\(/.test(missingSecretBranch)) {
  failures.push(
    `${ROUTE}: the missing-secret branch does not return a response -- it must fail the whole ` +
      `approval, not proceed to commit one.`,
  );
}

// No silent fallback secret may be introduced.
if (/VENDOR_REGISTRATION_TOKEN_SECRET\s*(\?\?|\|\|)/.test(source)) {
  failures.push(`${ROUTE}: VENDOR_REGISTRATION_TOKEN_SECRET has a fallback default -- fail closed instead.`);
}

// The minting failure path must also refuse rather than commit.
if (!/catch \(error\) \{[\s\S]{0,600}?Cannot approve/.test(source)) {
  failures.push(
    `${ROUTE}: a mintVendorRegistrationToken() throw does not refuse the approval with an ` +
      `operator-facing "Cannot approve" error.`,
  );
}

// The review machine must NOT have been weakened to allow re-approving an approved application.
const machine = readFileSync(new URL('../../../lib/vendor-application-review.ts', import.meta.url), 'utf8');
if (/'approved'\s*:\s*\{[\s\S]{0,200}?approve/.test(machine)) {
  failures.push('lib/vendor-application-review.ts appears to allow an action from the approved state.');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: the approval route reads the registration secret and mints the token BEFORE any ' +
    'ref.update(), refuses the whole approval (no commit) on a missing secret or a minting ' +
    'failure, adds no fallback secret, and leaves the closed review machine unweakened.',
);
process.exit(0);
