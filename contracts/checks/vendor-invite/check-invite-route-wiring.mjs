#!/usr/bin/env node
// vendor-invite F1 — A2: route-wiring discriminator. Proves the invite route creates the
// application THROUGH the transactional lock (claimVendorInviteEmailLock in
// lib/vendor-invite-email-lock.ts), never via a direct write: the capability gate uses the SAME
// existing 'review-vendor-applications' string; the VENDOR_REGISTRATION_TOKEN_SECRET precondition
// is checked BEFORE the claim call; the document handed to the claim is built from
// buildVendorApplicationInvite (status 'approved' / origin 'invited') plus registrationCodeId in
// ONE object, with no direct .add( / .create( / .set( / .update( on the applications collection
// in the route; the claim's result is rejected (409) BEFORE the approval email; and
// sendVendorApprovalConfirmationEmail (the EXISTING sender) is imported and called only wrapped
// in deliverConfirmationEmailAfterCommit, AFTER the claim. On the lib side, the lock module must
// perform transaction.create(options.newApplicationRef, ...) INSIDE db.runTransaction(...).
//
// Source-level discriminator (a live Firestore project is outside this contract's offline,
// credential-free constraint; the concurrency BEHAVIOUR of the lock is proven separately).
// Self-tested against frozen KNOWN-UNWIRED fixtures (route and lib) before trusting it on the
// real files.
//
// DEFEATING MUTATION: calling .add(/.create( directly on the applications collection and
// bypassing claimVendorInviteEmailLock; claiming before the secret check; creating the
// application outside runTransaction in the lock module; sending the email before or without
// checking the claim result, or unwrapped; a second capability string.
//
// Run as: node contracts/checks/vendor-invite/check-invite-route-wiring.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const KNOWN_UNWIRED_ROUTE_FIXTURE = `
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

const KNOWN_UNWIRED_LIB_FIXTURE = `
export async function claimVendorInviteEmailLock(db, options) {
  await options.newApplicationRef.set(options.newApplicationData);
  return db.runTransaction(async (transaction) => {
    transaction.set(options.lockRef, { applicationId: options.newApplicationId });
    return { ok: true };
  });
}
`;

const CAPABILITY = 'review-vendor-applications';

function analyzeRoute(source) {
  const failures = [];

  const capabilityMatches = [...source.matchAll(/hasCapability\s*\([^)]*?['"]([a-z0-9-]+)['"]/gs)];
  if (capabilityMatches.length === 0) {
    failures.push('no hasCapability(...) call found at all');
  } else {
    const strings = new Set(capabilityMatches.map((m) => m[1]));
    if (!strings.has(CAPABILITY)) {
      failures.push(`hasCapability is never called with the existing '${CAPABILITY}' string`);
    }
    const extra = [...strings].filter((s) => s !== CAPABILITY);
    if (extra.length > 0) {
      failures.push(`a second/different capability string was introduced: ${extra.join(', ')}`);
    }
  }

  // Transactional lock wiring: imported from the lock module and called.
  const importsClaim =
    /import\s*\{[^}]*\bclaimVendorInviteEmailLock\b[^}]*\}\s*from\s*['"]@\/lib\/vendor-invite-email-lock['"]/.test(source);
  if (!importsClaim) {
    failures.push('does not import claimVendorInviteEmailLock from @/lib/vendor-invite-email-lock');
  }
  const claimMatch = /\bclaimVendorInviteEmailLock\s*\(\s*db\s*,/.exec(source);
  if (!claimMatch) {
    failures.push('claimVendorInviteEmailLock(db, ...) is never called — the application is not created through the transactional lock');
    return { ok: false, failures };
  }
  const claimIndex = claimMatch.index;

  // No direct write to the applications collection from the route itself (bypassing the lock).
  const directWrite = /\b(?:applicationsCollection|newApplicationRef|ref)\s*\.\s*(?:add|create|set|update)\s*\(|\.collection\(\s*VENDOR_APPLICATIONS_COLLECTION\s*\)\s*\.\s*(?:add|create|set|update)\s*\(/s.test(source);
  if (directWrite) {
    failures.push('the route writes to the applications collection directly (.add/.create/.set/.update) — it must create ONLY via claimVendorInviteEmailLock');
  }
  if (/\.\s*runTransaction\s*\(/.test(source)) {
    failures.push('the route opens its own runTransaction — the transaction must live in claimVendorInviteEmailLock');
  }

  // The secret precondition precedes the claim.
  const secretIndex = source.search(/process\.env\.VENDOR_REGISTRATION_TOKEN_SECRET/);
  if (secretIndex === -1) {
    failures.push('no VENDOR_REGISTRATION_TOKEN_SECRET precondition check found');
  } else if (secretIndex > claimIndex) {
    failures.push('VENDOR_REGISTRATION_TOKEN_SECRET is checked AFTER the claim call, not before it');
  }

  // The document handed to the claim: built from the invite builder (status/origin) and carrying
  // registrationCodeId, declared as ONE object literal before the claim and passed to it.
  const dataLiteral = /const\s+newApplicationData\s*=\s*\{([\s\S]*?)\n\s*\};/.exec(source);
  if (!dataLiteral) {
    failures.push('could not locate the newApplicationData object literal handed to the claim');
  } else {
    if (!/\.\.\.\s*built\b/.test(dataLiteral[1])) {
      failures.push('newApplicationData does not spread the buildVendorApplicationInvite output (status:approved / origin:invited)');
    }
    if (!/\bregistrationCodeId\b/.test(dataLiteral[1])) {
      failures.push('newApplicationData does not carry registrationCodeId — code issuance is not part of the same create');
    }
    if (dataLiteral.index > claimIndex) {
      failures.push('newApplicationData is defined AFTER the claim call');
    }
  }
  if (!/\bconst\s+built\s*=\s*buildVendorApplicationInvite\s*\(/.test(source)) {
    failures.push('`built` is not produced by buildVendorApplicationInvite(...)');
  }
  const claimCallWindow = source.slice(claimIndex, claimIndex + 600);
  if (!/newApplicationData/.test(claimCallWindow) || !/newApplicationRef/.test(claimCallWindow)) {
    failures.push('the claim call is not passed newApplicationData and newApplicationRef');
  }

  // Claim result is checked and rejected before any email.
  const rejectMatch = /if\s*\(\s*!\s*lockResult\.ok\s*\)\s*\{[\s\S]{0,200}?status\s*:\s*409/.exec(source);
  if (!rejectMatch) {
    failures.push('a not-ok claim result is not rejected with a 409 before proceeding');
  } else if (rejectMatch.index < claimIndex) {
    failures.push('the claim result is checked before the claim is made');
  }

  // Email: existing sender, wrapped, after the claim and after the reject guard.
  const importsApprovalSender =
    /import\s*\{[^}]*\bsendVendorApprovalConfirmationEmail\b[^}]*\}\s*from\s*['"]@\/lib\/vendor-approval-confirmation['"]/.test(source);
  if (!importsApprovalSender) {
    failures.push('does not import the EXISTING sendVendorApprovalConfirmationEmail from @/lib/vendor-approval-confirmation');
  }
  const importsDeliver =
    /import\s*\{[^}]*\bdeliverConfirmationEmailAfterCommit\b[^}]*\}\s*from\s*['"]@\/lib\/confirmation-email['"]/.test(source);
  if (!importsDeliver) {
    failures.push('does not import deliverConfirmationEmailAfterCommit from @/lib/confirmation-email');
  }
  const wrappedCallRegex = /deliverConfirmationEmailAfterCommit\s*\(\s*\(\)\s*=>\s*[\s\S]*?sendVendorApprovalConfirmationEmail\s*\(/g;
  const wrappedMatches = [...source.matchAll(wrappedCallRegex)];
  if (wrappedMatches.length === 0) {
    failures.push('sendVendorApprovalConfirmationEmail is never called wrapped inside deliverConfirmationEmailAfterCommit(() => ...)');
  } else {
    if (wrappedMatches.some((m) => m.index < claimIndex)) {
      failures.push('the approval email is sent BEFORE the claim call');
    }
    if (rejectMatch && wrappedMatches.some((m) => m.index < rejectMatch.index)) {
      failures.push('the approval email is sent BEFORE the not-ok claim result is rejected');
    }
  }
  const bareCall = /sendVendorApprovalConfirmationEmail\s*\(/.test(source.replace(wrappedCallRegex, ''));
  if (bareCall) {
    failures.push('sendVendorApprovalConfirmationEmail appears to have a call site NOT wrapped in deliverConfirmationEmailAfterCommit');
  }

  return { ok: failures.length === 0, failures };
}

function analyzeLib(source) {
  const failures = [];
  const claimStart = source.search(/export\s+async\s+function\s+claimVendorInviteEmailLock\b/);
  if (claimStart === -1) {
    failures.push('claimVendorInviteEmailLock is not exported from the lock module');
    return { ok: false, failures };
  }
  const body = source.slice(claimStart);
  const txMatch = /\.runTransaction\s*\(\s*async\s*\(\s*transaction\s*\)\s*=>\s*\{/.exec(body);
  if (!txMatch) {
    failures.push('claimVendorInviteEmailLock does not run inside db.runTransaction(async (transaction) => ...)');
    return { ok: false, failures };
  }
  const afterTx = body.slice(txMatch.index);
  const createIdx = afterTx.search(/transaction\.create\(\s*options\.newApplicationRef\s*,\s*options\.newApplicationData\s*\)/);
  if (createIdx === -1) {
    failures.push('the application is not created via transaction.create(options.newApplicationRef, options.newApplicationData) inside the transaction');
  }
  const beforeTx = body.slice(0, txMatch.index);
  if (/\b(?:newApplicationRef|applicationsCollection)\b[\s\S]*?\.\s*(?:set|add|create)\s*\(/.test(beforeTx.replace(/\/\*[\s\S]*?\*\//g, ''))) {
    failures.push('an application write occurs OUTSIDE the transaction, before runTransaction');
  }
  if (!/transaction\.get\(\s*options\.applicationsCollection\s*,?\s*\)/.test(afterTx)) {
    failures.push('the duplicate-eligibility scan is not a transactional read (transaction.get(options.applicationsCollection))');
  }
  return { ok: failures.length === 0, failures };
}

// Self-tests: both analyzers must reject their frozen known-unwired fixtures.
if (analyzeRoute(KNOWN_UNWIRED_ROUTE_FIXTURE).ok) {
  console.error('FAIL (self-test): route analyzer accepted the KNOWN-UNWIRED fixture — the discriminator itself is broken.');
  process.exit(1);
}
if (analyzeLib(KNOWN_UNWIRED_LIB_FIXTURE).ok) {
  console.error('FAIL (self-test): lib analyzer accepted the KNOWN-UNWIRED fixture — the discriminator itself is broken.');
  process.exit(1);
}

const targets = [
  ['app/api/admin/vendors/applications/invite/route.ts', analyzeRoute],
  ['lib/vendor-invite-email-lock.ts', analyzeLib],
];

let failed = 0;
for (const [rel, analyze] of targets) {
  const targetPath = path.join(REPO_ROOT, rel);
  if (!existsSync(targetPath)) {
    console.error(`FAIL: ${targetPath} does not exist.`);
    failed += 1;
    continue;
  }
  const result = analyze(readFileSync(targetPath, 'utf8'));
  if (!result.ok) {
    result.failures.forEach((f) => console.error(`FAIL [${rel}]: ${f}`));
    failed += result.failures.length;
  }
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: the invite route creates the application only through claimVendorInviteEmailLock ' +
    '(transaction.create inside runTransaction), checks the secret before it, rejects a not-ok ' +
    'claim before emailing, and sends the existing approval email wrapped and after the claim — ' +
    'and the discriminator rejects both known-unwired fixtures.',
);
process.exit(0);
