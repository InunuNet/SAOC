#!/usr/bin/env node
// F18-A21 (static, F17 leftover): one sold-out helper. /tickets, the catalogue page (CategoryTicketsPage) and the National Show tickets hub all take their sold-out verdict from
// getAdmissionSoldOutBySlug (lib/data/admission-availability.ts); /tickets and CategoryTicketsPage no longer carry their own planPooledCapacity / over-capacity logic.
// The helper stays the single owner of that logic and is not weakened (still planPooledCapacity, still catches and logs by error name only).
// Usage: node contracts/checks/launch-weekend/f18/check-m-availability.mjs   (cwd = implementation worktree)
import { T, readText } from './_lib.mjs';

const problems = [];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const FILES = ['app/(marketing)/tickets/page.tsx', 'components/tickets/CategoryTicketsPage.tsx', 'app/(marketing)/national-show/tickets/page.tsx'];
for (const f of FILES) {
  const src = readText(f);
  if (!src) { problems.push(`${f} is missing`); continue; }
  const code = strip(src);
  if (!/import\s*\{[^}]*\bgetAdmissionSoldOutBySlug\b[^}]*\}\s*from\s*'@\/lib\/data\/admission-availability'/.test(code)) problems.push(`${f} does not import getAdmissionSoldOutBySlug from @/lib/data/admission-availability`);
  if (!/getAdmissionSoldOutBySlug\s*\(/.test(code)) problems.push(`${f} never calls getAdmissionSoldOutBySlug`);
  if (f !== FILES[2] && /planPooledCapacity|over-capacity/.test(code)) problems.push(`${f} still carries its own pooled-capacity / over-capacity logic`);
}
const helper = strip(readText('lib/data/admission-availability.ts') ?? '');
if (!/planPooledCapacity/.test(helper) || !/over-capacity/.test(helper)) problems.push('admission-availability.ts no longer owns the pooled-capacity verdict');
if (!/catch\s*\(/.test(helper)) problems.push('admission-availability.ts lost its error handling');
void T;
if (problems.length) { console.error(`FAIL F18-A21 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS F18-A21: one sold-out helper for /tickets, the catalogues and the tickets hub');
