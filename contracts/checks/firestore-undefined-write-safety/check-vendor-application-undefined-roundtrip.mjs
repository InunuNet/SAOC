#!/usr/bin/env node
// mission firestore-undefined-write-safety -- RED check (A2), architect pass 2026-09-01.
//
// Sibling of check-vendor-submission-undefined-roundtrip.mjs (A1) -- same defect class, second
// confirmed instance found by the architect's sibling-builder audit. buildVendorApplication()
// (lib/vendor-applications.ts:167) assigns `tradingName: input.tradingName` directly, and
// tradingName is optional (VendorApplicationDraft, validateOptionalStringMaxLength allows it
// absent). app/api/vendors/apply/route.ts:47 spreads the built object straight into `.add()`,
// same shape as the vendorSubmissions route. See A1's header comment for the full mechanism
// (synchronous SDK validation, no network I/O, credential-free, fix-layer agnostic) -- not
// repeated here.
//
// RUN: node contracts/checks/firestore-undefined-write-safety/check-vendor-application-undefined-roundtrip.mjs

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

const keyDir = mkdtempSync(path.join(tmpdir(), 'firestore-undefined-check-'));
const keyPath = path.join(keyDir, 'dummy-key.pem');
execFileSync('openssl', ['genrsa', '-out', keyPath, '2048'], { stdio: 'ignore' });

const probeScriptPath = path.join(__dirname, `.tmp-probe-app-${process.pid}.mjs`);
const probeScript = `
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { buildVendorApplication } from ${JSON.stringify(path.join(repoRoot, 'lib/vendor-applications.ts'))};
import { readFileSync } from 'node:fs';

const privateKey = readFileSync(${JSON.stringify(keyPath)}, 'utf8');

// Minimal REQUIRED field set for VendorApplicationDraft per validateVendorApplicationInput()
// in lib/vendor-applications.ts. tradingName (optional) is deliberately ABSENT.
const minimalDraft = {
  businessName: 'Minimal Orchids CC',
  contactPersonName: 'Jane Vendor',
  contactEmail: 'jane@example.com',
  contactCellPhone: '0821234567',
  vendorCategory: ['orchids'],
  indicativeBoothCount: 1,
  // tradingName intentionally NOT PRESENT -- the defect trigger.
};

const now = new Date('2026-09-01T12:00:00.000Z');
const built = buildVendorApplication(minimalDraft, now);

const app = initializeApp(
  {
    credential: cert({
      projectId: 'demo-project',
      clientEmail: 'test@demo-project.iam.gserviceaccount.com',
      privateKey,
    }),
  },
  'firestore-undefined-write-safety-probe-app',
);
const db = getFirestore(app);

// BYTE-IDENTICAL to app/api/vendors/apply/route.ts:47's write call shape.
try {
  const addResult = db.collection('vendorApplications').add({
    ...built,
    status: 'pending',
    submittedAt: Timestamp.fromDate(built.submittedAt),
  });
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
    'FAIL: buildVendorApplication() output for a minimal draft with tradingName genuinely ' +
      'absent still throws at the Firestore write boundary.',
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
  console.log('PASS: minimal vendorApplications draft with tradingName absent round-trips ' +
    'past the Firestore write boundary without an undefined-value throw.');
  process.exit(0);
}

console.error('FAIL: probe produced no recognizable result.');
console.error(output);
process.exit(1);
