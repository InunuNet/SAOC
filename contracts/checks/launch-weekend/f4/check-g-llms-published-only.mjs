#!/usr/bin/env node
// A11 - scripts/refresh-llms.ts must read the published perspective: with a write token Sanity returns drafts,
// and the nightly workflow passes SANITY_API_TOKEN, so unpublished (draft) invented events would re-enter
// public/llms-full.txt. Static: the client declares perspective 'published'. Runtime: run it with the token
// set and the regenerated file holds no invented title. Rewrites public/llms-full.txt (in scope, expected).
// Usage: node contracts/checks/launch-weekend/f4/check-g-llms-published-only.mjs
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { inventedIn, report } from './_lib.mjs';

const SCRIPT = 'scripts/refresh-llms.ts';
const OUT = 'public/llms-full.txt';
const problems = [];
if (!/perspective:\s*['"]published['"]/.test(readFileSync(SCRIPT, 'utf8'))) problems.push(`${SCRIPT}: client does not set perspective: 'published'`);

const env = { ...process.env };
try {
  for (const k of ['NEXT_PUBLIC_SANITY_PROJECT_ID', 'NEXT_PUBLIC_SANITY_DATASET', 'SANITY_API_TOKEN']) {
    const m = readFileSync('.env.local', 'utf8').match(new RegExp(`^${k}=["']?([^"'\\n]+)`, 'm'));
    if (m && !env[k]) env[k] = m[1];
  }
} catch { /* no .env.local: rely on the caller's env */ }
if (!env.SANITY_API_TOKEN) { console.error('INFRA: SANITY_API_TOKEN not set; the draft leak cannot be exercised'); process.exit(2); }

const run = spawnSync('pnpm', ['exec', 'tsx', SCRIPT], { encoding: 'utf8', env });
if (run.status !== 0) problems.push(`${SCRIPT} exited ${run.status}`);
if (run.stdout.includes(env.SANITY_API_TOKEN) || run.stderr.includes(env.SANITY_API_TOKEN)) problems.push('refresh-llms output contains the token');
for (const t of inventedIn(readFileSync(OUT, 'utf8'))) problems.push(`${OUT} contains invented event: ${t}`);
report(problems, 'refresh-llms with a token yields published content only; no invented event in llms-full.txt');
