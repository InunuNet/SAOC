// council-copy-fixes A2: in the RENDERED server HTML of each route (NOS routes requested with the NOS host) the after-string is present and the
// before-string is absent; the exhibitors meta description carries the corrected sentence; the vendor strings are checked in the server-rendered
// vendor form. Text is tag-stripped and entity-decoded, whitespace collapsed. Tolerance zero: a string is either there or not.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { withServer } from './serve.mjs';

const MAP = JSON.parse(readFileSync('.agent/memory/project/specs/council-1028/council-copy-fixes/goldens/copy-map.json', 'utf8'));
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' };
const text = (html) => html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&(amp|lt|gt|quot|apos|nbsp|#x27|#39);/g, (m) => ENTITIES[m]).replace(/\s+/g, ' ').trim();
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const count = (hay, needle) => hay.split(norm(needle)).length - 1;
const fails = [];

await withServer(async ({ get }) => {
  const pages = new Map();
  for (const e of MAP.entries.filter((x) => x.routes)) for (const r of e.routes) {
    const key = `${r.host}${r.path}`;
    if (!pages.has(key)) { const res = await get(r.host, r.path); pages.set(key, res); if (res.status !== 200) fails.push(`${key}: HTTP ${res.status}`); }
    const res = pages.get(key); if (res.status !== 200) continue;
    const t = text(res.body);
    const a = count(t, e.after); const b = count(t, e.before);
    if (a < 1) fails.push(`${e.id} ${key}: rendered after-string missing: "${e.after}"`);
    if (b !== 0) fails.push(`${e.id} ${key}: rendered before-string still present x${b}: "${e.before}"`);
    if (r.alsoMetaDescription) {
      const m = res.body.match(/<meta[^>]+name="description"[^>]*content="([^"]*)"/i) || res.body.match(/<meta[^>]+content="([^"]*)"[^>]*name="description"/i);
      const d = m ? text(m[1]) : '';
      if (!d.includes(norm(e.after))) fails.push(`${e.id} ${key}: meta description does not carry the corrected sentence (${d.slice(0, 120)})`);
      if (/who’s/.test(d)) fails.push(`${e.id} ${key}: meta description still has who’s`);
    }
  }
});

const vendor = MAP.entries.filter((e) => e.render === 'vendor-form');
if (vendor.length) {
  const r = spawnSync('pnpm', ['exec', 'tsx', '.agent/memory/project/specs/council-1028/council-copy-fixes/checks/render-vendor-form.mjs'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) fails.push(`vendor form render failed: ${(r.stderr || '').slice(0, 400)}`);
  else {
    const t = text(r.stdout);
    for (const e of vendor) {
      if (count(t, e.after) < 1) fails.push(`${e.id} vendor form: rendered after-string missing: "${e.after}"`);
      if (count(t, e.before) !== 0) fails.push(`${e.id} vendor form: rendered before-string still present: "${e.before}"`);
    }
  }
}

if (fails.length) { console.error(`FAIL copy-rendered: ${fails.length}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log('PASS copy-rendered');
