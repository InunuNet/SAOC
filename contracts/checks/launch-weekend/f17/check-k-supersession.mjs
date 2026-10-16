#!/usr/bin/env node
// F17-A10 (D, check hygiene): the retired F3 assertions are retired for real, not just listed. Static.
//  - goldens/f17/supersession.json records check-f3-container, the imagery 1080 h1-left test and the rhythm amendment;
//  - check-f3-container.mjs carries the RETIRED header; check-f3-imagery.mjs no longer asserts the 1080px content edge but still asserts h1/standfirst/wrap on one edge;
//  - contract-f16 F16-A10 no longer runs check-f3-container and still runs imagery, tickets and rhythm;
//  - check-f3-rhythm.mjs knows nos-section-joined.
// Usage: node contracts/checks/launch-weekend/f17/check-k-supersession.mjs
import { readFileSync } from 'node:fs';
import { readGolden } from './_lib.mjs';

const problems = [];
const S = readGolden('supersession.json');
const text = JSON.stringify(S);
for (const needle of ['check-f3-container.mjs', 'check-f3-imagery.mjs', 'check-f3-rhythm.mjs', 'F12-A15']) if (!text.includes(needle)) problems.push(`supersession.json does not mention ${needle}`);
const container = readFileSync('contracts/checks/nos-own-brand-chrome/f3/check-f3-container.mjs', 'utf8');
if (!/^\/\/ RETIRED/.test(container)) problems.push('check-f3-container.mjs has no RETIRED header');
const imagery = readFileSync('contracts/checks/nos-own-brand-chrome/f3/check-f3-imagery.mjs', 'utf8');
if (/want the 1080px container's content edge/.test(imagery)) problems.push("check-f3-imagery.mjs still asserts the 1080px container's content edge");
if (!/differs from the first \[data-nos-wrap\] content edge/.test(imagery) || !/are not on the same grid/.test(imagery)) problems.push('check-f3-imagery.mjs lost its still-valid h1/standfirst/wrap edge tests');
const rhythm = readFileSync('contracts/checks/nos-own-brand-chrome/f3/check-f3-rhythm.mjs', 'utf8');
if (!/nos-section-joined/.test(rhythm)) problems.push('check-f3-rhythm.mjs does not know nos-section-joined');
const c16 = readFileSync('.agent/memory/project/specs/launch-weekend/contract-f16.yaml', 'utf8');
const a10 = /- id: F16-A10[\s\S]*?command: (.*)\n/.exec(c16)?.[1] ?? '';
if (!a10) problems.push('contract-f16 F16-A10 not found');
if (/check-f3-container/.test(a10)) problems.push('F16-A10 still runs check-f3-container');
for (const c of ['check-f3-imagery', 'check-f3-tickets', 'check-f3-rhythm']) if (!a10.includes(c)) problems.push(`F16-A10 no longer runs ${c}`);
if (problems.length) { console.error(`FAIL F17-A10 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS F17-A10: container check retired, imagery 1080 test removed, rhythm amended, F16-A10 updated');
