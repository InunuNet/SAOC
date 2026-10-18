// nos-critique-r14 f2 static (QA input, hash-locked). F2 (lead ruling FINAL 2026-10-18): /societies gets its own meta description, the
// Drive sentence in goldens/f2-description.json verbatim, through buildPageMetadata (lib/seo.ts) as the r12 /about description was done.
//   S1  every BASE line of app/(marketing)/societies/page.tsx is still there, in order, except the bare `metadata = { title }` line, so
//       UNSOURCED_LEDE, its withhold branch and the rest of the page are untouched.
//   S2  the page imports buildPageMetadata from '@/lib/seo' and its metadata is buildPageMetadata({ title: 'Affiliated Societies',
//       description: <the golden string, one literal>, path: '/societies' }) with no lede (the string fits 70-160, no cut).
//   S3  the added lines carry no other new copy: every string literal of 20+ chars they add is the golden string or already in the BASE file.
//   S4  a comment line in the page cites the Drive path and line 9; the golden string is in that Drive file on line 9 (source 1 of
//       docs/rules/no-invention.md). The Drive mirror is gitignored, so it is read from the inspected checkout, the checkout holding
//       this spec, or the main checkout of the repository (NOS_CR14_DRIVE overrides).
//   S5  docs/nos-critique-r14.md records F2 and the Drive source.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { DOC, SOCIETIES, finish, git, golden, projectRoot, readBaseFile, readRepoFile, repoRoot } from './_lib.mjs';

const NAME = 'f2-static.mjs';
const failures = [];
const G = JSON.parse(golden('f2-description.json'));
const BARE = "export const metadata: Metadata = { title: 'Affiliated Societies' };";
const MIN_LITERAL = 20;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const head = readRepoFile(SOCIETIES);
const base = readBaseFile(SOCIETIES);
if (head === null || base === null) failures.push(`${SOCIETIES} is missing at HEAD or BASE`);
else {
  // S1
  const h = head.split('\n');
  const added = [];
  let i = 0;
  for (const line of base.split('\n')) {
    if (line === BARE) continue;
    while (i < h.length && h[i] !== line) added.push(h[i++]);
    if (i === h.length) { failures.push(`${SOCIETIES}: BASE line removed or changed: "${line.trim().slice(0, 80)}" (S1)`); break; }
    i++;
  }
  added.push(...h.slice(i));
  if (h.includes(BARE)) failures.push(`${SOCIETIES}: the bare metadata = { title } line is still there (S2)`);
  // S2
  if (!/^import \{[^}]*\bbuildPageMetadata\b[^}]*\} from '@\/lib\/seo';$/m.test(head)) failures.push(`${SOCIETIES}: does not import buildPageMetadata from '@/lib/seo' (S2)`);
  const call = /export const metadata: Metadata = buildPageMetadata\(\{([\s\S]*?)\}\);/.exec(head);
  if (!call) failures.push(`${SOCIETIES}: metadata is not \`buildPageMetadata({ ... })\` (S2)`);
  else {
    const body = call[1];
    if (!/\btitle:\s*'Affiliated Societies',/.test(body)) failures.push(`${SOCIETIES}: buildPageMetadata title is not 'Affiliated Societies' (S2)`);
    if (!new RegExp(`\\bdescription:\\s*'${esc(G.text)}',`).test(body)) failures.push(`${SOCIETIES}: buildPageMetadata description is not the golden string as one single-quoted literal (S2)`);
    if (!/\bpath:\s*'\/societies',/.test(body)) failures.push(`${SOCIETIES}: buildPageMetadata path is not '/societies' (S2)`);
    if (/\blede\s*:/.test(body)) failures.push(`${SOCIETIES}: buildPageMetadata gets a lede; the string fits 70-160 and needs none (S2)`);
    const keys = [...body.matchAll(/^\s*(\w+)\s*:/gm)].map((m) => m[1]);
    for (const k of keys) if (!['title', 'description', 'path'].includes(k)) failures.push(`${SOCIETIES}: buildPageMetadata gets an extra '${k}' (S2)`);
  }
  // S3
  const code = added.filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  for (const m of code.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`([^`]*)`/g)) {
    const lit = m[1] ?? m[2] ?? m[3];
    if (lit.length >= MIN_LITERAL && lit !== G.text && !base.includes(lit)) failures.push(`${SOCIETIES}: added literal is new copy: "${lit.slice(0, 60)}" (S3)`);
  }
  // S4
  const cite = new RegExp(`^\\s*//.*${esc(G.source)}.*(?:\\bl\\.\\s?|:|\\bline\\s)${G.line}\\b`, 'm');
  if (!cite.test(head)) failures.push(`${SOCIETIES}: no one-line comment citing "${G.source}" line ${G.line} (S4)`);
}
if (G.text.length !== G.chars) failures.push(`golden string is ${G.text.length} chars, the ruling says ${G.chars}`);

// S4 source
let mainCheckout = null;
try { mainCheckout = path.dirname(path.resolve(repoRoot, git('rev-parse', '--git-common-dir').trim())); } catch { /* no git */ }
const candidates = [process.env.NOS_CR14_DRIVE, path.join(repoRoot, G.source), path.join(projectRoot, G.source), mainCheckout && path.join(mainCheckout, G.source)].filter(Boolean);
const src = candidates.find((c) => existsSync(c));
if (!src) failures.push(`Drive source not found (tried ${candidates.join(' | ')}); set NOS_CR14_DRIVE (S4)`);
else {
  const line = readFileSync(src, 'utf8').split('\n')[G.line - 1] ?? '';
  if (!line.includes(G.text)) failures.push(`${G.source} line ${G.line} does not contain the golden string (S4, no invention)`);
}

// S5
const doc = readRepoFile(DOC);
if (doc === null || !/\bF2\b/.test(doc) || !doc.includes('content/drive-source/')) failures.push(`${DOC} must record F2 and its Drive source (S5)`);

finish(NAME, failures, '/societies takes the Drive sentence verbatim through buildPageMetadata, cites it, adds no other copy and keeps the rest of the page; docs record F2.');
