#!/usr/bin/env node
// /national-show ticket chain after the NOS chrome (mission nos-own-brand-chrome F1; HANDOFF "Tickets CTA" and
// "Hub hero"): the hub's hero no longer carries a ticket CTA, because the NOS header carries the one Tickets CTA on
// every NOS page. This asserts, on the rendered HTML of <url>, that the NOS header (header#nh) contains an
// a.nh-cta whose href is /national-show/tickets (mode "href") and whose text is meaningful (mode "text").
// Usage: node check-national-show-header-cta.mjs <url> <href|text>
const [url, mode] = process.argv.slice(2);
if (!url || !['href', 'text'].includes(mode)) {
  console.error('usage: check-national-show-header-cta.mjs <url> <href|text>');
  process.exit(2);
}
const res = await fetch(url);
if (!res.ok) { console.error(`fetch failed: ${res.status}`); process.exit(2); }
const html = await res.text();
const start = html.search(/<header[^>]*\bid="nh"/);
const end = start < 0 ? -1 : html.indexOf('</header>', start);
if (end < 0) { console.error('no <header id="nh"> (NOS header) in rendered HTML'); process.exit(1); }
const header = html.slice(start, end);
const m = header.match(/<a\b[^>]*\bclass="[^"]*\bnh-cta\b[^"]*"[^>]*>([\s\S]*?)<\/a>/);
if (!m) { console.error('no a.nh-cta inside the NOS header'); process.exit(1); }
if (mode === 'href') {
  const href = m[0].match(/\bhref="([^"]*)"/)?.[1];
  if (href !== '/national-show/tickets') { console.error(`a.nh-cta href is ${href}, want /national-show/tickets`); process.exit(1); }
} else {
  const text = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text || /click here/i.test(text)) { console.error(`a.nh-cta text is not meaningful: "${text}"`); process.exit(1); }
  console.log(text);
}
