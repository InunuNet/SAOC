#!/usr/bin/env node
// F18-A21 (static, F17 leftover, v13): ONE stock/availability owner. lib/data/admission-availability.ts exports loadTicketCardViewModels (reads the real Firestore sold counts and Sanity capacity, then calls the pure
// buildTicketCardViewModels of lib/data/ticket-card-view-models.ts) and keeps owning the pooled-capacity maths (planPooledCapacity, over-capacity) and its error handling. The three pages that show tickets
// (/national-show/tickets, /national-show/conferences, /national-show/workshops) take their cards from it; no other app or component file carries planPooledCapacity / over-capacity; the retired bare
// /tickets page is a redirect only (permanentRedirect, no data fetching). Early-bird pool and per-day remaining therefore come from one real source or are not shown (R7).
// Usage: node --import tsx/esm contracts/checks/launch-weekend/f18/check-m-availability.mjs   (cwd = implementation worktree)
import { execFileSync } from 'node:child_process';
import { readText } from './_lib.mjs';

const problems = [];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const PAGES = ['app/(marketing)/national-show/tickets/page.tsx', 'app/(marketing)/national-show/conferences/page.tsx', 'app/(marketing)/national-show/workshops/page.tsx'];
for (const f of PAGES) {
  const src = readText(f);
  if (!src) { problems.push(`${f} is missing`); continue; }
  const code = strip(src);
  if (!/import\s*\{[^}]*\bloadTicketCardViewModels\b[^}]*\}\s*from\s*'@\/lib\/data\/admission-availability'/.test(code)) problems.push(`${f} does not import loadTicketCardViewModels from @/lib/data/admission-availability`);
  if (!/loadTicketCardViewModels\s*\(/.test(code)) problems.push(`${f} never calls loadTicketCardViewModels`);
}
const helper = strip(readText('lib/data/admission-availability.ts') ?? '');
if (!/export\s+(async\s+)?function\s+loadTicketCardViewModels\b/.test(helper)) problems.push('admission-availability.ts does not export loadTicketCardViewModels');
if (!/planPooledCapacity/.test(helper) || !/over-capacity/.test(helper)) problems.push('admission-availability.ts no longer owns the pooled-capacity verdict');
if (!/buildTicketCardViewModels/.test(helper)) problems.push('admission-availability.ts does not call the pure buildTicketCardViewModels');
if (!/catch\s*\(/.test(helper)) problems.push('admission-availability.ts lost its error handling');
if (!readText('lib/data/ticket-card-view-models.ts')) problems.push('lib/data/ticket-card-view-models.ts is missing');
const files = execFileSync('git', ['ls-files', 'app', 'components'], { encoding: 'utf8' }).split('\n').filter((f) => /\.tsx?$/.test(f));
const extra = execFileSync('git', ['ls-files', '--others', '--exclude-standard', 'app', 'components'], { encoding: 'utf8' }).split('\n').filter((f) => /\.tsx?$/.test(f));
for (const f of [...new Set([...files, ...extra])]) {
  const code = strip(readText(f) ?? '');
  if (/planPooledCapacity|over-capacity/.test(code)) problems.push(`${f} carries its own pooled-capacity / over-capacity logic (one owner: lib/data/admission-availability.ts)`);
}
const bare = strip(readText('app/(marketing)/tickets/page.tsx') ?? '');
if (!/permanentRedirect\s*\(/.test(bare) || /sanityFetch|getSoldCounts/.test(bare)) problems.push('app/(marketing)/tickets/page.tsx must be a permanentRedirect only (no data fetching)');
if (problems.length) { console.error(`FAIL F18-A21 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS F18-A21: one stock owner for the keepsake tickets, bare /tickets redirects');
