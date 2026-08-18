#!/usr/bin/env node
// A5 — VendorIntro renders Lee-Ann's copy verbatim: real react-dom/server output, checked
// against the golden fixture extracted independently from the source .docx, not a re-typed
// paraphrase and not a source-code grep of page.tsx (a component render check catches a typo
// introduced by hand-copying; a grep of the same hand-copied text would not).
//
// Whitespace is normalized (collapsed to single spaces) on both sides before comparison —
// JSX line-wrapping inside a template literal or text node is not a content change — but no
// word is added, removed, or reordered within a paragraph.
//
// NOTE: this fixes F3's brief ("three intro paragraphs") against a real discrepancy found
// re-reading the source: the .docx has ONE heading line plus FOUR body paragraphs, not three.
// See golden README, "Judgement call — four paragraphs, not three." All four are gated here
// so none of Lee-Ann's copy is silently dropped to force-fit "three."
//
// DEFEATING MUTATION: rewording, "improving," or shortening any paragraph; dropping the
// fourth paragraph to match the brief's "three" framing; rendering the paragraphs out of
// order; rendering the heading as a random string instead of Lee-Ann's chosen phrase (the
// project's own PageHero heading prop is a plausible spot for this to be lost — this check
// looks at VendorIntro's own render, not PageHero's, so it also catches the copy being routed
// through the wrong component entirely, i.e. VendorIntro rendering nothing because the page
// only ever calls PageHero).
//
// Run as: node --import tsx/esm contracts/checks/vendor-f3-showcase-page/check-intro-prose-renders.mjs

import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { VendorIntro } from '../../../components/vendors/VendorIntro.tsx';

const goldenPath = new URL('./fixtures/intro-prose.golden.json', import.meta.url);
const golden = JSON.parse(readFileSync(goldenPath, 'utf8'));

const normalize = (s) => s.replace(/\s+/g, ' ').trim();

const failures = [];
let html;
try {
  html = renderToStaticMarkup(React.createElement(VendorIntro));
} catch (error) {
  failures.push(`VendorIntro threw when rendered with no props: ${error.message}`);
}

if (html !== undefined) {
  const text = normalize(html.replace(/<[^>]*>/g, ' '));

  if (!text.includes(normalize(golden.heading))) {
    failures.push(`VendorIntro does not render the heading verbatim: "${golden.heading}"`);
  }

  const positions = [];
  golden.paragraphs.forEach((para, i) => {
    const needle = normalize(para);
    const at = text.indexOf(needle);
    if (at === -1) {
      failures.push(
        `VendorIntro does not render paragraph ${i + 1} verbatim (first 60 chars: ` +
          `"${needle.slice(0, 60)}...")`,
      );
    } else {
      positions.push(at);
    }
  });

  if (positions.length === golden.paragraphs.length) {
    const ordered = positions.every((p, i) => i === 0 || positions[i - 1] < p);
    if (!ordered) {
      failures.push(`VendorIntro's paragraphs render out of source order — positions: ${JSON.stringify(positions)}`);
    }
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(`PASS: VendorIntro renders the heading and all ${golden.paragraphs.length} paragraphs verbatim, in order.`);
process.exit(0);
