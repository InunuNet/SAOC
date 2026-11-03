// go-live-prep F6 -- /members is noindex,nofollow without any title/description change, is in no
// sitemap, and the ticket utility pages that already carry noindex still do.
// Offline static check. The metadata strings are pinned to the golden, so a copy edit fails here.
import { readFileSync } from 'node:fs';

const GOLDEN = JSON.parse(readFileSync('.agent/memory/project/specs/go-live-prep/f6-hardening/goldens/members-metadata.json', 'utf8'));
const failures = [];
const page = readFileSync('app/(marketing)/members/page.tsx', 'utf8');

const callAt = page.indexOf('buildPageMetadata({');
if (callAt === -1) failures.push('members page no longer calls buildPageMetadata({…})');
const call = callAt === -1 ? '' : page.slice(callAt, page.indexOf('});', callAt) + 3);

if (!/\bnoIndex:\s*true\b/.test(call)) failures.push('members buildPageMetadata call has no `noIndex: true` (lib/seo.ts turns that into robots index:false, follow:false)');
if (/robots\s*:/.test(page)) failures.push('members page hand-rolls a robots block; use the shared noIndex option');
for (const key of ['title', 'description', 'path']) {
  const m = call.match(new RegExp(`\\b${key}:\\s*'([^']*)'`));
  if (!m || m[1] !== GOLDEN[key]) failures.push(`members metadata ${key} changed: got ${m ? JSON.stringify(m[1]) : 'none'}, golden ${JSON.stringify(GOLDEN[key])}`);
}
if (!/lede:\s*LEDE/.test(call) || !page.includes(`const LEDE =\n  '${GOLDEN.lede}';`)) failures.push('members lede changed from the golden');

// Sitemap exclusion (already true on main; this is the regression guard).
const routes = readFileSync('lib/saoc-sitemap-routes.ts', 'utf8');
const sitemap = readFileSync('app/sitemap.ts', 'utf8');
if (/path:\s*'\/members'/.test(routes)) failures.push("lib/saoc-sitemap-routes.ts lists '/members'");
if (/['"`]\/members['"`]/.test(sitemap)) failures.push("app/sitemap.ts references '/members'");

// Siblings that must stay noindex (already true on main).
for (const f of ['app/(nos)/tickets/cancelled/page.tsx', 'app/(nos)/tickets/recover/page.tsx', 'app/(nos)/tickets/confirmation/page.tsx']) {
  if (!/index:\s*false/.test(readFileSync(f, 'utf8'))) failures.push(`${f} lost its noindex`);
}

if (failures.length) {
  console.error(`FAIL members-noindex:\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log('PASS members-noindex');
