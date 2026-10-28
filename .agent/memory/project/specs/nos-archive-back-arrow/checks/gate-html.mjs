// A8: zero U+2190 (and its escaped spellings) in the rendered HTML of EVERY NOS-host route, on fixture replay. Routes are the union of:
//   1. the built app's NOS routes (.next/server/app-paths-manifest.json, keys under /(nos)/), mapped to NOS-host paths; dynamic segments are not guessable, so
//   2. the NOS-host sitemap.xml (its URLs carry the real slugs and years) and the goldens' htmlPages ([year] pages from the fixture stub),
//   3. a same-origin link crawl from every fetched page (capped), which reaches every linked dynamic page Sanity content can produce.
// Skipped on purpose (listed in spec.md): route handlers that return no HTML (/og), links that leave the NOS origin, non-HTML responses, and unresolved [dynamic] templates.
import { readFileSync } from 'node:fs';
import { AUTH, ROOT, V, withServer } from './_lib.mjs';

const MARKERS = { '/archive/2024': 'data-nos-backlink', '/archive/2023': 'data-nos-backlink' };
const CRAWL_CAP = 400;

/** /(nos)/national-show/about/page -> /about ; /(nos)/tickets/page -> /tickets ; null for route handlers and unresolved [dynamic] templates. */
function publicPathOf(appKey) {
  if (!appKey.startsWith('/(nos)/') || !appKey.endsWith('/page')) return null;
  let path = appKey.slice('/(nos)'.length, -'/page'.length);
  if (path.includes('[')) return null;
  if (path === '/national-show') path = '/';
  else if (path.startsWith('/national-show/')) path = path.slice('/national-show'.length);
  return path || '/';
}

const clean = (href, origin) => {
  try {
    const u = new URL(href, `${origin}/`);
    return u.origin === origin ? u.pathname.replace(/(.)\/$/, '$1') : null;
  } catch { return null; }
};

await withServer('gate-html', async (server, c) => {
  const manifest = JSON.parse(readFileSync(`${ROOT}/.next/server/app-paths-manifest.json`, 'utf8'));
  const fromManifest = Object.keys(manifest).map(publicPathOf).filter(Boolean);
  const sm = await fetch(`${server.nos}/sitemap.xml`, { headers: { authorization: AUTH } });
  const smXml = await sm.text();
  c.check(`the NOS sitemap.xml responds 200 (got ${sm.status})`, sm.status === 200);
  const fromSitemap = [...smXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => { try { return new URL(m[1].trim()).pathname.replace(/(.)\/$/, '$1'); } catch { return null; } }).filter(Boolean); // pathname only: the baked site origin may differ from the gate port
  const seeds = new Set([...fromManifest, ...fromSitemap, ...V.htmlPages]);
  c.check(`route discovery found the built NOS routes (${fromManifest.length}) and the sitemap (${fromSitemap.length})`, fromManifest.length > 10 && fromSitemap.length > 0);
  const queue = [...seeds];
  const seen = new Set();
  const visited = [];
  const skipped = [];
  while (queue.length && seen.size < CRAWL_CAP) {
    const route = queue.shift();
    if (seen.has(route)) continue;
    seen.add(route);
    const res = await fetch(`${server.nos}${route}`, { headers: { authorization: AUTH }, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const target = clean(res.headers.get('location') ?? '', server.nos);
      if (target) queue.push(target); else skipped.push(`${route} redirects off the NOS origin`);
      continue;
    }
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('text/html')) { skipped.push(`${route} is ${type || 'not HTML'}`); continue; }
    const html = await res.text();
    visited.push(`${route} ${res.status}`);
    c.check(`${route} does not 5xx (got ${res.status})`, res.status < 500);
    if (V.htmlPages.includes(route)) c.check(`${route} responds 200 on the NOS host (got ${res.status})`, res.status === 200);
    if (MARKERS[route]) c.check(`${route} rendered the archive year page (marker ${MARKERS[route]})`, html.includes(MARKERS[route]));
    for (const g of V.forbiddenGlyphs) {
      const count = html.toLowerCase().split(g.toLowerCase()).length - 1;
      c.check(`${route} has no ${JSON.stringify(g)}`, count === 0, `${count} occurrence(s)`);
    }
    for (const m of html.matchAll(/\bhref="([^"#]+)"/g)) {
      const next = clean(m[1], server.nos);
      if (next && !seen.has(next) && !/\.(png|jpe?g|webp|svg|ico|pdf|ics|xml|txt|css|js|woff2?)$/i.test(next) && !next.startsWith('/_next') && !next.startsWith('/api')) queue.push(next);
    }
  }
  c.check(`the crawl finished inside the ${CRAWL_CAP}-page cap (visited ${seen.size}, queue left ${queue.filter((r) => !seen.has(r)).length})`, queue.every((r) => seen.has(r)));
  c.check('/archive/2024 and /archive/2023 were visited', visited.some((v) => v.startsWith('/archive/2024 ')) && visited.some((v) => v.startsWith('/archive/2023 ')));
  c.note(`gate-html: ${visited.length} HTML route(s) checked, ${skipped.length} skipped:\n  checked: ${visited.join(', ')}\n  skipped: ${skipped.join('; ') || 'none'}`);
});
