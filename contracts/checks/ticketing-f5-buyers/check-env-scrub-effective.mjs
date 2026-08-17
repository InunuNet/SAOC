#!/usr/bin/env node
// F5 (ticketing-foundation) — self-verification of check-http-checkin-fails-closed.sh's
// credential scrub (QA gap-2 fix). QA proved that deleting a name from the shell script's env
// scrub list left A5 passing anyway, because A5 only inspects HTTP status codes and response
// bodies, which don't change when a real Firebase credential leaks into the server's
// environment. This script closes that gap by calling the REAL function Next.js itself calls at
// startup to load `.env.local` — `loadEnvConfig()` from `@next/env` (already an installed
// transitive dependency of `next`, not a new dependency) — in the SAME working directory, with
// the SAME env prefix the calling shell script is about to hand to `next dev`, and asserting
// that the nine FIREBASE_ADMIN_*/NEXT_PUBLIC_FIREBASE_* variables are still empty AFTER that
// real load runs. This is not a reimplementation of Next's env-loading precedence — it invokes
// the exact function `node_modules/next/dist/server/config.js` calls
// (`(0, _env.loadEnvConfig)(dir, phase === PHASE_DEVELOPMENT_SERVER, curLog)`), so a genuine
// leak (a scrubbed variable that was actually left unset, letting `.env.local`'s real value
// through via dotenv's standard "don't overwrite an already-set key" precedence) is observed for
// real, not inferred.
//
// Only variable NAMES are ever printed, never values, on either the pass or fail path, per this
// project's standing rule against logging secrets (four prior incidents).
//
// Run as: node contracts/checks/ticketing-f5-buyers/check-env-scrub-effective.mjs
// (invoked by check-http-checkin-fails-closed.sh with the identical env prefix it uses to
// launch the real server, BEFORE the server is started — see that script's "(0)" step)

import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

// Hard-coded independently of check-http-checkin-fails-closed.sh's SCRUB_VARS array. The two
// lists are deliberately NOT derived from one another: if a future edit deletes a name from
// SCRUB_VARS (the list used to build the launch's env prefix), this list still requires it to be
// empty, so the mismatch is caught here rather than silently narrowing what gets checked.
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

// Resolve `@next/env` the same way `next`'s own server config module resolves it -- via Node's
// module resolution starting from `next`'s own package directory, not a hardcoded pnpm store
// path (which would silently stop matching the moment the `next` version bumps).
const nextPkgDir = path.dirname(require.resolve('next/package.json'));
const envModulePath = require.resolve('@next/env', { paths: [nextPkgDir] });
const { loadEnvConfig } = require(envModulePath);

// Silent logger -- loadEnvConfig() otherwise prints which .env files it loaded, which is
// harmless but noisy for a check script; it never logs values either way.
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
  'PASS: after running the real loadEnvConfig() Next.js itself calls at startup, all nine ' +
    'FIREBASE_ADMIN_*/NEXT_PUBLIC_FIREBASE_* variables remain empty -- the credential scrub is ' +
    'verified effective, not merely present in source.',
);
process.exit(0);
