#!/usr/bin/env node
// cms-loop-f3-national-show A6: proves wiring `hero` did NOT change what a visitor
// sees. Per team-lead direction, swapping the hero background is a visual-design
// decision reserved for the pending Claude Design handoff (CLAUDE.md) — the seeded
// hero asset (orchid-yellow.jpg, migrated from ShowBand.tsx in a prior mission) was
// never an approved choice for THIS page. @dev's implementation must, as a
// documented one-time dataset correction (not a silent fix), update
// nationalShow.hero to reference the SAME asset the page currently hardcodes
// (orchid-dark.jpg — confirmed live 2026-08-05 via the Sanity asset API:
// image-894baf3b8a14c1fc68771b3f2efcd9637fc0dfb5-5184x3456-jpg), THEN wire the field.
//
// This is a static, read-only, non-mutating check — it does not perform the dataset
// correction itself (that is @dev's implementation work), it only verifies the
// correction landed and that the wired page renders that exact asset. Matches on the
// asset's HASH segment specifically (not the full `_ref` string, which also encodes
// pixel dimensions/format that a re-upload could legitimately vary) — extracted from
// a live `_ref` value the same way for both the dataset read and the page HTML scan,
// so a coincidental partial match is not possible.
//
// Run this AFTER F1 is deployed and AFTER @dev has performed the hero correction +
// wiring — before wiring, /national-show hardcodes /images/orchid-dark.jpg as a
// local file path with no Sanity asset reference at all, so this check is expected
// to FAIL (no cdn.sanity.io hero markup exists yet) until wiring is complete. This is
// NOT the same F1-deployment gate as A1/A3 (this check never mutates anything, so it
// carries none of their CDN-poisoning risk) — it can safely be run at any time; it
// just won't PASS until the wiring work is actually done.
//
// Exit codes: 0 = dataset hero asset matches the expected orchid-dark.jpg hash AND
// the deployed page renders that same hash. 1 = mismatch, missing reference, or host
// unreachable — never a skip.

import { getSanityClient, fetchPublicPageContains, TARGET_DOC_ID, TARGET_PAGE_PATH } from './_shared.mjs';

// Confirmed live 2026-08-05 via the Sanity CDN API
// (*[_type=="sanity.imageAsset"]{_id,originalFilename}) — the pre-existing,
// already-uploaded asset for public/images/orchid-dark.jpg, the file
// app/(marketing)/national-show/page.tsx's hero <Image> currently hardcodes.
const EXPECTED_HERO_ASSET_ID = 'image-894baf3b8a14c1fc68771b3f2efcd9637fc0dfb5-5184x3456-jpg';

function extractHash(assetId) {
  // Sanity asset ids are shaped "image-<hash>-<dims>-<ext>" — the hash segment
  // uniquely identifies file content independent of any dimension/format variant.
  const parts = assetId.split('-');
  return parts.length >= 2 ? parts[1] : null;
}

const expectedHash = extractHash(EXPECTED_HERO_ASSET_ID);
if (!expectedHash) {
  console.error(`FAIL: could not parse a hash out of EXPECTED_HERO_ASSET_ID (${EXPECTED_HERO_ASSET_ID}) — check the constant.`);
  process.exit(1);
}

const client = getSanityClient();
let doc;
try {
  doc = await client.fetch(`*[_id == $id][0]{"heroAssetId": hero.asset._ref}`, { id: TARGET_DOC_ID });
} catch (err) {
  console.error(`FAIL: dataset read for ${TARGET_DOC_ID}.hero threw — ${err.message}`);
  process.exit(1);
}

const datasetHeroAssetId = doc?.heroAssetId;
console.log('Dataset nationalShow.hero.asset._ref:', datasetHeroAssetId);
if (!datasetHeroAssetId) {
  console.error(
    `FAIL: nationalShow.hero has no asset reference yet — @dev has not performed the required dataset correction ` +
      `(set hero to the orchid-dark.jpg asset, ${EXPECTED_HERO_ASSET_ID}) before wiring.`
  );
  process.exit(1);
}
const datasetHash = extractHash(datasetHeroAssetId);
if (datasetHash !== expectedHash) {
  console.error(
    `FAIL: nationalShow.hero references a DIFFERENT asset than expected — dataset hash ${datasetHash}, ` +
      `expected ${expectedHash} (orchid-dark.jpg, the asset the page hardcoded before wiring). Per team-lead direction, ` +
      'the hero correction must point at the SAME image the page rendered before this feature, not a new choice.'
  );
  process.exit(1);
}
console.log('Dataset hero asset hash matches the expected pre-wiring image (orchid-dark.jpg).');

const page = await fetchPublicPageContains(datasetHash, TARGET_PAGE_PATH);
console.log(`${TARGET_PAGE_PATH} status: ${page.status}, contains hero hash: ${page.hasNeedle}`);

if (page.status === 200 && page.hasNeedle) {
  console.log('PASS: /national-show renders the same hero image after wiring as it did before wiring.');
  process.exit(0);
}
console.error(
  `FAIL: the dataset's hero asset (hash ${datasetHash}) does not appear anywhere in the deployed /national-show HTML — ` +
    'either hero is not wired at all, or it is not rendering the corrected asset.'
);
process.exit(1);
