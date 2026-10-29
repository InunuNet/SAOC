#!/usr/bin/env node
// Proves the retired AI-drafted "draft pending legal review" notice is NOT on a page. The notice
// was removed when Lee-Ann's own Privacy and Terms text replaced the drafts (mission
// leeann-content-build, M1/F1); before that this check asserted the notice was visible.
//
// Usage: node check-legal-draft-notice.mjs <url>

const url = process.argv[2];
if (!url) {
  console.error('usage: check-legal-draft-notice.mjs <url>');
  process.exit(2);
}

const MARKERS = [
  /draft.{0,20}pending.{0,30}legal review/i,
  /not (?:constitute|intended as) legal advice/i,
];

const res = await fetch(url);
if (!res.ok) {
  console.error(`fetch failed: ${res.status} ${res.statusText}`);
  process.exit(2);
}
const html = await res.text();
const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

const markerMatch = MARKERS.map((re) => text.match(re)).find(Boolean);
if (markerMatch) {
  console.error(`FAIL: retired legal-draft notice still present on ${url}: "${markerMatch[0]}"`);
  process.exit(1);
}

console.log(`OK: no legal-draft notice on ${url}`);
process.exit(0);
