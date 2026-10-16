#!/usr/bin/env node
// F9 - apphosting.yaml pins: one warm instance, unchanged ceiling, beta placeholder preview at RUNTIME only.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const EXPECTED_MIN_INSTANCES = 1;
const EXPECTED_MAX_INSTANCES = 2;

let doc;
try {
  doc = parse(readFileSync('apphosting.yaml', 'utf8'));
} catch (e) {
  console.error(`INFRA: cannot read or parse apphosting.yaml (${e.message})`);
  process.exit(2);
}

const problems = [];
const run = doc?.runConfig ?? {};
if (run.minInstances !== EXPECTED_MIN_INSTANCES) problems.push(`minInstances is ${run.minInstances}, expected ${EXPECTED_MIN_INSTANCES}`);
if (run.maxInstances !== EXPECTED_MAX_INSTANCES) problems.push(`maxInstances is ${run.maxInstances}, expected ${EXPECTED_MAX_INSTANCES}`);

const entries = (doc?.env ?? []).filter((e) => e.variable === 'SHOW_PLACEHOLDER_PREVIEW');
if (entries.length !== 1) {
  problems.push(`expected exactly one SHOW_PLACEHOLDER_PREVIEW entry, found ${entries.length}`);
} else {
  const [entry] = entries;
  if (entry.value !== 'true') problems.push(`SHOW_PLACEHOLDER_PREVIEW value is ${JSON.stringify(entry.value)}, expected the string "true"`);
  if (JSON.stringify(entry.availability) !== JSON.stringify(['RUNTIME'])) problems.push(`SHOW_PLACEHOLDER_PREVIEW availability is ${JSON.stringify(entry.availability)}, expected ["RUNTIME"]`);
}

if (problems.length) {
  for (const p of problems) console.error(`FAIL: ${p}`);
  process.exit(1);
}
console.log('OK: minInstances 1, maxInstances 2, SHOW_PLACEHOLDER_PREVIEW "true" at RUNTIME');
