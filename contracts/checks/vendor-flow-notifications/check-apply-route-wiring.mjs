#!/usr/bin/env node
// G1 (vendor-flow-notifications) — A3: route-wiring discriminator on
// app/api/vendors/apply/route.ts. Proves BOTH the new vendor-facing confirmation and the new
// admin notice are wired from the application-submit route, each independently wrapped in the
// real deliverConfirmationEmailAfterCommit, each positioned AFTER the Firestore .add() call
// commits.
//
// Source-level discriminator (proving the real HTTP route requires a live Firestore project,
// outside this contract's offline/credential-free constraint) — same technique as
// vendor-f8-approval-email's A5. Self-tested against a frozen KNOWN-UNWIRED fixture (must
// reject) before trusting it against the real repository file.
//
// DEFEATING MUTATION: deleting either email call; calling either without the
// deliverConfirmationEmailAfterCommit wrapper (a rejection would then propagate and turn a
// successful application submission into a 500); moving either call before the `.add(...)`
// commits.
//
// Run as: node contracts/checks/vendor-flow-notifications/check-apply-route-wiring.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const KNOWN_UNWIRED_FIXTURE = `
export async function POST(request) {
  const built = buildVendorApplication(rawInput, now);
  try {
    initAdmin();
    const ref = await getFirestore().collection(VENDOR_APPLICATIONS_COLLECTION).add({ ...built, status: 'pending' });
    return NextResponse.json({ success: true, id: ref.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save vendor application.' }, { status: 500 });
  }
}
`;

function isWired(source) {
  const failures = [];

  const importsConfirmation =
    /import\s*\{[^}]*\bsendVendorApplicationConfirmationEmail\b[^}]*\}\s*from\s*['"]@\/lib\/vendor-application-confirmation['"]/.test(
      source,
    );
  const importsAdminNotice =
    /import\s*\{[^}]*\bsendVendorApplicationAdminNoticeEmail\b[^}]*\}\s*from\s*['"]@\/lib\/vendor-application-admin-notice['"]/.test(
      source,
    );
  const importsDeliver =
    /import\s*\{[^}]*\bdeliverConfirmationEmailAfterCommit\b[^}]*\}\s*from\s*['"]@\/lib\/confirmation-email['"]/.test(
      source,
    );

  if (!importsConfirmation) failures.push('missing import of sendVendorApplicationConfirmationEmail from @/lib/vendor-application-confirmation');
  if (!importsAdminNotice) failures.push('missing import of sendVendorApplicationAdminNoticeEmail from @/lib/vendor-application-admin-notice');
  if (!importsDeliver) failures.push('missing import of deliverConfirmationEmailAfterCommit from @/lib/confirmation-email');

  const addIndex = source.search(/\.collection\(\s*VENDOR_APPLICATIONS_COLLECTION\s*\)\s*\.\s*add\s*\(/s);
  if (addIndex === -1) {
    failures.push('could not locate the .collection(VENDOR_APPLICATIONS_COLLECTION).add( write call');
    return { wired: false, failures };
  }

  const confirmationCallRegex = /deliverConfirmationEmailAfterCommit\s*\(\s*\(\)\s*=>\s*[\s\S]*?sendVendorApplicationConfirmationEmail\s*\(/g;
  const adminNoticeCallRegex = /deliverConfirmationEmailAfterCommit\s*\(\s*\(\)\s*=>\s*[\s\S]*?sendVendorApplicationAdminNoticeEmail\s*\(/g;

  const confirmationMatches = [...source.matchAll(confirmationCallRegex)];
  const adminNoticeMatches = [...source.matchAll(adminNoticeCallRegex)];

  if (confirmationMatches.length === 0) {
    failures.push('sendVendorApplicationConfirmationEmail is never called wrapped inside deliverConfirmationEmailAfterCommit(() => ...)');
  } else if (confirmationMatches.every((m) => m.index < addIndex)) {
    failures.push('sendVendorApplicationConfirmationEmail is only called BEFORE the Firestore .add() commits');
  }

  if (adminNoticeMatches.length === 0) {
    failures.push('sendVendorApplicationAdminNoticeEmail is never called wrapped inside deliverConfirmationEmailAfterCommit(() => ...)');
  } else if (adminNoticeMatches.every((m) => m.index < addIndex)) {
    failures.push('sendVendorApplicationAdminNoticeEmail is only called BEFORE the Firestore .add() commits');
  }

  // A bare, unwrapped call to either sender (not preceded by "=> " within a short window,
  // i.e. NOT inside a deliverConfirmationEmailAfterCommit(() => ...) arrow) is a defeat.
  const bareConfirmation = /(?<!=>\s{0,200})sendVendorApplicationConfirmationEmail\s*\(/.test(
    source.replace(confirmationCallRegex, ''),
  );
  const bareAdminNotice = /(?<!=>\s{0,200})sendVendorApplicationAdminNoticeEmail\s*\(/.test(
    source.replace(adminNoticeCallRegex, ''),
  );
  if (bareConfirmation) failures.push('sendVendorApplicationConfirmationEmail appears to have a call site NOT wrapped in deliverConfirmationEmailAfterCommit');
  if (bareAdminNotice) failures.push('sendVendorApplicationAdminNoticeEmail appears to have a call site NOT wrapped in deliverConfirmationEmailAfterCommit');

  return { wired: failures.length === 0, failures };
}

// Self-test: the discriminator must reject the frozen known-unwired fixture.
const selfTest = isWired(KNOWN_UNWIRED_FIXTURE);
if (selfTest.wired) {
  console.error('FAIL (self-test): discriminator accepted the KNOWN-UNWIRED fixture — the discriminator itself is broken.');
  process.exit(1);
}

const targetPath = path.join(REPO_ROOT, 'app/api/vendors/apply/route.ts');
if (!existsSync(targetPath)) {
  console.error(`FAIL: ${targetPath} does not exist.`);
  process.exit(1);
}

const source = readFileSync(targetPath, 'utf8');
const result = isWired(source);

if (!result.wired) {
  result.failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${result.failures.length} assertion(s) failed against ${targetPath}.`);
  process.exit(1);
}

console.log(
  'PASS: app/api/vendors/apply/route.ts wires both sendVendorApplicationConfirmationEmail and ' +
    'sendVendorApplicationAdminNoticeEmail, each inside deliverConfirmationEmailAfterCommit, ' +
    'each after the Firestore .add() commits, and the discriminator rejects the known-unwired fixture.',
);
process.exit(0);
