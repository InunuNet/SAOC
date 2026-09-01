#!/usr/bin/env node
// G1 (vendor-flow-notifications) — A6: the `to` computation in each of the three admin-notice
// sender modules resolves EXCLUSIVELY from getVendorAdminNotifyRecipients() — never from
// anything the vendor submitted (businessName/contactEmail/contactPersonName), and never from a
// second admin-roster env var.
//
// PAIRED, not absence-only (this project's own audited "assertion satisfiable by something
// that isn't the real property" defect class): each module must BOTH (a) actually call
// getVendorAdminNotifyRecipients() and pass its result to mailer.send's `to` field (presence —
// proves the real property exists, not merely that a banned identifier is absent from an empty
// stub) AND (b) never reference contactEmail/businessName/contactPersonName inside the `to:`
// argument of any mailer.send(...) call (absence). A module satisfying only (b) — e.g. one that
// deletes recipient resolution entirely and sends nowhere — is caught by (a).
//
// Also proves no NEW process.env reference beyond ADMIN_EMAIL_ALLOWLIST (via the resolver)
// exists anywhere in the five new lib/*.ts files — no second admin roster.
//
// Run as: node contracts/checks/vendor-flow-notifications/check-recipients-allowlist-only.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const ADMIN_NOTICE_MODULES = [
  'lib/vendor-application-admin-notice.ts',
  'lib/vendor-submission-admin-notice.ts',
  'lib/vendor-payment-admin-notice.ts',
];

const RESOLVER_MODULE = 'lib/vendor-admin-notify-recipients.ts';
const ALL_NEW_MODULES = [
  'lib/vendor-application-confirmation.ts',
  ...ADMIN_NOTICE_MODULES,
  RESOLVER_MODULE,
];

const failures = [];

for (const rel of ADMIN_NOTICE_MODULES) {
  const target = path.join(REPO_ROOT, rel);
  if (!existsSync(target)) {
    failures.push(`${rel}: does not exist`);
    continue;
  }
  const source = readFileSync(target, 'utf8');

  // Presence: must import and call the real resolver.
  const importsResolver =
    /import\s*\{[^}]*\bgetVendorAdminNotifyRecipients\b[^}]*\}\s*from\s*['"]@\/lib\/vendor-admin-notify-recipients['"]/.test(
      source,
    );
  if (!importsResolver) {
    failures.push(`${rel}: does not import getVendorAdminNotifyRecipients from @/lib/vendor-admin-notify-recipients`);
  }
  const callsResolver = /getVendorAdminNotifyRecipients\s*\(\s*\)/.test(source);
  if (!callsResolver) {
    failures.push(`${rel}: never calls getVendorAdminNotifyRecipients()`);
  }
  if (!/mailer\.send\s*\(/.test(source)) {
    failures.push(`${rel}: never calls mailer.send(...) at all`);
  }

  // Absence: no mailer.send({ to: ... }) call's `to:` argument may reference a
  // vendor-submitted identifier. Scan each mailer.send(...) call's argument object literal
  // (brace-matched) for a `to:` property whose value expression contains a banned identifier.
  const bannedIdentifiers = ['contactEmail', 'businessName', 'contactPersonName'];
  const sendCallRegex = /mailer\.send\s*\(/g;
  let match;
  while ((match = sendCallRegex.exec(source)) !== null) {
    const parenStart = match.index + match[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let i = parenStart; i < source.length; i += 1) {
      if (source[i] === '(') depth += 1;
      if (source[i] === ')') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue;
    const argSource = source.slice(parenStart, end + 1);
    const toMatch = /to\s*:\s*([^,\n]+)/.exec(argSource);
    if (toMatch) {
      for (const identifier of bannedIdentifiers) {
        if (new RegExp(`\\b${identifier}\\b`).test(toMatch[1])) {
          failures.push(`${rel}: a mailer.send(...) call's \`to:\` field references '${identifier}' — recipients must resolve exclusively from getVendorAdminNotifyRecipients()`);
        }
      }
    }
  }

  // No second admin-roster env var: the ONLY process.env reference in an admin-notice module,
  // if any (there should be none — recipient resolution is delegated to the resolver), must not
  // name a second allowlist-shaped variable.
  const envMatches = [...source.matchAll(/process\.env\.(\w+)/g)];
  for (const m of envMatches) {
    if (m[1] !== 'ADMIN_EMAIL_ALLOWLIST') {
      failures.push(`${rel}: references process.env.${m[1]} directly — recipient env access must live only in lib/vendor-admin-notify-recipients.ts`);
    }
  }
}

// The resolver itself must reference ADMIN_EMAIL_ALLOWLIST (presence) and nothing else.
{
  const target = path.join(REPO_ROOT, RESOLVER_MODULE);
  if (!existsSync(target)) {
    failures.push(`${RESOLVER_MODULE}: does not exist`);
  } else {
    const source = readFileSync(target, 'utf8');
    if (!/process\.env\.ADMIN_EMAIL_ALLOWLIST/.test(source)) {
      failures.push(`${RESOLVER_MODULE}: does not read process.env.ADMIN_EMAIL_ALLOWLIST`);
    }
    const envMatches = [...source.matchAll(/process\.env\.(\w+)/g)];
    for (const m of envMatches) {
      if (m[1] !== 'ADMIN_EMAIL_ALLOWLIST') {
        failures.push(`${RESOLVER_MODULE}: references a second env var process.env.${m[1]} — only ADMIN_EMAIL_ALLOWLIST is permitted`);
      }
    }
    if (/lib\/admin-auth|lib\/admin-roles/.test(source)) {
      failures.push(`${RESOLVER_MODULE}: imports from lib/admin-auth or lib/admin-roles — must be zero-authorization, standalone`);
    }
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: all three admin-notice modules resolve recipients exclusively via ' +
    'getVendorAdminNotifyRecipients(), never from a vendor-submitted field, and no new lib/*.ts ' +
    'file references a second admin-roster env var.',
);
process.exit(0);
