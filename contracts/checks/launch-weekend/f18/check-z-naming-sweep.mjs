#!/usr/bin/env node
// F18-A36 (F18b, design-cb Symposium naming): the product is "National Orchid Show Symposium" end to end. The Sanity ticketType was renamed on 2026-10-17, so the code must not
// hardcode the old name and desync from the CMS (CMS name wins, ruling 4).
//  static : 0 occurrences of "SAOC Symposium" in the code of app/, components/ and lib/ (comments excluded). "SAOC/WOSA Joint" is a different, unruled name and is untouched.
//           Two files are site-77's (components/chrome/nav-config.ts, components/show/ShowSectionNav.tsx; A10 forbids editing the first): their hits are reported as notes until site-77 lands
//           the swap, never as a failure of F18's own work (lead routing, 2026-10-17).
//  scoped : the F18-owned sites say the new name: lib/ticket-taxonomy.ts, lib/provisional-figures.ts (fallback name and description), the conferences and symposium pages (the hub and tickets pages hold the old name only in comments or not at all, and the 0-count scan covers them).
//  symposium page: the h1 stays "National Orchid Show Symposium" (Brad's h1, F12).
//  sub-lede: lib/data/ticket-section-ledes.ts never types "SAOC" in front of a name (the programme line interpolates the CMS name).
// Usage: node contracts/checks/launch-weekend/f18/check-z-naming-sweep.mjs   (cwd = implementation worktree)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readText } from './_lib.mjs';

const problems = [];
const notes = [];
const r = { fail: (m) => problems.push(m), note: (m) => notes.push(m) };

const OLD = 'SAOC Symposium';
const NEW = 'National Orchid Show Symposium';
const SITE77 = ['components/chrome/nav-config.ts', 'components/show/ShowSectionNav.tsx'];
const ROOTS = ['app', 'components', 'lib'];
const EXT = /\.(tsx?|jsx?|mjs|css|json)$/;

const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:\\])\/\/.*$/gm, '$1');

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue;
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (EXT.test(e)) out.push(p);
  }
  return out;
}

// the comment stripper must keep string literals and drop real comments (probe)
export const probe = () => {
  const code = "const a = 'SAOC Symposium'; // SAOC Symposium here\n/* SAOC Symposium */ const b = 1;";
  const kept = stripComments(code);
  return kept.split(OLD).length - 1 === 1;
};

{
  if (!probe()) r.fail('probe: the comment stripper must keep exactly the string-literal hit');
  for (const root of ROOTS) {
    for (const f of walk(root)) {
      const hits = stripComments(readFileSync(f, 'utf8')).split(OLD).length - 1;
      if (!hits) continue;
      if (SITE77.includes(f)) r.note(`${f}: ${hits} "${OLD}" hit(s), site-77's file (routed by the lead); not a failure of F18`);
      else r.fail(`${f}: ${hits} occurrence(s) of "${OLD}" in code (the product is "${NEW}")`);
    }
  }
  for (const f of ['lib/ticket-taxonomy.ts', 'lib/provisional-figures.ts', 'app/(marketing)/national-show/conferences/page.tsx']) {
    const code = readText(f);
    if (code === null) { r.fail(`${f} is missing`); continue; }
    if (!stripComments(code).includes(NEW)) r.fail(`${f} does not say "${NEW}"`);
  }
  const sym = readText('app/(marketing)/national-show/symposium/page.tsx');
  if (sym === null) r.fail('app/(marketing)/national-show/symposium/page.tsx is missing');
  else if (!stripComments(sym).includes(NEW)) r.fail(`the symposium page does not say "${NEW}" (h1 stays Brad's "${NEW}")`);
  const ledes = readText('lib/data/ticket-section-ledes.ts');
  if (ledes === null) r.fail('lib/data/ticket-section-ledes.ts is missing');
  else if (/SAOC/.test(stripComments(ledes).replace(/SAOC\/WOSA/g, ''))) r.fail('lib/data/ticket-section-ledes.ts types "SAOC" in the lede source (the programme line must interpolate the CMS name)');
}
for (const n of notes) console.log(`NOTE ${n}`);
if (problems.length) { console.error(`FAIL F18-A36 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS F18-A36: the Symposium is named "National Orchid Show Symposium" end to end');
