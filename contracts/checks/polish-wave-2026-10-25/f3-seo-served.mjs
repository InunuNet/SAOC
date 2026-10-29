// F3 served: against `next start` (no beta wall, so no wall-injected X-Robots-Tag can mask a
// missing page-level tag; this check reads the <meta name="robots"> in the HTML, not headers).
//   /tickets/confirmation (bare; a ?ref lookup needs Firestore and is covered by f3-seo-static.mjs) and /tickets/cancelled on the NOS host
//     carry <meta name="robots" content="noindex...">
//   the SAOC sitemap.xml has no /members <loc> and still lists /about (non-vacuous)
//   /societies/<static slug> carries a canonical link whose host is the request host, and an
//     og:url with the same value
// Run as: node contracts/checks/polish-wave-2026-10-25/f3-seo-served.mjs   (needs a current build)
import { finish } from './_lib.mjs';
import { buildProblem, get, startServer } from './_server.mjs';

const failures = [];
const stale = buildProblem(['lib/saoc-sitemap-routes.ts', 'app/(nos)/tickets/cancelled/page.tsx', 'app/(nos)/tickets/confirmation/page.tsx']);
if (stale.length) finish('f3-seo-served', stale);

const srv = await startServer();
try {
  const robotsMeta = (html) => (html.match(/<meta[^>]+name="robots"[^>]*>/gi) ?? []).join(' ');
  for (const path of ['/tickets/confirmation', '/tickets/cancelled']) {
    const r = await get(srv.port, path, 'nos.localhost');
    if (r.status !== 200) { failures.push(`${path}: HTTP ${r.status}, want 200`); continue; }
    if (!/content="[^"]*noindex/i.test(robotsMeta(r.body))) failures.push(`${path}: no <meta name="robots" content="noindex...">`);
  }

  const sm = await get(srv.port, '/sitemap.xml', 'localhost');
  if (sm.status !== 200) failures.push(`/sitemap.xml: HTTP ${sm.status}`);
  else {
    const locs = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname.replace(/\/$/, ''));
    if (!locs.includes('/about')) failures.push('sitemap lost /about (check is vacuous)');
    if (locs.includes('/members')) failures.push('sitemap still lists /members');
  }

  const listing = await get(srv.port, '/societies', 'localhost');
  const slug = listing.body.match(/href="\/societies\/([a-z0-9-]+)"/)?.[1];
  if (!slug) failures.push('no /societies/<slug> link found on /societies to probe');
  else {
    const page = await get(srv.port, `/societies/${slug}`, 'localhost');
    const canonical = page.body.match(/<link[^>]+rel="canonical"[^>]*href="([^"]+)"/i)?.[1]
      ?? page.body.match(/<link[^>]+href="([^"]+)"[^>]*rel="canonical"/i)?.[1];
    const ogUrl = page.body.match(/<meta[^>]+property="og:url"[^>]*content="([^"]+)"/i)?.[1]
      ?? page.body.match(/<meta[^>]+content="([^"]+)"[^>]*property="og:url"/i)?.[1];
    if (!canonical) failures.push(`/societies/${slug}: no canonical link`);
    else if (new URL(canonical).hostname !== 'localhost') failures.push(`/societies/${slug}: canonical host is ${new URL(canonical).hostname}, want localhost`);
    if (!ogUrl) failures.push(`/societies/${slug}: no og:url`);
    else if (new URL(ogUrl).hostname !== 'localhost') failures.push(`/societies/${slug}: og:url host is ${new URL(ogUrl).hostname}, want localhost (hard-coded host)`);
    if (canonical && ogUrl && canonical !== ogUrl) failures.push(`/societies/${slug}: canonical ${canonical} != og:url ${ogUrl}`);
  }
} finally {
  srv.stop();
}
finish('f3-seo-served', failures);
