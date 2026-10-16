#!/usr/bin/env node
// A4 - scripts/unpublish-invented-shows.ts dry run: contract output shape, only the five exact ids, keeps 2027,
// writes nothing, never prints the token, refuses with no mode flag. Idempotent after --apply (unpublish=0).
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { golden, report } from './_lib.mjs';

const SCRIPT = 'scripts/unpublish-invented-shows.ts';
const BACKUPS = '.tmp/sandbox/launch-weekend-f6-backup';
const problems = [];
const run = (...a) => spawnSync('pnpm', ['exec', 'tsx', SCRIPT, ...a], { encoding: 'utf8' });
const count = () => (existsSync(BACKUPS) ? readdirSync(BACKUPS).length : 0);
if (!existsSync(SCRIPT)) { console.error(`FAIL: ${SCRIPT} does not exist`); process.exit(1); }

const before = count();
const dry = run('--dry-run');
const out = `${dry.stdout}\n${dry.stderr}`;
if (dry.status !== 0) problems.push(`--dry-run exited ${dry.status}\n${out.slice(0, 600)}`);
if (!/^MODE dry-run$/m.test(out)) problems.push('missing "MODE dry-run"');
const allowed = new Set(golden.sanityUnpublish.map((d) => d.id));
const targets = [...out.matchAll(/^UNPUBLISH (\S+) rev=\S+$/gm)].map((m) => m[1]);
for (const t of targets) if (!allowed.has(t)) problems.push(`UNPUBLISH targets a non-listed id: ${t}`);
for (const k of golden.keep) if (targets.includes(k.id)) problems.push(`UNPUBLISH targets kept doc ${k.id}`);
const keeps = [...out.matchAll(/^KEEP (\S+)$/gm)].map((m) => m[1]);
if (!keeps.includes('show-19-2027')) problems.push('missing "KEEP show-19-2027"');
const sum = out.match(/^SUMMARY unpublish=(\d+) keep=(\d+)/m);
if (!sum) problems.push('missing SUMMARY line');
else if (Number(sum[1]) !== targets.length || Number(sum[2]) !== keeps.length) problems.push(`SUMMARY (${sum[0]}) disagrees with ${targets.length} UNPUBLISH / ${keeps.length} KEEP lines`);
if (count() !== before) problems.push('--dry-run wrote a backup file');
try {
  const m = readFileSync('.env.local', 'utf8').match(/^SANITY_API_TOKEN=["']?([^"'\n]+)/m);
  if (m && m[1].length > 8 && out.includes(m[1])) problems.push('script output contains the Sanity token');
} catch { /* no .env.local */ }
if (run().status === 0) problems.push('running with no mode flag exited 0');
const src = readFileSync(SCRIPT, 'utf8');
if (!src.includes('ifRevisionID')) problems.push('script does not lock mutations with ifRevisionID');
if (!/--apply/.test(src) || !/--dry-run/.test(src)) problems.push('script lacks both modes');
report(problems, `dry run well-formed (${targets.length} to unpublish, ${keeps.length} kept, nothing written)`);
