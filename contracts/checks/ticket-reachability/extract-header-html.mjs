#!/usr/bin/env node
// Fetches a given URL and prints ONLY the <header>...</header> HTML to
// stdout, so assertions can grep it without false hits from page body
// content (e.g. a ticket CTA on the page itself would otherwise make a
// header-scoped assertion pass for the wrong reason).
//
// Deliberately run against a NON-home page (e.g. /about) so a pass proves
// the header nav is genuinely global, not local to one route.
//
// Usage: node extract-header-html.mjs [url] [--text]

const url = process.argv[2] || 'http://localhost:3333/about';

const res = await fetch(url);
if (!res.ok) {
  console.error(`fetch failed: ${res.status} ${res.statusText}`);
  process.exit(2);
}
const html = await res.text();

const headerStart = html.indexOf('<header');
if (headerStart === -1) {
  console.error('no <header> element found in rendered HTML');
  process.exit(2);
}
const headerEndTag = html.indexOf('</header>', headerStart);
if (headerEndTag === -1) {
  console.error('no closing </header> found');
  process.exit(2);
}
const headerEnd = headerEndTag + '</header>'.length;
const headerHtml = html.slice(headerStart, headerEnd);

if (process.argv[3] === '--text') {
  const text = headerHtml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  process.stdout.write(text);
} else {
  process.stdout.write(headerHtml);
}
