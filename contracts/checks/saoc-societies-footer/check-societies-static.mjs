// Findings (e) wiring, (f) SO-1 filters row and chips, (h) duplicate label. Source-level, because the
// client component needs a router to render; the rendered behaviour is proven by check-societies-ssr.mts
// and the post-deploy browser check. Golden: design/design_handoff_saoc/src/styles.css .filters (l.1304),
// .chip (l.1318), .chip__n (l.1340), .filters__search (l.1348), with the ruling's 14px sans label and 44px target.
// Run as: node contracts/checks/saoc-societies-footer/check-societies-static.mjs
import { readFileSync } from 'node:fs';

const failures = [];
const read = (f) => readFileSync(f, 'utf8');
const client = read('app/(marketing)/societies/SocietiesClient.tsx');
const fallback = read('app/(marketing)/societies/SocietiesFallback.tsx');
const page = read('app/(marketing)/societies/page.tsx');
const grid = read('components/societies/SocietiesGrid.tsx');

// (e) the grid is server-safe, shared, and is the Suspense fallback with ALL societies.
if (/['"]use client['"]/.test(grid) || /useSearchParams|useState|useEffect|useRouter/.test(grid)) failures.push('SocietiesGrid must be a server-safe component (no use client, no hooks)');
if (!/SocietiesGrid/.test(client)) failures.push('SocietiesClient must render its results through SocietiesGrid');
if (!/SocietiesGrid/.test(fallback)) failures.push('SocietiesFallback must render SocietiesGrid');
if (!/fallback=\{\s*<SocietiesFallback[^>]*societies=\{listed\}/.test(page)) failures.push('page.tsx must pass <SocietiesFallback societies={listed} /> (every society) as the Suspense fallback');
if (/animate-pulse/.test(fallback + page + grid)) failures.push('skeleton animate-pulse blocks must be gone from the societies route');
if (/count=\{/.test(page)) failures.push('page.tsx still passes the skeleton count prop');

// (h) one search string, no visible label, accessible name kept.
if (/<label\b/.test(client)) failures.push('SocietiesClient still renders a visible <label>');
if ((client.match(/Search by name or region/g) ?? []).length !== 1) failures.push('the search string must appear exactly once (one constant)');
if (/Search by name or region/.test(fallback)) failures.push('SocietiesFallback must not repeat the search string');
if (!/aria-label=\{SEARCH_PLACEHOLDER\}/.test(client)) failures.push('input needs aria-label={SEARCH_PLACEHOLDER}');
if (!/placeholder=\{SEARCH_PLACEHOLDER\}/.test(client)) failures.push('input keeps placeholder={SEARCH_PLACEHOLDER}');

// (f) one .filters row: search and chips together, space-between, wrapping, 1px rule under it.
const rowAt = client.search(/className="[^"]*\bjustify-between\b[^"]*"/);
if (rowAt < 0) failures.push('no filters row with justify-between');
else {
  const rowClass = client.slice(rowAt).match(/className="([^"]*)"/)[1];
  for (const t of ['flex', 'flex-wrap', 'items-center', 'border-b', 'border-rule']) {
    if (!rowClass.split(/\s+/).includes(t)) failures.push(`filters row class is missing ${t}`);
  }
  if (!(client.indexOf('<input') > rowAt && client.search(/\[ALL_CHIP,[^\]]*\]\.map\(/) > rowAt)) failures.push('search input and chips must both sit inside the one filters row');
}
// chips: sans 14px, 44px target, primary when active, count in mono after the name.
const chipClasses = [...client.matchAll(/'((?:inline-flex)[^']*rounded-full[^']*)'/g)].map((m) => m[1]);
if (chipClasses.length < 2) failures.push('could not find the active and inactive chip class strings');
for (const c of chipClasses) {
  for (const t of ['min-h-11', 'font-sans', 'text-[14px]', 'rounded-full']) if (!c.split(/\s+/).includes(t)) failures.push(`chip class is missing ${t}: ${c}`);
  if (/\bfont-mono\b|tracking-\[0\.16em\]|text-\[11px\]/.test(c)) failures.push(`chip label must not be mono 11px any more: ${c}`);
}
const active = chipClasses.find((c) => /bg-/.test(c) && /text-ivory/.test(c));
if (!active || !/\bbg-primary\b/.test(active) || !/\bborder-primary\b/.test(active)) failures.push('active chip must use bg-primary and border-primary (var(--primary)) with text-ivory');
if (active && /\bbg-ink\b|\bborder-ink\b/.test(active)) failures.push('active chip still uses the ink colour');
if (!/font-mono[^"']*text-\[10\.5px\]|text-\[10\.5px\][^"']*font-mono/.test(client) || !/opacity-70/.test(client)) failures.push('count needs font-mono text-[10.5px] opacity-70 (.chip__n)');
if (!/provinceCounts\(/.test(client) || !/from '@\/lib\/societies-view'/.test(client)) failures.push('chip counts must come from provinceCounts() in lib/societies-view');
if (!/aria-label=\{`[^`]*\$\{[^}]*count[^}]*\}[^`]*`\}/i.test(client) && !/aria-label=\{`\$\{p\.name\}[^`]*\$\{/.test(client)) failures.push('chip aria-label must include the count');
if (!/min-h-11/.test(client.slice(client.indexOf('<input') - 400, client.indexOf('<input')))) failures.push('search field wrapper must be at least 44px tall (min-h-11)');

if (failures.length > 0) {
  console.error('FAIL\n' + failures.join('\n'));
  process.exit(1);
}
console.log('PASS: societies wiring, filters row, chips, single search label');
