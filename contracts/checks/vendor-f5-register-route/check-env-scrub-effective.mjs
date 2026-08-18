#!/usr/bin/env node
// F5 (vendor-registration) — self-verification of check-http-rate-limit-per-ip.sh's credential
// scrub, mirroring ticketing-f5-buyers's A5 "(0)" self-verification (QA gap-2 fix: an HTTP-only
// check cannot tell a real credential leaked into the child environment). Calls the REAL
// function Next.js itself calls at startup to load `.env.local` — `loadEnvConfig()` from
// `@next/env` (already an installed transitive dependency of `next`) — in the SAME working
// directory, with the SAME env prefix the calling shell script is about to hand to `next dev`,
// and asserts that an INDEPENDENTLY hard-coded list of FIREBASE_ADMIN_*/NEXT_PUBLIC_FIREBASE_*/
// RESEND_API_KEY variable names is still empty afterward.
//
// Only variable NAMES are ever printed, never values, on either the pass or fail path, per this
// project's standing rule against logging secrets (four prior incidents).
//
// Run as: node contracts/checks/vendor-f5-register-route/check-env-scrub-effective.mjs
// (invoked by check-http-rate-limit-per-ip.sh with the identical env prefix it uses to launch
// the real server, BEFORE the server is started)

import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

// Hard-coded independently of check-http-rate-limit-per-ip.sh's SCRUB_VARS array. If a future
// edit deletes a name from SCRUB_VARS (the list used to build the launch's env prefix), this
// list still requires it to be empty, so the mismatch is caught here.
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
  'RESEND_API_KEY',
];

// Resolve `@next/env` the same way `next`'s own server config module resolves it -- via Node's
// module resolution starting from `next`'s own package directory, not a hardcoded pnpm store
// path.
const nextPkgDir = path.dirname(require.resolve('next/package.json'));
const envModulePath = require.resolve('@next/env', { paths: [nextPkgDir] });
const { loadEnvConfig } = require(envModulePath);

// Silent logger -- loadEnvConfig() otherwise prints which .env files it loaded; it never logs
// values either way.
loadEnvConfig(process.cwd(), /* dev */ true, { info: () => {}, error: () => {} });

const leaked = REQUIRED_SCRUBBED_VARS.filter((name) => Boolean(process.env[name]));

if (leaked.length > 0) {
  console.error(
    `FAIL: the credential scrub did not hold -- the following variable(s) are NON-EMPTY after ` +
      `the real Next.js env-loading path ran (values withheld, names only): ${leaked.join(', ')}. ` +
      `This means .env.local's real value reached process.env because the launch's env prefix ` +
      `did not pre-set an empty override for it.`,
  );
  process.exit(1);
}

console.log(
  'PASS: after running the real loadEnvConfig() Next.js itself calls at startup, all ten ' +
    'FIREBASE_ADMIN_*/NEXT_PUBLIC_FIREBASE_*/RESEND_API_KEY variables remain empty -- the ' +
    'credential scrub is verified effective, not merely present in source.',
);
process.exit(0);
