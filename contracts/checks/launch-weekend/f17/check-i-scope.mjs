#!/usr/bin/env node
// F17-A9: scope and no-invention hygiene on the diff against F17_BASE_REF. Only the allowlisted files may change (the naming swap files, nav-config, the sponsors manifest row
// and its two copies, footer-data, ShowContentState, the symposium page, the hub page, nos-structure.css by pure addition under an F17 comment); the header axis (nos-theme.css,
// NosHeader, components/nos-chrome/*), ShowPageProse (G7), the tickets hub, vendor components with Lee-Ann's legal text, SEO JSON-LD are untouched; the /members route itself and its page stay.
// Added lines in the non-swap code files hold no hex colour, rgb literal, new font family, animation, duration other than 150ms, shadow or emoji (the swap files are bounded by the A1 delta).
// Scope E touches the F16 ticket rows (admission-rows, AdmissionRows, the tickets hub page, the F16 .nos-ticket-* CSS block, a new availability helper). Scope F removes the Members entries (nav-config, footer-data).
// Usage: F17_BASE_REF=<sha> node --import tsx/esm contracts/checks/launch-weekend/f17/check-i-scope.mjs
import { existsSync } from 'node:fs';
import { NAMING, baseRef, baseText, git, gitLines, readText } from './_lib.mjs';

const BASE = baseRef();
const SWAP = NAMING.swapFiles.map((s) => s.file);
const CODE = [
  'components/chrome/nav-config.ts', 'content/national-show-routes.json', 'scripts/generate-nos-route-manifest.ts', 'app/(marketing)/national-show/sponsors/page.tsx',
  'components/chrome/footer-data.ts', 'lib/admission-rows.ts', 'components/tickets/AdmissionRows.tsx', 'app/(marketing)/national-show/tickets/page.tsx', 'lib/data/admission-availability.ts', 'components/show/nos/ShowContentState.tsx', 'app/(marketing)/national-show/symposium/page.tsx', 'app/(marketing)/national-show/nos-structure.css',
];
const ALLOWED = [...SWAP, ...CODE, 'app/(marketing)/national-show/tickets/buy/page.tsx', 'app/(marketing)/tickets/page.tsx'];
const ALLOWED_PREFIX = ['contracts/checks/', 'e2e/mega-menu-', '.agent/memory/project/specs/', 'docs/', '.tmp/', 'README.md'];
const problems = [];
const names = [...new Set([...gitLines('diff', '--name-only', `${BASE}...HEAD`), ...gitLines('diff', '--name-only', 'HEAD'), ...gitLines('ls-files', '--others', '--exclude-standard')])];
for (const f of names) if (!ALLOWED.includes(f) && !ALLOWED_PREFIX.some((p) => f.startsWith(p))) problems.push(`file outside the F17 allowlist changed: ${f}`);

const added = [];
for (const f of names.filter((n) => CODE.includes(n) && existsSync(n) && /\.(tsx?|css)$/.test(n))) {
  const lines = git('diff', '--unified=0', BASE, '--', f).split('\n');
  const adds = lines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
  const dels = lines.filter((l) => l.startsWith('-') && !l.startsWith('---'));
  if (f.endsWith('nos-structure.css')) {
    // Scope E may rewrite the F16 ticket-row block (.nos-ticket-rows ... #visit-heading); a deletion anywhere else is a violation.
    const baseLines = (baseText(f) ?? '').split('\n');
    const start = baseLines.findIndex((x) => x.includes('.nos-ticket-rows'));
    const end = baseLines.findIndex((x) => x.includes('#visit-heading')) + 2;
    for (const m of lines.filter((x) => x.startsWith('@@'))) {
      const h = /^@@ -(\d+)(?:,(\d+))? /.exec(m);
      if (!h) continue;
      const a = Number(h[1]); const n = h[2] === undefined ? 1 : Number(h[2]);
      if (n > 0 && (a - 1 < start || a - 1 + n > end)) problems.push(`nos-structure.css: lines ${a}-${a + n - 1} of the base file are deleted or edited outside the F16 ticket-row block (${start + 1}-${end})`);
    }
    if (adds.length && !adds.some((l) => /F17/.test(l))) problems.push('nos-structure.css: additions must sit under an F17 comment');
  }
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
// Scope F: the Members link is removed from nav-config and footer-data (not hidden by CSS); the /members route stays.
const nav = readText('components/chrome/nav-config.ts') ?? '';
if (/id: 'members'|href: '\/members'/.test(nav)) problems.push('nav-config: the Members item is still there (Brad 2026-10-16: hide the Members link)');
const foot = readText('components/chrome/footer-data.ts') ?? '';
if (/\/members/.test(foot)) problems.push('footer-data: the Members Portal link is still there');
if (!existsSync('app/(marketing)/members/page.tsx')) problems.push('the /members route was deleted; only the link goes, the route stays');
if (!added.length) problems.push('no F17 change found');
if (problems.length) { console.error(`FAIL F17-A9 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`PASS F17-A9: ${names.length} changed path(s) inside the allowlist; ${added.length} added code line(s) hold no unruled colour, font, animation, duration or shadow`);
