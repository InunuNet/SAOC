// ozow-sandbox-toggle F1 — proves lib/ozow-sandbox-test-mode-shared.ts (the module client
// components are required to import from) contains no server-only import, so a client bundle
// that reaches it never pulls in Firebase Admin or any other Node-only package. Static grep, no
// build/bundler invocation.
//
// See contracts/golden/ozow-sandbox-toggle-f1/README.md §3d for the full decision record — this
// is the fix for Codex GPT-5.5's third cross-model review finding (client component importing a
// module with a top-level `firebase-admin/firestore` import).
//
// Run as: node contracts/checks/ozow-sandbox-toggle-f1/check-shared-module-client-safe.mjs

import { readFileSync, existsSync } from 'node:fs';

const FILE = 'lib/ozow-sandbox-test-mode-shared.ts';

let FAIL = false;
function fail(msg) {
  console.error(`FAIL: ${msg}`);
  FAIL = true;
}

if (!existsSync(FILE)) {
  fail(`${FILE} does not exist`);
  process.exit(1);
}

const src = readFileSync(FILE, 'utf8');

// Server-only import specifiers this module must never contain. Matches any import/require
// naming these as a module specifier (quoted string).
const SERVER_ONLY_PATTERNS = [
  /firebase-admin/,
  /next\/headers/,
  /next\/server/,
  /['"]server-only['"]/,
  /node:fs/,
  /node:path/,
];

for (const pattern of SERVER_ONLY_PATTERNS) {
  if (pattern.test(src)) {
    fail(`${FILE} matches server-only import pattern: ${pattern}`);
  }
}

if (FAIL) {
  console.error(
    `FAIL: ${FILE} must remain importable from a 'use client' component without pulling in a server-only dependency.`
  );
  process.exit(1);
}
console.log(`PASS: ${FILE} contains no server-only import — safe for client bundles.`);
