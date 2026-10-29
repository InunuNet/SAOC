// F3 static: /members leaves the sitemap routes, the society page delegates to the pure builder,
// and the two ticket result pages declare noindex on EVERY metadata path (the confirmation page's
// generateMetadata has several returns, one a ternary; an order lookup needs Firestore, so served
// checks reach only one of them). A return that is a ternary needs a noindex token on both arms.
// Accepted tokens: noIndex: true, robots: { index: false ... }, or a spread of a NOINDEX constant.
// Run as: node contracts/checks/polish-wave-2026-10-25/f3-seo-static.mjs   (POLISH_ROOT optional)
import { finish, read } from './_lib.mjs';

const failures = [];
const routes = read('lib/saoc-sitemap-routes.ts');
if (/path:\s*'\/members'/.test(routes)) failures.push("lib/saoc-sitemap-routes.ts still lists path '/members'");
for (const keep of ["path: '/about'", "path: '/contact'", "path: '/refunds'"]) {
  if (!routes.includes(keep)) failures.push(`lib/saoc-sitemap-routes.ts lost ${keep} (over-removal)`);
}

const society = read('app/(marketing)/societies/[slug]/page.tsx');
if (!/buildSocietyMetadata\(/.test(society)) failures.push('societies/[slug]/page.tsx does not call buildSocietyMetadata(');
if (/https:\/\/saoc\.co\.za/.test(society)) failures.push('societies/[slug]/page.tsx still hard-codes https://saoc.co.za');

const TOKEN = /noIndex:\s*true|robots:\s*\{[^}]*index:\s*false|\.\.\.NOINDEX\b/g;
const tokenCount = (text) => (text.match(TOKEN) ?? []).length;

const cancelled = read('app/(nos)/tickets/cancelled/page.tsx');
if (tokenCount(cancelled) < 1) failures.push('app/(nos)/tickets/cancelled/page.tsx: no noindex declaration');

const rel = 'app/(nos)/tickets/confirmation/page.tsx';
const src = read(rel);
const start = src.indexOf('export async function generateMetadata');
if (start < 0) failures.push(`${rel}: generateMetadata not found`);
else {
  const end = src.indexOf('\nasync function', start);
  const body = src.slice(start, end > 0 ? end : src.length);
  const returns = body.split(/\breturn\b/).slice(1).map((seg) => seg.split(/;\s*\n/)[0]);
  if (returns.length < 3) failures.push(`${rel}: expected the three returns of generateMetadata, found ${returns.length}`);
  returns.forEach((r, i) => {
    const need = r.includes('?') ? 2 : 1;
    if (tokenCount(r) < need) failures.push(`${rel}: generateMetadata return #${i + 1} has ${tokenCount(r)} noindex token(s), needs ${need} (${r.trim().slice(0, 70)})`);
  });
}
finish('f3-seo-static', failures);
