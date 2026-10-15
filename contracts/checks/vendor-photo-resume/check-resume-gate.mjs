#!/usr/bin/env node
// lib/vendor-photo-resume-gate.ts resolveVendorPhotoResumeState() against the golden
// resume-state-matrix.json, with an injected in-memory loadSubmission (no Firestore, no live
// data). Proves: invalid/expired/forged/other-domain tokens and an unset secret never reach the
// loader; a valid token loads EXACTLY its own submission id and nothing else; rejected and
// missing submissions are indistinguishable from a bad token ({kind:'invalid'}); missing-slot
// computation matches the admin table's rule; the resolved state is a closed shape that never
// echoes PII or storage paths from the loaded document.
//
// Run as: node contracts/checks/vendor-photo-resume/check-resume-gate.mjs

import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

const { resolveVendorPhotoResumeState } = await import('../../../lib/vendor-photo-resume-gate.ts');
const { mintVendorPhotoResumeToken } = await import('../../../lib/vendor-photo-resume-token.ts');

const matrix = JSON.parse(
  readFileSync(new URL('../../../.agent/memory/project/specs/vendor-flow-fixes/goldens/f2/resume-state-matrix.json', import.meta.url), 'utf8'),
);

const SECRET = 'fixture-secret-0123456789abcdef';
const ID = matrix.submissionId;
const NOW = new Date(matrix.now);
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64url');
const hmac = (data) => createHmac('sha256', SECRET).update(data).digest('hex');

const valid = mintVendorPhotoResumeToken({ vendorSubmissionId: ID, secret: SECRET, now: NOW }).token;
const [validPayload, validSig] = valid.split('.');
const tokens = {
  empty: '',
  malformed: 'not-a-token',
  valid,
  expired: mintVendorPhotoResumeToken({ vendorSubmissionId: ID, secret: SECRET, now: new Date(NOW.getTime() - 5000), ttlMs: 1000 }).token,
  'tampered-signature': `${validPayload}.${validSig.slice(0, -1)}${validSig.endsWith('0') ? '1' : '0'}`,
  'tampered-payload': `${b64({ ...JSON.parse(Buffer.from(validPayload, 'base64url').toString('utf8')), u: 'SomeOtherSubmission99' })}.${validSig}`,
  'stand-payment-shaped': (() => { const p = b64({ s: ID, e: NOW.getTime() + 86400000, n: 'abcd' }); return `${p}.${hmac(p)}`; })(),
  'registration-shaped': (() => { const p = b64({ a: ID, e: NOW.getTime() + 86400000, g: 0 }); return `${p}.${hmac(p)}`; })(),
};

const PII_DOC = {
  businessName: 'Leak Test Nursery',
  contactPersonName: 'Leak Person',
  contactEmail: 'leak@example.test',
  contactPhone: '+27 82 000 0000',
};
const ALLOWED_KEYS = { invalid: ['kind'], complete: ['kind'], upload: ['kind', 'missingSlots', 'uploadedCount', 'vendorSubmissionId'] };

const failures = [];
for (const c of matrix.cases) {
  const calls = [];
  const doc = c.submission === null ? null : { ...PII_DOC, ...c.submission };
  const secret = 'secret' in c ? c.secret ?? undefined : SECRET;
  let state;
  try {
    state = await resolveVendorPhotoResumeState({
      token: tokens[c.token],
      secret,
      now: NOW,
      loadSubmission: async (id) => { calls.push(id); return doc; },
    });
  } catch (err) {
    failures.push(`[${c.name}] resolver threw: ${err instanceof Error ? err.message : err}`);
    continue;
  }
  if (calls.length !== c.loaderCalls) failures.push(`[${c.name}] loadSubmission called ${calls.length}x, expected ${c.loaderCalls}.`);
  if (calls.some((id) => id !== ID)) failures.push(`[${c.name}] loadSubmission called with an id other than the token's (${calls.join(',')}).`);
  if (state.kind !== c.expect.kind) { failures.push(`[${c.name}] kind ${state.kind}, expected ${c.expect.kind}.`); continue; }
  const allowed = ALLOWED_KEYS[state.kind];
  const extra = Object.keys(state).filter((k) => !allowed.includes(k));
  if (extra.length) failures.push(`[${c.name}] state carries unexpected keys: ${extra.join(',')}.`);
  if (state.kind === 'upload') {
    if (JSON.stringify(state.missingSlots) !== JSON.stringify(c.expect.missingSlots)) failures.push(`[${c.name}] missingSlots ${JSON.stringify(state.missingSlots)}, expected ${JSON.stringify(c.expect.missingSlots)}.`);
    if (state.uploadedCount !== c.expect.uploadedCount) failures.push(`[${c.name}] uploadedCount ${state.uploadedCount}, expected ${c.expect.uploadedCount}.`);
    if (state.vendorSubmissionId !== ID) failures.push(`[${c.name}] upload state must name the token's submission id.`);
  }
  const serialised = JSON.stringify(state);
  for (const s of matrix.piiSentinels) {
    if (serialised.includes(s)) failures.push(`[${c.name}] resolved state leaks "${s}".`);
  }
}

// Source hygiene: the gate must be read-only and relative-import so this check can load it.
const src = readFileSync(new URL('../../../lib/vendor-photo-resume-gate.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
if (/firebase|\.set\(|\.update\(|\.add\(|\.delete\(|console\./.test(src)) failures.push('gate module must not import firebase, write, or log.');
if (/from '@\//.test(src)) failures.push("gate module must use relative './x.ts' imports (no '@/' alias) so it is loadable outside Next.");

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}
console.log(`PASS: resume gate satisfies all ${matrix.cases.length} golden cases.`);
