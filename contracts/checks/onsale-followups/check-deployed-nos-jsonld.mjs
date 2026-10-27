// onsale-followups RUN-AFTER-DEPLOY check: the deployed NOS /national-show Event JSON-LD offers carry the active
// show's VIP price and no wrong-show price. Plain check, not the browser_deployed_check kind: that kind's live
// re-check sends no auth and beta answers 401 behind the Basic Auth wall (backlog 2026-10-07,
// execution/browser_deployed_check.sh:188). Credentials are read from BETA_BASIC_AUTH_USER / BETA_BASIC_AUTH_PASSWORD
// inside this script and never printed.
// Run as: node --env-file-if-exists=.env.local <this file>   (from the project root, after the change is deployed)
// Env: NOS_ORIGIN (default https://nos.saoc.co.za), EXPECT_VIP_PRICE (default 300, the Brad-settled live VIP price),
// WRONG_SHOW_PRICE (default 999, the impostor price of the fixture), WRONG_SHOW_SLUG (default fictional-test-show-general-admission).
// Exit 0 PASS, 1 FAIL (a real finding), 77 inconclusive (credentials missing or host unreachable): contract.py reads 77 as a skip.
const ORIGIN = process.env.NOS_ORIGIN ?? 'https://nos.saoc.co.za';
const EXPECT_VIP = Number(process.env.EXPECT_VIP_PRICE ?? 300);
const WRONG_PRICE = Number(process.env.WRONG_SHOW_PRICE ?? 999);
const WRONG_SLUG = process.env.WRONG_SHOW_SLUG ?? 'fictional-test-show-general-admission';
const user = process.env.BETA_BASIC_AUTH_USER;
const pass = process.env.BETA_BASIC_AUTH_PASSWORD;
if (!user || !pass) { console.error('INCONCLUSIVE: BETA_BASIC_AUTH_USER / BETA_BASIC_AUTH_PASSWORD not set (run from the project root with .env.local)'); process.exit(77); }

let res;
let html;
try {
  res = await fetch(`${ORIGIN}/national-show`, { headers: { authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` }, signal: AbortSignal.timeout(20000) });
  html = await res.text();
} catch (error) {
  console.error(`INCONCLUSIVE: could not reach ${ORIGIN}/national-show (${error.name})`);
  process.exit(77);
}
if (res.status !== 200) { console.error(`FAIL: ${ORIGIN}/national-show returned ${res.status}, want 200`); process.exit(1); }

const nodes = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => {
  try { const v = JSON.parse(m[1]); return Array.isArray(v) ? v : [v]; } catch { return []; }
});
const offers = nodes.filter((n) => n && n['@type'] === 'Event').flatMap((n) => (Array.isArray(n.offers) ? n.offers : n.offers ? [n.offers] : []));
if (offers.length === 0) { console.error('FAIL: no Event JSON-LD offers on /national-show'); process.exit(1); }
const slugOf = (o) => String(o.url ?? '').split('/').pop();
const failures = [];
const vip = offers.find((o) => slugOf(o) === 'vip');
if (!vip) failures.push('no VIP offer');
else if (Number(vip.price) !== EXPECT_VIP) failures.push(`VIP offer price is ${vip.price}, want ${EXPECT_VIP}`);
if (offers.some((o) => Number(o.price) === WRONG_PRICE)) failures.push(`an offer carries the wrong-show price ${WRONG_PRICE}`);
if (offers.some((o) => slugOf(o) === WRONG_SLUG)) failures.push(`an offer links the wrong-show type ${WRONG_SLUG}`);
if (failures.length) { for (const f of failures) console.error(`FAIL: ${f}`); process.exit(1); }
console.log(`PASS: ${ORIGIN}/national-show JSON-LD, ${offers.length} offer(s), VIP ${vip.price}, no wrong-show offer`);
