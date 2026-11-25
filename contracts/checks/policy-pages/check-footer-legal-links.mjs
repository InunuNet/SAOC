#!/usr/bin/env node
// Proves the footer bottom bar links to /privacy, /terms, and /refunds
// with meaningful (non-empty, non-"click here") visible text, AND that
// each link's destination actually resolves (HTTP 200) — a footer href
// pointing at a route that 404s is not "the reviewer can find the page".
//
// This does NOT prove the footer is rendered on every route (a
// site-wide layout is a reasonable inference from Footer.tsx living in
// the shared marketing layout, but this script only checks the one URL
// it's given) — run it against more than one route in the contract to
// cover that gap without re-implementing a full crawl.
//
// Usage: node check-footer-legal-links.mjs <baseUrl> <pageUrl>
//   baseUrl — origin used to resolve destination checks (e.g. http://localhost:3333)
//   pageUrl — page to fetch and extract the footer from

const baseUrl = process.argv[2];
const pageUrl = process.argv[3];

if (!baseUrl || !pageUrl) {
  console.error('usage: check-footer-legal-links.mjs <baseUrl> <pageUrl>');
  process.exit(2);
}

const REQUIRED = [
  { path: '/privacy', label: 'Privacy' },
  { path: '/terms', label: 'Terms' },
  { path: '/refunds', label: 'Refunds' },
];

const pageRes = await fetch(pageUrl);
if (!pageRes.ok) {
  console.error(`fetch failed: ${pageRes.status} ${pageRes.statusText}`);
  process.exit(2);
}
const html = await pageRes.text();

const footerStart = html.indexOf('<footer');
if (footerStart === -1) {
  console.error('no <footer> element found in rendered HTML');
  process.exit(2);
}
const footerEndTag = html.indexOf('</footer>', footerStart);
const footerHtml = html.slice(footerStart, footerEndTag + '</footer>'.length);

let failed = false;

for (const { path, label } of REQUIRED) {
  const anchorRe = /<a\b[^>]*>/g;
  let match;
  let anchorOpenTag = null;
  let anchorOpenIdx = -1;
  while ((match = anchorRe.exec(footerHtml)) !== null) {
    if (match[0].includes(`href="${path}"`)) {
      anchorOpenTag = match[0];
      anchorOpenIdx = match.index;
      break;
    }
  }
  if (anchorOpenIdx === -1) {
    console.error(`FAIL: footer has no <a href="${path}">`);
    failed = true;
    continue;
  }
  const closeIdx = footerHtml.indexOf('</a>', anchorOpenIdx);
  const innerHtml = footerHtml.slice(anchorOpenIdx + anchorOpenTag.length, closeIdx);
  const text = innerHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text || /click here/i.test(text)) {
    console.error(`FAIL: footer link to ${path} has non-meaningful text: "${text}"`);
    failed = true;
    continue;
  }

  const destRes = await fetch(`${baseUrl}${path}`);
  if (destRes.status !== 200) {
    console.error(`FAIL: footer link to ${path} resolves to HTTP ${destRes.status}, not 200`);
    failed = true;
    continue;
  }
  console.log(`OK: footer -> ${path} ("${text}") -> HTTP 200`);
}

process.exit(failed ? 1 : 0);
