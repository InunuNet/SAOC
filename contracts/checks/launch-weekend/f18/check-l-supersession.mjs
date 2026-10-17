#!/usr/bin/env node
// F18-A13 (check hygiene, static): the rebased and amended checks are what supersession.json says they are.
//  - supersession.json names check-labels-static, check-f3-imagery, check-h-symposium-render, check-f-sponsors;
//  - check-labels-static.mjs no longer references the d2071be5 base and still pins the structural labels;
//  - check-f3-imagery.mjs excludes [data-nos-image-break] and [data-ticket-stub] in both img filters;
//  - the retired F16 hub checks and the F7 check-d-ticket-form re-amendment are recorded, and each retired F16 file carries its RETIRED header;
//  - F17 check-h forbids hideContentGap on programme, wosa-conference, international-guests, sponsors but not sa-exhibitors;
//  - F17 check-f-sponsors treats the TBC marker as optional;
//  - check-labels-static runs green (spawned, structural, no server).
// Usage: node --import tsx/esm contracts/checks/launch-weekend/f18/check-l-supersession.mjs   (cwd = implementation worktree)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readGolden } from './_lib.mjs';

const problems = [];
const S = JSON.stringify(readGolden('supersession.json'));
for (const n of ['check-labels-static', 'check-f3-imagery', 'check-h-symposium-render', 'check-f-sponsors', 'check-d-ticket-form', 'check-f-cards', 'check-b-index', 'check-c-rows', 'check-d-render', 'check-a-copy', 'check-f3-tickets', 'data-ticket-stub']) if (!S.includes(n)) problems.push(`supersession.json does not mention ${n}`);
const labels = readFileSync('contracts/checks/vendor-p1-targets/check-labels-static.mjs', 'utf8');
if (/d2071be5/.test(labels.replace(/\/\/.*$/gm, ''))) problems.push('check-labels-static still diffs against d2071be5 in code');
if (!/Exhibiting Nurseries/.test(labels)) problems.push('check-labels-static lost its forbidden-label pin');
const img = readFileSync('contracts/checks/nos-own-brand-chrome/f3/check-f3-imagery.mjs', 'utf8');
if ((img.match(/data-nos-image-break/g) ?? []).length < 2) problems.push('check-f3-imagery does not exclude [data-nos-image-break] in both img filters');
if ((img.match(/data-ticket-stub\]'/g) ?? []).length < 2) problems.push('check-f3-imagery does not exclude [data-ticket-stub] in both img filters');
for (const f of ['a-copy.mjs', 'b-index.mjs', 'c-rows.mjs', 'd-render.mts', 'f-cards.mjs']) if (!/RETIRED/.test(readFileSync(`contracts/checks/launch-weekend/f16/check-${f}`, 'utf8').split('\n').slice(0, 3).join('\n'))) problems.push(`F16 check-${f} lacks its RETIRED header`);
const h = readFileSync('contracts/checks/launch-weekend/f17/check-h-symposium-render.mts', 'utf8');
for (const p of ['programme', 'wosa-conference', 'international-guests', 'sponsors']) if (!h.includes(p)) problems.push(`F17 check-h no longer lists ${p} as must-not-hide`);
if (/sa-exhibitors['"]?\s*[,\]]/.test(h.split('hideContentGap')[1] ?? '') && /mustNot[^\n]*sa-exhibitors/.test(h)) problems.push('F17 check-h still forbids hideContentGap on sa-exhibitors');
const sp = readFileSync('contracts/checks/launch-weekend/f17/check-f-sponsors.mjs', 'utf8');
if (!/optional|beta-only|may be absent|no marker/i.test(sp)) problems.push('F17 check-f-sponsors does not treat the TBC marker as optional');
try { execFileSync('node', ['contracts/checks/vendor-p1-targets/check-labels-static.mjs'], { stdio: 'pipe' }); } catch (e) { problems.push(`check-labels-static fails: ${String(e.stderr || e.stdout || e.message).slice(0, 300)}`); }
if (problems.length) { console.error(`FAIL F18-A13 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS F18-A13: check hygiene recorded and applied');
