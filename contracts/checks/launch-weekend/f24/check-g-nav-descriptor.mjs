#!/usr/bin/env node
// F24-A10 (static, V1): the vendors tickets-audience descriptor is the exact voted string, the old string is gone, and no nav descriptor
// in components/chrome/nav-config.ts contains the word "gated".
import { readFileSync } from 'node:fs';
import { ROOT, report, loadGolden } from './_meta.mjs';

const V = loadGolden('copy-deletions.json').V1;
const src = readFileSync(`${ROOT}${V.file}`, 'utf8');
const descriptors = [...src.matchAll(/descriptor:\s*(['"`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]);
const problems = [];
if (!descriptors.includes(V.new)) problems.push(`no descriptor equals "${V.new}"`);
if (src.includes(V.old)) problems.push(`the old descriptor "${V.old}" is still present`);
for (const d of descriptors) if (/\bgated\b/i.test(d)) problems.push(`descriptor still says "gated": "${d}"`);
if (descriptors.length < 10) problems.push(`parsed only ${descriptors.length} descriptors; the extractor no longer matches nav-config.ts`);
report(problems, `${descriptors.length} nav descriptors parsed; the vendors descriptor is the voted string and none says "gated"`);
