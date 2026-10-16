#!/usr/bin/env node
// F18-A10: scope and no-invention hygiene on the diff against F18_BASE_REF, plus the static archive and sponsors rules.
//  - allowlist: the 13 route pages named in goldens/f18/tokens.json plus components/show/, components/nos/, components/tickets/, lib/data/ (show-pages, show-page-presentation, a new presentation helper),
//    app/(marketing)/national-show/nos-structure.css (pure addition under an F18 comment, or the marked nos-ticket-row block), content copy swaps listed nowhere (NO copy file changes: a changed
//    content/ or sanity/ file fails), contracts/checks, specs, docs, e2e/. The header axis, nav-config, footer-data, the vendor legal components, SEO JSON-LD, the F16 rows' price maths stay untouched.
//  - no invention in added lines of code: no hex, rgb, new font family, animation, duration other than 150ms, shadow, emoji; no NEW string literal in a .tsx outside strings-allowed.json / base text.
//  - archive: the beta TBC card spans the column (no max-w-* on the card or its wrapper) in app/(marketing)/national-show/archive/page.tsx.
// Usage: F18_BASE_REF=<sha> node --import tsx/esm contracts/checks/launch-weekend/f18/check-j-archive-scope.mjs   (cwd = implementation worktree)
import { existsSync, readFileSync } from 'node:fs';
import { T, baseRef, git, gitLines, readGolden, readText } from './_lib.mjs';

const BASE = baseRef();
const problems = [];
const ROUTE_PAGES = ['about', 'what-to-expect', 'vendors', 'sa-exhibitors', 'programme', 'international-guests', 'wosa-conference', 'faq', 'archive', 'conferences', 'workshops', 'exhibitors', 'sponsors', 'symposium'].map((s) => `app/(marketing)/national-show/${s}/page.tsx`);
const ALLOWED = [...ROUTE_PAGES, 'app/(marketing)/national-show/nos-structure.css', 'app/(marketing)/national-show/nos-theme.css', 'public/images/national-show/'];
const PREFIX = ['components/show/', 'components/nos/', 'components/tickets/', 'lib/data/', 'lib/', 'contracts/checks/', 'e2e/', 'docs/', 'README.md', '.agent/memory/project/specs/', '.tmp/'];
const FORBIDDEN = ['components/chrome/nav-config.ts', 'components/chrome/footer-data.ts', 'components/nos-chrome/', 'components/vendors/'];
const names = [...new Set([...gitLines('diff', '--name-only', `${BASE}...HEAD`), ...gitLines('diff', '--name-only', 'HEAD'), ...gitLines('ls-files', '--others', '--exclude-standard')])];
for (const f of names) {
  if (FORBIDDEN.some((p) => f.startsWith(p))) problems.push(`forbidden file changed: ${f}`);
  else if (!ALLOWED.some((a) => f === a || (a.endsWith('/') && f.startsWith(a))) && !PREFIX.some((p) => f.startsWith(p))) problems.push(`file outside the F18 allowlist changed: ${f}`);
  if (/^(content|sanity)\//.test(f)) problems.push(`copy/CMS file changed (F18 changes no copy): ${f}`);
}
const strings = readGolden('strings-allowed.json');
const allowedStrings = new Set(JSON.stringify(strings).match(/"([^"\\]|\\.)+"/g)?.map((s) => JSON.parse(s)) ?? []);
const added = [];
for (const f of names.filter((n) => existsSync(n) && /^(app|components)\/.*\.(tsx|css)$/.test(n))) {
  const adds = git('diff', '--unified=0', BASE, '--', f).split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
  adds.forEach((l) => added.push({ f, l }));
}
for (const { f, l } of added) {
  const tag = `${f}: "${l.trim().slice(0, 90)}"`;
  if (/#[0-9a-fA-F]{3,8}\b/.test(l.replace(/&#\d+;/g, ''))) problems.push(`hex colour added: ${tag}`);
  if (/\brgba?\(/.test(l)) problems.push(`rgb literal added (use tokens): ${tag}`);
  if (/font-family\s*:/.test(l) && !/var\(--(serif|sans)\)/.test(l)) problems.push(`new font family: ${tag}`);
  if (/@keyframes|\banimate-|animation:/.test(l)) problems.push(`animation added: ${tag}`);
  for (const m of l.matchAll(/duration-\[?(\d+)|transition[^;]*?\b(\d+)ms/g)) { const d = m[1] || m[2]; if (d && d !== '150') problems.push(`duration ${d}ms (only 150ms): ${tag}`); }
  if (/box-shadow\s*:|shadow-(sm|md|lg|xl|2xl)\b/.test(l)) problems.push(`shadow added (NOS elevation is a border): ${tag}`);
  if (/\p{Extended_Pictographic}/u.test(l)) problems.push(`emoji added: ${tag}`);
}
// no NEW user-visible sentence literal in a .tsx: a JSX text or string literal of 4+ words must exist in the base tree or strings-allowed.json
const baseBlob = gitLines('ls-tree', '-r', '--name-only', BASE).filter((p) => /\.(tsx|ts|json)$/.test(p) && /^(app|components|lib|content)\//.test(p)).map((p) => { try { return git('show', `${BASE}:${p}`); } catch { return ''; } }).join('\n');
for (const { f, l } of added.filter((a) => a.f.endsWith('.tsx'))) {
  for (const m of l.matchAll(/(?:'([^'\n]{18,})'|"([^"\n]{18,})"|>([^<>{}\n]{18,})<)/g)) {
    const s = (m[1] ?? m[2] ?? m[3]).trim();
    if (s.split(/\s+/).length < 4 || /^[a-z0-9_.\-:/ [\]()*@#%,]+$/.test(s) || /^(use client|@\/|\.\/|\.\.\/)/.test(s)) continue;
    if (/\b(className|aria-|data-|href|import|from|var\(|calc\()/.test(s)) continue;
    if (!baseBlob.includes(s) && !allowedStrings.has(s)) problems.push(`new user-visible sentence in ${f}: "${s.slice(0, 80)}" (reuse copy from the base tree or strings-allowed.json; invented copy is forbidden)`);
  }
}
const arch = readText('app/(marketing)/national-show/archive/page.tsx') ?? '';
if (!arch) problems.push('archive page missing');
else {
  const near = arch.split('\n').filter((l) => /max-w-/.test(l));
  const card = arch.split('\n').findIndex((l) => l.includes(T.archive.emptyHeading));
  const lines = arch.split('\n');
  if (card < 0) problems.push(`archive: the beta TBC card ("${T.archive.emptyHeading}") is gone from the page`);
  for (let i = Math.max(0, card - 25); i <= card; i += 1) if (/max-w-(xl|2xl|3xl|4xl|5xl|prose|\[)/.test(lines[i] ?? '') && !/nos-wrap|container/.test(lines[i])) problems.push(`archive: line ${i + 1} still caps the TBC card width: "${lines[i].trim().slice(0, 80)}"`);
  void near;
}
if (!added.length) problems.push('no F18 change found');
if (problems.length) { console.error(`FAIL F18-A10 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS F18-A10 scope, no invention, archive card width');
