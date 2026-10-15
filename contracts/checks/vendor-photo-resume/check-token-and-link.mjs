#!/usr/bin/env node
// Vendor photo-resume token (lib/vendor-photo-resume-token.ts) and link builder
// (lib/vendor-photo-resume-link.ts). Pure modules, no Firestore, no network, no live data.
// Proves: round trip; scoped to ONE submission id; payload carries no PII (keys exactly u,e,n);
// 30-day default expiry; expiry is exclusive-at-now; any tamper -> bad-signature; malformed
// shapes -> malformed; wrong secret -> bad-signature; tokens are NOT interchangeable with the
// stand-payment token or a registration-session-shaped token (both directions); the signature
// is domain-separated even under a SHARED secret (a payload signed without the domain prefix
// is refused); two mints differ (nonce); URL builder shape.
//
// Run as: node contracts/checks/vendor-photo-resume/check-token-and-link.mjs

import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

const tokenMod = await import('../../../lib/vendor-photo-resume-token.ts');
const linkMod = await import('../../../lib/vendor-photo-resume-link.ts');
const { mintVendorPhotoResumeToken, verifyVendorPhotoResumeToken, VENDOR_PHOTO_RESUME_TOKEN_DEFAULT_TTL_MS } = tokenMod;
const { buildVendorPhotoUploadUrl, mintVendorPhotoUploadUrl, VENDOR_PHOTO_UPLOAD_PATH } = linkMod;

const failures = [];
const expect = (cond, msg) => { if (!cond) failures.push(msg); };

const SECRET = 'fixture-secret-0123456789abcdef';
const OTHER_SECRET = 'different-secret-0123456789abcdef';
const ID = 'FixtureSubmission0001';
const NOW = new Date('2026-10-14T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64url');
const hmac = (data, secret) => createHmac('sha256', secret).update(data).digest('hex');

// --- default TTL and round trip -----------------------------------------------------------
expect(VENDOR_PHOTO_RESUME_TOKEN_DEFAULT_TTL_MS === 30 * DAY, 'default TTL must be exactly 30 days.');
const minted = mintVendorPhotoResumeToken({ vendorSubmissionId: ID, secret: SECRET, now: NOW });
expect(minted.expiresAt.getTime() === NOW.getTime() + 30 * DAY, 'expiresAt must be now + 30 days.');
const ok = verifyVendorPhotoResumeToken({ token: minted.token, secret: SECRET, now: NOW });
expect(ok.ok === true && ok.vendorSubmissionId === ID, 'fresh token must verify and name the submission id.');
expect(
  verifyVendorPhotoResumeToken({ token: minted.token, secret: SECRET, now: new Date(NOW.getTime() + 30 * DAY - 1) }).ok === true,
  'token must still verify 1ms before expiry.',
);
const atExpiry = verifyVendorPhotoResumeToken({ token: minted.token, secret: SECRET, now: new Date(NOW.getTime() + 30 * DAY) });
expect(atExpiry.ok === false && atExpiry.reason === 'expired', 'token must be expired at exactly expiresAt.');
expect(
  mintVendorPhotoResumeToken({ vendorSubmissionId: ID, secret: SECRET, now: NOW, ttlMs: 1000 }).expiresAt.getTime() === NOW.getTime() + 1000,
  'ttlMs override must be honoured.',
);

// --- not single-use: verifying twice both succeed (no consumed state exists in the module) --
expect(
  verifyVendorPhotoResumeToken({ token: minted.token, secret: SECRET, now: NOW }).ok === true,
  'verification must be repeatable (token is not single-use).',
);

// --- payload shape: u,e,n only, no PII ----------------------------------------------------
const [payloadSegment, signatureSegment] = minted.token.split('.');
const payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8'));
expect(
  JSON.stringify(Object.keys(payload).sort()) === JSON.stringify(['e', 'n', 'u']),
  `payload keys must be exactly e,n,u; got ${Object.keys(payload).sort().join(',')}.`,
);
expect(payload.u === ID, 'payload.u must be the vendorSubmissionId.');
expect(/^[0-9a-f]{64}$/.test(signatureSegment), 'signature must be a 64-char lowercase hex digest.');

// --- uniqueness (nonce) -------------------------------------------------------------------
const second = mintVendorPhotoResumeToken({ vendorSubmissionId: ID, secret: SECRET, now: NOW });
expect(second.token !== minted.token, 'two mints for the same id/now must differ (nonce).');

// --- tamper / secret ----------------------------------------------------------------------
const flipped = signatureSegment.slice(0, -1) + (signatureSegment.endsWith('0') ? '1' : '0');
const sigTamper = verifyVendorPhotoResumeToken({ token: `${payloadSegment}.${flipped}`, secret: SECRET, now: NOW });
expect(sigTamper.ok === false && sigTamper.reason === 'bad-signature', 'flipped signature must be bad-signature.');
const otherPayload = b64({ ...payload, u: 'SomeOtherSubmission99' });
const payloadTamper = verifyVendorPhotoResumeToken({ token: `${otherPayload}.${signatureSegment}`, secret: SECRET, now: NOW });
expect(payloadTamper.ok === false && payloadTamper.reason === 'bad-signature', 'retargeted payload with original signature must be bad-signature.');
const extendedPayload = b64({ ...payload, e: payload.e + 365 * DAY });
const expiryTamper = verifyVendorPhotoResumeToken({ token: `${extendedPayload}.${signatureSegment}`, secret: SECRET, now: NOW });
expect(expiryTamper.ok === false && expiryTamper.reason === 'bad-signature', 'extended expiry with original signature must be bad-signature.');
const wrongSecret = verifyVendorPhotoResumeToken({ token: minted.token, secret: OTHER_SECRET, now: NOW });
expect(wrongSecret.ok === false && wrongSecret.reason === 'bad-signature', 'wrong secret must be bad-signature.');
const uppercased = verifyVendorPhotoResumeToken({ token: `${payloadSegment}.${signatureSegment.toUpperCase()}`, secret: SECRET, now: NOW });
expect(uppercased.ok === false, 'uppercase signature must be refused (well-formed-hex rule).');

// --- malformed ----------------------------------------------------------------------------
for (const bad of ['', 'nodot', '.', 'a.', '.b', '!!!.@@@', `${b64('str')}.${'0'.repeat(64)}`, `${b64({ u: 1, e: 1, n: 'x' })}.${'0'.repeat(64)}`, `${b64({ u: ID, e: 'soon', n: 'x' })}.${'0'.repeat(64)}`, `${b64({ u: ID, e: 1 })}.${'0'.repeat(64)}`]) {
  const r = verifyVendorPhotoResumeToken({ token: bad, secret: SECRET, now: NOW });
  expect(r.ok === false && r.reason === 'malformed', `"${bad.slice(0, 24)}" must be malformed; got ${JSON.stringify(r)}.`);
}

// --- domain separation: other token shapes, same secret ------------------------------------
const standPayload = b64({ s: ID, e: NOW.getTime() + DAY, n: 'abcd' });
const standShaped = `${standPayload}.${hmac(standPayload, SECRET)}`;
expect(verifyVendorPhotoResumeToken({ token: standShaped, secret: SECRET, now: NOW }).ok === false, 'a stand-payment-shaped token must not verify as a photo-resume token.');
const registrationPayload = b64({ a: ID, e: NOW.getTime() + DAY, g: 0 });
const registrationShaped = `${registrationPayload}.${hmac(registrationPayload, SECRET)}`;
expect(verifyVendorPhotoResumeToken({ token: registrationShaped, secret: SECRET, now: NOW }).ok === false, 'a registration-session-shaped token must not verify as a photo-resume token.');
// Right payload shape, signed the way the stand-payment module signs (bare HMAC of the payload
// segment) with the SAME secret: only a real domain prefix in the photo-resume signature
// rejects this.
const barePayload = b64({ u: ID, e: NOW.getTime() + DAY, n: 'abcd' });
const bareSigned = verifyVendorPhotoResumeToken({ token: `${barePayload}.${hmac(barePayload, SECRET)}`, secret: SECRET, now: NOW });
expect(bareSigned.ok === false && bareSigned.reason === 'bad-signature', 'signature must be domain-separated: a bare-HMAC {u,e,n} token under the shared secret must be bad-signature.');
// And the reverse: a photo-resume token fed to the stand-payment verifier's rules (needs `s`).
expect(typeof payload.s === 'undefined', 'photo-resume payload must not carry an `s` key (stand-payment domain).');

// --- link builder -------------------------------------------------------------------------
expect(VENDOR_PHOTO_UPLOAD_PATH === '/national-show/vendors/photos', 'VENDOR_PHOTO_UPLOAD_PATH must be /national-show/vendors/photos.');
const url = buildVendorPhotoUploadUrl({ siteUrl: 'https://example.test///', token: 'a.b/c+d' });
expect(url === `https://example.test/national-show/vendors/photos?token=${encodeURIComponent('a.b/c+d')}`, `builder must trim trailing slashes and encode the token; got ${url}.`);
const mintedUrl = mintVendorPhotoUploadUrl({ vendorSubmissionId: ID, secret: SECRET, now: NOW, siteUrl: 'https://example.test' });
expect(mintedUrl.url.startsWith('https://example.test/national-show/vendors/photos?token='), 'minted URL must use the photos path.');
const roundTripToken = decodeURIComponent(new URL(mintedUrl.url).searchParams.get('token') ?? '');
const rt = verifyVendorPhotoResumeToken({ token: roundTripToken, secret: SECRET, now: NOW });
expect(rt.ok === true && rt.vendorSubmissionId === ID, 'URL token must round-trip to the submission id.');
expect(mintedUrl.expiresAt instanceof Date, 'mintVendorPhotoUploadUrl must return expiresAt as a Date.');

// --- source hygiene: pure modules ---------------------------------------------------------
for (const rel of ['lib/vendor-photo-resume-token.ts', 'lib/vendor-photo-resume-link.ts']) {
  const src = readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8');
  expect(!/firebase|process\.env|Date\.now\(|new Date\(\)/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), `${rel} must be pure: no firebase, process.env, Date.now() or new Date() outside comments.`);
  expect(!/console\./.test(src), `${rel} must contain no logging call.`);
}
const tokenSrc = readFileSync(new URL('../../../lib/vendor-photo-resume-token.ts', import.meta.url), 'utf8');
expect(/from '\.\/recovery-token\.ts'/.test(tokenSrc), "token module must reuse constantTimeEqual/isWellFormedHexDigest via a relative './recovery-token.ts' import.");
expect(!/timingSafeEqual\(/.test(tokenSrc.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), 'token module must not redefine its own constant-time comparison.');

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}
console.log('PASS: photo-resume token + link builder satisfy scope, expiry, tamper, domain-separation and purity.');
