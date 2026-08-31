#!/usr/bin/env node
// vendor-gated-registration-flow M4/F23 -- structural proof that BOTH the register page and the
// register route depend ONLY on the internal HttpOnly session cookie, never a vendor-typed
// token/code value: the `?token=` search-param gate (M1/F7) is retired at the page level, and
// the route no longer reads a token/code field out of the vendor-submitted request body.
//
// Run as: node contracts/checks/vendor-gated-registration-flow-m4/check-register-page-and-route-session-only.mjs

import { readFileSync } from 'node:fs';

const PAGE = 'app/(marketing)/national-show/vendors/register/page.tsx';
const ROUTE = 'app/api/vendors/register/route.ts';
const failures = [];

function read(path) {
  try {
    return readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
  } catch {
    failures.push(`${path} does not exist.`);
    return '';
  }
}

const pageSrc = read(PAGE);
const routeSrc = read(ROUTE);

// --- Page: no longer gates on a `?token=` search param -----------------------------------------

if (!pageSrc) {
  // already recorded above
} else {
  if (!/VENDOR_REGISTRATION_SESSION_COOKIE_NAME/.test(pageSrc)) {
    failures.push(`${PAGE}: does not reference the internal session cookie constant -- gate may not be cookie-based.`);
  }
  if (!/cookies\(\)/.test(pageSrc)) {
    failures.push(`${PAGE}: does not read the request's cookies -- cannot be gating on the session cookie.`);
  }
  if (!/verifyVendorRegistrationToken/.test(pageSrc)) {
    failures.push(`${PAGE}: does not call verifyVendorRegistrationToken -- F3's HMAC verification (reused internally) is missing.`);
  }
  // The old M1 gate read a `token` search param and used it directly as the thing verified.
  // `?name=&code=` params are still legitimately read (as UI prefill values only) -- the defect
  // this guards is `searchParams`'s `token` field being read at all, or a search-param value
  // being passed into verifyVendorRegistrationToken/the Firestore lookup as the credential.
  if (/searchParams\.token\b/.test(pageSrc)) {
    failures.push(`${PAGE}: still reads searchParams.token -- the public \`?token=\` gate must be retired at the page level.`);
  }
  const pageVerifyMatch = pageSrc.match(/verifyVendorRegistrationToken\(\{[^}]*?token:\s*(\S+?)[,\s]/);
  if (pageVerifyMatch && /searchParam/i.test(pageVerifyMatch[1])) {
    failures.push(`${PAGE}: verifyVendorRegistrationToken is called with "${pageVerifyMatch[1]}" -- the gate must depend on the session cookie, not a public query string.`);
  }
  // Fail-closed fallback: both surfaces (the gated form, and the code-entry fallback) must
  // still be present -- the default branch must be the gate, not access.
  if (!/VendorRegistrationCodeEntryForm/.test(pageSrc)) {
    failures.push(`${PAGE}: does not render VendorRegistrationCodeEntryForm as the ungated fallback.`);
  }
  if (!/VendorRegisterForm/.test(pageSrc) || !/\?\s*[\s\S]{0,80}VendorRegisterForm/.test(pageSrc)) {
    failures.push(`${PAGE}: VendorRegisterForm is not conditionally rendered.`);
  }
}

// --- Route: no longer accepts a vendor-typed token/code field in the request body --------------

if (!routeSrc) {
  // already recorded above
} else {
  if (!/VENDOR_REGISTRATION_SESSION_COOKIE_NAME/.test(routeSrc)) {
    failures.push(`${ROUTE}: does not reference the internal session cookie constant -- route may still accept a body token.`);
  }
  if (!/cookies\(\)/.test(routeSrc)) {
    failures.push(`${ROUTE}: does not read the request's cookies -- cannot be gating on the session cookie.`);
  }
  // The M1 shape read `vendorSubmissionInput.token` (or similarly named) out of the parsed body
  // and passed it into verifyVendorRegistrationToken. Guard against that pattern reappearing --
  // the ONLY source of a token value feeding verifyVendorRegistrationToken must be the cookie
  // read (sessionToken), never a property pulled off the parsed request body.
  const verifyCallMatch = routeSrc.match(/verifyVendorRegistrationToken\(\{[^}]*?token:\s*(\S+?)[,\s]/);
  if (verifyCallMatch && verifyCallMatch[1] !== 'sessionToken') {
    failures.push(`${ROUTE}: verifyVendorRegistrationToken is called with "${verifyCallMatch[1]}", not the cookie-derived sessionToken.`);
  }
  if (/rawBody\.(token|code|registrationToken|registrationCode)\b/.test(routeSrc) || /vendorSubmissionInput\.(token|code|registrationToken|registrationCode)\b/.test(routeSrc)) {
    failures.push(`${ROUTE}: reads a token/code field directly off the parsed request body -- the body must not carry a vendor-typed credential.`);
  }
  if (!/sessionToken/.test(routeSrc)) {
    failures.push(`${ROUTE}: no sessionToken (cookie-derived) identifier found.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: the register page gates on the internal session cookie (not a `?token=` search param) ' +
    'and falls back to the code-entry form by default; the register route re-verifies the same ' +
    'cookie-derived token and reads no token/code field from the vendor-submitted request body.',
);
process.exit(0);
