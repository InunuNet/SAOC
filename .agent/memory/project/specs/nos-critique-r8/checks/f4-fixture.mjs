// nos-critique-r8 f4 fixture (Codex interim QA P3s), props only:
//   ids     every id VisitAttractions emits (heading and link) is unique and safe (starts with a letter, only letters, digits, - and _), whatever the CMS key is
//           (duplicate keys, a key equal to another item's index, whitespace, quotes and markup characters, empty or missing key), in both the plain and the disclosure state;
//           and each link's aria-labelledby resolves to ids that exist, its own link id and its own heading id
//   levels  TravelRoutes under an h2 draws h3 route headings, never h4 (no level skipped)
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';

import { finish, repoRoot, specDir } from './_lib.mjs';

const NAME = 'f4-fixture.mjs';
const failures = [];
let rendered;
try {
  rendered = JSON.parse(execFileSync(path.join(repoRoot, 'node_modules/.bin/tsx'), [path.join(specDir, 'checks/f4-fixture-run.mjs'), repoRoot], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 24 }));
} catch (e) {
  finish(NAME, [`could not render the f4 fixtures: ${String(e.stderr || e.message).split('\n').slice(0, 4).join(' | ')}`]);
}

const ids = () => {
  const root = document.getElementById('root');
  const all = [...root.querySelectorAll('[id]')].filter((e) => e.id !== 'root').map((e) => e.id);
  const links = [...root.querySelectorAll('a[aria-labelledby]')].map((a) => ({ id: a.id, ref: a.getAttribute('aria-labelledby').split(/\s+/).filter(Boolean), heading: a.closest('[id]') ? null : null }));
  const headings = [...root.querySelectorAll('h3')].map((h) => h.id);
  return { all, links, headings, raw: root.innerHTML.length };
};
const levels = () => [...document.querySelectorAll('#root h1, #root h2, #root h3, #root h4, #root h5')].map((h) => Number(h.tagName[1]));

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const name of ['attrPending', 'attrConfirmed']) {
    await page.setContent(`<!doctype html><body>${rendered[name]}</body>`);
    const r = await page.evaluate(ids);
    const tag = `[${name}]`;
    const seen = new Set();
    for (const id of r.all) {
      if (seen.has(id)) failures.push(`${tag}: duplicate id "${id}"`);
      seen.add(id);
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) failures.push(`${tag}: unsafe id ${JSON.stringify(id)} (whitespace, quotes or markup in an id)`);
    }
    if (r.headings.length !== 7) failures.push(`${tag}: ${r.headings.length} attraction h3s, want 7`);
    for (const h of r.headings) if (!h) failures.push(`${tag}: an attraction heading has no id`);
    if (r.links.length !== 7) failures.push(`${tag}: ${r.links.length} labelled links, want 7`);
    for (const l of r.links) {
      if (l.ref.length !== 2 || l.ref[0] !== l.id) failures.push(`${tag}: link ${JSON.stringify(l.id)} aria-labelledby ${JSON.stringify(l.ref)} must start with its own id and add its heading's`);
      for (const t of l.ref) if (!seen.has(t)) failures.push(`${tag}: aria-labelledby points at missing id ${JSON.stringify(t)}`);
      if (l.ref[1] && !r.headings.includes(l.ref[1])) failures.push(`${tag}: aria-labelledby second token ${JSON.stringify(l.ref[1])} is not an attraction heading id`);
    }
    if (new Set(r.links.map((l) => l.ref[1])).size !== r.links.length) failures.push(`${tag}: two links are named by the same heading`);
  }
  await page.setContent(`<!doctype html><body>${rendered.travel}</body>`);
  const lv = await page.evaluate(levels);
  if (JSON.stringify(lv) !== JSON.stringify([2, 3, 3])) failures.push(`[travel]: heading levels [${lv.join(', ')}], want [2, 3, 3] (route headings directly under the h2 are h3)`);
} finally {
  await browser.close();
}

finish(NAME, failures, 'attraction heading and link ids are unique and safe for duplicate, numeric, whitespace, markup and missing keys in both states, aria-labelledby resolves; TravelRoutes draws h3 under the h2.');
