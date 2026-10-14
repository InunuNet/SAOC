// Static source check -- no dev server. After all 3 product photos upload, the vendor
// success page must show a completion message instead of the unconditional "not complete"
// sentence. Asserts: the upload field exposes and calls onUploaded on success; the success
// page passes each photo slot ITS OWN markUploaded call (logo none); completion derives from
// all 3 slots via .every; completion copy is the truthy branch and "not complete" the falsy.
//
// Run as: node contracts/checks/vendor-register-p2-f1/check-completion-state.mjs
// Optional args: <successSourcePath> <fieldSourcePath> (used to mutation-prove against old source).

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const successPath = process.argv[2] ?? resolve(repoRoot, 'components/vendors/VendorRegisterSuccess.tsx');
const fieldPath = process.argv[3] ?? resolve(repoRoot, 'components/vendors/VendorMarketingUploadField.tsx');
const success = readFileSync(successPath, 'utf8');
const field = readFileSync(fieldPath, 'utf8');

const failures = [];
const expect = (ok, msg) => {
  if (!ok) failures.push(msg);
};

expect(/onUploaded\?:\s*\(\)\s*=>\s*void/.test(field), 'field does not declare optional onUploaded prop');
expect(
  /setStatus\('success'\);\s*onUploaded\?\.\(\)/.test(field),
  'field does not call onUploaded right after setStatus(success)',
);

// Parse every <VendorMarketingUploadField ... /> element: assetSlot and onUploaded together.
const elements = [...success.matchAll(/<VendorMarketingUploadField\b([\s\S]*?)\/>/g)].map((m) => m[1]);
const bySlot = new Map();
for (const attrs of elements) {
  const slot = attrs.match(/assetSlot="([^"]+)"/)?.[1];
  if (slot) bySlot.set(slot, attrs);
}
const PHOTO_SLOTS = ['product-photo-1', 'product-photo-2', 'product-photo-3'];
for (const slot of PHOTO_SLOTS) {
  const attrs = bySlot.get(slot);
  const handler = attrs?.match(/onUploaded=\{\(\)\s*=>\s*markUploaded\('([^']+)'\)\}/);
  expect(Boolean(attrs), `no <VendorMarketingUploadField> for ${slot}`);
  expect(handler?.[1] === slot, `${slot} onUploaded must call markUploaded('${slot}'), got ${handler?.[1] ?? 'none'}`);
}
expect(bySlot.has('logo') && !/onUploaded/.test(bySlot.get('logo')), 'logo field must exist and have NO onUploaded');

const slotsDecl = success.match(/const PRODUCT_PHOTO_SLOTS = \[([^\]]*)\]/)?.[1] ?? '';
const declared = [...slotsDecl.matchAll(/'([^']+)'/g)].map((m) => m[1]);
expect(
  declared.length === 3 && PHOTO_SLOTS.every((slot) => declared.includes(slot)),
  `PRODUCT_PHOTO_SLOTS must be exactly the 3 product-photo slots, got [${declared.join(', ')}]`,
);
expect(
  /const allPhotosUploaded = PRODUCT_PHOTO_SLOTS\.every\(\(\w+\) => uploadedSlots\.has\(\w+\)\)/.test(success),
  'allPhotosUploaded must be PRODUCT_PHOTO_SLOTS.every(... uploadedSlots.has(...))',
);
expect(
  /new Set\(prev\)\.add\(slot\)/.test(success) && /const markUploaded = \(slot: string\) => setUploadedSlots/.test(success),
  'markUploaded must add its slot to the existing set',
);

const truthy = /\{allPhotosUploaded \? \(\s*<p[^>]*>\s*([\s\S]*?)<\/p>\s*\) : \(\s*<p[^>]*>\s*([\s\S]*?)<\/p>\s*\)\}/.exec(success);
expect(Boolean(truthy), 'no `allPhotosUploaded ? (<p>..</p>) : (<p>..</p>)` conditional found');
expect(
  truthy?.[1].includes('All 3 required product photos have been uploaded. Your registration is complete.'),
  'completion copy is not in the truthy branch',
);
expect(
  truthy?.[2].replace(/\s+/g, ' ').includes('Your registration is not complete until you have also uploaded all 3 required product photos below.'),
  'the "not complete" copy is not in the falsy branch',
);

if (failures.length > 0) {
  console.error('FAIL check-completion-state:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log('PASS check-completion-state');
