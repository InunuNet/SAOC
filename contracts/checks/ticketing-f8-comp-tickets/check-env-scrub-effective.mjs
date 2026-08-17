#!/usr/bin/env node
// F8 (ticketing-foundation) — self-verification of check-http-comp-fails-closed.sh's credential
// scrub, copied and adapted from F5's identical check
// (contracts/checks/ticketing-f5-buyers/check-env-scrub-effective.mjs — see that file's header
// for the full QA-found-gap history this closes). Calls the REAL function Next.js itself calls
// at startup to load `.env.local` — `loadEnvConfig()` from `@next/env` — in the SAME working
// directory, with the SAME env prefix the calling shell script is about to hand to `next dev`,
// and asserts that the nine FIREBASE_ADMIN_*/NEXT_PUBLIC_FIREBASE_* variables are still empty
// AFTER that real load runs.
//
// Only variable NAMES are ever printed, never values, on either the pass or fail path, per this
// project's standing rule against logging secrets (four prior incidents).
//
// Run as: node contracts/checks/ticketing-f8-comp-tickets/check-env-scrub-effective.mjs
// (invoked by check-http-comp-fails-closed.sh with the identical env prefix it uses to launch
// the real server, BEFORE the server is started)

import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

// Hard-coded independently of check-http-comp-fails-closed.sh's SCRUB_VARS array — see that
// script for why the two lists are deliberately not derived from one another.
const REQUIRED_SCRUBBED_VARS = [
  'FIREBASE_ADMIN_PROJECT_ID',
  'FIREBASE_ADMIN_CLIENT_EMAIL',
  'FIREBASE_ADMIN_PRIVATE_KEY',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];

const nextPkgDir = path.dirname(require.resolve('next/package.json'));
const envModulePath = require.resolve('@next/env', { paths: [nextPkgDir] });
const { loadEnvConfig } = require(envModulePath);

loadEnvConfig(process.cwd(), /* dev */ true, { info: () => {}, error: () => {} });

const leaked = REQUIRED_SCRUBBED_VARS.filter((name) => Boolean(process.env[name]));

if (leaked.length > 0) {
  console.error(
    `FAIL: the credential scrub did not hold — the following variable(s) are NON-EMPTY after ` +
      `the real Next.js env-loading path ran (values withheld, names only): ${leaked.join(', ')}. ` +
      `This means .env.local's real value reached process.env because the launch's env prefix ` +
      `did not pre-set an empty override for it.`,
  );
  process.exit(1);
}

console.log(
  'PASS: after running the real loadEnvConfig() Next.js itself calls at startup, all nine ' +
    'FIREBASE_ADMIN_*/NEXT_PUBLIC_FIREBASE_* variables remain empty — the credential scrub is ' +
    'verified effective, not merely present in source.',
);
process.exit(0);
