#!/usr/bin/env node
// POLICY-10: /refunds carries no provisional-figure mark.
//
// This check used to prove that every invented refund figure on the page was bound to a visible
// "provisional" disclosure. The figures are no longer invented: the page renders Lee-Ann's master
// Refund and Cancellation Policy (see check-refunds-no-fabrication.mjs, POLICY-09). The mark
// mechanism is retired on this page, so the property now is its absence: no
// data-provisional-figure region and no visible "provisional" wording inside the policy text.
//
// Usage:
//   node check-refunds-provisional-figures.mjs <url>
//   node check-refunds-provisional-figures.mjs --fixture <path-to-html-file>

import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
let html;
let source;

if (args[0] === '--fixture') {
  source = args[1];
  if (!source) {
    console.error('usage: check-refunds-provisional-figures.mjs --fixture <path>');
    process.exit(2);
  }
  html = await readFile(source, 'utf8');
} else {
  source = args[0];
  if (!source) {
    console.error('usage: check-refunds-provisional-figures.mjs <url>');
    process.exit(2);
  }
  const res = await fetch(source);
  if (res.status !== 200) {
    console.error(`FAIL: ${source} did not return HTTP 200 (got ${res.status})`);
    process.exit(1);
  }
  html = await res.text();
}

const page = html
  .replace(/<script\b[\s\S]*?<\/script\s*>/gi, ' ')
  .replace(/<style\b[\s\S]*?<\/style\s*>/gi, ' ');

if (/data-provisional-figure/i.test(page)) {
  console.error('FAIL: a data-provisional-figure region is still on the page');
  process.exit(1);
}

const proseMatch = page.match(/<div[^>]*class="[^"]*doc-prose[^"]*"[^>]*>([\s\S]*?)<\/main>/i);
const prose = (proseMatch ? proseMatch[1] : page).replace(/<[^>]+>/g, ' ');
const word = prose.match(/\bprovisional\b/i);
if (word) {
  console.error(`FAIL: the word "${word[0]}" appears in the policy text`);
  process.exit(1);
}

console.log(`OK: ${source} carries no provisional-figure mark`);
process.exit(0);
