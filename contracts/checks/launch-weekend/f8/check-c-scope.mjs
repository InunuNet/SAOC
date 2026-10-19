#!/usr/bin/env node
// A4 - every file differing from BASE_REF (tracked diff + untracked) is on the F8 scope allowlist, and none of the
// hot files in-flight work owns is touched.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ROOT, GOLDEN_DIR, report } from './_lib.mjs';

const cfg = JSON.parse(readFileSync(`${GOLDEN_DIR}/scope-allowlist.json`, 'utf8'));
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
let base = process.env[cfg.baseRefEnv];
if (!base) { try { base = git('merge-base', 'HEAD', cfg.baseRefDefault).trim(); } catch { base = cfg.baseRefDefault; } }
try { git('rev-parse', '--verify', base); } catch { console.error(`INFRA: base ref ${base} not found`); process.exit(2); }
const changed = new Set([...git('diff', '--name-only', base).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')].filter(Boolean));
const allowed = cfg.allowed.map((r) => new RegExp(r));
const problems = [];
for (const f of changed) if (!allowed.some((r) => r.test(f))) problems.push(`out-of-scope change: ${f}`);
report(problems, `${changed.size} changed file(s), all within the F8 allowlist`);
