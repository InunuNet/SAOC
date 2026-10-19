#!/usr/bin/env node
// A2 - runtime (BASE_URL, server with SITE_PUBLIC_LAUNCH and SHOW_PLACEHOLDER_PREVIEW unset): no AI placeholder prose on
// any of the 17 /national-show routes, the R11 gap state where it was, preserved sections intact, no duplicate or empty
// headings, /programme single h1 and links, meta/OG clean.
import { ROUTES, PENDING_LABEL, GAP_SENTENCE, golden, get, stripTags, decode, mainOf, report } from './_lib.mjs';

const problems = [];
const BANNED = [/AI-generated/i, /Placeholder copy/, /has not been written or approved/i, /placeholder-ai/i];
const headingsOf = (html) => [...html.matchAll(/<(h[12])\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => ({ tag: m[1].toLowerCase(), text: stripTags(m[2]).trim() }));
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const leak = golden.sections;

for (const route of ROUTES) {
  const { status, text } = await get(route);
  if (status !== 200) { problems.push(`${route} answered ${status}`); continue; }
  const main = mainOf(text);
  const mainText = norm(stripTags(main));
  const pageText = norm(stripTags(text));
  for (const re of BANNED) {
    if (re.test(pageText)) problems.push(`${route} renders text matching ${re}`);
    if (re.test(main)) problems.push(`${route} <main> markup matches ${re}`);
  }
  const heads = headingsOf(main);
  for (const h of heads) if (h.text === '') problems.push(`${route} has an empty ${h.tag}`);
  // A repeat is a finding only when it is the withheld AI heading echoing the h1 (a preserved Council section that
  // happens to share the page title, as on /sa-exhibitors, is Lee-Ann's own structure and stays).
  const goneHeadings = new Set((leak[route] ?? []).filter((s) => s.class === 'placeholder' && s.heading).map((s) => s.heading));
  const seen = new Set();
  for (const h of heads) { if (seen.has(h.text) && goneHeadings.has(h.text)) problems.push(`${route} repeats the heading "${h.text}"`); seen.add(h.text); }

  const sections = leak[route];
  if (!sections) continue;
  const gone = sections.filter((s) => s.class === 'placeholder');
  const kept = sections.filter((s) => s.class === 'preserved');
  for (const s of gone) {
    if (mainText.includes(norm(s.firstWords).slice(0, 40))) problems.push(`${route} still renders placeholder section ${s.sectionKey}: "${s.firstWords.slice(0, 40)}"`);
    if (s.heading && heads.some((h) => h.tag === 'h2' && h.text === s.heading)) problems.push(`${route} still renders the h2 "${s.heading}" that only existed for AI prose`);
  }
  for (const s of kept) {
    if (!mainText.includes(norm(s.firstWords).slice(0, 40))) problems.push(`${route} lost preserved section ${s.sectionKey}`);
    if (s.heading && !heads.some((h) => h.tag === 'h2' && h.text === s.heading)) problems.push(`${route} lost the h2 "${s.heading}" of preserved section ${s.sectionKey}`);
  }
  if (gone.length > 0) {
    const gaps = (main.match(/data-nos-content-gap/g) || []).length;
    if (gaps !== 1) problems.push(`${route} has ${gaps} data-nos-content-gap element(s), expected exactly 1 (placeholder sections collapse to one)`);
    if (!mainText.includes(PENDING_LABEL)) problems.push(`${route} lacks the pending chip text "${PENDING_LABEL}"`);
    if (!mainText.includes(GAP_SENTENCE)) problems.push(`${route} lacks the gap sentence`);
  }
  // meta, OG and twitter tags carry no AI prose.
  for (const m of text.matchAll(/<meta\b[^>]*>/gi)) {
    const content = decode(m[0].match(/content="([^"]*)"/i)?.[1] ?? '');
    if (BANNED.some((re) => re.test(content))) problems.push(`${route} meta tag carries AI placeholder wording: ${m[0].slice(0, 100)}`);
    for (const s of gone) if (content.includes(norm(s.firstWords).slice(0, 40))) problems.push(`${route} meta tag carries placeholder prose of ${s.sectionKey}`);
  }
}

// /programme: one h1, no duplicate "Programme", links to Symposium and Workshops in the marked container.
{
  const { status, text } = await get('/national-show/programme');
  if (status === 200) {
    const main = mainOf(text);
    const heads = headingsOf(main);
    const h1s = heads.filter((h) => h.tag === 'h1');
    if (h1s.length !== 1 || h1s[0].text !== 'Programme') problems.push(`/programme h1s: ${JSON.stringify(h1s.map((h) => h.text))}, expected exactly ["Programme"]`);
    if (heads.filter((h) => h.text === 'Programme').length > 1) problems.push('/programme still has "Programme" as both h1 and h2');
    const box = main.match(/<([a-z]+)[^>]*data-nos-programme-links[^>]*>[\s\S]*?<\/\1>/i)?.[0] ?? '';
    for (const href of ['/national-show/symposium', '/national-show/workshops']) {
      if (!box.includes(`href="${href}"`)) problems.push(`/programme data-nos-programme-links lacks a link to ${href}`);
    }
  }
}

// llms files and sitemap: no AI wording and none of the withheld prose.
const allGone = Object.values(leak).flat().filter((s) => s.class === 'placeholder');
for (const file of ['/llms.txt', '/llms-full.txt', '/sitemap.xml']) {
  const { status, text } = await get(file);
  if (status !== 200) { problems.push(`${file} answered ${status}`); continue; }
  const t = norm(decode(text));
  for (const re of BANNED) if (re.test(t)) problems.push(`${file} matches ${re}`);
  for (const s of allGone) if (t.includes(norm(s.firstWords).slice(0, 40))) problems.push(`${file} carries placeholder prose of ${s.sectionKey}`);
}
report(problems, `${ROUTES.length} routes free of AI placeholder prose, R11 gap state present, headings clean, llms/sitemap/meta clean`);
