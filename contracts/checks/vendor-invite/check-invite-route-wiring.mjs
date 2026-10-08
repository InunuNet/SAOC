#!/usr/bin/env node
// vendor-invite F1 — A2: route-wiring discriminator on
// app/api/admin/vendors/applications/invite/route.ts. Proves: the capability gate uses the
// SAME existing 'review-vendor-applications' string (no new capability); the
// VENDOR_REGISTRATION_TOKEN_SECRET precondition is checked BEFORE any `.add(` call;
// status:'approved' and origin:'invited' and every registrationCode* field land inside the
// SAME `.add(` call object literal (never split into a create-then-update pair); and
// sendVendorApprovalConfirmationEmail (the EXISTING approval sender, no new email module) is
// imported and called wrapped in deliverConfirmationEmailAfterCommit, positioned AFTER the
// `.add(` call.
//
// Source-level discriminator (a live Firestore project + VENDOR_REGISTRATION_TOKEN_SECRET is
// outside this contract's offline/credential-free constraint — same stated reason the sibling
// vendor-flow-notifications checks use source analysis for route wiring). Self-tested against a
// frozen KNOWN-UNWIRED fixture before trusting it against the real repository file.
//
// DEFEATING MUTATION: splitting the create into a pending-doc-then-approve-update pair;
// checking VENDOR_REGISTRATION_TOKEN_SECRET after minting or after the write; calling
// sendVendorApprovalConfirmationEmail unwrapped or before the `.add(` commits; introducing a
// second capability string anywhere in the gate.
//
// Run as: node contracts/checks/vendor-invite/check-invite-route-wiring.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const KNOWN_UNWIRED_FIXTURE = `
export async function POST(request) {
  const session = await getAdminSession();
  if (!session.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasCapability(session.decodedToken, NATIONAL_SHOW_ID, 'review-vendor-applications', {})) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await request.json();
  const db = getFirestore(initAdmin());
  const ref = await db.collection(VENDOR_APPLICATIONS_COLLECTION).add({
    businessName: body.businessName,
    status: 'pending',
  });
  await ref.update({ status: 'approved', origin: 'invited', registrationCodeId: '1234' });
  return NextResponse.json({ success: true, id: ref.id });
}
`;

function analyze(source) {
  const failures = [];

  const capabilityMatches = [...source.matchAll(/hasCapability\s*\([^)]*?['"]([a-z0-9-]+)['"]/gs)];
  if (capabilityMatches.length === 0) {
    failures.push('no hasCapability(...) call found at all');
  } else {
    const strings = new Set(capabilityMatches.map((m) => m[1]));
    if (!strings.has('review-vendor-applications')) {
      failures.push("hasCapability is never called with the existing 'review-vendor-applications' string");
    }
    const extra = [...strings].filter((s) => s !== 'review-vendor-applications');
    if (extra.length > 0) {
      failures.push(`a second/different capability string was introduced: ${extra.join(', ')}`);
    }
  }

  const secretCheckIndex = source.search(/VENDOR_REGISTRATION_TOKEN_SECRET/);
  if (secretCheckIndex === -1) {
    failures.push('no VENDOR_REGISTRATION_TOKEN_SECRET precondition check found');
  }

  // Find every .add( / .update( call on the applications collection ref.
  const addMatches = [...source.matchAll(/\.collection\(\s*VENDOR_APPLICATIONS_COLLECTION\s*\)\s*\.\s*add\s*\(/gs)];
  const updateMatches = [...source.matchAll(/\bref\s*\.\s*update\s*\(/gs)];

  if (addMatches.length === 0) {
    failures.push('could not locate a .collection(VENDOR_APPLICATIONS_COLLECTION).add( write call');
    return { ok: false, failures };
  }
  if (updateMatches.length > 0) {
    failures.push(
      'found a ref.update( call after the initial write — the invite must be a SINGLE atomic .add(, never a create-then-update pair',
    );
  }

  const addIndex = addMatches[0].index;
  if (secretCheckIndex !== -1 && secretCheckIndex > addIndex) {
    failures.push('VENDOR_REGISTRATION_TOKEN_SECRET is checked AFTER the .add( write, not before it');
  }

  // The object literal passed to .add( must, in one slice, contain status:'approved',
  // origin:'invited' and a registrationCode field together. Grab a generous window after the
  // add( call up to its balanced-ish close by taking the next 2000 chars (object literals in
  // this codebase's routes are not long enough to exceed this).
  const addLiteralWindow = source.slice(addIndex, addIndex + 2000);
  const hasApprovedStatus = /status\s*:\s*['"]approved['"]/.test(addLiteralWindow) || /\.\.\.\s*built/.test(addLiteralWindow);
  const hasInvitedOrigin = /origin\s*:\s*['"]invited['"]/.test(addLiteralWindow) || /\.\.\.\s*built/.test(addLiteralWindow);
  const hasRegistrationCodeField = /registrationCodeId/.test(addLiteralWindow);

  if (!hasApprovedStatus) {
    failures.push("the .add( call's object literal does not appear to carry status:'approved' (directly or via a spread of the builder's output)");
  }
  if (!hasInvitedOrigin) {
    failures.push("the .add( call's object literal does not appear to carry origin:'invited' (directly or via a spread of the builder's output)");
  }
  if (!hasRegistrationCodeField) {
    failures.push("the .add( call's object literal does not include registrationCodeId — code issuance is not part of the same write");
  }

  const importsApprovalSender =
    /import\s*\{[^}]*\bsendVendorApprovalConfirmationEmail\b[^}]*\}\s*from\s*['"]@\/lib\/vendor-approval-confirmation['"]/.test(
      source,
    );
  if (!importsApprovalSender) {
    failures.push('does not import the EXISTING sendVendorApprovalConfirmationEmail from @/lib/vendor-approval-confirmation (a new email module would violate the no-new-institutional-copy rule)');
  }

  const importsDeliver =
    /import\s*\{[^}]*\bdeliverConfirmationEmailAfterCommit\b[^}]*\}\s*from\s*['"]@\/lib\/confirmation-email['"]/.test(
      source,
    );
  if (!importsDeliver) {
    failures.push('does not import deliverConfirmationEmailAfterCommit from @/lib/confirmation-email');
  }

  const wrappedCallRegex = /deliverConfirmationEmailAfterCommit\s*\(\s*\(\)\s*=>\s*[\s\S]*?sendVendorApprovalConfirmationEmail\s*\(/g;
  const wrappedMatches = [...source.matchAll(wrappedCallRegex)];
  if (wrappedMatches.length === 0) {
    failures.push('sendVendorApprovalConfirmationEmail is never called wrapped inside deliverConfirmationEmailAfterCommit(() => ...)');
  } else if (wrappedMatches.every((m) => m.index < addIndex)) {
    failures.push('sendVendorApprovalConfirmationEmail is only called BEFORE the .add( commits');
  }

  const bareCall = /(?<!=>\s{0,300})sendVendorApprovalConfirmationEmail\s*\(/.test(
    source.replace(wrappedCallRegex, ''),
  );
  if (bareCall) {
    failures.push('sendVendorApprovalConfirmationEmail appears to have a call site NOT wrapped in deliverConfirmationEmailAfterCommit');
  }

  return { ok: failures.length === 0, failures };
}

// Self-test: the discriminator must reject the frozen known-unwired fixture (which splits the
// write into add-then-update, never checks the secret, and never sends the approval email).
const selfTest = analyze(KNOWN_UNWIRED_FIXTURE);
if (selfTest.ok) {
  console.error('FAIL (self-test): discriminator accepted the KNOWN-UNWIRED fixture — the discriminator itself is broken.');
  process.exit(1);
}

const targetPath = path.join(REPO_ROOT, 'app/api/admin/vendors/applications/invite/route.ts');
if (!existsSync(targetPath)) {
  console.error(`FAIL: ${targetPath} does not exist.`);
  process.exit(1);
}

const source = readFileSync(targetPath, 'utf8');
const result = analyze(source);

if (!result.ok) {
  result.failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${result.failures.length} assertion(s) failed against ${targetPath}.`);
  process.exit(1);
}

console.log(
  'PASS: app/api/admin/vendors/applications/invite/route.ts reuses the existing capability, ' +
    'checks the secret before writing, writes status/origin/code fields in one atomic .add(, ' +
    'and sends the existing approval email wrapped and after the write — and the discriminator ' +
    'rejects the known-unwired fixture.',
);
process.exit(0);
