#!/usr/bin/env node
// CLASS-LEVEL STANDING GUARD, not a per-module instance check. Codex found (2026-09-01) that
// `Buffer.from(str, 'hex')` does not reject malformed hex -- it silently stops decoding at the
// first invalid character or an odd-length tail and returns whatever it managed to parse. A
// genuine 64-char signature with junk appended decodes to the SAME 32-byte buffer as the clean
// signature, so it passed every affected verifier's constant-time comparison unchanged, before
// that comparison ever ran. Reproduced against the shipped lib/vendor-registration-token.ts
// (team-lead) and confirmed across five mutation classes in both that file and
// lib/recovery-token.ts (@dev) -- both were in production paths, and both had already been
// through several QA passes, a dedicated forgery/expiry/domain-separation check, and multiple
// Codex reviews without this surfacing, because every existing forgery test started from an
// ALREADY-invalid token. The bug only showed up when a fourth token module was written on the
// same pattern. See .agent/memory/project/learned.md / the 2026-09-01 session record for the
// full incident.
//
// THIS CHECK EXISTS SO A FIFTH TOKEN MODULE INHERITS THE SAME TEST WITHOUT ANYONE HAVING TO
// REMEMBER TO WRITE IT AGAIN. It does not hardcode "these are the token modules" -- it
// discovers every lib/*.ts file matching this project's shared HMAC-signed-token SHAPE
// (createHmac + .digest('hex') + an exported verify function), the same "scan by shape, not by
// name" method A54 uses for claimRegistrationToken() call sites and the rewritten A50 uses for
// route preconditions. A module written on this pattern gets swept in automatically; a module
// the discovery finds but this file has no adapter for is a HARD FAILURE (see MODULE_ADAPTERS
// below), never a silent skip -- so the check either tests a newly-discovered module for real
// or fails loudly demanding someone teach it how, but never quietly ignores it.
//
// Mutation classes covered (signature segment only -- see below for why the payload segment is
// deliberately NOT mutated here):
//   1. appended non-hex junk       ("<sig>zz")
//   2. trailing whitespace          ("<sig> ")
//   3. one extra (still-hex) char   ("<sig>0")
//   4. case variation                (uppercased <sig> -- decodes to the same bytes, but a
//                                      genuine signature is never anything but lowercase, so
//                                      accepting it would still mean the verifier treats more
//                                      than one string as "the" token)
//   5. an extra `.`-delimited segment ("<payload>.<sig>.extra")
//
// WHY ONLY THE SIGNATURE SEGMENT: the payload segment is the string that gets HMAC-signed, so
// any byte difference there changes the expected signature regardless of how leniently it is
// later decoded -- it was never exposed to this defect. The signature segment is uniquely
// exposed because it is DECODED and then compared, rather than signed as a string. A mutation
// check that treated both segments identically would be testing a property that was never at
// risk for the payload half and would dilute what this check actually proves.
//
// NOTE: contracts/checks/public-supporter-registration-f1/check-purpose-scoped-tokens.mjs
// deliberately still only cross-checks purpose separation -- it was NOT extended with these
// mutation classes, and should not be read as already covering this property.
//
// Run as: npx tsx contracts/checks/token-canonicality/check-signature-mutation-rejected.mjs

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const LIB_DIR = fileURLToPath(new URL('../../../lib/', import.meta.url));
const SECRET = 'token-canonicality-check-secret-do-not-reuse';
const NOW = new Date('2026-09-01T00:00:00Z');

const failures = [];

// --- Discovery: every lib/*.ts file implementing this project's shared HMAC-signed-token
// shape -- createHmac(...).digest('hex') plus an exported verify function. Shape-based, not a
// hardcoded filename list, so a new module written on this pattern is swept in automatically.
function discoverTokenModules() {
  const files = readdirSync(LIB_DIR).filter((f) => f.endsWith('.ts'));
  const discovered = [];
  for (const file of files) {
    const content = readFileSync(join(LIB_DIR, file), 'utf8');
    const hasHmacHexDigest = content.includes('createHmac(') && content.includes(".digest('hex')");
    const hasExportedVerify = /export (async )?function verify/.test(content);
    if (hasHmacHexDigest && hasExportedVerify) {
      discovered.push(file);
    }
  }
  return discovered.sort();
}

// --- Per-module adapters: HOW to mint a genuine token and HOW to call verify on it. Mint/
// verify call SHAPES necessarily differ per module (different identifying fields, different
// purpose/generation parameters) -- what's discovered automatically is the SET of modules to
// test, not a way to avoid knowing each one's mint/verify signature. A discovered file with no
// entry here fails loudly below rather than being silently skipped.
const MODULE_ADAPTERS = {
  'recovery-token.ts': {
    mintFn: 'mintRecoveryToken',
    verifyFn: 'verifyRecoveryToken',
    mintInput: () => ({ orderId: 'order-canonicality-check', secret: SECRET, now: NOW }),
    verifyInput: (token) => ({ token, secret: SECRET, now: NOW }),
  },
  'supporter-registration-token.ts': {
    mintFn: 'mintSupporterRegistrationToken',
    verifyFn: 'verifySupporterRegistrationToken',
    mintInput: () => ({ registrationId: 'reg-canonicality-check', purpose: 'confirm', secret: SECRET, now: NOW }),
    verifyInput: (token) => ({ token, expectedPurpose: 'confirm', secret: SECRET, now: NOW }),
  },
  'vendor-registration-token.ts': {
    mintFn: 'mintVendorRegistrationToken',
    verifyFn: 'verifyVendorRegistrationToken',
    mintInput: () => ({ applicationId: 'app-canonicality-check', secret: SECRET, now: NOW, generation: 1 }),
    verifyInput: (token) => ({ token, secret: SECRET, now: NOW }),
  },
  'vendor-stand-payment-token.ts': {
    mintFn: 'mintVendorStandPaymentToken',
    verifyFn: 'verifyVendorStandPaymentToken',
    mintInput: () => ({ vendorSubmissionId: 'vs-canonicality-check', secret: SECRET, now: NOW }),
    verifyInput: (token) => ({ token, secret: SECRET, now: NOW }),
  },
};

function mutateSignature(genuineToken, kind) {
  const separatorIndex = genuineToken.indexOf('.');
  const payloadSegment = genuineToken.slice(0, separatorIndex);
  const signatureSegment = genuineToken.slice(separatorIndex + 1);

  switch (kind) {
    case 'appended non-hex junk':
      return `${payloadSegment}.${signatureSegment}zz`;
    case 'trailing whitespace':
      return `${payloadSegment}.${signatureSegment} `;
    case 'one extra hex character':
      return `${payloadSegment}.${signatureSegment}0`;
    case 'case variation on the signature':
      return `${payloadSegment}.${signatureSegment.toUpperCase()}`;
    case 'extra dot-delimited segment':
      return `${genuineToken}.extra`;
    default:
      throw new Error(`Unknown mutation kind: ${kind}`);
  }
}

const MUTATION_KINDS = [
  'appended non-hex junk',
  'trailing whitespace',
  'one extra hex character',
  'case variation on the signature',
  'extra dot-delimited segment',
];

const discoveredModules = discoverTokenModules();

// Vacuous-scan guard, same as A54/A42 -- this check must not pass by finding nothing to check.
if (discoveredModules.length === 0) {
  failures.push('discoverTokenModules() found zero HMAC-signed-token modules under lib/ -- the discovery pattern itself is broken.');
}
if (discoveredModules.length < 4) {
  failures.push(
    `discoverTokenModules() found only ${discoveredModules.length} module(s) (${discoveredModules.join(', ')}) -- ` +
      `expected at least the 4 known as of 2026-09-01 (recovery-token.ts, ` +
      `supporter-registration-token.ts, vendor-registration-token.ts, vendor-stand-payment-token.ts). ` +
      `If one was renamed or removed intentionally, update this expectation; if the discovery regex ` +
      `stopped matching a real module, that is the bug this check exists to prevent going unnoticed.`,
  );
}

for (const file of discoveredModules) {
  const adapter = MODULE_ADAPTERS[file];
  if (!adapter) {
    failures.push(
      `lib/${file} matches this project's HMAC-signed-token shape (createHmac + .digest('hex') + an ` +
        `exported verify function) but has NO entry in MODULE_ADAPTERS in this check. This is exactly ` +
        `the gap that let a fourth token module inherit the truncated-hex-decode defect unnoticed -- add ` +
        `a mintInput/verifyInput adapter for lib/${file} here before this can be trusted to pass.`,
    );
    continue;
  }

  const modulePath = join(LIB_DIR, file);
  const mod = await import(pathToFileURL(modulePath).href);
  const mintFn = mod[adapter.mintFn];
  const verifyFn = mod[adapter.verifyFn];

  if (typeof mintFn !== 'function') {
    failures.push(`lib/${file}: expected export '${adapter.mintFn}' not found (or not a function).`);
    continue;
  }
  if (typeof verifyFn !== 'function') {
    failures.push(`lib/${file}: expected export '${adapter.verifyFn}' not found (or not a function).`);
    continue;
  }

  const minted = mintFn(adapter.mintInput());
  if (!minted || typeof minted.token !== 'string' || !minted.token.includes('.')) {
    failures.push(`lib/${file}: ${adapter.mintFn}() did not return a { token } string containing a '.' separator.`);
    continue;
  }

  // Sanity check: the genuine, byte-identical token must verify successfully -- otherwise a
  // failure below would prove nothing (the adapter itself would be broken, not the module).
  const genuineResult = verifyFn(adapter.verifyInput(minted.token));
  if (!genuineResult || genuineResult.ok !== true) {
    failures.push(
      `lib/${file}: the GENUINE, unmutated minted token was rejected by ${adapter.verifyFn}() ` +
        `(result: ${JSON.stringify(genuineResult)}) -- this check's adapter for lib/${file} is wrong, ` +
        `not proof of a real defect. Fix MODULE_ADAPTERS['${file}'] before trusting the mutation results.`,
    );
    continue;
  }

  for (const kind of MUTATION_KINDS) {
    const mutatedToken = mutateSignature(minted.token, kind);
    let mutatedResult;
    try {
      mutatedResult = verifyFn(adapter.verifyInput(mutatedToken));
    } catch (error) {
      failures.push(`lib/${file}: ${adapter.verifyFn}() threw on mutation '${kind}': ${error.message}`);
      continue;
    }
    if (mutatedResult && mutatedResult.ok === true) {
      failures.push(
        `lib/${file}: ${adapter.verifyFn}() ACCEPTED a signature mutated by '${kind}' as valid -- ` +
          `a byte-different token from what was minted verified successfully. This is exactly the ` +
          `truncated-hex-decode defect class this check exists to catch.`,
      );
    }
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  `PASS: every discovered HMAC-signed-token module under lib/ (${discoveredModules.join(', ')}) rejects ` +
    'a signature mutated by appended non-hex junk, trailing whitespace, one extra hex character, case ' +
    'variation, and an extra dot-delimited segment, while the genuine unmutated token still verifies.',
);
process.exit(0);
