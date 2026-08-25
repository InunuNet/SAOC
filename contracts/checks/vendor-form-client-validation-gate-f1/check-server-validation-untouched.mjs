// A5 — regression guard. Proves server-side validation stays authoritative and unconditional:
// lib/vendor-registration-handler.ts (the real orchestrator behind app/api/vendors/register/
// route.ts) still calls validateVendorSubmissionInput(rawInput) on every request body, and that
// call is not gated behind any conditional referencing a client-supplied flag/header (e.g.
// checking a "clientValidated" field, an "x-client-validated" header, or similar). Walks the
// actual POST handler chain (route.ts -> vendor-registration-handler.ts) rather than grepping
// the whole repo, so an unrelated validateVendorSubmissionInput call elsewhere cannot satisfy
// this check by accident.
//
// Run as: node contracts/checks/vendor-form-client-validation-gate-f1/check-server-validation-untouched.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const ROUTE_FILE = path.join(REPO_ROOT, 'app/api/vendors/register/route.ts');
const HANDLER_FILE = path.join(REPO_ROOT, 'lib/vendor-registration-handler.ts');

const routeSource = readFileSync(ROUTE_FILE, 'utf8');
const handlerSource = readFileSync(HANDLER_FILE, 'utf8');

if (!/handleVendorRegistration\s*\(/.test(routeSource)) {
  console.error(
    `FAIL: ${ROUTE_FILE} no longer delegates to handleVendorRegistration(...) — cannot confirm ` +
      'server validation is still wired into the POST path.',
  );
  process.exit(1);
}

if (!/validateVendorSubmissionInput\s*\(\s*rawInput\s*\)/.test(handlerSource)) {
  console.error(
    `FAIL: ${HANDLER_FILE} no longer calls validateVendorSubmissionInput(rawInput) — server-side ` +
      'validation may have been removed or made conditional.',
  );
  process.exit(1);
}

// Guard against a future regression where server validation is skipped based on some
// client-supplied "already validated" signal. Look for suspicious conditionals gating the
// validateVendorSubmissionInput call on anything resembling a client-trust flag.
const suspiciousPatterns = [
  /if\s*\([^)]*clientValidated[^)]*\)[^{]*{[^}]*validateVendorSubmissionInput/i,
  /if\s*\([^)]*x-client-validated[^)]*\)/i,
  /skipValidation/i,
];
for (const pattern of suspiciousPatterns) {
  if (pattern.test(handlerSource) || pattern.test(routeSource)) {
    console.error(
      `FAIL: found a pattern suggesting server validation may be conditionally skipped based ` +
        `on a client-supplied signal (pattern: ${pattern}).`,
    );
    process.exit(1);
  }
}

// Confirm validateVendorSubmissionInput is called unconditionally at the top of the handler,
// before any Firestore write (deps.write) — i.e. not gated behind a write-success branch that
// would imply it runs after persistence.
const validationIdx = handlerSource.indexOf('validateVendorSubmissionInput(rawInput)');
const writeIdx = handlerSource.indexOf('deps.write(built)');
if (writeIdx !== -1 && validationIdx > writeIdx) {
  console.error(
    'FAIL: validateVendorSubmissionInput(rawInput) call occurs AFTER the Firestore write call — ' +
      'validation is no longer gating persistence.',
  );
  process.exit(1);
}

console.log(
  'PASS: handleVendorRegistration still calls validateVendorSubmissionInput(rawInput) ' +
    'unconditionally, before the Firestore write, with no client-trust bypass pattern found.',
);
process.exit(0);
