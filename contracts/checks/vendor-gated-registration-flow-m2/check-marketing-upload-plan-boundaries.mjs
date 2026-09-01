#!/usr/bin/env node
// F18 (vendor-gated-registration-flow, M2) -- A33: lib/vendor-marketing-upload.ts's
// planMarketingAssetUpload() rejects a non-image MIME type, rejects a file over the size cap,
// and derives the storage extension solely from the validated mimeType (never the
// caller-supplied fileName) -- same technique and same shape as F7's own
// check-proof-of-payment-plan.mjs, run against the real function once it exists.
//
// MODULE/INTERFACE SPEC (flagged, not guessed silently -- @dev implements against this, per
// the mission's "@dev implements against golden files only" rule; nothing in the M2 golden
// README names this module's exact exports):
//   lib/vendor-marketing-upload.ts exports:
//     MARKETING_ASSET_ALLOWED_MIME_TYPES: readonly ['image/jpeg', 'image/png'] -- logo and
//       product photos are images only; unlike F7's proof-of-payment (which accepts a PDF),
//       nothing in the source form's Marketing section asks for a document.
//     MARKETING_ASSET_MAX_BYTES: number -- an engineering limit, not a Council figure (same
//       disclaimer as F7's PROOF_OF_PAYMENT_MAX_BYTES): no size limit is named anywhere in the
//       source document. Mirrors F7's own 5 MiB default; @dev may pick a different number, but
//       it must stay a NAMED CONSTANT the function actually compares against (this check
//       reads the constant's own value, so it is not hardcoded here).
//     planMarketingAssetUpload(input: { submissionId, assetSlot, fileName, mimeType, sizeBytes })
//       -> { ok: true, plan: { storagePath } } | { ok: false, error }, where assetSlot is one
//       of 'logo' | 'product-photo-1' | 'product-photo-2' | 'product-photo-3' (matching the 4
//       upload fields the M2 golden README's "Why three fields, not an array" describes:
//       logoPath + productPhoto1Path/2Path/3Path) and storagePath follows F7's own
//       `vendor-marketing/{submissionId}/{assetSlot}.{ext}` convention.
//
// PENDING: F18 is not implemented yet -- this check imports the real module via a try/caught
// dynamic import so a missing module fails with ONE clear line, never a raw Node stack trace.
//
// FAILS ON: any of the boundary cases behaving wrong once the module exists, OR (today) the
// module not existing yet -- both are real, property-shaped failures, never a false pass.
//
// Run as: node contracts/checks/vendor-gated-registration-flow-m2/check-marketing-upload-plan-boundaries.mjs

const MODULE_PATH = '../../../lib/vendor-marketing-upload.ts';

let mod;
try {
  mod = await import(MODULE_PATH);
} catch (err) {
  console.error(
    'FAIL: lib/vendor-marketing-upload.ts does not exist or fails to load yet -- F18 ' +
      '(vendor-gated-registration-flow, M2) is not implemented. This check will start ' +
      'exercising real boundary behaviour once the module exports planMarketingAssetUpload(), ' +
      'MARKETING_ASSET_ALLOWED_MIME_TYPES, and MARKETING_ASSET_MAX_BYTES per this file\'s own ' +
      `header comment. Underlying error: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
}

const { planMarketingAssetUpload, MARKETING_ASSET_ALLOWED_MIME_TYPES, MARKETING_ASSET_MAX_BYTES } = mod;

const failures = [];

if (typeof planMarketingAssetUpload !== 'function') {
  failures.push('lib/vendor-marketing-upload.ts does not export a planMarketingAssetUpload function.');
}
if (!Array.isArray(MARKETING_ASSET_ALLOWED_MIME_TYPES) || MARKETING_ASSET_ALLOWED_MIME_TYPES.length === 0) {
  failures.push('lib/vendor-marketing-upload.ts does not export a non-empty MARKETING_ASSET_ALLOWED_MIME_TYPES array.');
}
if (typeof MARKETING_ASSET_MAX_BYTES !== 'number' || MARKETING_ASSET_MAX_BYTES <= 0) {
  failures.push('lib/vendor-marketing-upload.ts does not export a positive MARKETING_ASSET_MAX_BYTES constant.');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

const EXPECTED_EXTENSION = { 'image/jpeg': 'jpg', 'image/png': 'png' };

// (1) Every allowed mime type, well under the limit, is accepted with a deterministic path
// whose extension is derived from the MIME type, never the caller-supplied file name.
for (const mimeType of MARKETING_ASSET_ALLOWED_MIME_TYPES) {
  const result = planMarketingAssetUpload({
    submissionId: 'abc123',
    assetSlot: 'logo',
    fileName: 'whatever-the-user-named-it.exe', // deliberately wrong extension -- must be ignored
    mimeType,
    sizeBytes: 1024,
  });
  if (!result.ok) {
    failures.push(`(1) mimeType '${mimeType}': expected ok:true, got ok:false: ${result.error}`);
    continue;
  }
  const expectedExtension = EXPECTED_EXTENSION[mimeType];
  if (expectedExtension && !result.plan.storagePath.endsWith(`.${expectedExtension}`)) {
    failures.push(
      `(1) mimeType '${mimeType}': expected storagePath to end with '.${expectedExtension}', got ` +
        `'${result.plan.storagePath}' -- the extension must be derived from mimeType, never fileName.`,
    );
  }
}

// (2) A disallowed mime type is refused, even at a tiny, otherwise-valid size.
{
  const result = planMarketingAssetUpload({
    submissionId: 'abc123',
    assetSlot: 'logo',
    fileName: 'logo.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
  });
  if (result.ok) {
    failures.push('(2) a disallowed mime type (application/pdf) was accepted -- expected ok:false.');
  }
}

// (3) A file exactly at the byte limit is accepted; one byte over is refused.
{
  const atLimit = planMarketingAssetUpload({
    submissionId: 'abc123',
    assetSlot: 'product-photo-1',
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: MARKETING_ASSET_MAX_BYTES,
  });
  if (!atLimit.ok) {
    failures.push(`(3a) a file exactly at MARKETING_ASSET_MAX_BYTES (${MARKETING_ASSET_MAX_BYTES}) was refused: ${atLimit.error}`);
  }

  const overLimit = planMarketingAssetUpload({
    submissionId: 'abc123',
    assetSlot: 'product-photo-1',
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: MARKETING_ASSET_MAX_BYTES + 1,
  });
  if (overLimit.ok) {
    failures.push('(3b) a file one byte over MARKETING_ASSET_MAX_BYTES was accepted -- expected ok:false.');
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: planMarketingAssetUpload() accepts every allowed image mime type under the byte ' +
    'limit with a mime-derived (never file-name-derived) extension, accepts exactly at the ' +
    'byte limit and refuses one byte over, and refuses a disallowed (non-image) mime type.',
);
process.exit(0);
