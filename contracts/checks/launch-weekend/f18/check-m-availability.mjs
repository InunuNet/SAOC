#!/usr/bin/env node
// F18-A21 (static, F17 leftover, v13): ONE stock/availability DISPLAY owner. lib/data/admission-availability.ts exports loadTicketCardViewModels (reads the real Firestore sold counts and Sanity
// capacity, then calls the pure buildTicketCardViewModels of lib/data/ticket-card-view-models.ts) and keeps owning the pooled-capacity maths (planPooledCapacity, over-capacity) and its error handling.
// The pages that show tickets take their cards from it: /national-show/tickets and /national-show/conferences (F18b); /national-show/workshops too when F18_PART=c (F18c). No other display file under
// app/ or components/ carries planPooledCapacity / over-capacity. app/api/ is EXEMPT: the checkout route's authoritative capacity re-check is required (ruling 8) and A10 forbids editing it. The retired
// bare /tickets page is a redirect only (permanentRedirect, no data fetching).
// Negative probes run first: a display file under components/ or app/(marketing)/ that carries the logic IS caught, app/api/tickets/checkout/route.ts is NOT.
// Usage: [F18_PART=c] node --import tsx/esm contracts/checks/launch-weekend/f18/check-m-availability.mjs   (cwd = implementation worktree)
import { execFileSync } from 'node:child_process';
import { readText } from './_lib.mjs';

const problems = [];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const LOGIC = /planPooledCapacity|over-capacity/;
const exempt = (f) => f.startsWith('app/api/');
// Pure judge, shared by the probes and the real scan.
const carriesLogic = (file, src) => !exempt(file) && LOGIC.test(strip(src));

if (!carriesLogic('components/tickets/Probe.tsx', 'const v = planPooledCapacity(x);')) problems.push('probe: a display component carrying planPooledCapacity is NOT caught');
if (!carriesLogic('app/(marketing)/national-show/tickets/page.tsx', "if (r === 'over-capacity') {}")) problems.push('probe: a page carrying over-capacity is NOT caught');
if (carriesLogic('app/api/tickets/checkout/route.ts', 'const v = planPooledCapacity(x); // over-capacity')) problems.push('probe: app/api/ is wrongly flagged');

const PAGES = ['app/(marketing)/national-show/tickets/page.tsx', 'app/(marketing)/national-show/conferences/page.tsx'];
if (process.env.F18_PART === 'c') PAGES.push('app/(marketing)/national-show/workshops/page.tsx');
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
const tracked = execFileSync('git', ['ls-files', 'app', 'components'], { encoding: 'utf8' }).split('\n');
const extra = execFileSync('git', ['ls-files', '--others', '--exclude-standard', 'app', 'components'], { encoding: 'utf8' }).split('\n');
for (const f of [...new Set([...tracked, ...extra])].filter((x) => /\.tsx?$/.test(x))) {
  if (carriesLogic(f, readText(f) ?? '')) problems.push(`${f} carries its own pooled-capacity / over-capacity logic (one display owner: lib/data/admission-availability.ts; only app/api/ may re-check)`);
}
if (!LOGIC.test(readText('app/api/tickets/checkout/route.ts') ?? '')) problems.push('app/api/tickets/checkout/route.ts no longer carries the authoritative capacity re-check (it must stay)');
const bare = strip(readText('app/(marketing)/tickets/page.tsx') ?? '');
if (!/permanentRedirect\s*\(/.test(bare) || /sanityFetch|getSoldCounts/.test(bare)) problems.push('app/(marketing)/tickets/page.tsx must be a permanentRedirect only (no data fetching)');
if (problems.length) { console.error(`FAIL F18-A21 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS F18-A21: one stock display owner for the keepsake tickets, checkout re-check kept, bare /tickets redirects');
