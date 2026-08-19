#!/usr/bin/env node
// Fetches a given URL and prints ONLY the <footer>...</footer> HTML to
// stdout, so assertions can grep it without false hits from page-body
// links (e.g. a /privacy link inside a page's own text would otherwise
// make a footer-scoped assertion pass for the wrong reason).
//
// Usage: node extract-footer-html.mjs [url] [--text]

const url = process.argv[2] || 'http://localhost:3333/about';

const res = await fetch(url);
if (!res.ok) {
  console.error(`fetch failed: ${res.status} ${res.statusText}`);
  process.exit(2);
}
const html = await res.text();

const footerStart = html.indexOf('<footer');
if (footerStart === -1) {
  console.error('no <footer> element found in rendered HTML');
  process.exit(2);
}
const footerEndTag = html.indexOf('</footer>', footerStart);
if (footerEndTag === -1) {
  console.error('no closing </footer> found');
  process.exit(2);
}
const footerEnd = footerEndTag + '</footer>'.length;
const footerHtml = html.slice(footerStart, footerEnd);

if (process.argv[3] === '--text') {
  const text = footerHtml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  process.stdout.write(text);
} else {
  process.stdout.write(footerHtml);
}
