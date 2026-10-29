// verify-landing: the one pure verifier behind nos-landing-v1 A3/A4. Input is the served HTML of the NOS hub; output is a list of
// failures. No network, no filesystem except the golden copy.json, so the mutation suite can run it hundreds of times.
//
// Contract with the implementation: every rendered copy unit in goldens/copy.json carries data-lp="<unit id>" on the element whose
// visible text is exactly that unit; sections carry data-hm-section (about, visit, judging, entry, closing; programme and exhibit are
// the existing ones). Everything below is checked on the served HTML, not on source text, so a constant that is never rendered fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { all, ancestors, hiddenReason, parse, text } from './html.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const COPY = JSON.parse(readFileSync(path.join(HERE, '../goldens/copy.json'), 'utf8'));

const em = (n) => all(n).filter((e) => e.tag === 'em' || e.tag === 'i').map((e) => text(e));

export function verify(html, copy = COPY) {
  const f = [];
  const fail = (id, msg) => f.push(`${id}: ${msg}`);
  const doc = parse(html);
  const nodes = all(doc);
  const byLp = new Map();
  for (const n of nodes) if (n.attrs['data-lp'] !== undefined) byLp.set(n.attrs['data-lp'], [...(byLp.get(n.attrs['data-lp']) ?? []), n]);

  // 1. every unit: present once, exact text, visible, right tag, right italics, right section
  const sectionOf = (n) => ancestors(n).find((a) => a.attrs?.['data-hm-section'])?.attrs['data-hm-section'] ?? null;
  const firstSection = nodes.find((n) => n.attrs['data-hm-section']);
  let lastSeq = -1;
  for (const u of copy.units) {
    const els = byLp.get(u.id) ?? [];
    if (els.length === 0) { if (!u.optional) fail(u.id, 'not rendered (no element with data-lp)'); continue; }
    if (els.length > 1) { fail(u.id, `rendered ${els.length} times`); continue; }
    const el = els[0];
    const got = text(el);
    if (got !== u.text) fail(u.id, `text differs: want ${JSON.stringify(u.text)} got ${JSON.stringify(got)}`);
    const hid = hiddenReason(el);
    if (hid) fail(u.id, `not visible (${hid})`);
    if (u.tag && el.tag !== u.tag) fail(u.id, `want <${u.tag}> got <${el.tag}>`);
    if (u.id.endsWith('-desc') || u.em.length) {
      const g = em(el);
      if (JSON.stringify(g) !== JSON.stringify(u.em)) fail(u.id, `italics differ: want ${JSON.stringify(u.em)} got ${JSON.stringify(g)}`);
    }
    if (u.section === 'hero') {
      if (sectionOf(el) !== null || (firstSection && el.seq > firstSection.seq)) fail(u.id, 'must sit in the hero, before the first data-hm-section');
    } else if (sectionOf(el) !== u.section) fail(u.id, `want inside data-hm-section="${u.section}" got ${JSON.stringify(sectionOf(el))}`);
    if (u.order) {
      if (el.seq < lastSeq) fail(u.id, 'out of document order');
      lastSeq = Math.max(lastSeq, el.seq);
    }
  }
  const known = new Set([...copy.units.map((u) => u.id), ...copy.retained.map((r) => r.id)]);
  for (const id of byLp.keys()) if (!known.has(id)) fail(id, 'data-lp id is not in the golden (invented unit)');

  // 2. structure: counts and shape
  const h1s = nodes.filter((n) => n.tag === 'h1' && !hiddenReason(n));
  if (h1s.length !== 1) fail('h1', `want exactly one visible <h1>, got ${h1s.length}`);
  const groups = [...byLp.keys()].filter((k) => /^group-\d+-name$/.test(k));
  if (groups.length !== copy.groupCount) fail('groups', `want ${copy.groupCount} group cards, got ${groups.length}`);
  if ([...byLp.keys()].filter((k) => /^stage-\d+-title$/.test(k)).length !== copy.stageCount) fail('stages', `want ${copy.stageCount} stage cards`);
  if ([...byLp.keys()].filter((k) => /^stat-\d+$/.test(k)).length !== copy.statCount) fail('stats', `want ${copy.statCount} stats`);
  const judging = nodes.find((n) => n.attrs['data-hm-section'] === 'judging');
  if (judging) for (const n of all(judging)) if (['p', 'h2', 'h3', 'li'].includes(n.tag) && text(n) === '') fail('judging', `empty <${n.tag}> in the judging section (a card with no description must omit it)`);
  const order = nodes.filter((n) => n.attrs['data-hm-section']).map((n) => n.attrs['data-hm-section']);
  const seen = copy.sectionOrder.filter((s) => s !== 'hero').map((s) => order.indexOf(s));
  if (seen.some((i) => i === -1) || seen.some((v, i) => i > 0 && v < seen[i - 1])) fail('sections', `doc sections out of order or missing: ${order.join(',')}`);
  if (order[order.length - 1] !== 'closing') fail('sections', 'closing must be the last data-hm-section');
  for (const sec of ['programme', 'exhibit']) if (!order.includes(sec)) fail(sec, 'existing section removed');

  // 3. retained strings still render, in their section
  for (const r of copy.retained) {
    const sec = nodes.find((n) => n.attrs['data-hm-section'] === r.section);
    if (!sec || !text(sec).includes(r.text)) fail(r.id, `retained text missing from data-hm-section="${r.section}"`);
  }

  // 4. retired and instruction strings: absent from the whole served document, raw (meta description and JSON-LD included)
  for (const r of copy.retired) if (html.includes(r.text) || html.includes(r.text.replace(/'/g, '&#x27;').replace(/"/g, '&quot;'))) fail(r.id, `retired text still served (${r.why})`);
  const visible = text(doc);
  for (const s of copy.forbiddenText) if (visible.includes(s)) fail('forbidden', `${JSON.stringify(s)} rendered (instruction, struck or invented text)`);
  for (const c of copy.corrections) if (visible.includes(c.never)) fail(c.id, `her wording was corrected: ${JSON.stringify(c.never)} (must read ${JSON.stringify(c.must)})`);

  // 5. no invented destination: no form or control for Register Here, no non-root-relative or dead link, nothing pointing at a registration
  const entry = nodes.find((n) => n.attrs['data-hm-section'] === 'entry');
  if (entry) for (const n of all(entry)) if (['form', 'button', 'input', 'select', 'textarea'].includes(n.tag)) fail('entry', `<${n.tag}> in the entry section (the registration form is a gap, D4)`);
  const inPage = (n) => ancestors(n).some((x) => x.attrs?.['data-hm-section'] || x.attrs?.['data-nos-hero']);
  for (const a of nodes.filter((n) => n.tag === 'a' && inPage(n))) {
    const href = a.attrs.href ?? '';
    const label = text(a);
    if (!/^\/(?!\/)/.test(href) && !/^mailto:/.test(href) && !/^https?:\/\/(?:[a-z0-9-]+\.)*(saoc\.co\.za|nos\.localhost(?::\d+)?|saoc\.localhost(?::\d+)?)\b/.test(href)) fail('link', `${JSON.stringify(label)} -> ${JSON.stringify(href)}: not a root-relative or SAOC link (dead or invented)`);
    if (/register/i.test(href) && !/vendors|conferences/.test(href)) fail('link', `${JSON.stringify(label)} -> ${href}: points at a registration route that is not in the nav`);
  }
  return f;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error('usage: verify-landing.mjs <html file>'); process.exit(2); }
  const failures = verify(readFileSync(file, 'utf8'));
  for (const x of failures) console.error('FAIL', x);
  console.log(failures.length ? `verify-landing: ${failures.length} failure(s)` : 'verify-landing: ok');
  process.exit(failures.length ? 1 : 0);
}
