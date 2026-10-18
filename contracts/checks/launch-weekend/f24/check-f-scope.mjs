#!/usr/bin/env node
// F24-A6 (static): only the files F24 needs change versus BASE_REF (default origin/main), and the diff adds no hex colour, no
// 'use client' and no new Sanity/api touch. Allowlist is the contract's scope list.
// Usage: BASE_REF=origin/main node contracts/checks/launch-weekend/f24/check-f-scope.mjs
import { execFileSync } from 'node:child_process';
import { ROOT, report } from './_meta.mjs';

const BASE_REF = process.env.BASE_REF || 'origin/main';
const ALLOW = [
  /^app\/layout\.tsx$/,
  /^app\/\(marketing\)\/(.+\/)?(page|layout)\.tsx$/,
  /^lib\/seo\.ts$/,
  /^lib\/seo\/.+\.ts$/,
  /^\.agent\/memory\//,
  /^contracts\/checks\/launch-weekend\/f24\//,
  /^docs\/.+\.md$/,
  /^README\.md$/,
];
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8' });
const files = git('diff', '--name-only', `${BASE_REF}...HEAD`).split('\n').filter(Boolean);
git('diff', '--name-only').split('\n').filter(Boolean).forEach((f) => files.push(f));
const problems = [];
for (const f of new Set(files)) if (!ALLOW.some((re) => re.test(f))) problems.push(`out of scope: ${f}`);
const added = git('diff', `${BASE_REF}`, '--', 'app', 'lib').split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
if (added.some((l) => /#[0-9a-fA-F]{6}\b/.test(l))) problems.push('the diff adds a hex colour (F24 is metadata and withholding only)');
if (added.some((l) => /['"]use client['"]/.test(l))) problems.push('the diff adds a client component');
report(problems, `${new Set(files).size} changed files, all inside the F24 allowlist`);
