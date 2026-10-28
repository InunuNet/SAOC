// council-copy-fixes A2: in the RENDERED server HTML of each route (NOS routes requested with the NOS host) the after-string is present and the
// before-string is absent; the exhibitors meta description carries the corrected sentence; the vendor strings are checked in the server-rendered
// vendor form. The before-string must also be absent from every attribute value (aria-label, alt, title, content), every meta/og/twitter description
// and every script payload (JSON-LD, RSC flight data, \u-decoded). Visible text is tag-stripped and entity-decoded, whitespace collapsed. Tolerance zero: a string is either there or not.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { withServer } from './serve.mjs';

const MAP = JSON.parse(readFileSync('.agent/memory/project/specs/council-1028/council-copy-fixes/goldens/copy-map.json', 'utf8'));
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' };
const text = (html) => html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&(amp|lt|gt|quot|apos|nbsp|#x27|#39);/g, (m) => ENTITIES[m]).replace(/\s+/g, ' ').trim();
const unescapeJs = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\"/g, '"').replace(/\\'/g, "'");
const decode = (s) => s.replace(/&(amp|lt|gt|quot|apos|nbsp|#x27|#39);/g, (m) => ENTITIES[m]);
// Everything that is not visible text: attribute values, script and style bodies, entity- and \u-decoded, whitespace collapsed.
const hidden = (html) => {
  const attrs = [...html.matchAll(/\s[\w:-]+\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((m) => m[1] ?? m[2]);
  const scripts = [...html.matchAll(/<(script|style)[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => m[2]);
  return [...attrs, ...scripts].map((x) => unescapeJs(decode(x)).replace(/\s+/g, ' ')).join(' \n ');
};
// Every description-like meta tag: name|property = description, og:description, twitter:description.
const metaDescriptions = (html) => [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]).flatMap((tag) => {
  const key = (tag.match(/\b(?:name|property)\s*=\s*"([^"]*)"/i) || [])[1]; const content = (tag.match(/\bcontent\s*=\s*"([^"]*)"/i) || [])[1];
  return key && /^(og:|twitter:)?description$/i.test(key) && content !== undefined ? [{ key: key.toLowerCase(), content: decode(content).replace(/\s+/g, ' ').trim() }] : [];
});
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
    const hb = count(hidden(res.body), e.before);
    if (hb !== 0) fails.push(`${e.id} ${key}: before-string survives in an attribute, meta tag or script payload x${hb}: "${e.before}"`);
    if (r.alsoMetaDescription) {
      const metas = metaDescriptions(res.body);
      if (!metas.some((m) => m.key === 'description')) fails.push(`${e.id} ${key}: no <meta name="description"> found`);
      for (const m of metas) {
        if (!m.content.includes(norm(e.after))) fails.push(`${e.id} ${key}: ${m.key} does not carry the corrected sentence (${m.content.slice(0, 120)})`);
        if (m.content.includes(norm(e.before))) fails.push(`${e.id} ${key}: ${m.key} still carries the before-string`);
      }
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
