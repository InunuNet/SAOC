// F1a A4 (static half): ONE focus ring, enumerated. Scans every .ts/.tsx under app/ and components/ (NOS-host-only code excluded: components/nos-chrome/, components/nos/, app/(nos)/) for className strings carrying
// focus:ring-*, focus-visible:ring-*, ring-offset-* focus(-visible):outline-none or a focus outline-offset other than [3px] (cues that are not outline or ring, such as group-focus underline, focus:bg-*, focus:border-*, are ignored). A hit passes only if it IS the one ring (focus-visible:outline-2, outline-solid, outline-offset-[3px], no ring-*, no outline-none);
// otherwise it must appear in goldens/focus-classes.json with a reason. Unlisted hits FAIL; a listed entry that matches no hit FAILS as stale. The runtime probes in check-focus-ring.mjs cover named elements only.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { check, finish } from './lib.mjs';
const ROOTS = ['app', 'components']; const EXCLUDED = ['components/nos-chrome/', 'components/nos/', 'components/tickets/TicketTypeCard.tsx', 'components/show/', 'app/(nos)/'];
const SPEC = process.env.DC_FOCUS_CLASSES || '.agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency/goldens/focus-classes.json';
const allow = JSON.parse(readFileSync(SPEC, 'utf8')).allow;
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? (n === 'node_modules' ? [] : walk(p)) : /\.tsx?$/.test(n) && !/\.(d|test|spec)\.tsx?$/.test(n) ? [p] : []; });
const HIT = /\b(?:focus|focus-visible|focus-within):ring-|(?:^|[\s"'`:])ring-offset-|(?:^|[\s"'`])(?:[\w-]+:)*outline-none\b|\bfocus(?:-visible)?:outline-offset-(?!\[3px\])/;
const RING = /\bfocus(?:-visible|-within)?:ring-|(?:^|[\s"'`:])ring-offset-/; const NONE = /(?:^|[\s"'`])(?:[\w-]+:)*outline-none\b/; const NONE_FOCUS = /(?:^|[\s"'`])(?:[\w-]*focus[\w-]*:)+outline-none\b/;
const isOne = (s) => /\bfocus-visible:outline-2\b/.test(s) && /\bfocus-visible:outline-solid\b/.test(s) && /\bfocus-visible:outline-offset-\[3px\]/.test(s) && !RING.test(s) && !NONE_FOCUS.test(s); // a bare outline-none only clears the resting state; the focus-visible ring then paints, so it is allowed WITH the one ring, never alone
// Comments are blanked first (same length, so line numbers hold): an apostrophe in prose would otherwise pair quotes across code. Strings: "..." and '...' stay on one line, `...` may span lines.
const blank = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/^(\s*)\/\/.*$/gm, (m, a) => a + ' '.repeat(m.length - a.length));
const LIT = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\[\s\S])*)`/g;
const files = ROOTS.flatMap(walk).filter((f) => !EXCLUDED.some((x) => f.startsWith(x)));
const used = new Set(); let hits = 0, one = 0;
for (const file of files) {
  const src = blank(readFileSync(file, 'utf8')); if (!HIT.test(src)) continue;
  for (const m of src.matchAll(LIT)) {
    const lit = m[1] ?? m[2] ?? m[3]; if (!HIT.test(lit)) continue; hits++; if (isOne(lit)) { one++; continue; }
    const line = src.slice(0, m.index).split('\n').length; const label = `${file}:${line}`;
    const i = allow.findIndex((a) => a.file === file && lit.includes(a.key));
    if (i >= 0) { used.add(i); check(Boolean(allow[i].reason), `${label}: allowlist entry has no reason`); continue; }
    const why = [RING.test(lit) && 'ring-* / ring-offset-* utility', NONE.test(lit) && 'outline-none (bare, focus: or focus-visible:)', /\bfocus(?:-visible)?:outline-offset-(?!\[3px\])/.test(lit) && 'outline offset is not 3px', !isOne(lit) && 'not the one ring (needs focus-visible:outline-2 outline-solid outline-offset-[3px])'].filter(Boolean).join(', ');
    check(false, `${label}: ${why}: "${lit.replace(/\s+/g, ' ').slice(0, 110)}"`);
  }
}
allow.forEach((a, i) => check(used.has(i), `goldens/focus-classes.json entry ${i + 1} (${a.file} / ${a.key}) matches no hit: stale, remove or fix it`));
console.log(`focus class strings: ${hits} (the one ring: ${one}, allowlisted: ${used.size} entries)`);
finish('focus-classes-static');
