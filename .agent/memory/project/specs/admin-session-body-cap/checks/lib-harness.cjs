// Scenario harness for POST /api/admin/session body cap. Drives a POST handler with
// firebase-admin/auth, next/headers and lib/firebase-admin stubbed; counts verifyIdToken
// calls and bytes pulled from the request stream. Used both on the real route (run.cjs)
// and on reference good/mutant handlers (selftest.cjs).
const Module = require('module');
const CAP = 4096;
const state = { verifyCalls: 0, createCalls: 0 };
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'next/headers') return { cookies: async () => ({ set() {}, get() {} }) };
  if (request === 'firebase-admin/auth') {
    return {
      getAuth: () => ({
        verifyIdToken: async () => { state.verifyCalls++; return { admin: true, email_verified: true, email: 'a@b.c', uid: 'u' }; },
        createSessionCookie: async () => { state.createCalls++; return 'cookie'; },
      }),
    };
  }
  if (request === '@/lib/firebase-admin') return { initAdmin: () => ({}) };
  if (request === '@/lib/admin-auth') return { isAdminToken: () => true, classifyRefusal: () => 'stub' };
  return origLoad.apply(this, arguments);
};

// A request whose body is an endless/long stream and which UNDER-DECLARES (or omits) Content-Length.
function streamRequest(totalBytes, declared) {
  const { NextRequest } = require('next/server');
  const chunk = new Uint8Array(1024).fill(0x61); // 'a'
  let pulled = 0;
  const body = new ReadableStream({
    pull(ctl) {
      if (pulled >= totalBytes) { ctl.close(); return; }
      const n = Math.min(chunk.length, totalBytes - pulled);
      pulled += n;
      ctl.enqueue(chunk.subarray(0, n));
    },
  });
  const headers = { 'content-type': 'application/json' };
  if (declared !== undefined) headers['content-length'] = String(declared);
  const req = new NextRequest('http://localhost/api/admin/session', { method: 'POST', headers, body, duplex: 'half' });
  return { req, pulled: () => pulled };
}
function jsonRequest(text) {
  const { NextRequest } = require('next/server');
  return new NextRequest('http://localhost/api/admin/session', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: text,
  });
}
const tokenOfLength = (n) => 'x'.repeat(n);

// Returns [{id, ok, detail}]
async function runScenarios(POST) {
  const out = [];
  const rec = (id, ok, detail) => out.push({ id, ok, detail });
  const reset = () => { state.verifyCalls = 0; state.createCalls = 0; };

  // S1: huge stream, Content-Length absent -> 413, bounded pull, no verify
  reset();
  let s = streamRequest(50 * 1024 * 1024, undefined);
  let res = await POST(s.req);
  rec('S1-status-413-no-length', res.status === 413, `status ${res.status}`);
  rec('S1-bounded-pull', s.pulled() <= 2 * CAP + 65536, `pulled ${s.pulled()} bytes`);
  rec('S1-no-verify', state.verifyCalls === 0 && state.createCalls === 0, `verify ${state.verifyCalls}`);

  // S2: Content-Length lies (declares 10) but stream is 1 MB -> 413, bounded
  reset();
  s = streamRequest(1024 * 1024, 10);
  res = await POST(s.req);
  rec('S2-status-413-underdeclared', res.status === 413, `status ${res.status}`);
  rec('S2-bounded-pull', s.pulled() <= 2 * CAP + 65536, `pulled ${s.pulled()} bytes`);
  rec('S2-no-verify', state.verifyCalls === 0, `verify ${state.verifyCalls}`);

  // S3: honest oversize Content-Length -> 413 without verify
  reset();
  s = streamRequest(CAP * 4, CAP * 4);
  res = await POST(s.req);
  rec('S3-status-413-declared', res.status === 413, `status ${res.status}`);
  rec('S3-no-verify', state.verifyCalls === 0, `verify ${state.verifyCalls}`);

  // S4: oversize body that is NOT valid JSON still 413 (cap precedes parse)
  reset();
  res = await POST(jsonRequest('{' + 'z'.repeat(CAP + 10)));
  rec('S4-oversize-invalid-json-is-413', res.status === 413, `status ${res.status}`);

  // S5: realistic worst-case token (3000 chars: 1000B claims + standard claims + sig) flows as before
  reset();
  res = await POST(jsonRequest(JSON.stringify({ idToken: tokenOfLength(3000) })));
  rec('S5-large-real-token-200', res.status === 200, `status ${res.status}`);
  rec('S5-verify-once', state.verifyCalls === 1, `verify ${state.verifyCalls}`);

  // S6: body exactly at the cap is accepted (boundary), one byte over rejected
  reset();
  const env = JSON.stringify({ idToken: '' }); // envelope overhead
  const fill = CAP - env.length;
  res = await POST(jsonRequest(JSON.stringify({ idToken: tokenOfLength(fill) })));
  rec('S6-exactly-cap-accepted', res.status === 200, `status ${res.status}`);
  reset();
  res = await POST(jsonRequest(JSON.stringify({ idToken: tokenOfLength(fill + 1) })));
  rec('S6-cap-plus-one-413', res.status === 413, `status ${res.status}`);

  // S7: invalid JSON small stays 400; missing idToken 400; non-object 400
  reset();
  res = await POST(jsonRequest('{nope'));
  rec('S7-invalid-json-400', res.status === 400, `status ${res.status}`);
  res = await POST(jsonRequest('[1]'));
  rec('S7-array-400', res.status === 400, `status ${res.status}`);
  res = await POST(jsonRequest('{}'));
  rec('S7-missing-token-400', res.status === 400, `status ${res.status}`);
  rec('S7-no-verify', state.verifyCalls === 0, `verify ${state.verifyCalls}`);
  return out;
}
module.exports = { runScenarios, CAP, state };
