#!/usr/bin/env node
// F20 (vendor-gated-registration-flow, M2) -- A36: the rendered form contains exactly the 6
// declaration points from the 26 Aug source doc's "VENDOR DECLARATION" section (not a 12-point
// list -- see the source-doc snapshot's own "Verified deltas" note: "The 12-point Vendor
// Declaration is now 6 points") and the 90-day cancellation clause's exact wording, proving the
// WRITTEN document's figure shipped, not the voice-note's "2 months" figure (M2 golden
// README's "The two flagged contradictions").
//
// FILE LOCATION (flagged, not guessed silently): no declaration/T&Cs content exists anywhere
// in the codebase today (confirmed directly -- grepped for "declar"/"Declaration"/"I/We
// confirm" across components/vendors/ and lib/, zero matches), so F20 is greenfield, not a
// modification of existing copy. Rather than assume a filename @dev has not chosen yet (e.g.
// a new VendorDeclarationFieldset.tsx), this check scans the WHOLE components/vendors/
// directory's combined text, matching this contract's own A30/A35 inline-command convention
// (`grep -rq ... components/vendors/`) of not pinning a specific file for new F20-era content.
//
// Whitespace-normalised substring matching (collapse all runs of whitespace to one space
// before comparing) -- JSX line-wraps prose across multiple template-literal/text-node lines,
// so a literal multi-line match would be brittle against harmless reformatting.
//
// FAILS ON: any of the 6 exact declaration sentences (from the source doc, whitespace-
// normalised) missing from components/vendors/, the 90-day cancellation sentence missing, or
// the string "2 months" appearing anywhere in components/vendors/ (the voice-note's
// contradicting figure must never leak into the shipped copy).
//
// Run as: node contracts/checks/vendor-gated-registration-flow-m2/check-declaration-and-cancellation-copy.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const VENDORS_DIR = path.join(ROOT, 'components/vendors');

function collectTsxFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectTsxFiles(full));
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

// JSX text conventionally escapes '&' as '&amp;' (see e.g. every existing fieldset's
// "Contact &amp; business details" heading) -- normalize that back to a literal '&' so this
// check matches the source doc's own prose regardless of which literal form @dev's JSX uses.
const normalize = (s) => s.replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const files = collectTsxFiles(VENDORS_DIR);
const combinedRaw = files.map((f) => readFileSync(f, 'utf8')).join('\n');
const combinedNormalized = normalize(combinedRaw);

const failures = [];

// The exact 6 declaration sentences, verbatim from docs/leeann-source/
// 2027-vendor-registration-form_2026-08-26.md's "VENDOR DECLARATION" section.
const DECLARATION_POINTS = [
  'I/We confirm that the information supplied in this Vendor Registration Form is true, accurate and complete to the best of my/our knowledge.',
  'I/We confirm that I/We have disclosed all products, services, activities and equipment intended to be offered, displayed, demonstrated or undertaken at the 2027 SAOC National Show.',
  'I/We confirm that I/We have read, understood and agree to comply with the 2027 SAOC National Show Vendor Terms & Conditions set out below.',
  'I/We agree to comply with all applicable South African laws, regulations, permits, health and safety requirements, plant health requirements, municipal requirements and venue rules applicable to my/our participation in the Show.',
  'I/We undertake to obtain and maintain, at my/our own cost, all permits, licences, certificates, approvals and other authorisations required for my/our business, products, activities and participation in the Show.',
  'I/We will not sell, display, demonstrate or promote products or undertake activities that have not been declared in this registration form where such declaration is required, or where prior approval has been requested by the Show Organising Committee.',
];

for (const [index, point] of DECLARATION_POINTS.entries()) {
  if (!combinedNormalized.includes(normalize(point))) {
    failures.push(`declaration point ${index + 1} of 6 is missing verbatim from components/vendors/: "${point}"`);
  }
}

// The 90-day cancellation sentence, verbatim from the source doc's "Cancellation and Refunds"
// clause.
const CANCELLATION_SENTENCE = 'Cancellations received within 90 days of the show will not qualify for a refund.';
if (!combinedNormalized.includes(normalize(CANCELLATION_SENTENCE))) {
  failures.push(`the 90-day cancellation sentence is missing verbatim from components/vendors/: "${CANCELLATION_SENTENCE}"`);
}

// The voice-note's contradicting "2 months" figure must never leak into the shipped copy.
if (/2\s*months/i.test(combinedRaw)) {
  failures.push(
    '"2 months" appears somewhere in components/vendors/ -- the voice-note\'s contradicting ' +
      'cancellation figure must never ship; the written 90-day figure is the one source of truth.',
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: all 6 declaration points and the 90-day cancellation sentence are present verbatim ' +
    'in components/vendors/, and "2 months" appears nowhere.',
);
process.exit(0);
