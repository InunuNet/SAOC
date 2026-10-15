#!/usr/bin/env node
// TKT-06 (amended 2026-10-15, nos-audit-fixes F2; authorised by the lead saoc-2b): proves the
// NOS ticket journey over real HTTP, per Brad's 2026-10-15 directive that NOS "Book tickets"
// uses the existing /tickets/[slug] flow:
//   /national-show  ->  /national-show/tickets  ->  /tickets/<slug>  (HTTP 200)
// Each hop is checked inside the page's <main>, so the global header/nav rail (which links
// /national-show/tickets and two /tickets/<slug> pages on every page) cannot satisfy it.
//
// Usage: node check-nos-ticket-chain.mjs <origin>   e.g. http://localhost:3333
// Exit 0 when the chain holds, 1 when a hop is missing or broken, 2 if a page can't be fetched.

const origin = process.argv[2];
if (!origin) {
  console.error('usage: check-nos-ticket-chain.mjs <origin>');
  process.exit(2);
}

async function mainHtml(path) {
  const res = await fetch(origin + path);
  if (!res.ok) {
    console.error(`fetch ${path} failed: ${res.status} ${res.statusText}`);
    process.exit(2);
  }
  const m = (await res.text()).match(/<main\b[^>]*>([\s\S]*?)<\/main>/);
  if (!m) {
    console.error(`${path}: no <main> element`);
    process.exit(2);
  }
  return m[1];
}

function anchorHrefs(html) {
  return [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((m) => m[1]);
}

const problems = [];

const landing = anchorHrefs(await mainHtml('/national-show'));
if (!landing.includes('/national-show/tickets')) problems.push('/national-show <main> has no <a href="/national-show/tickets">');
if (landing.includes('/tickets')) problems.push('/national-show <main> still links the bare /tickets listing');

const slugs = anchorHrefs(await mainHtml('/national-show/tickets')).filter(
  (h) => /^\/tickets\/[a-z0-9-]+$/.test(h) && !/^\/tickets\/(confirmation|cancelled)$/.test(h),
);
if (slugs.length === 0) problems.push('/national-show/tickets <main> has no <a href="/tickets/<slug>">');

for (const href of slugs) {
  const res = await fetch(origin + href);
  if (res.status !== 200) problems.push(`${href} returned HTTP ${res.status}`);
}

if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
console.log(`/national-show -> /national-show/tickets -> ${slugs.join(', ')} (all 200)`);
