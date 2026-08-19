#!/usr/bin/env node
// Proves a visible legal-draft notice is present on a page: the marker
// phrase must appear in the rendered HTML AND must not be inside an
// element that hides it from sighted users (aria-hidden="true", a
// "sr-only" class, or a `hidden` attribute on the nearest enclosing
// tag found by scanning backward from the marker).
//
// What this does NOT prove: real CSS layout (e.g. zero-height via an
// external stylesheet rule, off-screen positioning, or z-index behind
// another element) is invisible to a static-HTML check. It only rules
// out the common "technically present but screen-reader/DOM-only"
// patterns used elsewhere in this codebase's Tailwind classes.
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
if (!markerMatch) {
  console.error(`FAIL: no legal-draft notice text found on ${url}`);
  process.exit(1);
}

// Find the marker's raw position in the *tagged* HTML by locating a
// same-length plain-text window, then walk backward to the nearest
// unclosed opening tag to inspect its attributes.
const markerPlain = markerMatch[0];
const firstWord = markerPlain.split(/\s+/)[0];
const rawIdx = html.toLowerCase().indexOf(firstWord.toLowerCase());
if (rawIdx === -1) {
  console.error(`FAIL: could not locate marker "${firstWord}" in raw HTML for ${url}`);
  process.exit(1);
}

const before = html.slice(Math.max(0, rawIdx - 500), rawIdx);
const lastOpenTagMatch = [...before.matchAll(/<([a-z0-9]+)\b([^>]*)>/gi)].pop();

if (lastOpenTagMatch) {
  const attrs = lastOpenTagMatch[2] || '';
  if (/aria-hidden\s*=\s*["']true["']/i.test(attrs)) {
    console.error(`FAIL: legal-draft notice on ${url} is inside aria-hidden="true"`);
    process.exit(1);
  }
  if (/class\s*=\s*["'][^"']*\bsr-only\b/i.test(attrs)) {
    console.error(`FAIL: legal-draft notice on ${url} is inside a sr-only element`);
    process.exit(1);
  }
  if (/\bhidden\b/.test(attrs)) {
    console.error(`FAIL: legal-draft notice on ${url} is inside a hidden element`);
    process.exit(1);
  }
}

console.log(`OK: visible legal-draft notice found on ${url}: "${markerPlain}"`);
process.exit(0);
