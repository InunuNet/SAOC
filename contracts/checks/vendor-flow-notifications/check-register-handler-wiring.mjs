#!/usr/bin/env node
// G1 (vendor-flow-notifications) — A4: wiring discriminator across
// lib/vendor-registration-handler.ts (the pure orchestrator, gains a `sendAdminNotice` dep) and
// app/api/vendors/register/route.ts (supplies the real `sendVendorSubmissionAdminNoticeEmail`
// closure). Proves the handler calls the new dep through deliverConfirmationEmailAfterCommit,
// strictly after the existing vendor-confirmation call, and the route wires a real closure
// (never leaves the new dep unset, which would be a TypeScript error caught by A1 too, but this
// check proves the RUNTIME shape independent of the type-check).
//
// Source-level discriminator, self-tested against a frozen KNOWN-UNWIRED handler fixture.
//
// DEFEATING MUTATION: deleting the sendAdminNotice call from the handler; calling it before
// step 6's write or before the existing sendConfirmationEmail call; calling it unwrapped
// (bypassing deliverConfirmationEmailAfterCommit); the route never passing a sendAdminNotice
// closure.
//
// Run as: node contracts/checks/vendor-flow-notifications/check-register-handler-wiring.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const KNOWN_UNWIRED_HANDLER_FIXTURE = `
export async function handleVendorRegistration(rawInput, deps) {
  const built = buildVendorSubmission(rawInput, deps.now);
  const writeResult = await deps.write(built);
  await deliverConfirmationEmailAfterCommit(
    () => deps.sendConfirmationEmail({ businessName: built.businessName, contactPersonName: built.contactPersonName, contactEmail: built.contactEmail }),
    deps.onEmailError,
  );
  return { status: 201, body: { success: true, id: writeResult.id } };
}
`;

function checkHandler(source) {
  const failures = [];

  const confirmationIndex = source.search(
    /deliverConfirmationEmailAfterCommit\s*\(\s*\(\)\s*=>\s*[\s\S]*?deps\.sendConfirmationEmail\s*\(/,
  );
  if (confirmationIndex === -1) {
    failures.push('could not locate the existing deps.sendConfirmationEmail call wrapped in deliverConfirmationEmailAfterCommit — this fixture/file no longer matches the pinned baseline');
    return { wired: false, failures };
  }

  const adminNoticeCallRegex = /deliverConfirmationEmailAfterCommit\s*\(\s*\(\)\s*=>\s*[\s\S]*?deps\.sendAdminNotice\s*\(/g;
  const adminNoticeMatches = [...source.matchAll(adminNoticeCallRegex)];

  if (adminNoticeMatches.length === 0) {
    failures.push('deps.sendAdminNotice is never called wrapped inside deliverConfirmationEmailAfterCommit(() => ...)');
  } else if (adminNoticeMatches.every((m) => m.index < confirmationIndex)) {
    failures.push('deps.sendAdminNotice is called BEFORE the existing deps.sendConfirmationEmail call, not after');
  }

  const bareAdminNotice = /(?<!=>\s{0,200})deps\.sendAdminNotice\s*\(/.test(
    source.replace(adminNoticeCallRegex, ''),
  );
  if (bareAdminNotice) {
    failures.push('deps.sendAdminNotice appears to have a call site NOT wrapped in deliverConfirmationEmailAfterCommit');
  }

  const depsInterfaceHasSendAdminNotice =
    /sendAdminNotice\s*\(\s*input\s*:\s*\{[^}]*businessName[^}]*contactPersonName[^}]*vendorSubmissionId[^}]*\}\s*\)\s*:\s*Promise<void>/s.test(
      source,
    );
  if (!depsInterfaceHasSendAdminNotice) {
    failures.push('VendorRegistrationHandlerDeps does not declare sendAdminNotice(input: { businessName; contactPersonName; vendorSubmissionId }): Promise<void>');
  }

  return { wired: failures.length === 0, failures };
}

function checkRoute(source) {
  const failures = [];
  const importsAdminNotice =
    /import\s*\{[^}]*\bsendVendorSubmissionAdminNoticeEmail\b[^}]*\}\s*from\s*['"]@\/lib\/vendor-submission-admin-notice['"]/.test(
      source,
    );
  if (!importsAdminNotice) {
    failures.push('app/api/vendors/register/route.ts does not import sendVendorSubmissionAdminNoticeEmail from @/lib/vendor-submission-admin-notice');
  }
  const suppliesDep = /sendAdminNotice\s*:\s*\([^)]*\)\s*=>\s*sendVendorSubmissionAdminNoticeEmail\s*\(/.test(source);
  if (!suppliesDep) {
    failures.push("app/api/vendors/register/route.ts does not supply handleVendorRegistration's sendAdminNotice dep as a closure calling sendVendorSubmissionAdminNoticeEmail");
  }
  return { wired: failures.length === 0, failures };
}

// Self-test: the discriminator must reject the frozen known-unwired handler fixture.
const selfTest = checkHandler(KNOWN_UNWIRED_HANDLER_FIXTURE);
if (selfTest.wired) {
  console.error('FAIL (self-test): handler discriminator accepted the KNOWN-UNWIRED fixture — the discriminator itself is broken.');
  process.exit(1);
}

const handlerPath = path.join(REPO_ROOT, 'lib/vendor-registration-handler.ts');
const routePath = path.join(REPO_ROOT, 'app/api/vendors/register/route.ts');

const allFailures = [];

if (!existsSync(handlerPath)) {
  allFailures.push(`${handlerPath} does not exist.`);
} else {
  const result = checkHandler(readFileSync(handlerPath, 'utf8'));
  result.failures.forEach((f) => allFailures.push(`${handlerPath}: ${f}`));
}

if (!existsSync(routePath)) {
  allFailures.push(`${routePath} does not exist.`);
} else {
  const result = checkRoute(readFileSync(routePath, 'utf8'));
  result.failures.forEach((f) => allFailures.push(`${routePath}: ${f}`));
}

if (allFailures.length > 0) {
  allFailures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${allFailures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: lib/vendor-registration-handler.ts calls deps.sendAdminNotice through ' +
    'deliverConfirmationEmailAfterCommit strictly after the existing sendConfirmationEmail call, ' +
    'and app/api/vendors/register/route.ts wires a real sendVendorSubmissionAdminNoticeEmail closure.',
);
process.exit(0);
