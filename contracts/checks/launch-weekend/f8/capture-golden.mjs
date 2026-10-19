#!/usr/bin/env node
// One-off capture, run against UNMODIFIED origin/main with the dev server up: records, per showPage route, every
// rendered section (data-section-key) as placeholder (carries the "Placeholder copy" chip) or preserved.
// Writes goldens/f8/placeholder-sections.json. Not part of the gate.
import { writeFileSync } from 'node:fs';
import { BASE, GOLDEN_DIR, get, stripTags } from './_lib.mjs';

const routes17 = ['', '/about', '/what-to-expect', '/plan-your-visit', '/faq', '/programme', '/workshops', '/symposium', '/wosa-conference', '/conferences', '/sa-exhibitors', '/international-guests', '/exhibitors', '/vendors', '/tickets', '/sponsors', '/archive'].map((s) => `/national-show${s}`);
const showPageRoutes = ['/programme', '/symposium', '/wosa-conference', '/international-guests', '/sponsors', '/sa-exhibitors'].map((s) => `/national-show${s}`);
const out = { capturedFrom: BASE, routes17, sections: {} };
for (const route of showPageRoutes) {
  const { status, text } = await get(route);
  if (status !== 200) { console.error(`INFRA: ${route} answered ${status}`); process.exit(2); }
  const main = text.match(/<main[\s\S]*?<\/main>/)?.[0] ?? text;
  const parts = main.split(/(?=<div class="nos-show-page-prose)/).slice(1);
  out.sections[route] = parts.map((chunk) => {
    const key = chunk.match(/data-section-key="([^"]+)"/)?.[1];
    const isPlaceholder = /nos-show-page-notice/.test(chunk) && /AI-generated placeholder/.test(stripTags(chunk));
    const h2 = chunk.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1];
    const body = stripTags(chunk.replace(/<p class="nos-show-page-notice[\s\S]*?<\/p>/, '').replace(/<h2[\s\S]*?<\/h2>/, ''));
    return { sectionKey: key, class: isPlaceholder ? 'placeholder' : 'preserved', heading: h2 ? stripTags(h2) : null, firstWords: body.trim().slice(0, 60) };
  });
}
writeFileSync(`${GOLDEN_DIR}/placeholder-sections.json`, JSON.stringify(out, null, 2) + '\n');
for (const [r, s] of Object.entries(out.sections)) console.log(r, s.map((x) => `${x.sectionKey}:${x.class}`).join(' '));
