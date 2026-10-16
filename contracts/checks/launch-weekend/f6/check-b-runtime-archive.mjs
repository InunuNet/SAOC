#!/usr/bin/env node
// A2 - runtime (BASE_URL): archive index shows the honest state and no invented fact or stock photo; every invented
// archive year 404s; /national-show carries no past-editions section; sitemap and llms files list no archive year.
import { FORBIDDEN, HUB_FORBIDDEN, YEARS, get, forbiddenIn, mainOf, stripTags, report } from './_lib.mjs';

const problems = [];
const idx = await get('/national-show/archive');
if (idx.status !== 200) problems.push(`/national-show/archive answered ${idx.status}`);
const text = stripTags(idx.text);
const mainText = stripTags(mainOf(idx.text));
if (!text.includes('Show history awaiting committee records')) problems.push('index lacks "Show history awaiting committee records"');
if (!idx.text.includes('data-confirmation-badge="pending"')) problems.push('index lacks the pending StatusMarker');
for (const l of forbiddenIn(idx.text)) problems.push(`index contains "${l}"`);
if (/\bEdition\b|\b(XIV|XV|XVI|XVII|XVIII|XIX)\b|\b(14|15|16|17|18|19)(th|st)\b/.test(mainText.split("What's next")[0])) problems.push('index shows an edition numeral or ordinal; edition numbers are unsourced (NOS ruling)');
if (/\/national-show\/archive\/\d{4}/.test(mainOf(idx.text))) problems.push('index links to an archive year page');
if (/<img[^>]+(orchid-[a-z]+\.jpg|National Orchid Show")/i.test(idx.text.replace(/<img[^>]+hero[^>]*>/gi, ''))) {
  if (/alt="\d{4} National Orchid Show"/.test(idx.text)) problems.push('index has a stock photo with a fabricated "<year> National Orchid Show" alt');
}
if (/\b(entries|visitors|trophies)\b/.test(mainText.replace(/awaiting[^.]*/, ''))) problems.push('index shows an entries/visitors/trophies stat');

for (const y of YEARS.concat([2027])) {
  const r = await get(`/national-show/archive/${y}`);
  if (r.status !== 404) problems.push(`/national-show/archive/${y} answered ${r.status}, expected 404`);
  for (const l of forbiddenIn(r.text)) problems.push(`/archive/${y} body contains "${l}"`);
}

const ns = await get('/national-show');
if (ns.status !== 200) problems.push(`/national-show answered ${ns.status}`);
for (const l of forbiddenIn(ns.text)) problems.push(`/national-show contains "${l}"`);
for (const l of HUB_FORBIDDEN) if (stripTags(mainOf(ns.text)).includes(l)) problems.push(`/national-show hub contains "${l}"`);
if (stripTags(mainOf(ns.text)).includes('Past editions')) problems.push('/national-show still shows "Past editions"');

const sm = await get('/sitemap.xml');
if (/\/national-show\/archive\/\d{4}/.test(sm.text)) problems.push('sitemap lists an archive year');
if (!sm.text.includes('/national-show')) problems.push('sitemap lost /national-show');

for (const f of ['/llms.txt', '/llms-full.txt']) {
  const r = await get(f);
  if (r.status === 200 && f === '/llms.txt' && /champion|galler/i.test(r.text)) problems.push('/llms.txt promises champions or galleries');
  if (r.status === 200) for (const l of FORBIDDEN) if (r.text.includes(l)) problems.push(`${f} contains "${l}"`);
}
report(problems, 'archive index honest, invented years 404, sitemap and llms clean');
