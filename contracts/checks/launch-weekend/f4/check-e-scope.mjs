#!/usr/bin/env node
// A5 - every file differing from BASE_REF (tracked diff + untracked) is on the F4 scope allowlist.
// Run from the implementation worktree, based on origin/main.
// Usage: node contracts/checks/launch-weekend/f4/check-e-scope.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { GOLDEN_DIR, report } from './_lib.mjs';

const cfg = JSON.parse(readFileSync(`${GOLDEN_DIR}/scope-allowlist.json`, 'utf8'));
const base = process.env[cfg.baseRefEnv] || cfg.baseRefDefault;
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
try { git('rev-parse', '--verify', base); } catch { console.error(`INFRA: base ref ${base} not found`); process.exit(2); }
const changed = new Set([...git('diff', '--name-only', base).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')].filter(Boolean));
const allowed = cfg.allowed.map((r) => new RegExp(r));
const problems = [];
for (const f of changed) if (!allowed.some((r) => r.test(f))) problems.push(`out-of-scope change: ${f}`);
report(problems, `${changed.size} changed file(s), all within the F4 allowlist`);
