#!/usr/bin/env node
// A1 — every block of Lee-Ann's official About copy (the title + all 7
// paragraphs) must appear verbatim in the RENDERED page at
// http://localhost:3002/about, not just somewhere in the source tree, and
// every **bold** span from the source doc must render as real semantic
// emphasis (<strong> or <b>), not a CSS-only bold.
//
// Deliberately does NOT hand-transcribe the expected text into this script
// or into a separate fixture — it reads content.md itself at runtime and
// derives both the plain-text blocks and the bold-phrase list from it, so
// there is exactly one source of truth and no risk of a retyped-text
// mismatch (see the golden's §1 note on typographic apostrophes etc.).
//
// Usage: node contracts/checks/saoc-about-page-f1/check-content-verbatim.mjs
// Requires `pnpm dev` already running on :3002 (this script does not start
// the server). Exits 2 if the dev server isn't reachable, 1 if any block or
// bold phrase is missing from the rendered page, 0 on success.

import { readFileSync } from 'fs';

const CONTENT_MD = "content/drive-source/SAOC /2. About/About page - South African Orchid Council/v1.0/content.md";
const URL = 'http://localhost:3002/about';

function normalizeWhitespace(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function stripHtmlTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    // Tags carry no whitespace of their own — any real word-gap in the
    // rendered text is already a literal space character in the markup
    // (natural text or an explicit `{' '}`). Replacing a tag with '' (not
    // ' ') avoids inserting a space where the source has none, e.g. a
    // <strong> span closing directly against a comma or period with no
    // space (content.md's "**1968**," has none) — replacing with a space
    // would otherwise produce "1968 ," and break the verbatim substring
    // match even though the visible text is correct.
    .replace(/<[^>]+>/g, '');
}

// React/ReactDOM server rendering escapes apostrophes and quotes in text
// content (standard behaviour, not a bug in the page) — content.md's plain
// ASCII apostrophes ("Council's", "Africa's") render as `&#x27;` in the
// fetched HTML. Decode the handful of entities relevant to this copy so the
// verbatim comparison isn't fooled by an encoding difference that carries no
// actual content change.
function decodeHtmlEntities(s) {
  return s
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&');
}

// --- Parse content.md: title + 7 paragraphs, derive bold phrases ---
const raw = readFileSync(CONTENT_MD, 'utf8');
const blocks = raw
  .split(/\n\s*\n/)
  .map((b) => normalizeWhitespace(b))
  .filter((b) => b.length > 0);

if (blocks.length < 2) {
  console.error(`expected a title + multiple paragraphs in ${CONTENT_MD}, got ${blocks.length} block(s)`);
  process.exit(1);
}

const boldPhrases = [];
const plainBlocks = blocks.map((block) => {
  const re = /\*\*(.+?)\*\*/gs;
  let m;
  while ((m = re.exec(block)) !== null) {
    boldPhrases.push(normalizeWhitespace(m[1]));
  }
  return normalizeWhitespace(block.replace(/\*\*/g, ''));
});

console.log(`parsed ${plainBlocks.length} block(s) (title + paragraphs) and ${boldPhrases.length} bold phrase(s) from content.md`);

// --- Fetch the rendered page ---
let res;
try {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  res = await fetch(URL, { signal: controller.signal });
  clearTimeout(timeout);
} catch (err) {
  console.error(`could not reach ${URL} — is 'pnpm dev' running on :3002? (${err.message})`);
  process.exit(2);
}

if (!res.ok) {
  console.error(`${URL} returned HTTP ${res.status}`);
  process.exit(2);
}

const html = await res.text();
const normalizedText = decodeHtmlEntities(normalizeWhitespace(stripHtmlTags(html)));

// --- Check each block's plain text is present verbatim in the rendered page ---
const missingBlocks = [];
plainBlocks.forEach((block, i) => {
  if (!normalizedText.includes(block)) {
    missingBlocks.push({ index: i, preview: block.slice(0, 80) });
  }
});

// --- Check each bold phrase renders inside <strong> or <b> ---
const normalizedHtmlForBold = decodeHtmlEntities(html.replace(/\s+/g, ' '));
const missingBold = [];
boldPhrases.forEach((phrase) => {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<(strong|b)[^>]*>\\s*${escaped}\\s*</\\1>`, 'i');
  if (!re.test(normalizedHtmlForBold)) {
    missingBold.push(phrase.slice(0, 80));
  }
});

if (missingBlocks.length > 0 || missingBold.length > 0) {
  if (missingBlocks.length > 0) {
    console.error(`FAIL: ${missingBlocks.length} of ${plainBlocks.length} content.md block(s) not found verbatim in rendered ${URL}:`);
    missingBlocks.forEach((b) => console.error(`  block ${b.index}: "${b.preview}..."`));
  }
  if (missingBold.length > 0) {
    console.error(`FAIL: ${missingBold.length} of ${boldPhrases.length} bold phrase(s) not wrapped in <strong>/<b> in rendered ${URL}:`);
    missingBold.forEach((p) => console.error(`  "${p}..."`));
  }
  process.exit(1);
}

console.log(`OK: all ${plainBlocks.length} content.md blocks and all ${boldPhrases.length} bold phrases found verbatim (with semantic emphasis) in ${URL}`);
