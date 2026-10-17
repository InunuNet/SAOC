#!/usr/bin/env node
// F18-A10: scope and no-invention hygiene on the diff against scopeBase() (merge-base(HEAD, main), never older than F18_BASE_REF; F19 and other main files merged in are not F18 scope), plus the static archive and sponsors rules.
//  - allowlist: the route pages named in goldens/f18/tokens.json, the keepsake ticket hub (app/(marketing)/national-show/tickets/), components/show/, components/nos/, components/tickets/ (incl. keepsake/), components/home/ShowBand.tsx (link repoint), lib/data/ (show-pages, show-page-presentation, ticket-card-view-models, admission-availability),
//    app/(marketing)/national-show/nos-structure.css (pure addition under an F18 comment, or the marked nos-ticket-row block), content copy swaps listed nowhere (NO copy file changes: a changed
//    content/ or sanity/ file fails), contracts/checks, specs, docs, e2e/. The header axis, nav-config, footer-data, the vendor legal components, SEO JSON-LD, the F16 rows' price maths stay untouched.
//  - no invention in added lines of code: no hex (except the seven v13 stub field colours), rgb (except v13 drop-shadow / --t-rule / --t-edge), new font family, animation (except the R84 hero fan-out, guarded per A32), duration other than 150ms (except R84 360ms / 1.1s), box-shadow, emoji; no NEW string literal in a .tsx outside strings-allowed.json / base text.
//  - F18b: NO new binary image asset (png, jpg, jpeg, webp, avif, gif, svg, ico): the keepsake stubs reuse the five production photos (goldens/f18b/v13-photo-map.json).
//  - archive: the beta TBC card spans the column (no max-w-* on the card or its wrapper) in app/(marketing)/national-show/archive/page.tsx.
// Usage: F18_BASE_REF=<sha> node --import tsx/esm contracts/checks/launch-weekend/f18/check-j-archive-scope.mjs   (cwd = implementation worktree)
import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { STRUCTURE_CSS, guardedLines, isExemptPath, judgeMotion, keepsakeBlock, probeMotionRules } from './motion-rules.mjs';
import { T, scopeBase, git, gitLines, readGolden, readText } from './_lib.mjs';

const BASE = scopeBase();
const problems = [];
const ROUTE_PAGES = ['', 'about', 'what-to-expect', 'vendors', 'sa-exhibitors', 'programme', 'international-guests', 'wosa-conference', 'faq', 'archive', 'conferences', 'workshops', 'exhibitors', 'sponsors', 'symposium'].map((s) => `app/(marketing)/national-show/${s ? `${s}/` : ''}page.tsx`);
const ALLOWED = [...ROUTE_PAGES, 'app/(marketing)/tickets/', 'app/(marketing)/layout.tsx', 'app/(marketing)/national-show/layout.tsx', 'app/(marketing)/national-show/not-found.tsx', 'app/(marketing)/national-show/[', 'app/(marketing)/national-show/tickets/', 'components/home/ShowBand.tsx', 'components/nos-chrome/ChromeFrame.tsx', 'app/(marketing)/national-show/nos-structure.css', 'app/(marketing)/national-show/nos-theme.css'];
const PREFIX = ['components/show/', 'components/nos/', 'components/tickets/', 'lib/data/', 'lib/', 'contracts/checks/', 'e2e/', 'docs/', 'README.md', '.agent/memory/project/specs/', '.tmp/'];
// UtilityBar (NOS variant) and the NOS header components (components/nos-chrome/NosHeader.tsx, covered by the nos-chrome prefix) belong to the site-77 session (R74 #7): never edited here.
// Payment, checkout and the ITN stay behaviourally identical (F18b): no API route, gateway or order library may change. The SAOC not-found stays as is.
const FORBIDDEN = ['components/chrome/nav-config.ts', 'components/chrome/footer-data.ts', 'components/chrome/UtilityBar.tsx', 'components/nos-chrome/', 'components/vendors/', 'app/api/', 'app/not-found.tsx', 'lib/payfast', 'lib/ozow', 'lib/orders', 'lib/checkout', 'lib/payment', 'lib/reconciliation', 'lib/confirmation-email'];
const FORBIDDEN_EXCEPT = ['components/nos-chrome/ChromeFrame.tsx'];
const names = [...new Set([...gitLines('diff', '--name-only', `${BASE}...HEAD`), ...gitLines('diff', '--name-only', 'HEAD'), ...gitLines('ls-files', '--others', '--exclude-standard')])];
for (const f of names) {
  if (FORBIDDEN.some((p) => f.startsWith(p)) && !FORBIDDEN_EXCEPT.includes(f)) problems.push(`forbidden file changed: ${f}`);
  else if (!ALLOWED.some((a) => f === a || (a.endsWith('/') && f.startsWith(a))) && !PREFIX.some((p) => f.startsWith(p))) problems.push(`file outside the F18 allowlist changed: ${f}`);
  if (/^(content|sanity)\//.test(f)) problems.push(`copy/CMS file changed (F18 changes no copy): ${f}`);
}
const BINARY = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg', '.ico']);
const addedFiles = new Set([...gitLines('diff', '--name-only', '--diff-filter=A', `${BASE}...HEAD`), ...gitLines('diff', '--name-only', '--diff-filter=A', 'HEAD'), ...gitLines('ls-files', '--others', '--exclude-standard')]);
for (const f of addedFiles) if (BINARY.has(extname(f).toLowerCase()) && !/^(\.agent|contracts|docs|e2e|\.tmp|test-results)\//.test(f)) problems.push(`new image asset added (F18b reuses the five production photos): ${f}`);
const strings = [readGolden('strings-allowed.json'), JSON.parse(readFileSync('.agent/memory/project/specs/launch-weekend/goldens/f18b/v13-copy.json', 'utf8'))];
// Standing design-cb ruling: a straight quote or apostrophe rendered as a typographic one is typography, not new copy. Normalise both sides before comparing.
const nq = (t) => t.replace(/&rsquo;|&lsquo;|[\u2018\u2019]/g, "'").replace(/&ldquo;|&rdquo;|[\u201C\u201D]/g, '"').replace(/National Orchid Show Symposium/g, 'SAOC Symposium');
const isNewSentence = (sentence, baseNorm, allowedNorm) => !baseNorm.includes(nq(sentence)) && !allowedNorm.has(nq(sentence));
const allowedStringsRaw = new Set(JSON.stringify(strings).match(/"([^"\\]|\\.)+"/g)?.map((s) => JSON.parse(s)) ?? []);
const added = [];
for (const f of names.filter((n) => existsSync(n) && /^(app|components)\/.*\.(tsx|css)$/.test(n))) {
  const adds = git('diff', '--unified=0', BASE, '--', f).split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
  adds.forEach((l) => added.push({ f, l }));
}
const V13 = JSON.parse(readFileSync('.agent/memory/project/specs/launch-weekend/goldens/f18b/v13-tokens.json', 'utf8'));
const FIELD_HEX = new Set(Object.values(V13.palette.stubFieldColours).map((h) => h.toLowerCase()));
problems.push(...probeMotionRules());
const structureBlock = keepsakeBlock(readText(STRUCTURE_CSS) ?? '');
const guardCache = new Map();
const guardOf = (f, l) => { if (!guardCache.has(f)) { const src = readText(f) ?? ''; guardCache.set(f, { lines: src.split('\n'), g: guardedLines(src) }); } const c = guardCache.get(f); const i = c.lines.indexOf(l); return i >= 0 ? c.g[i] : false; };
for (const { f, l } of added) {
  const tag = `${f}: "${l.trim().slice(0, 90)}"`;
  const exempt = isExemptPath(f, l, structureBlock);
  // Hex stays OUT of components and CSS: presentation hex lives in lib/data/*.ts constants and inline style vars (as the golden does).
  if (/#[0-9a-fA-F]{3,8}\b/.test(l.replace(/&#\d+;/g, ''))) problems.push(`hex colour added in a component or CSS file (put the seven v13 stub colours in a lib/data/*.ts constant and pass them as inline style vars): ${tag}`);
  if (/\brgba?\(/.test(l) && !(exempt && /drop-shadow\(|color-mix\(|--t-(rule|edge)/.test(l))) problems.push(`rgb literal added (use tokens or color-mix of existing tokens; rgba only on drop-shadow / --t-rule / --t-edge inside the keepsake paths): ${tag}`);
  if (/font-family\s*:/.test(l) && !/var\(--(serif|sans)\)/.test(l)) problems.push(`new font family: ${tag}`);
  const motion = judgeMotion({ line: l, guarded: guardOf(f, l), exempt });
  if (motion) problems.push(`${motion}: ${tag}`);
  if (/box-shadow\s*:|shadow-(sm|md|lg|xl|2xl)\b/.test(l) && !/drop-shadow/.test(l)) problems.push(`shadow added (NOS elevation is a border; v13 tickets use filter: drop-shadow): ${tag}`);
  if (/\p{Extended_Pictographic}/u.test(l)) problems.push(`emoji added: ${tag}`);
}
for (const f of names.filter((n) => /^lib\/.*\.ts$/.test(n) && existsSync(n))) {
  for (const l of git('diff', '--unified=0', BASE, '--', f).split('\n').filter((x) => x.startsWith('+') && !x.startsWith('+++'))) {
    for (const m of l.matchAll(/#[0-9a-fA-F]{6}\b/g)) if (!FIELD_HEX.has(m[0].toLowerCase())) problems.push(`${f}: hex ${m[0]} is not one of the seven v13 stub field colours`);
  }
}
// no NEW user-visible sentence literal in a .tsx: a JSX text or string literal of 4+ words must exist in the base tree or strings-allowed.json
const baseBlobRaw = gitLines('ls-tree', '-r', '--name-only', BASE).filter((p) => /\.(tsx|ts|json)$/.test(p) && /^(app|components|lib|content)\//.test(p)).map((p) => { try { return git('show', `${BASE}:${p}`); } catch { return ''; } }).join('\n');
const baseBlob = nq(baseBlobRaw);
const allowedStrings = new Set([...allowedStringsRaw].map(nq));
{
  const pb = nq("Visitors can’t miss “the show” today and it’s free");
  const pa = new Set();
  if (isNewSentence("Visitors can't miss \"the show\" today and it's free", pb, pa)) problems.push('probe: typographic quotes vs straight quotes are wrongly read as new copy');
  if (isNewSentence('Visitors can’t miss “the show” today and it’s free', pb, pa)) problems.push('probe: a typographic-quote sentence present in the base is wrongly read as new copy');
  if (!isNewSentence('Visitors can’t miss “the show” today and it’s extremely free', pb, pa)) problems.push('probe: a genuinely new word is NOT caught');
  // the Symposium rename (design-cb 2026-10-17) is the one sanctioned term swap: the same sentence under either name is not new copy, a changed word beside it still is
  const sb = nq('Register for the SAOC Symposium or the WOSA Conference at the show today');
  if (isNewSentence('Register for the National Orchid Show Symposium or the WOSA Conference at the show today', sb, pa)) problems.push('probe: the Symposium rename is wrongly read as new copy');
  if (!isNewSentence('Register for the National Orchid Show Symposium or the WOSA Conference at the show tomorrow', sb, pa)) problems.push('probe: a new word beside the renamed Symposium is NOT caught');
}
for (const { f, l } of added.filter((a) => a.f.endsWith('.tsx'))) {
  for (const m of l.matchAll(/(?:'([^'\n]{18,})'|"([^"\n]{18,})"|>([^<>{}\n]{18,})<)/g)) {
    const s = (m[1] ?? m[2] ?? m[3]).trim();
    if (s.split(/\s+/).length < 4 || /^[a-z0-9_.\-:/ [\]()*@#%,]+$/.test(s) || /^(use client|@\/|\.\/|\.\.\/)/.test(s)) continue;
    if (/\b(className|aria-|data-|href|import|from|var\(|calc\()/.test(s)) continue;
    if (isNewSentence(s, baseBlob, allowedStrings)) problems.push(`new user-visible sentence in ${f}: "${s.slice(0, 80)}" (reuse copy from the base tree or strings-allowed.json; invented copy is forbidden)`);
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
