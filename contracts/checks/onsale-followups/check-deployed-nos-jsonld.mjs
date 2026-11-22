// onsale-followups RUN-AFTER-DEPLOY check: the deployed NOS /national-show Event JSON-LD offers equal a PINNED set
// exactly (no missing, no extra, prices equal), carry the active show's VIP price, and no wrong-show price. Plain check,
// not the browser_deployed_check kind: that kind's live re-check sends no auth and beta answers 401 behind the Basic Auth
// wall (backlog 2026-10-07, execution/browser_deployed_check.sh:188). Credentials are read from BETA_BASIC_AUTH_USER /
// BETA_BASIC_AUTH_PASSWORD inside this script and never printed.
// PRICES ARE PINNED: the expected set lives in the contract's A10 command (EXPECT_OFFERS="slug:price,slug:price"). The
// page builds offers from fixed product slots (lib/data/ticket-card-view-models.ts) that this check does not mirror, so
// when a ticket price or product legitimately changes, update the EXPECT_OFFERS value in contract.yaml (A10) to match.
// Run as: EXPECT_OFFERS=... node --env-file-if-exists=.env.local <this file>   (from the project root, after deploy)
// Env: EXPECT_OFFERS (required for a PASS), NOS_ORIGIN (default https://nos.saoc.co.za), EXPECT_VIP_PRICE (default 350,
// Lee-Ann's 16 Nov list, lib/provisional-figures.ts vip), WRONG_SHOW_PRICE (default 999), WRONG_SHOW_SLUG (default fictional-test-show-general-admission).
// Exit 0 PASS, 1 FAIL (a real finding), 77 inconclusive (EXPECT_OFFERS unset/empty, credentials missing or host
// unreachable: contract.py reads 77 as a skip), MALFORMED_EXIT (5) EXPECT_OFFERS is malformed (missing price, non-numeric
// price, duplicate slug, empty slug): a configuration error, never a silent pass.
// `--self-test` exercises the parser and the comparison on synthetic data only (no network, no env). It is NOT a check
// run and never prints PASS: it prints `SELFTEST OK` and exits SELFTEST_OK_EXIT (3), or prints `SELFTEST FAIL` lines and
// exits SELFTEST_FAIL_EXIT (4). Neither code is 0, 1, 5 or 77, so a caller cannot read it as a check verdict.
const SELFTEST_OK_EXIT = 3;
const SELFTEST_FAIL_EXIT = 4;
const MALFORMED_EXIT = 5;
const INCONCLUSIVE_EXIT = 77;
const FETCH_TIMEOUT_MS = 20000;

// "slug:price,slug:price" -> { pairs } | { unset } | { error }. Rejects rather than repairs.
const parseExpectOffers = (raw) => {
  if (raw === undefined || raw === null || raw.trim() === '') return { unset: true };
  const pairs = [];
  const seen = new Set();
  for (const entry of raw.split(',').map((e) => e.trim())) {
    const parts = entry.split(':');
    if (parts.length !== 2 || parts[0].trim() === '' || parts[1].trim() === '') return { error: `entry "${entry}" is not slug:price` };
    const slug = parts[0].trim();
    const price = Number(parts[1].trim());
    if (!Number.isFinite(price)) return { error: `entry "${entry}" has a non-numeric price` };
    if (seen.has(slug)) return { error: `duplicate slug "${slug}"` };
    seen.add(slug);
    pairs.push([slug, price]);
  }
  return { pairs };
};

// Exact comparison of the deployed slug -> price map against the pinned map. Returns failure strings.
const compareOffers = (expected, got) => {
  const failures = [];
  for (const [slug, price] of got) {
    if (!expected.has(slug)) failures.push(`unexpected offer ${slug} (${price}) is not in the pinned set`);
    else if (expected.get(slug) !== price) failures.push(`offer ${slug} price is ${price}, want ${expected.get(slug)}`);
  }
  for (const slug of expected.keys()) if (!got.has(slug)) failures.push(`expected offer ${slug} is missing`);
  return failures;
};

if (process.argv.includes('--self-test')) {
  const problems = [];
  const pinned = new Map([['general-admission', 100], ['vip', 300]]);
  const cases = [
    ['exact match passes', new Map([['vip', 300], ['general-admission', 100]]), 0],
    ['extra offer fails', new Map([['vip', 300], ['general-admission', 100], ['extra', 50]]), 1],
    ['missing offer fails', new Map([['vip', 300]]), 1],
    ['wrong price fails', new Map([['vip', 300], ['general-admission', 90]]), 1],
  ];
  for (const [name, got, wantFailures] of cases) {
    const failures = compareOffers(pinned, got);
    console.log(`selftest ${name}: ${failures.length} failure(s)`);
    if (failures.length !== wantFailures) problems.push(`${name}: ${failures.length} failures, want ${wantFailures}`);
  }
  for (const raw of [undefined, '', '   ']) {
    const r = parseExpectOffers(raw);
    console.log(`selftest unset ${JSON.stringify(raw ?? null)} -> ${r.unset ? 'inconclusive (77)' : 'parsed'}`);
    if (!r.unset) problems.push(`EXPECT_OFFERS ${JSON.stringify(raw)} should be unset/inconclusive`);
  }
  for (const raw of ['a', 'a:', ':5', 'a:x', 'a:1,a:2', 'a:1,', 'a:1:2']) {
    const r = parseExpectOffers(raw);
    console.log(`selftest malformed ${JSON.stringify(raw)} -> ${r.error ?? 'ACCEPTED'}`);
    if (!r.error) problems.push(`EXPECT_OFFERS ${JSON.stringify(raw)} should be malformed`);
  }
  const ok = parseExpectOffers(' a:1 , b:2.5 ');
  if (!ok.pairs || ok.pairs.length !== 2 || ok.pairs[1][1] !== 2.5) problems.push('valid EXPECT_OFFERS did not parse');
  if (problems.length) { for (const p of problems) console.error(`SELFTEST FAIL: ${p}`); process.exit(SELFTEST_FAIL_EXIT); }
  console.log(`SELFTEST OK: parser and exact comparison behave (not a check verdict, exit ${SELFTEST_OK_EXIT})`);
  process.exit(SELFTEST_OK_EXIT);
}

const parsed = parseExpectOffers(process.env.EXPECT_OFFERS);
if (parsed.unset) { console.error('INCONCLUSIVE: EXPECT_OFFERS is not set; the pinned offer set lives in the contract A10 command'); process.exit(INCONCLUSIVE_EXIT); }
if (parsed.error) { console.error(`ERROR: EXPECT_OFFERS is malformed: ${parsed.error}`); process.exit(MALFORMED_EXIT); }

const ORIGIN = process.env.NOS_ORIGIN ?? 'https://nos.saoc.co.za';
const EXPECT_VIP = Number(process.env.EXPECT_VIP_PRICE ?? 350);
const WRONG_PRICE = Number(process.env.WRONG_SHOW_PRICE ?? 999);
const WRONG_SLUG = process.env.WRONG_SHOW_SLUG ?? 'fictional-test-show-general-admission';
const user = process.env.BETA_BASIC_AUTH_USER;
const pass = process.env.BETA_BASIC_AUTH_PASSWORD;
if (!user || !pass) { console.error('INCONCLUSIVE: BETA_BASIC_AUTH_USER / BETA_BASIC_AUTH_PASSWORD not set (run from the project root with .env.local)'); process.exit(INCONCLUSIVE_EXIT); }

let res;
let html;
try {
  res = await fetch(`${ORIGIN}/national-show`, { headers: { authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  html = await res.text();
} catch (error) {
  console.error(`INCONCLUSIVE: could not reach ${ORIGIN}/national-show (${error.name})`);
  process.exit(INCONCLUSIVE_EXIT);
}
if (res.status !== 200) { console.error(`FAIL: ${ORIGIN}/national-show returned ${res.status}, want 200`); process.exit(1); }

const nodes = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => {
  try { const v = JSON.parse(m[1]); return Array.isArray(v) ? v : [v]; } catch { return []; }
});
const offers = nodes.filter((n) => n && n['@type'] === 'Event').flatMap((n) => (Array.isArray(n.offers) ? n.offers : n.offers ? [n.offers] : []));
if (offers.length === 0) { console.error('FAIL: no Event JSON-LD offers on /national-show'); process.exit(1); }
const slugOf = (o) => String(o.url ?? '').split('/').pop();
const got = new Map(offers.map((o) => [slugOf(o), Number(o.price)]));
console.log(`deployed offers: ${[...got].map(([s, p]) => `${s}:${p}`).join(',')}`);

const expected = new Map(parsed.pairs);
const failures = compareOffers(expected, got);
if (got.size !== offers.length) failures.push('duplicate offer slugs in the JSON-LD');
if (!got.has('vip')) failures.push('no VIP offer');
else if (got.get('vip') !== EXPECT_VIP) failures.push(`VIP offer price is ${got.get('vip')}, want ${EXPECT_VIP}`);
for (const [slug, price] of got) {
  if (price === WRONG_PRICE) failures.push(`offer ${slug} carries the wrong-show price ${WRONG_PRICE}`);
  if (slug === WRONG_SLUG) failures.push(`an offer links the wrong-show type ${WRONG_SLUG}`);
}
if (failures.length) { for (const f of failures) console.error(`FAIL: ${f}`); process.exit(1); }
console.log(`PASS: ${ORIGIN}/national-show JSON-LD, ${offers.length} offer(s) equal the pinned set exactly, VIP ${got.get('vip')}`);
