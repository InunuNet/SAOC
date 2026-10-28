// F1a A4 (static half): ONE focus ring, enumerated. Scans every .ts/.tsx under app/ and components/ for className strings carrying
// focus:ring-*, focus-visible:ring-*, ring-offset-* focus(-visible):outline-none or a focus outline-offset other than [3px] (cues that are not outline or ring, such as group-focus underline, focus:bg-*, focus:border-*, are ignored). A hit passes only if it IS the one ring (focus-visible:outline-2, outline-solid, outline-offset-[3px], no ring-*, no outline-none);
// otherwise it must appear in goldens/focus-classes.json with a reason. Unlisted hits FAIL; a listed entry that matches no hit FAILS as stale. The runtime probes in check-focus-ring.mjs cover named elements only.
// SCOPE, stated once. (1) The class-string scan above excludes ONLY the explicit EXCLUDED list below: components/nos-chrome/, components/nos/, components/show/, components/tickets/TicketTypeCard.tsx and app/(nos)/ (NOS-host chrome and pages).
// NOS-routed SHARED components that live elsewhere (components/vendors/*, components/tickets/* other than TicketTypeCard, components/contact/NosContactAside.tsx) are IN SCOPE of the class-string scan ON PURPOSE.
// (2) The NOS-routed exemption (derived from the import graph, printed, DC_LIST_NOS=1 lists the files) applies ONLY to the second, standalone-element pass further down. It does not touch the class-string scan, and check-error-summary-static.mjs
// (the alert scan) likewise covers NOS-routed components on purpose.
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
// Second pass (F1a Codex finding, /events/submit "Contact us about membership"): a STANDALONE <a>, <Link> or <button> whose className carries NO focus or outline utility at all paints the browser default, not the one ring.
// The first pass only sees strings that already contain a focus utility, so it was blind to this. An element is standalone when it is a <button>, or a link whose classes build a box (flex/block/padding/bg/border/size...);
// a link with no className, or only prose classes (underline, colour, font), is an in-prose link and stays exempt. className={IDENT} is resolved to its literal definition in the same file; an unresolvable
// reference (a prop, a spread, an import) is skipped, a printed gap not a pass. Same allowlist (file + key substring) as above.
const TAG = /<(a|Link|button)\b/g; const BOX = /(?:^|[\s"'`:])(?:inline-flex|flex|inline-block|block|grid|min-h-\S+|min-w-\S+|h-\d\S*|w-\d\S*|size-\S+|p[xylrtb]?-\S+|bg-\S+|border(?:-\S+)?|rounded(?:-\S+)?|absolute|relative)(?=[\s"'`]|$)/;
const tagText = (src, from) => { let depth = 0, q = null; for (let i = from; i < src.length; i++) { const ch = src[i]; if (q) { if (ch === q && src[i - 1] !== '\\') q = null; continue; } if (depth > 0 && (ch === '"' || ch === "'" || ch === '`')) { q = ch; continue; } if (ch === '{') depth++; else if (ch === '}') depth--; else if (ch === '>' && depth === 0) return src.slice(from, i + 1); } return src.slice(from, from + 600); };
const FOCUSY = /focus|outline/; let standalone = 0, covered = 0, unresolved = 0;
// Constants are resolved across files by name (FOCUS_RING from admin/tokens.ts, HERO_CTA_BASE in Hero.tsx...): every `const NAME = <literals>` under app/ and components/. ${NAME} inside a template literal resolves the same way.
const DEFS = new Map(); const srcOf = new Map(files.map((f) => [f, blank(readFileSync(f, 'utf8'))]));
for (const src of srcOf.values()) for (const d of src.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\b[^=\n]*=([\s\S]*?)(?:;\n|\n\n)/g)) { const lits = [...d[2].matchAll(LIT)].map((x) => x[1] ?? x[2] ?? x[3]); const refs = [...d[2].matchAll(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g)].map((x) => x[1]); if (lits.length || refs.length) DEFS.set(d[1], (DEFS.get(d[1]) || '') + ' ' + lits.join(' ') + ' ' + refs.map((r) => '${' + r + '}').join(' ')); }
const expand = (t, depth = 0) => depth > 4 ? t : t.replace(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g, (_, n) => DEFS.has(n) ? ' ' + expand(DEFS.get(n), depth + 1) + ' ' : ' ');
// Classes whose CSS rule carries a :focus / :focus-visible selector (app/globals.css, SAOC side): an element using one is covered by that rule.
const CSS_FOCUS = new Set(); for (const m of readFileSync('app/globals.css', 'utf8').matchAll(/\.([A-Za-z_][\w-]*)[^{,]*?:focus(?:-visible|-within)?\b/g)) CSS_FOCUS.add(m[1]);
// NOS-routed files are exempt from this pass (proxy.ts sends /tickets and the show routes to NOS): derived from the import graph, not a hand list. A file is NOS-only when it has importers and EVERY importer is
// under app/(nos)/, in the EXCLUDED set, or itself NOS-only (fixed point). Shared files (any SAOC importer, or none found) stay checked. Exempt files are printed with the reason.
const ALL = [...ROOTS.flatMap(walk)]; const importers = new Map(ALL.map((f) => [f, new Set()]));
const resolveImp = (from, spec) => { const base = spec.startsWith('@/') ? spec.slice(2) : spec.startsWith('.') ? join(from, '..', spec) : null; if (!base) return null; for (const c of [base + '.tsx', base + '.ts', join(base, 'index.tsx'), join(base, 'index.ts')]) if (importers.has(c)) return c; return null; };
for (const f of ALL) for (const m of blank(readFileSync(f, 'utf8')).matchAll(/from\s+['"]([^'"]+)['"]/g)) { const t = resolveImp(f, m[1]); if (t && t !== f) importers.get(t).add(f); }
const nosFile = (f) => f.startsWith('app/(nos)/') || EXCLUDED.some((x) => f.startsWith(x)); const nosOnly = new Set();
for (let changed = true; changed;) { changed = false; for (const [f, imps] of importers) if (!nosOnly.has(f) && !nosFile(f) && imps.size > 0 && [...imps].every((i) => nosFile(i) || nosOnly.has(i))) { nosOnly.add(f); changed = true; } }
const nosExempt = new Set();
for (const file of files) {
  if (nosOnly.has(file)) { nosExempt.add(file); continue; }
  const src = srcOf.get(file);
  for (const m of src.matchAll(TAG)) {
    const tag = tagText(src, m.index); const cn = /\bclassName\s*=\s*(\{[\s\S]*\}|"[^"]*"|'[^']*')/.exec(tag); if (!cn) continue;
    const lits = [...cn[1].matchAll(LIT)].map((x) => x[1] ?? x[2] ?? x[3]); const ids = [...cn[1].replace(LIT, ' ').matchAll(/\b[A-Za-z_$][\w$]*\b/g)].map((x) => x[0]).filter((x) => !['cn', 'clsx', 'join', 'props', 'true', 'false', 'null', 'undefined'].includes(x));
    if (/\b(?:className|props|rest)\b/.test(cn[1].replace(LIT, ' ')) || /(?:^|\s)nk-/.test(lits.join(' '))) { unresolved++; continue; } // a className prop pass-through is the caller's (probed at runtime); nk-* classes are NOS Design's CSS (NOS-host styling, excluded like components/show)
    const known = ids.filter((id) => DEFS.has(id)); const unknown = ids.filter((id) => !DEFS.has(id));
    const text = expand(lits.join(' ') + ' ' + known.map((id) => DEFS.get(id)).join(' '));
    const isButton = m[1] === 'button'; if (!isButton && !BOX.test(text)) { if (!(lits.length || known.length)) continue; continue; }
    if (!(lits.length || known.length) || (unknown.length && !FOCUSY.test(text) && !text.trim())) { unresolved++; continue; }
    standalone++; if (FOCUSY.test(text) || text.split(/\s+/).some((c) => CSS_FOCUS.has(c))) { covered++; continue; }
    const line = src.slice(0, m.index).split('\n').length; const label = `${file}:${line}`;
    const i = allow.findIndex((a) => a.file === file && text.includes(a.key));
    if (i >= 0) { used.add(i); continue; }
    check(false, `${label}: standalone <${m[1]}> className has no focus or outline utility (browser default ring, not the one ring): "${text.replace(/\s+/g, ' ').trim().slice(0, 110)}"`);
  }
}
allow.forEach((a, i) => check(used.has(i), `goldens/focus-classes.json entry ${i + 1} (${a.file} / ${a.key}) matches no hit: stale, remove or fix it`));
if (process.env.DC_LIST_NOS) for (const f of [...nosExempt].sort()) console.log(`NOS-ROUTED ${f}`);
if (nosExempt.size) { const dirs = new Map(); for (const f of nosExempt) { const d = f.replace(/\/[^/]+$/, ''); dirs.set(d, (dirs.get(d) || 0) + 1); } console.log(`NOS-ROUTED, exempt from the standalone pass (${nosExempt.size} files imported only from app/(nos) or NOS-only files; proxy.ts serves their routes on the NOS host): ${[...dirs].map(([d, n]) => `${d} (${n})`).join(', ')}`); }
console.log(`focus class strings: ${hits} (the one ring: ${one}, allowlisted: ${used.size} entries); standalone elements: ${standalone} (with a focus utility: ${covered}, className unresolvable and skipped: ${unresolved})`);
finish('focus-classes-static');
