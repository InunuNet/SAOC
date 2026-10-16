#!/usr/bin/env node
// F17-A2: Lee-Ann's legal text is NOT touched. Every legal file is byte-identical to the base, still holds its quoted sentence, and each quote is
// found verbatim on the cited line of her source document in docs/leeann-source/ (so the leave-list cannot be a place to park builder copy).
// Usage: F17_BASE_REF=<sha> node --import tsx/esm contracts/checks/launch-weekend/f17/check-b-legal.mjs
import { readFileSync } from 'node:fs';
import { NAMING, baseRef, baseText, readText, wsNorm } from './_lib.mjs';

baseRef();
const problems = [];
const unamp = (t) => wsNorm(t.replace(/&amp;/g, '&'));
const files = [...new Set(NAMING.legal.map((l) => l.file))];
for (const file of files) {
  const base = baseText(file);
  const cur = readText(file);
  if (base === null || cur === null) { problems.push(`${file}: missing at base or in the tree`); continue; }
  if (base !== cur) problems.push(`${file}: changed since the base ref; Lee-Ann's legal text must stay byte-identical`);
}
for (const l of NAMING.legal) {
  const cur = readText(l.file);
  if (cur !== null && !unamp(cur).includes(l.quote)) problems.push(`${l.file}: the quoted sentence is gone: "${l.quote}"`);
  const src = readFileSync(l.source.file, 'utf8').split('\n')[l.source.line - 1] ?? '';
  if (!unamp(src).includes(l.quote)) problems.push(`${l.source.file}:${l.source.line}: Lee-Ann's line does not contain "${l.quote}" (the leave-list entry has no source)`);
}
if (problems.length) { console.error(`FAIL F17-A2 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`PASS F17-A2: ${NAMING.legal.length} legal sentences in ${files.length} files unchanged and found verbatim in Lee-Ann's source`);
