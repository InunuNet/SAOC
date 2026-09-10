// menu-system-layout4 M2/F7 -- provenance check for NavMegaFeatureRail.blurb.
//
// WHAT THIS PROVES: that the literal string assigned to featureRail.blurb in
// components/chrome/nav-config.ts is byte-for-byte identical to the string
// pinned in goldens/f7-featurerail-blurb.json, which is itself transcribed
// verbatim from the approved Layout 4 artifact (b9eadbd4-e165-4de9-884d-86acc9fbf2a2,
// "SAOC Menu Flyouts"). This is a PROVENANCE check: it proves the copy in source
// traces to the one place this mission allows chrome copy to come from.
//
// WHAT THIS DOES NOT PROVE: that the string actually RENDERS anywhere on the
// page, in the right place, in the right element, at the right time. That is
// e2e/mega-menu-layout4-visual-fidelity.spec.ts's job (the
// "feature rail: ... blurb renders" test) -- a real rendered-DOM check, not a
// source grep. This checker and that spec are a pair; neither is sufficient
// alone, matching this repo's audited "assertion satisfiable without the
// property it claims to prove" defect class.
//
// SCOPE NOTE (the provenance question the architect brief asked to resolve):
// this string is menu CHROME copy embedded directly in the approved mockup, not
// a leaf descriptor -- it has no row in content/national-show-routes.json, so
// contracts/checks/menu-system-layout4-f1/check-descriptor-provenance.mjs's
// manifest-purpose-prefix mechanism does not and should not cover it. This is a
// deliberate scope boundary, not a gap in that checker. See
// goldens/f7-featurerail-blurb.json's own "provenanceRuling" field for the full
// reasoning.
//
// Run via: node contracts/checks/menu-system-layout4-f7/check-featurerail-blurb-provenance.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const NAV_CONFIG_PATH = path.join(REPO_ROOT, 'components/chrome/nav-config.ts');
const GOLDEN_PATH = path.join(
  REPO_ROOT,
  '.agent/memory/project/specs/menu-system-layout4/goldens/f7-featurerail-blurb.json'
);

function fail(message) {
  console.log('FAIL');
  console.error(message);
  process.exit(1);
}

let golden;
try {
  golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));
} catch (error) {
  fail(`Could not read/parse golden file at ${GOLDEN_PATH}: ${error.message}`);
}

if (typeof golden.blurb !== 'string' || golden.blurb.length === 0) {
  fail(`Golden file ${GOLDEN_PATH} has no non-empty "blurb" string.`);
}

let navSource;
try {
  navSource = readFileSync(NAV_CONFIG_PATH, 'utf8');
} catch (error) {
  fail(`Could not read ${NAV_CONFIG_PATH}: ${error.message}`);
}

// Find the featureRail object literal's `blurb:` field. Deliberately tolerant
// of quote style (' or ") and trailing comma, but requires the value to be a
// single-line string literal -- if a future edit makes this multi-line or
// template-literal, this regex will (correctly) fail to match rather than
// silently accept anything.
const blurbFieldMatch = navSource.match(/featureRail:\s*\{[^}]*blurb:\s*(['"])((?:(?!\1).)*)\1/s);

if (!blurbFieldMatch) {
  fail(
    'No `featureRail: { ... blurb: "..." }` field found in components/chrome/nav-config.ts. ' +
      'featureRail.blurb must be set to the golden string -- see ' +
      GOLDEN_PATH
  );
}

const actualBlurb = blurbFieldMatch[2];

if (actualBlurb !== golden.blurb) {
  fail(
    `featureRail.blurb does not match the artifact-sourced golden.\n` +
      `  golden:  ${JSON.stringify(golden.blurb)}\n` +
      `  actual:  ${JSON.stringify(actualBlurb)}\n` +
      `Source of truth: ${GOLDEN_PATH}`
  );
}

console.log('PASS');
console.log(`featureRail.blurb matches the artifact-sourced golden: ${JSON.stringify(actualBlurb)}`);
process.exit(0);
