// societies-content F1 — render the real components with the golden docs; only fields with values appear.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parse, evaluate } from 'groq-js';

import { SocietyCard, SocietyFacts, SocietyAbout, SocietyCommittee } from '@/components/societies';
import { societyListQuery, societyBySlugQuery, societySlugsQuery } from '@/sanity/queries';

const SPEC = '.agent/memory/project/specs/societies-content/goldens';
const docs = JSON.parse(readFileSync(`${SPEC}/sanity-docs.json`, 'utf8'));
const BASE = { _id: 'x', province: null, region: null, founded: null, memberCount: null, logo: null, markBadge: null };
const props = (d) => ({ ...BASE, ...d, slug: d.slug.current });
const html = (C, extra, d) => renderToStaticMarkup(React.createElement(C, { society: props(d), ...extra }));
const has = (h, t) => h.replaceAll('&#x27;', "'").replaceAll('&amp;', '&').includes(t);

for (const d of docs) {
  const page = [SocietyCard, SocietyFacts, SocietyAbout, SocietyCommittee].map((C) => html(C, { withhold: false }, d)).join('\n');
  for (const bad of ['Not supplied', 'not supplied', 'undefined', 'null', '[object']) assert.ok(!page.includes(bad), `${d.name}: rendered "${bad}"`);
  // every field that has a value is shown, verbatim
  if (d.venue) assert.ok(has(page, d.venue), `${d.name}: venue missing`);
  if (d.meets) assert.ok(has(page, d.meets), `${d.name}: meets missing`);
  if (d.contactEmail) assert.ok(has(page, d.contactEmail), `${d.name}: public email missing`);
  if (d.contactPhone) assert.ok(has(page, d.contactPhone), `${d.name}: public phone missing`);
  if (d.annualShow) assert.ok(has(page, d.annualShow), `${d.name}: annual show missing`);
  if (d.description) assert.ok(has(page, d.description), `${d.name}: history missing`);
  for (const c of d.committee ?? []) assert.ok(has(page, c.name) && has(page, c.role), `${d.name}: committee ${c.role}`);
  for (const u of [d.website, d.facebookUrl, d.instagramUrl]) if (u) assert.ok(page.includes(`href="${u.replaceAll('&', '&amp;')}"`) || page.includes(`href="${u}"`), `${d.name}: link ${u}`);
  // and every field without a value leaves no label behind
  if (!(d.committee ?? []).some((c) => c.role.startsWith('Liaison'))) assert.ok(!/Liaison/i.test(page), `${d.name}: empty liaison row rendered`);
  if (!d.contactPhone) assert.ok(!/tel:|Telephone|Phone/i.test(page), `${d.name}: empty phone row rendered`);
  if (!d.contactEmail) assert.ok(!/mailto:/.test(page), `${d.name}: empty email row rendered`);
  if (!d.annualShow) assert.ok(!/Annual show/i.test(page), `${d.name}: empty annual-show row rendered`);
  if (!d.facebookUrl) assert.ok(!/facebook/i.test(page), `${d.name}: empty facebook link rendered`);
  if (!d.instagramUrl) assert.ok(!/instagram/i.test(page), `${d.name}: empty instagram link rendered`);
  if (!d.committee) assert.ok(!/Committee/i.test(page), `${d.name}: committee heading rendered with no committee`);
  // the society's note to the webmaster is stored, never shown
  if (d.committeeNote) for (const w of ['Byron', 'Would it be possible', 'Thanks very much']) assert.ok(!page.includes(w), `${d.name}: committee note leaked (${w})`);
}

// The three queries show 21 of 37 and never project the internal note.
const store = JSON.parse(readFileSync('.tmp/sandbox/societies-content/after-apply.json', 'utf8'));
async function q(query, params = {}) {
  return (await evaluate(parse(query), { dataset: store, params })).get();
}
assert.equal((await q(societyListQuery)).length, 21, 'societyListQuery must return exactly the 21 listed societies');
assert.equal((await q(societySlugsQuery)).length, 21, 'societySlugsQuery must return exactly 21');
assert.equal(await q(societyBySlugQuery, { slug: 'west-rand-orchid-society' }), null, 'a hidden society must not resolve by slug');
const tyg = await q(societyBySlugQuery, { slug: 'tygerberg-orchid-group' });
assert.equal(tyg.name, 'Tygerberg Orchid Group');
assert.ok(!('committeeNote' in tyg) && !JSON.stringify(await q(societyListQuery)).includes('Byron'), 'committeeNote must not be projected');
assert.ok(tyg.contactEmail && tyg.committee?.length === 3, 'detail query must project contact + committee');
console.log('PASS render: 21 societies, only populated fields, no sentinel text, 21 listed / hidden unresolved');
