// F24 shared sweep helpers: the public route list (the six sitemap SAOC routes, the other SAOC pages when they exist, and every
// indexable non-dynamic row of content/national-show-routes.json) and a DOM reader for title, description, h1 and lede.
import { readFileSync } from 'node:fs';
import { ROOT, PUBLIC_BASE, BASE, launch, newPage, VIEWPORTS, report } from '../f19/_lib.mjs';

export { ROOT, PUBLIC_BASE, BASE, launch, newPage, VIEWPORTS, report };
export const GOLDEN_DIR = `${ROOT}.agent/memory/project/specs/launch-weekend/goldens/f24`;
export const loadGolden = (name) => JSON.parse(readFileSync(`${GOLDEN_DIR}/${name}`, 'utf8'));

const SITEMAP_SAOC = ['/', '/about', '/societies', '/judging', '/events', '/contact'];
const OPTIONAL_SAOC = ['/members', '/sponsors', '/media-kit', '/constitution', '/privacy', '/terms', '/refunds'];

export function sweepRoutes() {
  const manifest = JSON.parse(readFileSync(`${ROOT}content/national-show-routes.json`, 'utf8'));
  const nos = manifest.routes.filter((r) => r.indexable && !r.dynamic).map((r) => r.slug);
  return [...SITEMAP_SAOC.map((r) => ({ route: r, optional: false })), ...OPTIONAL_SAOC.map((r) => ({ route: r, optional: true })), ...nos.map((r) => ({ route: r, optional: false }))];
}

// Returns null when an optional route is 404. Exits 2 (infrastructure) when a required route cannot be loaded.
export async function readMeta(page, route, base) {
  let res;
  try { res = await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 }); }
  catch (e) { console.error(`INFRA: cannot load ${base}${route} (${e.message})`); process.exit(2); }
  if (!res || res.status() >= 400) return { status: res ? res.status() : 0 };
  return page.evaluate(() => {
    const content = (sel) => { const el = document.querySelector(sel); return el ? el.getAttribute('content') : null; };
    const ledes = [...document.querySelectorAll('[data-page-hero] p, .nos-hero p, main p')].map((p) => p.textContent.replace(/\s+/g, ' ').trim()).filter((t) => t.length >= 20).slice(0, 3);
    const h1 = document.querySelector('h1');
    return { status: 200, title: document.title, description: content('meta[name="description"]'), ogDescription: content('meta[property="og:description"]'), h1: h1 ? h1.textContent.trim() : '', lede: ledes };
  });
}
