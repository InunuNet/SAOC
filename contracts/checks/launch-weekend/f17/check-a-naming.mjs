#!/usr/bin/env node
// F17-A1 (R73): the event is "National Orchid Show". Static, no server.
//  1. Scan app/, components/, lib/, emails/, types/ (comment lines skipped) for "SAOC National Show" / "SAOC National Orchid Show": the only survivors are
//     Lee-Ann's legal sentences (naming.json "legal", proven by check B) and the mega lead title kept by ruling ("keep"). Wrapped JSX text is handled
//     (the scan runs on whitespace-collapsed text).
//  2. DELTA: in every swap file the current text (whitespace-normalised) equals the BASE text with only the naming rules applied: every other word identical.
//  3. mustContain: the email subjects, previews, fallback intro, hub sentence and the PayFast item name carry the new name.
//  4. PayFast item_name: still clamped to the gateway limit, no new character class, prefix is the new name. Ozow does not send itemName.
//  5. Report only: Sanity documents that still hold the old name (read-only query, never a mutation).
// Usage: F17_BASE_REF=<sha> node --import tsx/esm contracts/checks/launch-weekend/f17/check-a-naming.mjs   (cwd = implementation worktree)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NAMING, baseRef, baseText, readText, wsNorm, isCommentLine } from './_lib.mjs';

const problems = [];
const notes = [];
baseRef();

// ---- 1. scan
const re = new RegExp(NAMING.oldNameRegex, 'g');
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  if (n === 'node_modules' || n === '.next') return [];
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|jsx?|mjs|mdx)$/.test(n) ? [p] : [];
});
const allowed = new Map();
for (const l of NAMING.legal) allowed.set(l.file, (allowed.get(l.file) ?? 0) + 1);
for (const k of NAMING.keep) allowed.set(k.file, (allowed.get(k.file) ?? 0) + 1);
let scanned = 0;
for (const dir of NAMING.scanDirs) {
  for (const file of walk(dir)) {
    scanned += 1;
    const code = readFileSync(file, 'utf8').split('\n').filter((line) => !(NAMING.scanSkipComments && isCommentLine(line))).join('\n');
    const hits = wsNorm(code).match(re) ?? [];
    const want = allowed.get(file) ?? 0;
    if (hits.length !== want) problems.push(`${file}: ${hits.length} occurrence(s) of the old event name, want ${want}${want ? ' (legal / kept)' : ''}`);
  }
}

// ---- 2. delta
for (const sf of NAMING.swapFiles) {
  const base = baseText(sf.file);
  const cur = readText(sf.file);
  if (base === null) { problems.push(`${sf.file}: not present at the base ref, the swap list is stale`); continue; }
  if (cur === null) { problems.push(`${sf.file}: deleted`); continue; }
  let expected = wsNorm(base);
  for (const [from, to] of sf.rules ?? []) expected = expected.split(from).join(to);
  expected = expected.split(NAMING.globalRule[0]).join(NAMING.globalRule[1]);
  let actual = wsNorm(cur);
  // scope G1: the Explore-index mount (one import, one element per inner page) is the only other change a swap file may carry.
  // The hub already carried both at the base ref, so the same strip is applied to the expected text.
  const stripIndex = (t) => wsNorm(t.replace(/import \{ NosShowIndex \} from '@\/components\/nos\/NosShowIndex';/g, '').replace(/<NosShowIndex current="[^"]*" \/>/g, ''));
  actual = stripIndex(actual);
  expected = stripIndex(expected);
  for (const pat of sf.stripCurrent ?? []) {
    const rx = new RegExp(pat, "g");
    const n = (actual.match(rx) ?? []).length;
    if (sf.expectStrip !== undefined && n !== sf.expectStrip) problems.push(`${sf.file}: ${n} occurrence(s) of /${pat}/, want ${sf.expectStrip}`);
    actual = actual.replace(rx, "");
  }
  if (expected !== actual && !sf.deltaExempt) {
    let i = 0;
    while (i < expected.length && expected[i] === actual[i]) i += 1;
    problems.push(`${sf.file}: differs from base-plus-naming at char ${i}: want "…${expected.slice(Math.max(0, i - 30), i + 50)}…" got "…${actual.slice(Math.max(0, i - 30), i + 50)}…" (only the event name may change)`);
  }
}

// ---- 3. mustContain
for (const m of NAMING.mustContain) {
  const cur = readText(m.file);
  if (cur === null || !cur.includes(m.text)) problems.push(`${m.file}: missing \`${m.text}\``);
}

// ---- 4. item_name
const it = NAMING.itemName;
const route = readText(it.file) ?? '';
const limits = await import('../../../../lib/payments/gateway-field-limits.ts');
const clamp = limits.clampToMaxLength;
const MAX = limits.PAYFAST_FIELD_MAX_LENGTH?.[it.maxLengthKey];
if (typeof clamp !== 'function' || typeof MAX !== 'number') problems.push(`${it.maxLengthFile}: clampToMaxLength or PAYFAST_FIELD_MAX_LENGTH.${it.maxLengthKey} not found`);
else {
  const m = /itemName:\s*clampToMaxLength\(\s*(`[^`]*`)\s*,\s*PAYFAST_FIELD_MAX_LENGTH\.item_name/.exec(route);
  if (!m) problems.push(`${it.file}: itemName is no longer clampToMaxLength(<template>, PAYFAST_FIELD_MAX_LENGTH.item_name)`);
  else {
    const tpl = m[1].slice(1, -1);
    if (!tpl.startsWith(it.newPrefix)) problems.push(`${it.file}: item name does not start with "${it.newPrefix}"`);
    const oldChars = new Set([...it.oldPrefix].filter((c) => c.charCodeAt(0) > 127));
    const newChars = [...it.newPrefix].filter((c) => c.charCodeAt(0) > 127);
    for (const c of newChars) if (!oldChars.has(c)) problems.push(`${it.file}: the new prefix adds the non-ASCII character U+${c.charCodeAt(0).toString(16)} the old prefix did not have`);
    for (const biz of ['', 'A', 'x'.repeat(60), 'y'.repeat(200), 'z'.repeat(5000)]) {
      const out = clamp(tpl.replace("${submissionData.businessName ?? ''}", biz), MAX);
      if (out.length > MAX) problems.push(`item_name for a ${biz.length}-char business name is ${out.length} chars, limit ${MAX}`);
      if (!out.startsWith(it.newPrefix)) problems.push(`item_name for a ${biz.length}-char business name lost its prefix: "${out.slice(0, 50)}"`);
    }
  }
}
const ozow = readText('lib/payments/ozow.ts') ?? '';
if (/item_?name/i.test(ozow.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/itemName is NOT sent/g, ''))) notes.push('lib/payments/ozow.ts now mentions itemName in code: re-check Ozow field limits for the new name');

// ---- 5. CMS, report only
try {
  const { config } = await import('dotenv');
  config({ path: '.env.local', quiet: true });
  if (process.env.NEXT_PUBLIC_SANITY_PROJECT_ID && process.env.SANITY_API_TOKEN) {
    const { createClient } = await import('@sanity/client');
    const c = createClient({ projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID, dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production', apiVersion: '2024-01-01', token: process.env.SANITY_API_TOKEN, useCdn: false, perspective: 'published' });
    const docs = await c.fetch('*[!(_type match "system.*") && !(_type match "sanity.*")]');
    const hits = docs.filter((d) => re.test(JSON.stringify(d))).map((d) => `${d._type}:${d._id}`);
    re.lastIndex = 0;
    notes.push(`CMS (report only, never mutated): ${hits.length} published document(s) still hold the old event name${hits.length ? `: ${hits.slice(0, 12).join(', ')}` : ''}`);
  } else notes.push('CMS scan skipped: no Sanity credentials in .env.local');
} catch (e) { notes.push(`CMS scan skipped: ${e.message}`); }

for (const n of notes) console.log(`NOTE: ${n}`);
if (problems.length) { console.error(`FAIL F17-A1 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`PASS F17-A1: ${scanned} source files scanned, ${NAMING.swapFiles.length} swap files differ from base by the event name only, subjects/previews/item name carry "${NAMING.newName}"`);
