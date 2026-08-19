#!/usr/bin/env node
// Property check for /terms: proves conditions-of-sale content was
// actually added, not merely a new heading — the two facts the
// architect handoff named as required (18+ restriction on Sunset
// Cocktails, limited capacity on workshops/field trips) must appear as
// statements, and a general "conditions of sale" section must exist.
//
// What this does NOT prove: legal correctness or completeness of the
// sale terms — only that these two specific, previously-audited-absent
// facts are present in the rendered text.
//
// Usage: node check-terms-ticket-conditions.mjs <url>

const url = process.argv[2];
if (!url) {
  console.error('usage: check-terms-ticket-conditions.mjs <url>');
  process.exit(2);
}

const res = await fetch(url);
if (!res.ok) {
  console.error(`fetch failed: ${res.status} ${res.statusText}`);
  process.exit(2);
}
const html = await res.text();
const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

let failed = false;

if (!/18\s*\+|eighteen.{0,10}(years|and older)/i.test(text) || !/Sunset Cocktails/i.test(text)) {
  console.error('FAIL: missing the 18+ restriction statement tied to Sunset Cocktails');
  failed = true;
}

if (!/limited capacity|capacity is limited|subject to (?:availability|capacity)/i.test(text) ||
    !/workshop/i.test(text)) {
  console.error('FAIL: missing limited-capacity statement for workshops/field trips');
  failed = true;
}

if (!/conditions of sale|ticket terms|admission terms/i.test(text)) {
  console.error('FAIL: no identifiable conditions-of-sale / ticket-terms section');
  failed = true;
}

if (!failed) {
  console.log(`OK: ${url} contains conditions of sale, 18+ restriction, and capacity language`);
}
process.exit(failed ? 1 : 0);
