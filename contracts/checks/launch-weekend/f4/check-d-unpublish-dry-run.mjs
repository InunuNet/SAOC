#!/usr/bin/env node
// A4 - the unpublish script's dry run: contract output shape, keeps the National Show, targets only the
// seeded invented ids, writes nothing, never prints the token, and refuses to run with no mode flag.
// Idempotent: after --apply the dry run reports unpublish=0 and still passes.
// Usage: node contracts/checks/launch-weekend/f4/check-d-unpublish-dry-run.mjs
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { INVENTED, KEEP, report } from './_lib.mjs';

const SCRIPT = 'scripts/unpublish-invented-events.ts';
const BACKUPS = '.tmp/sandbox/launch-weekend-f4-backup';
const problems = [];
const run = (...args) => spawnSync('pnpm', ['exec', 'tsx', SCRIPT, ...args], { encoding: 'utf8' });
const count = () => (existsSync(BACKUPS) ? readdirSync(BACKUPS).length : 0);

if (!existsSync(SCRIPT)) { console.error(`FAIL: ${SCRIPT} does not exist`); process.exit(1); }

const before = count();
const dry = run('--dry-run');
const out = `${dry.stdout}\n${dry.stderr}`;
if (dry.status !== 0) problems.push(`--dry-run exited ${dry.status}\n${out.slice(0, 600)}`);
if (!/^MODE dry-run$/m.test(out)) problems.push('missing line "MODE dry-run"');
const keeps = [...out.matchAll(/^KEEP (\S+)$/gm)].map((m) => m[1]);
if (keeps.length !== 1 || keeps[0] !== KEEP.id) problems.push(`expected exactly one "KEEP ${KEEP.id}", got [${keeps.join(', ')}]`);
const targets = [...out.matchAll(/^UNPUBLISH (\S+) rev=\S+$/gm)].map((m) => m[1]);
const allowed = new Set(INVENTED.map((e) => e.id));
for (const t of targets) if (!allowed.has(t)) problems.push(`UNPUBLISH targets a non-seeded id: ${t}`);
if (targets.includes(KEEP.id)) problems.push('UNPUBLISH targets the National Show event');
const sum = out.match(/^SUMMARY unpublish=(\d+) keep=(\d+)/m);
if (!sum) problems.push('missing SUMMARY line');
else if (Number(sum[1]) !== targets.length || Number(sum[2]) !== 1) problems.push(`SUMMARY (${sum[0]}) disagrees with ${targets.length} UNPUBLISH lines / 1 keep`);
if (count() !== before) problems.push('--dry-run wrote a backup file');

// The token must never reach output.
try {
  const m = readFileSync('.env.local', 'utf8').match(/^SANITY_API_TOKEN=["']?([^"'\n]+)/m);
  if (m && m[1].length > 8 && out.includes(m[1])) problems.push('script output contains the Sanity token');
} catch { /* no .env.local: nothing to leak */ }

// Neither flag: must refuse (non-zero), never default to writing.
const bare = run();
if (bare.status === 0) problems.push('running with no --dry-run/--apply exited 0');
report(problems, `dry run well-formed (${targets.length} to unpublish, 1 kept, nothing written)`);
