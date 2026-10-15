#!/usr/bin/env node
// lib/vendor-photo-resume-progress.ts against the golden live-progress-matrix.json. Pure unit
// check, no I/O. Proves the count/completion a client component derives after each successful
// upload reaches 3 / complete without a reload, never double counts, ignores the logo, never
// exceeds 3, and that addUploadedSlot() is immutable (React state must get a NEW Set).
//
// Run as: node contracts/checks/vendor-photo-resume/check-live-progress.mjs

import { readFileSync } from 'node:fs';

const { computeResumeProgress, addUploadedSlot } = await import('../../../lib/vendor-photo-resume-progress.ts');
const golden = JSON.parse(
  readFileSync(new URL('../../../.agent/memory/project/specs/vendor-flow-fixes/goldens/f2/live-progress-matrix.json', import.meta.url), 'utf8'),
);

const failures = [];
for (const c of golden.progress) {
  const r = computeResumeProgress({ serverUploadedCount: c.server, missingSlots: c.missing, uploadedNowSlots: new Set(c.now) });
  if (r.uploadedCount !== c.expect.uploadedCount || r.complete !== c.expect.complete) {
    failures.push(`[${c.name}] got ${JSON.stringify(r)}, expected ${JSON.stringify(c.expect)}.`);
  }
  const keys = Object.keys(r).sort().join(',');
  if (keys !== 'complete,uploadedCount') failures.push(`[${c.name}] result keys must be exactly complete,uploadedCount; got ${keys}.`);
}
for (const c of golden.addSlot) {
  const prev = new Set(c.prev);
  const next = addUploadedSlot(prev, c.slot);
  if (next === prev) failures.push(`[${c.name}] addUploadedSlot must return a NEW Set (React state identity).`);
  if (prev.size !== c.prev.length) failures.push(`[${c.name}] addUploadedSlot mutated its input.`);
  if (JSON.stringify([...next].sort()) !== JSON.stringify([...c.expect].sort())) failures.push(`[${c.name}] got ${JSON.stringify([...next])}, expected ${JSON.stringify(c.expect)}.`);
}

// Sequential walk, as the component does: seed 0, fire onUploaded for each missing slot in turn.
let slots = new Set();
const missing = ['product-photo-1', 'product-photo-2', 'product-photo-3'];
const seen = [];
for (const s of missing) {
  slots = addUploadedSlot(slots, s);
  seen.push(computeResumeProgress({ serverUploadedCount: 0, missingSlots: missing, uploadedNowSlots: slots }));
}
if (JSON.stringify(seen.map((x) => x.uploadedCount)) !== '[1,2,3]' || JSON.stringify(seen.map((x) => x.complete)) !== '[false,false,true]') {
  failures.push(`sequential walk must yield counts 1,2,3 and complete only at the third; got ${JSON.stringify(seen)}.`);
}

const src = readFileSync(new URL('../../../lib/vendor-photo-resume-progress.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
if (/firebase|fetch\(|console\.|from '@\//.test(src)) failures.push('progress module must be pure: no firebase, fetch, logging or @/ alias imports.');

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}
console.log(`PASS: live progress satisfies ${golden.progress.length} progress and ${golden.addSlot.length} add-slot cases.`);
