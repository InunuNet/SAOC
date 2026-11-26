#!/usr/bin/env node
// POLICY-09: /refunds carries Lee-Ann's master Refund and Cancellation Policy, verbatim.
//
// The page used to be a draft with no figures, and this check forbade any digit+unit figure on it.
// The master policy is now the page (content/legal/refunds.ts, from her Drive document), so the
// check asserts the opposite: the rendered text matches the master source. Every block of
// REFUND_POLICY (title, headings, paragraphs, list items), in order, must appear in the page text.
// A reworded, dropped, reordered or added-to sentence fails; so does a leftover "draft pending
// legal review" notice or provisional-figure mark.
//
// What this does NOT prove: that content/legal/refunds.ts itself matches the Drive document. That
// is checked by hand against the .docx whenever she issues a new version.
//
// <script> and <style> payloads are stripped before the text is scanned: framework class strings
// are not page copy.
//
// Usage:
//   node check-refunds-no-fabrication.mjs <url>
//   node check-refunds-no-fabrication.mjs --fixture <path-to-html-file>

import { readFile } from 'node:fs/promises';

const { REFUND_POLICY } = await import(
  new URL('../../../content/legal/refunds.ts', import.meta.url).href
);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : Number(body.slice(1));
      return String.fromCodePoint(code);
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

function pageText(html) {
  return decodeEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script\s*>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style\s*>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ');
}

/** The plain text of a block's inline markup: **bold** and <https://link> lose their marks. */
function plain(text) {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/<((?:https?:\/\/|mailto:)[^>]+)>/g, '$1');
}

function expectedParts(document) {
  const parts = [document.title];
  for (const block of document.blocks) {
    if (block.kind === 'list') parts.push(...block.items);
    else if (block.kind === 'lines') parts.push(...block.lines);
    else parts.push(block.text);
  }
  return parts.map((part) => plain(part).replace(/\s+/g, ' ').trim());
}

async function load(args) {
  if (args[0] === '--fixture') {
    if (!args[1]) {
      console.error('usage: check-refunds-no-fabrication.mjs --fixture <path>');
      process.exit(2);
    }
    return { source: args[1], html: await readFile(args[1], 'utf8') };
  }
  if (!args[0]) {
    console.error('usage: check-refunds-no-fabrication.mjs <url>');
    process.exit(2);
  }
  const res = await fetch(args[0]);
  if (res.status !== 200) {
    console.error(`FAIL: ${args[0]} did not return HTTP 200 (got ${res.status})`);
    process.exit(1);
  }
  return { source: args[0], html: await res.text() };
}

const { source, html } = await load(process.argv.slice(2));
const text = pageText(html);
let failed = false;

let cursor = 0;
for (const part of expectedParts(REFUND_POLICY)) {
  const at = text.indexOf(part, cursor);
  if (at === -1) {
    console.error(`FAIL: master text missing from the page, or out of order: "${part.slice(0, 80)}"`);
    failed = true;
  } else {
    cursor = at + part.length;
  }
}

const draftNotice = text.match(/draft.{0,20}pending.{0,30}legal review/i);
if (draftNotice) {
  console.error(`FAIL: retired draft notice still on the page: "${draftNotice[0]}"`);
  failed = true;
}
if (/data-provisional-figure/i.test(html)) {
  console.error('FAIL: a data-provisional-figure mark is still on the page');
  failed = true;
}

if (!failed) {
  console.log(`OK: ${source} matches the master Refund and Cancellation Policy`);
}
process.exit(failed ? 1 : 0);
