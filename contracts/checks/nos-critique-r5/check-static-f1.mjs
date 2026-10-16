// nos-critique-r5 F1 — static source check for the 60ch prose measure on /national-show/vendors and
// /national-show/exhibitors. Class-only, page-local (the r2 precedent):
//   - the 1280px content container of each page gains `[&_p]:max-w-[60ch]` (targets p only);
//   - no cap targets li/ul/ol/td/dd/dt, [data-nos-content-state], and none is wider than 60ch;
//   - no copy string is added, removed or changed;
//   - vendors: the <CtaBand …/> block (F3's) is byte-identical, VendorIntro/VendorGrid/VendorEmptyState
//     are not wrapped in anything new beyond the container class.
//
// Run as: node contracts/checks/nos-critique-r5/check-static-f1.mjs
import { EXHIBITORS, VENDORS, copyStrings, finish, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const NAME = 'check-static-f1.mjs';
const failures = [];
const CAP = '[&_p]:max-w-[60ch]';

for (const rel of [VENDORS, EXHIBITORS]) {
  const raw = readRepoFile(rel);
  if (raw === null) { failures.push(`missing ${rel}`); continue; }
  const base = readBaseFile(rel);
  const src = stripComments(raw);

  const container = src.match(/<div className="[^"]*max-w-\[1280px\][^"]*">/)?.[0] ?? '';
  if (!container) failures.push(`${rel}: the max-w-[1280px] content container is gone`);
  else if (!container.includes(CAP)) failures.push(`${rel}: the content container must carry ${CAP}`);
  if ((src.match(/\[&_p\]:max-w-\[60ch\]/g) ?? []).length !== 1) failures.push(`${rel}: ${CAP} must appear exactly once (on the container)`);

  if (/\[&[_>]\s*(li|ul|ol|td|th|dd|dt|tr|table)\b/.test(src) || /\[&_\[data-nos-content-state\]/.test(src)) failures.push(`${rel}: no cap may target li/ul/ol/td/dd/dt or [data-nos-content-state] (grid cards and tracks must keep their width)`);
  if (/max-w-\[(6[1-9]|[7-9]\d|\d{3})ch\]/.test(src)) failures.push(`${rel}: no prose cap wider than 60ch`);

  const a = copyStrings(raw).sort().join('\n');
  const b = copyStrings(base).sort().join('\n');
  if (a !== b) failures.push(`${rel}: copy strings changed; this feature is class-only (no invention)`);

  // Only className edits: with every className value masked, the file must equal the base.
  const mask = (s) => stripComments(s).replace(/className="[^"]*"/g, 'className=""').replace(/\s+/g, ' ');
  if (mask(raw) !== mask(base)) failures.push(`${rel}: differs from the base beyond className values; F1 is class-only`);
}

const v = readRepoFile(VENDORS);
if (v !== null) {
  const cta = (s) => stripComments(s).match(/<CtaBand[\s\S]*?\n {6}\/>/)?.[0].replace(/\s+/g, ' ') ?? '';
  if (!cta(v) || cta(v) !== cta(readBaseFile(VENDORS))) failures.push(`${VENDORS}: the <CtaBand …/> vendors CTA is F3's and must be byte-identical`);
}

finish(NAME, failures, 'vendors + exhibitors: page-local [&_p]:max-w-[60ch] on the content container only, class-only edit, no copy change, vendors CTA untouched.');
