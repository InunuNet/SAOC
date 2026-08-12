#!/usr/bin/env node
// Fetches a URL, finds the FIRST <a ...href="TARGET_HREF"...>...</a> in the
// rendered HTML and prints its flattened inner text. Used to prove a link's
// accessible label is meaningful ("Book Tickets") rather than merely proving
// the href string appears somewhere in the markup (which a hidden or
// decorative element could also satisfy).
//
// Usage: node extract-anchor-text.mjs <url> <href>
// Exit 2 if the URL can't be fetched or no matching anchor exists.

const url = process.argv[2];
const targetHref = process.argv[3];

if (!url || !targetHref) {
  console.error('usage: extract-anchor-text.mjs <url> <href>');
  process.exit(2);
}

const res = await fetch(url);
if (!res.ok) {
  console.error(`fetch failed: ${res.status} ${res.statusText}`);
  process.exit(2);
}
const html = await res.text();

// Find an <a ...> tag whose attributes include href="targetHref" exactly,
// then capture up to its closing </a>.
const anchorRe = /<a\b[^>]*>/g;
let match;
let anchorOpenIdx = -1;
let anchorOpenTag = '';
while ((match = anchorRe.exec(html)) !== null) {
  if (match[0].includes(`href="${targetHref}"`)) {
    anchorOpenIdx = match.index;
    anchorOpenTag = match[0];
    break;
  }
}

if (anchorOpenIdx === -1) {
  console.error(`no <a href="${targetHref}"> found in ${url}`);
  process.exit(2);
}

const contentStart = anchorOpenIdx + anchorOpenTag.length;
const closeIdx = html.indexOf('</a>', contentStart);
if (closeIdx === -1) {
  console.error('found opening <a> but no matching </a>');
  process.exit(2);
}

const innerHtml = html.slice(contentStart, closeIdx);
const text = innerHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

process.stdout.write(text);
