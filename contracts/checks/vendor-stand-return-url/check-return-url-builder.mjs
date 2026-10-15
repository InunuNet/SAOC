#!/usr/bin/env node
// lib/vendor-stand-return.ts buildVendorStandReturnUrl() and the attempt-id gate. Pure unit
// check: no Firestore, no network, no live data. Proves the gateway return URL is short enough
// for Ozow's String(150) SuccessUrl/ErrorUrl/CancelUrl caps with a deliberately oversized
// siteUrl, carries exactly one query key (`a`, the 16-hex per-attempt correlator) and nothing
// that is a signed token, a submission id, a status flag, or PII.
//
// Run as: node contracts/checks/vendor-stand-return-url/check-return-url-builder.mjs

const OZOW_URL_CAP = 150;
const failures = [];
const expect = (cond, msg) => { if (!cond) failures.push(msg); };

let mod;
try {
  mod = await import('../../../lib/vendor-stand-return.ts');
} catch (error) {
  console.error(`FAIL: lib/vendor-stand-return.ts is missing or does not load: ${error.message}`);
  process.exit(1);
}
const { VENDOR_STAND_RETURN_PATH, ATTEMPT_ID_PATTERN, buildVendorStandReturnUrl } = mod;

expect(VENDOR_STAND_RETURN_PATH === '/vsp', `VENDOR_STAND_RETURN_PATH must be /vsp, got ${VENDOR_STAND_RETURN_PATH}`);
expect(ATTEMPT_ID_PATTERN instanceof RegExp && ATTEMPT_ID_PATTERN.test('0123456789abcdef') && !ATTEMPT_ID_PATTERN.test('0123456789ABCDEF') && !ATTEMPT_ID_PATTERN.test('0123456789abcdef0') && !ATTEMPT_ID_PATTERN.test('0123456789abcdef\n'), 'ATTEMPT_ID_PATTERN must be exactly ^[0-9a-f]{16}$ (anchored, lowercase, no trailing newline).');

const ATTEMPT = '0123456789abcdef';
// 60-char siteUrl: longer than every realistic host, so a host change cannot silently re-break Ozow.
const BIG_SITE = `https://${'a'.repeat(41)}.saoc.co.za`;
expect(BIG_SITE.length === 60, 'test setup: BIG_SITE must be 60 chars.');
const SITES = ['https://saoc.co.za', 'https://beta.saoc.co.za', 'https://saoc-prod--saoc-webapp.europe-west4.hosted.app', BIG_SITE];

let worst = 0;
for (const site of SITES) {
  const url = buildVendorStandReturnUrl(site, ATTEMPT);
  worst = Math.max(worst, url.length);
  expect(url.length <= OZOW_URL_CAP, `URL for ${site} is ${url.length} chars (> ${OZOW_URL_CAP}).`);
  const parsed = new URL(url);
  expect(url === `${site}${VENDOR_STAND_RETURN_PATH}?a=${ATTEMPT}`, `URL shape must be <siteUrl>${VENDOR_STAND_RETURN_PATH}?a=<attemptId>, got ${url}`);
  expect([...parsed.searchParams.keys()].join(',') === 'a', `query must carry exactly one key, a; got ${[...parsed.searchParams.keys()].join(',')}`);
  expect(!/token|paid|status|email|@|\.[A-Za-z0-9_-]{20,}/i.test(parsed.search + parsed.hash), 'query/hash must not look like a token, a status flag, or PII.');
  expect(parsed.hash === '', 'no fragment.');
}
// Trailing slash on siteUrl must not double up (resolveSiteUrl strips it, but the builder is the last line).
expect(buildVendorStandReturnUrl('https://saoc.co.za/', ATTEMPT) === `https://saoc.co.za${VENDOR_STAND_RETURN_PATH}?a=${ATTEMPT}`, 'a trailing-slash siteUrl must not produce //.');

// Malformed attempt ids must throw (never build a URL from untrusted or oversized input).
const golden = JSON.parse((await import('node:fs')).readFileSync(new URL('../../../.agent/memory/project/specs/vendor-flow-fixes/goldens/f4/return-state-matrix.json', import.meta.url), 'utf8'));
for (const bad of golden.malformedAttemptIds) {
  let threw = false;
  try { buildVendorStandReturnUrl('https://saoc.co.za', bad); } catch { threw = true; }
  expect(threw, `builder must throw for malformed attempt id ${JSON.stringify(bad)}.`);
}

// Length budget statement: the computed maximum host length that still fits.
const fixed = `${VENDOR_STAND_RETURN_PATH}?a=${ATTEMPT}`.length;
expect(fixed === 23, `path+query must be 23 chars, got ${fixed}.`);
expect(OZOW_URL_CAP - fixed >= 120, `the cap must leave >= 120 chars of siteUrl headroom, got ${OZOW_URL_CAP - fixed}.`);

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}
console.log(`PASS: return URL is path+query ${fixed} chars; worst case over ${SITES.length} hosts (up to 60 chars) is ${worst} <= ${OZOW_URL_CAP}; ${OZOW_URL_CAP - fixed} chars of siteUrl headroom; no token, id, status or PII.`);
