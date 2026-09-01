#!/usr/bin/env node
// F1 (public-supporter-registration) — this whole surface must stay structurally separate from
// the /admin gate and from vendor gating (dispatch brief's explicit boundary: "a public
// registrant must never be able to approach that surface"). Static source check: none of the
// five new lib files import lib/admin-auth.ts or lib/admin-roles.ts, or any vendor-gating
// module. Runtime check: a successful handleSupporterRegistration() result's body has EXACTLY
// the key `success` — no admin-flavoured key (role, capability, claim, isAdmin) of any kind.
//
// Same method as contracts/checks/vendor-f5-register-route/check-zero-authorization-meaning.mjs's
// design constraint 6.
//
// Run as: node --import tsx/esm contracts/checks/public-supporter-registration-f1/check-zero-admin-authorization.mjs

import { readFileSync } from 'node:fs';
import { handleSupporterRegistration } from '../../../lib/supporter-registration-handler.ts';

const failures = [];

const FILES_TO_CHECK = [
  '../../../lib/supporter-registrations.ts',
  '../../../lib/supporter-registration-token.ts',
  '../../../lib/supporter-registration-rate-limit.ts',
  '../../../lib/supporter-registration-handler.ts',
  '../../../lib/supporter-registration-confirmation.ts',
];

const FORBIDDEN_IMPORT_PATTERNS = [
  /from\s+['"][^'"]*admin-auth['"]/,
  /from\s+['"][^'"]*admin-roles['"]/,
  /from\s+['"][^'"]*vendor-registration-token['"]/,
  /from\s+['"][^'"]*vendor-registration-code-verify['"]/,
];

for (const relPath of FILES_TO_CHECK) {
  const source = readFileSync(new URL(relPath, import.meta.url), 'utf8');
  for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
    if (pattern.test(source)) {
      failures.push(`${relPath} matches forbidden import pattern ${pattern} — this surface must stay separate from admin/vendor gating.`);
    }
  }
}

const NOW = new Date('2026-09-01T00:00:00Z');
const deps = {
  now: NOW,
  source: 'website-registration-form',
  rateLimitKey: 'supporter-register-ip:203.0.113.20',
  getPriorAttempts: () => [],
  recordAttempt: () => {},
  findByEmail: async () => null,
  getLastConfirmationSentAt: () => null,
  recordConfirmationSent: () => {},
  write: async () => ({ id: 'reg-id' }),
  refreshConsent: async () => {},
  mintConfirmToken: () => ({ token: 'token-x', expiresAt: NOW }),
  sendConfirmationEmail: async () => {},
  onEmailError: () => {},
};

const result = await handleSupporterRegistration(
  { email: 'alex@example.com', firstName: 'Alex', consentMarketing: true },
  deps,
);

if (!result.body || result.body.success !== true) {
  failures.push(`Expected a successful result to check the body shape, got ${JSON.stringify(result.body)}.`);
} else {
  const keys = Object.keys(result.body).sort();
  if (keys.length !== 1 || keys[0] !== 'success') {
    failures.push(`Successful response body has keys ${JSON.stringify(keys)} — expected exactly ["success"], no admin-flavoured or echoed field.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: none of the five new lib files import lib/admin-auth.ts, lib/admin-roles.ts, or any ' +
    'vendor-gating token module, and a successful registration response body carries exactly ' +
    'one key (success) — no role, capability, claim, or echoed field of any kind.',
);
process.exit(0);
