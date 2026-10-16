#!/usr/bin/env node
// A7: scope and no-invention hygiene on the diff against BASE_REF (default origin/main). Only the allowlisted files may change; the
// header axis (F12/R71: nos-theme.css, NosHeader, nos-chrome, the container tokens), vendors, conferences/page.tsx, SEO JSON-LD and
// the label "Conferences tickets" are untouched. nos-structure.css may only gain lines under an F16 comment. Added lines hold no hex
// colour, no rgb literal, no new font family (var(--serif|--sans) only), no animation, no duration other than 150, no shadow, no emoji.
// Usage: node --import tsx/esm contracts/checks/launch-weekend/f16/check-g-scope.mjs
import { execFileSync } from 'node:child_process';

const BASE_REF = process.env.BASE_REF || 'origin/main';
const ALLOWED = [
  'app/(marketing)/national-show/tickets/page.tsx', 'app/(marketing)/national-show/nos-structure.css', 'app/(marketing)/tickets/[slug]/page.tsx',
  'components/tickets/AdmissionRows.tsx', 'components/tickets/TicketAudienceIndex.tsx', 'components/tickets/TicketTypeCard.tsx', 'components/tickets/TicketPurchaseForm.tsx',
  'components/tickets/CategoryTicketsPage.tsx', 'components/tickets/OzowSandboxTestModeBanner.tsx', 'components/tickets/index.ts',
  'lib/admission-rows.ts', 'lib/admission-siblings.ts', 'lib/admin-viewer.ts', 'lib/view-models/load-ticket-card.ts', 'lib/tickets-orchid-image.ts',
];
const ALLOWED_PREFIX = ['contracts/checks/launch-weekend/f16/', 'contracts/checks/nos-own-brand-chrome/f3/', '.agent/memory/project/specs/', 'docs/', '.tmp/', 'README.md'];
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const problems = [];
const names = [...new Set([...git('diff', '--name-only', `${BASE_REF}...HEAD`).split('\n'), ...git('diff', '--name-only', 'HEAD').split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')].filter(Boolean))];
for (const f of names) if (!ALLOWED.includes(f) && !ALLOWED_PREFIX.some((p) => f.startsWith(p))) problems.push(`file outside the F16 allowlist changed: ${f}`);
const added = [];
for (const f of names.filter((n) => /\.(tsx?|css)$/.test(n) && ALLOWED.includes(n))) {
  const lines = git('diff', '--unified=0', BASE_REF, '--', f).split('\n');
  const adds = lines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
  const dels = lines.filter((l) => l.startsWith('-') && !l.startsWith('---'));
  if (f.endsWith('nos-structure.css')) {
    if (dels.length) problems.push(`nos-structure.css: ${dels.length} line(s) deleted or edited, only additions allowed`);
    if (adds.length && !adds.some((l) => /F16/.test(l))) problems.push('nos-structure.css: additions must sit under an F16 comment');
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
if (!added.length) problems.push('no F16 change found');
if (problems.length) { console.error(`FAIL (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`PASS: ${names.length} changed path(s) inside the allowlist; ${added.length} added line(s) hold no unruled colour, font, animation, duration or shadow`);
