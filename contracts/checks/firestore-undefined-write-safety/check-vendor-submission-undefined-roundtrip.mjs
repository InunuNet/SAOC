#!/usr/bin/env node
// mission firestore-undefined-write-safety -- RED check (A1), architect pass 2026-09-01.
//
// Proves the REAL property: a minimal, valid vendorSubmissions payload whose optional fields
// are genuinely ABSENT (not present as keys at all -- never `''`) round-trips through the
// exact write shape app/api/vendors/register/route.ts:172 uses
// (`db.collection(VENDOR_SUBMISSIONS_COLLECTION).add({ ...doc, submittedAt: ... })`) without
// the Firebase Admin SDK throwing on an `undefined` own-property value.
//
// WHY THIS IS CREDENTIAL-FREE AND DETERMINISTIC: the Admin SDK (google-cloud/firestore under
// the hood) validates document data SYNCHRONOUSLY, before any network I/O, and throws
// `FirebaseError: Value for argument "data" is not a valid Firestore document. Cannot use
// "undefined" as a Firestore value ...` right there in the `.add()` call -- confirmed by
// probing with a locally-generated, throwaway RSA keypair (never a real credential, never a
// real project) against a `demo-project` cert. The .add() promise itself is never awaited:
// whatever happens after the synchronous validation passes (a network call that will fail
// with UNAUTHENTICATED against this fake project) is irrelevant to what this check proves and
// is explicitly NOT awaited, so it can never turn this check flaky against network conditions
// or actual credentials.
//
// FIX-LAYER AGNOSTIC BY DESIGN: this check exercises the real write call and asserts on the
// SDK's own behaviour, not on how the fix was implemented. It passes identically whether the
// fix is `db.settings({ ignoreUndefinedProperties: true })` in lib/firebase-admin.ts's
// initAdmin(), or stripping undefined-valued keys inside buildVendorSubmission() (or any other
// builder) before the spread -- both were probed directly against this exact scenario and both
// make the synchronous throw disappear. A grep for `ignoreUndefinedProperties` would pass
// while the actual write path still throws for the strip-in-builder fix, and vice versa for a
// grep on the builder; this check cares only about the real, external, SDK-boundary behaviour.
//
// RUN: node contracts/checks/firestore-undefined-write-safety/check-vendor-submission-undefined-roundtrip.mjs

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

// A fresh, throwaway RSA keypair minted for THIS run only -- never a real credential, never
// committed, never reused. Firebase Admin's ServiceAccountCredential parser requires a
// well-formed PKCS#1/PKCS#8 PEM to get past `crypto.createPrivateKey()`, but the write call
// below is never awaited, so this key is never actually used to sign a real request.
const keyDir = mkdtempSync(path.join(tmpdir(), 'firestore-undefined-check-'));
const keyPath = path.join(keyDir, 'dummy-key.pem');
execFileSync('openssl', ['genrsa', '-out', keyPath, '2048'], { stdio: 'ignore' });

// Written INSIDE the repo (not the OS tmpdir) so Node's ESM resolver walks up to the repo's
// own node_modules/ for 'firebase-admin' -- module resolution is rooted at the importing
// file's own path, not the process cwd. Removed in the `finally` below either way.
const probeScriptPath = path.join(__dirname, `.tmp-probe-${process.pid}.mjs`);
const probeScript = `
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { buildVendorSubmission } from ${JSON.stringify(path.join(repoRoot, 'lib/vendor-submissions.ts'))};
import { readFileSync } from 'node:fs';

const privateKey = readFileSync(${JSON.stringify(keyPath)}, 'utf8');

// The minimal REQUIRED field set for VendorSubmissionDraft, per
// validateVendorSubmissionInput() in lib/vendor-submissions.ts. Every field that function
// treats as optional is deliberately ABSENT below -- not '', not null, simply not a key on
// this object -- which is exactly what a direct API caller (or any future form that only
// sends what the user actually filled in) would send.
const minimalDraft = {
  businessName: 'Minimal Orchids CC',
  contactPersonName: 'Jane Vendor',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@example.com',
  productDescription: 'Cymbidium hybrids and growing media.',
  physicalAddress: '1 Test Street, Cape Town',
  emergencyContactName: 'John Vendor',
  emergencyContactCellPhone: '0839876543',
  vendorCategory: ['orchids'],
  powerRequired: false,
  termsAccepted: true,
  // tradingName, cipcNumber, vatNumber, website, socialMediaHandle, boothType,
  // paymentMethodsAccepted, bio, and every other optional field on VendorSubmissionDraft are
  // deliberately NOT PRESENT here -- this is the actual defect trigger, not an oversight.
};

const now = new Date('2026-09-01T12:00:00.000Z');
const built = buildVendorSubmission(minimalDraft, now);

const app = initializeApp(
  {
    credential: cert({
      projectId: 'demo-project',
      clientEmail: 'test@demo-project.iam.gserviceaccount.com',
      privateKey,
    }),
  },
  'firestore-undefined-write-safety-probe',
);
const db = getFirestore(app);

// BYTE-IDENTICAL to app/api/vendors/register/route.ts:172's write call shape.
try {
  const addResult = db
    .collection('vendorSubmissions')
    .add({ ...built, submittedAt: Timestamp.fromDate(built.submittedAt) });
  // Deliberately not awaited: only the SYNCHRONOUS validation throw is under test. Swallow
  // any eventual network rejection (UNAUTHENTICATED, since this is a fake project) so it can
  // never surface as an unhandled rejection after this process has already reported PASS/FAIL.
  addResult.catch(() => {});
  console.log('RESULT:NO_SYNC_THROW');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('Cannot use "undefined" as a Firestore value')) {
    console.log('RESULT:UNDEFINED_THROW');
    console.log('MESSAGE:' + message);
  } else {
    console.log('RESULT:OTHER_THROW');
    console.log('MESSAGE:' + message);
  }
}
`;
writeFileSync(probeScriptPath, probeScript, 'utf8');

let output;
try {
  output = execFileSync('npx', ['tsx', probeScriptPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (error) {
  console.error('FAIL: probe process itself threw unexpectedly (not the undefined-value error).');
  console.error(error.stdout || '');
  console.error(error.stderr || '');
  rmSync(keyDir, { recursive: true, force: true });
  rmSync(probeScriptPath, { force: true });
  process.exit(1);
}

rmSync(keyDir, { recursive: true, force: true });
rmSync(probeScriptPath, { force: true });

if (output.includes('RESULT:UNDEFINED_THROW')) {
  console.error(
    'FAIL: buildVendorSubmission() output for a minimal draft with optional fields genuinely ' +
      'absent still throws at the Firestore write boundary. A payload that passes ' +
      'validateVendorSubmissionInput() fails at persistence -- the submission looks accepted ' +
      'right up until the write.',
  );
  console.error(output);
  process.exit(1);
}

if (output.includes('RESULT:OTHER_THROW')) {
  console.error('FAIL: probe threw an unexpected error (not the undefined-value error). Investigate.');
  console.error(output);
  process.exit(1);
}

if (output.includes('RESULT:NO_SYNC_THROW')) {
  console.log('PASS: minimal vendorSubmissions draft with optional fields absent round-trips ' +
    'past the Firestore write boundary without an undefined-value throw.');
  process.exit(0);
}

console.error('FAIL: probe produced no recognizable result.');
console.error(output);
process.exit(1);
