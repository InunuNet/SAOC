#!/usr/bin/env node
// Static wiring proofs for the vendor photo-resume feature (no network, no Firestore, no live
// data). The behavioural proofs live in check-token-and-link.mjs / check-resume-gate.mjs; this
// file proves the pieces are actually CONNECTED and that the properties the unit checks cannot
// see (auth ordering, registry entries, untouched single-use gate) hold in the source.
//
// Run as: node contracts/checks/vendor-photo-resume/check-static-wiring.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const BASE = '77e50788';
const failures = [];
const expect = (cond, msg) => { if (!cond) failures.push(msg); };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, '$1');
const read = (rel) => {
  if (!existsSync(rel)) { failures.push(`missing file: ${rel}`); return null; }
  return readFileSync(rel, 'utf8');
};

// --- 1. The resume page ---------------------------------------------------------------------
const PAGE = 'app/(marketing)/national-show/vendors/photos/page.tsx';
const pageRaw = read(PAGE);
if (pageRaw) {
  const page = strip(pageRaw);
  expect(/export const dynamic = 'force-dynamic'/.test(page), 'page must be force-dynamic.');
  expect(/noIndex:\s*true/.test(page), 'page metadata must be noIndex: true.');
  expect(/resolveVendorPhotoResumeState/.test(page), 'page must decide via resolveVendorPhotoResumeState().');
  expect(/VENDOR_STAND_PAYMENT_TOKEN_SECRET/.test(page), 'page must read VENDOR_STAND_PAYMENT_TOKEN_SECRET (no new secret).');
  expect(/<VendorPhotoResumeUploads\b/.test(page), 'page must render the live-updating VendorPhotoResumeUploads client component for the upload state.');
  expect(/searchParams:\s*Promise<\{\s*token\?:\s*string \| string\[\]\s*\}>/.test(page), 'page searchParams must carry only `token` (never a submission id).');
  expect(/<VendorPhotoResumeUploads[^>]*submissionId=\{[^}]*vendorSubmissionId[^}]*\}/.test(page) || /<VendorPhotoResumeUploads[\s\S]*?submissionId=\{[^}]*vendorSubmissionId[^}]*\}[\s\S]*?\/>/.test(page), 'upload component must take the submission id from the verified state, not from the URL.');
  expect(/serverUploadedCount=\{[^}]*uploadedCount[^}]*\}/.test(page) && /missingSlots=\{[^}]*missingSlots[^}]*\}/.test(page), 'page must seed the component with the server uploadedCount and missingSlots.');
  expect(!/uploadedCount\}\s*of 3/.test(page), 'the static server-rendered "N of 3" line must be gone from the page (the client component owns it so it updates live).');
  expect(!/VendorRegisterForm|VendorRegistrationCodeEntryForm/.test(page), 'page must not render the registration form (no re-submission).');
  expect(!/cookies\(|vendor-registration-token|vendor-stand-payment-token|vendor-registration-code/.test(page), 'page must not touch the registration session or the other token domains.');
  expect(!/assetSlot="logo"|'logo'|"logo"/.test(page), 'resume page offers the 3 product photos only (logo stays on the success page).');
  expect(!/businessName|contactEmail|contactPersonName|contactPhone/.test(page), 'page must not read or render vendor PII.');
  expect(!/\.(set|update|add|delete)\(|runTransaction/.test(page), 'page must be read-only.');
  expect(/VENDOR_SUBMISSIONS_COLLECTION/.test(page), 'page must load the submission by the verified id from vendorSubmissions.');
}

// --- 1b. Live count/completion (defect found on beta c11b51bd: "0 of 3" until reload) ---------
const COMP = 'components/vendors/VendorPhotoResumeUploads.tsx';
const compRaw = read(COMP);
if (compRaw) {
  const comp = strip(compRaw);
  expect(/^\s*'use client';/.test(compRaw), 'live component must be a client component.');
  expect(/useState/.test(comp), 'live component must hold upload progress in client state.');
  expect(/computeResumeProgress/.test(comp) && /addUploadedSlot/.test(comp), 'live component must derive count/completion via the pure computeResumeProgress()/addUploadedSlot().');
  expect(/vendor-photo-resume-progress/.test(comp), 'live component must import the progress module.');
  const elements = [...comp.matchAll(/<VendorMarketingUploadField\b([\s\S]*?)\/>/g)].map((m) => m[1]);
  expect(elements.length >= 1, 'live component must render VendorMarketingUploadField.');
  expect(elements.every((a) => /onUploaded=\{/.test(a)), 'EVERY rendered upload field must pass onUploaded.');
  expect(elements.length > 0 && elements.every((a) => { const v = a.match(/assetSlot=\{(\w+)\}/)?.[1]; const seg = a.slice(a.indexOf('onUploaded={')); return Boolean(v) && new RegExp('\\b' + v + '\\b').test(seg); }), "each field's onUploaded must reference ITS OWN assetSlot variable.");
  expect(/missingSlots\.map/.test(comp) && !/missingSlots\.filter/.test(comp), 'fields must be mapped from the SEEDED missingSlots (not filtered by live progress) so they stay mounted and keep their own Uploaded feedback.');
  expect(!/assetSlot="logo"|'logo'|"logo"/.test(comp), 'live component offers the 3 product photos only.');
  expect(!/businessName|contactEmail|contactPersonName|contactPhone/.test(comp), 'live component must not read or render vendor PII.');
  expect(/All 3 required product photos have been uploaded\./.test(compRaw.replace(/\s+/g, ' ')), 'live component must show the existing completion sentence once complete.');
  expect(/(complete|allUploaded)\s*\?/.test(comp) || /(complete|allUploaded)\s*&&/.test(comp), 'completion sentence must be conditional on live progress.');
  expect(/\{\s*\w+\.uploadedCount\s*\}\s*of 3 product photos uploaded\./.test(compRaw.replace(/\s+/g, ' ')), 'the N of 3 line must render the LIVE progress.uploadedCount.');
  expect(!/fetch\(|firebase|\.collection\(/.test(comp), 'live component must not fetch or touch Firestore itself.');
}
const fieldRaw = read('components/vendors/VendorMarketingUploadField.tsx');
if (fieldRaw) {
  expect(/onUploaded\?:\s*\(\)\s*=>\s*void/.test(fieldRaw), 'VendorMarketingUploadField must declare optional onUploaded (same hunk as 8f3ae6e4).');
  expect(/setStatus\('success'\);\s*onUploaded\?\.\(\)/.test(fieldRaw), 'VendorMarketingUploadField must call onUploaded right after setStatus(success).');
}

// --- 2. Admin reissue route -----------------------------------------------------------------
const ROUTE = 'app/api/admin/vendors/[id]/resend-photo-link/route.ts';
const routeRaw = read(ROUTE);
if (routeRaw) {
  const route = strip(routeRaw);
  const iSession = route.indexOf('getAdminSession()');
  const iCap = route.indexOf("hasCapability(");
  const iRead = route.search(/\.get\(\)/);
  expect(iSession >= 0 && iRead >= 0 && iSession < iRead, 'getAdminSession() must run before any Firestore read.');
  expect(iCap >= 0 && iCap < iRead, 'hasCapability() must run before any Firestore read.');
  expect(/'review-vendor-applications'/.test(route), "route must reuse the existing 'review-vendor-applications' capability.");
  expect(/status:\s*401/.test(route) || /401/.test(route), 'route must answer 401 for no session.');
  expect(/403/.test(route) && /409/.test(route) && /503/.test(route) && /404/.test(route), 'route must answer 403, 404, 409 and 503 as specified.');
  expect(/mintVendorPhotoUploadUrl/.test(route), 'route must mint a FRESH link via mintVendorPhotoUploadUrl() every call.');
  expect(/photoUrl/.test(route), 'route must return `photoUrl`.');
  expect(/VENDOR_STAND_PAYMENT_TOKEN_SECRET/.test(route), 'route must use VENDOR_STAND_PAYMENT_TOKEN_SECRET (no new secret).');
  expect(/'rejected'/.test(route), 'route must refuse rejected submissions.');
  expect(/productPhoto1Path/.test(route) && /productPhoto3Path/.test(route), 'route must refuse when all 3 product photos are already present.');
  expect(!/sendEmail|@\/lib\/email|sendVendor|deliverConfirmationEmailAfterCommit/.test(route), 'route returns the link to the admin and sends no email (decision: no new email template).');
  expect(!/\.(set|update|add|delete)\(/.test(route), 'route must not write to Firestore (no state is stored for the link).');
}

// --- 3. Admin UI ------------------------------------------------------------------------------
const CONTROL = 'components/admin/VendorPhotoLinkControl.tsx';
read(CONTROL);
const tableRaw = read('components/admin/VendorReviewTable.tsx');
if (tableRaw) {
  const table = strip(tableRaw);
  expect(/resend-photo-link/.test(table), 'VendorReviewTable must call /resend-photo-link.');
  expect(/VendorPhotoLinkControl/.test(table), 'VendorReviewTable must render VendorPhotoLinkControl.');
  expect(/!uploadsComplete/.test(table), 'the control must be offered only while photos are incomplete (!uploadsComplete).');
}

// --- 4. Confirmation email carries the link ---------------------------------------------------
const handler = strip(read('lib/vendor-registration-handler.ts') ?? '');
expect(/sendConfirmationEmail\(\{[\s\S]*?vendorSubmissionId:\s*writeResult\.id/.test(handler), 'handler must pass vendorSubmissionId: writeResult.id into sendConfirmationEmail.');
const confirmationRaw = read('lib/vendor-registration-confirmation.ts');
if (confirmationRaw) {
  expect(/mintVendorPhotoUploadUrl/.test(strip(confirmationRaw)), 'confirmation sender must mint the link via mintVendorPhotoUploadUrl().');
  expect(/photoUploadUrl/.test(strip(confirmationRaw)), 'confirmation sender must pass photoUploadUrl to the email.');
  expect(/VENDOR_STAND_PAYMENT_TOKEN_SECRET/.test(strip(confirmationRaw)), 'confirmation sender must use VENDOR_STAND_PAYMENT_TOKEN_SECRET (no new secret).');
  expect(!/console\./.test(strip(confirmationRaw)), 'confirmation sender must keep its no-logging-call guarantee (PII).');
}
const emailRaw = read('emails/VendorRegistrationConfirmation.tsx');
if (emailRaw) {
  expect(/photoUploadUrl\?:\s*string/.test(emailRaw), 'email must take an OPTIONAL photoUploadUrl prop.');
  expect(/href=\{photoUploadUrl\}/.test(emailRaw), 'email must link to photoUploadUrl.');
  expect(/photoUploadUrl\s*(\?|&&)/.test(emailRaw), 'email must render the photo block only when photoUploadUrl is present.');
}

// --- 5. Route registries ---------------------------------------------------------------------
const SLUG = '/national-show/vendors/photos';
for (const f of ['scripts/generate-nos-route-manifest.ts', 'scripts/checks/verify-show-page-m4.ts', 'content/national-show-routes.json']) {
  const s = read(f);
  if (s) expect(s.includes(SLUG), `${f} must register ${SLUG}.`);
}
const manifestRaw = read('content/national-show-routes.json');
if (manifestRaw) {
  const manifest = JSON.parse(manifestRaw);
  const routes = Array.isArray(manifest) ? manifest : manifest.routes ?? [];
  const entry = routes.find((r) => r.slug === SLUG);
  expect(entry && entry.listed === false && entry.indexable === false, `${SLUG} manifest entry must have listed:false and indexable:false.`);
}

// --- 6. No new secret / env var ----------------------------------------------------------------
for (const f of ['apphosting.yaml', '.env.local.example']) {
  const s = read(f);
  if (s) expect(!/PHOTO/i.test(s), `${f} must not gain a photo-resume secret (shared VENDOR_STAND_PAYMENT_TOKEN_SECRET is reused).`);
}

// --- 7. Untouched: the single-use gate and the upload API --------------------------------------
const UNTOUCHED = [
  'app/api/vendors/[id]/marketing-asset/route.ts',
  'lib/vendor-marketing-upload-handler.ts',
  'lib/vendor-marketing-upload.ts',
  'lib/vendor-stand-payment-token.ts',
  'lib/vendor-registration-token.ts',
  'lib/vendor-registration-token-claim.ts',
  'app/api/vendors/register/route.ts',
  'app/(marketing)/national-show/vendors/register/page.tsx',
];
try {
  execFileSync('git', ['diff', '--quiet', BASE, '--', ...UNTOUCHED], { stdio: 'pipe' });
} catch (err) {
  failures.push(`one of the single-use-gate / upload-API files differs from base ${BASE} (exit ${err.status}); this feature must not change: ${UNTOUCHED.join(', ')}`);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}
console.log('PASS: photo-resume feature is wired as specified and the single-use gate is untouched.');
