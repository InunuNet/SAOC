// Proves the harness discriminates: a reference-good handler passes every scenario,
// and each mutant fails at least the scenarios named. Does not touch the real route.
require('tsx/cjs');
const { runScenarios, CAP } = require('./lib-harness.cjs');
const { NextResponse } = require('next/server');
const { getAuth } = require('firebase-admin/auth');
const j = (b, s) => NextResponse.json(b, { status: s });

async function readCapped(req, cap, check) {
  const reader = req.body.getReader(); const parts = []; let n = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.length; if (n > cap) { await reader.cancel(); return null; } parts.push(value); }
  return Buffer.concat(parts).toString('utf8');
}
async function tail(text) {
  let p; try { p = JSON.parse(text); } catch { return j({ error: 'bad' }, 400); }
  if (typeof p !== 'object' || p === null || Array.isArray(p)) return j({}, 400);
  if (typeof p.idToken !== 'string' || !p.idToken) return j({}, 400);
  await getAuth().verifyIdToken(p.idToken, true);
  return j({ status: 'ok' }, 200);
}
const good = async (req) => { const t = await readCapped(req, CAP); if (t === null) return j({}, 413); return tail(t); };
// M1: cap removed
const mNoCap = async (req) => tail(await req.text());
// M2: cap checked only AFTER the whole body is read and parsed (reads unbounded)
const mAfterParse = async (req) => { const t = await req.text(); if (Buffer.byteLength(t) > CAP) return j({}, 413); return tail(t); };
// M3: Content-Length-only gate
const mHeaderOnly = async (req) => { if (Number(req.headers.get('content-length') || 0) > CAP) return j({}, 413); return tail(await req.text()); };
// M4: cap applied but after verifyIdToken
const mAfterVerify = async (req) => { const t = await readCapped(req, CAP); let p; try { p = JSON.parse(t ?? ''); if (p && p.idToken) await getAuth().verifyIdToken(p.idToken, true); } catch {} if (t === null) return j({}, 413); return tail(t); };

(async () => {
  let fail = 0;
  const g = await runScenarios(good);
  const gb = g.filter((x) => !x.ok);
  console.log(`good: ${g.length - gb.length}/${g.length}`); if (gb.length) { fail++; console.log(gb); }
  for (const [name, h] of [['no-cap', mNoCap], ['cap-after-parse', mAfterParse], ['content-length-only', mHeaderOnly], ['cap-after-verify', mAfterVerify]]) {
    const r = await runScenarios(h); const killed = r.filter((x) => !x.ok).length;
    console.log(`mutant ${name}: killed by ${killed} scenario(s)`); if (!killed) fail++;
  }
  process.exit(fail ? 1 : 0);
})();
