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
// or negative price, duplicate slug, empty slug): a configuration error, never a silent pass.
// Offers are read from every Event node in every ld+json script (top level, arrays, @graph; @type string or array;
// offers array or single object). Each offer needs a finite non-negative price (number or plain decimal string) and a
// url of exactly `<NOS_ORIGIN>/tickets/<slug>` (what lib/data/national-show-offers.ts emits); anything else FAILs.
// `--self-test` runs the same extraction, parser and comparison functions on synthetic data only (no network, no env). It
// is NOT a check run and never prints PASS: it prints `SELFTEST OK` and exits SELFTEST_OK_EXIT (3), or prints
// `SELFTEST FAIL` lines and exits SELFTEST_FAIL_EXIT (4). Neither code is 0, 1, 5 or 77, so a caller cannot read it as a verdict.
const SELFTEST_OK_EXIT = 3;
const SELFTEST_FAIL_EXIT = 4;
const MALFORMED_EXIT = 5;
const INCONCLUSIVE_EXIT = 77;
const FETCH_TIMEOUT_MS = 20000;
const TICKET_PATH = /^\/tickets\/([^/]+)$/;
const PLAIN_DECIMAL = /^\d+(\.\d+)?$/;

// A finite non-negative number, or a string that is a plain decimal after trimming; anything else is null.
const parsePrice = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
  if (typeof v === 'string' && PLAIN_DECIMAL.test(v.trim())) return Number(v.trim());
  return null;
};

// "slug:price,slug:price" -> { pairs } | { unset } | { error }. Rejects rather than repairs.
const parseExpectOffers = (raw) => {
  if (raw === undefined || raw === null || raw.trim() === '') return { unset: true };
  const pairs = [];
  const seen = new Set();
  for (const entry of raw.split(',').map((e) => e.trim())) {
    const parts = entry.split(':');
    if (parts.length !== 2 || parts[0].trim() === '' || parts[1].trim() === '') return { error: `entry "${entry}" is not slug:price` };
    const slug = parts[0].trim();
    const price = parsePrice(parts[1]);
    if (price === null) return { error: `entry "${entry}" has a non-numeric or negative price` };
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

const isEventNode = (n) => n !== null && typeof n === 'object' && (n['@type'] === 'Event' || (Array.isArray(n['@type']) && n['@type'].includes('Event')));
// Every node reachable through arrays and @graph.
const flattenNodes = (v) => {
  if (Array.isArray(v)) return v.flatMap(flattenNodes);
  if (v === null || typeof v !== 'object') return [];
  return [v, ...flattenNodes(v['@graph'] ?? [])];
};

// All offers of every Event node in every ld+json script, plus structural problems (unparseable script, odd offer).
const extractOffers = (html) => {
  const problems = [];
  const offers = [];
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    let parsedJson;
    try { parsedJson = JSON.parse(m[1]); } catch { problems.push('an ld+json script is not valid JSON'); continue; }
    for (const node of flattenNodes(parsedJson).filter(isEventNode)) {
      for (const o of [].concat(node.offers ?? [])) {
        if (o === null || typeof o !== 'object' || Array.isArray(o)) problems.push('an Event offer is not an object');
        else offers.push(o);
      }
    }
  }
  return { offers, problems };
};

// The slug of an offer url `<origin>/tickets/<slug>`, or null when the origin, path shape or url itself differs.
const offerSlug = (url, origin) => {
  if (typeof url !== 'string') return null;
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.origin !== new URL(origin).origin || u.search !== '' || u.hash !== '') return null;
  const m = TICKET_PATH.exec(u.pathname);
  return m ? decodeURIComponent(m[1]) : null;
};

// The whole verdict on a page: failure strings plus the deployed slug -> price map. Shared by the real run and --self-test.
const evaluatePage = (html, { origin, expected, vipPrice, wrongPrice, wrongSlug }) => {
  const { offers, problems } = extractOffers(html);
  const failures = [...problems];
  if (offers.length === 0 && problems.length === 0) failures.push('no Event JSON-LD offers on /national-show');
  const got = new Map();
  offers.forEach((o, i) => {
    const slug = offerSlug(o.url, origin);
    const price = parsePrice(o.price);
    const label = `offer #${i + 1} (${JSON.stringify(o.name ?? null)}, url ${JSON.stringify(o.url ?? null)})`;
    if (slug === null) { failures.push(`${label} url is not ${origin}/tickets/<slug>`); return; }
    if (price === null) { failures.push(`${label} price ${JSON.stringify(o.price ?? null)} is not a finite non-negative number`); return; }
    if (got.has(slug)) { failures.push(`duplicate deployed offer slug ${slug}`); return; }
    got.set(slug, price);
  });
  failures.push(...compareOffers(expected, got));
  if (!got.has('vip')) failures.push('no VIP offer');
  else if (got.get('vip') !== vipPrice) failures.push(`VIP offer price is ${got.get('vip')}, want ${vipPrice}`);
  for (const [slug, price] of got) {
    if (price === wrongPrice) failures.push(`offer ${slug} carries the wrong-show price ${wrongPrice}`);
    if (slug === wrongSlug) failures.push(`an offer links the wrong-show type ${wrongSlug}`);
  }
  return { failures, got };
};

if (process.argv.includes('--self-test')) {
  const problems = [];
  const ORIGIN_T = 'https://nos.example';
  const ctx = { origin: ORIGIN_T, expected: new Map([['general-admission', 100], ['vip', 300]]), vipPrice: 300, wrongPrice: 999, wrongSlug: 'wrong-show' };
  const vipOnly = { ...ctx, expected: new Map([['vip', 300]]) };
  const offer = (slug, price, url = `${ORIGIN_T}/tickets/${slug}`) => ({ '@type': 'Offer', price, url });
  const ld = (...vals) => vals.map((v) => `<script type="application/ld+json">${JSON.stringify(v)}</script>`).join('');
  const event = (offers) => ({ '@type': 'Event', offers });
  const base = [offer('general-admission', 100), offer('vip', 300)];
  const withGa = (o) => ld(event([o, offer('vip', 300)]));
  const pageCases = [
    ['exact match passes', ld(event(base)), 0],
    ['extra offer fails', ld(event([...base, offer('extra', 50)])), 1],
    ['missing offer fails', ld(event([offer('vip', 300)])), 1],
    ['wrong price fails', withGa(offer('general-admission', 90)), 1],
    ['@graph-nested Event passes when exact', ld({ '@graph': [event(base)] }), 0],
    ['@graph-nested extra offer fails', ld(event(base), { '@graph': [event([offer('extra', 50)])] }), 1],
    ['array @type Event is found (extra offer fails)', ld({ '@type': ['Thing', 'Event'], offers: [...base, offer('extra', 50)] }), 1],
    ['single-object offers is read', ld(event(offer('vip', 300))), 0, vipOnly],
    ['empty-string price fails', withGa(offer('general-admission', '')), 1],
    ['whitespace price fails', withGa(offer('general-admission', '  ')), 1],
    ['null price fails', withGa(offer('general-admission', null)), 1],
    ['false price fails', withGa(offer('general-admission', false)), 1],
    ['numeric-string price passes', ld(event([offer('general-admission', ' 100 '), offer('vip', '300')])), 0],
    ['negative price fails', withGa(offer('general-admission', -1)), 1],
    ['foreign-origin url fails', ld(event([offer('general-admission', 100), offer('vip', 300, 'https://example.com/tickets/vip')])), 1],
    ['other-show path fails', ld(event([offer('general-admission', 100), offer('vip', 300, `${ORIGIN_T}/other-show/vip`)])), 1],
    ['missing url fails', ld(event([offer('general-admission', 100), { '@type': 'Offer', price: 300 }])), 1],
    ['duplicate deployed slug fails', ld(event([...base, offer('vip', 300)])), 1],
    ['no Event offers fails', ld({ '@type': 'Thing' }), 1],
  ];
  for (const [name, html, wantFailing, useCtx = ctx] of pageCases) {
    const { failures } = evaluatePage(html, useCtx);
    console.log(`selftest ${name}: ${failures.length} failure(s)`);
    if ((failures.length > 0 ? 1 : 0) !== wantFailing) problems.push(`${name}: ${failures.length} failures, want ${wantFailing ? 'some' : 'none'}`);
  }
  for (const raw of [undefined, '', '   ']) {
    const r = parseExpectOffers(raw);
    console.log(`selftest unset ${JSON.stringify(raw ?? null)} -> ${r.unset ? 'inconclusive (77)' : 'parsed'}`);
    if (!r.unset) problems.push(`EXPECT_OFFERS ${JSON.stringify(raw)} should be unset/inconclusive`);
  }
  for (const raw of ['a', 'a:', ':5', 'a:x', 'a:1,a:2', 'a:1,', 'a:1:2', 'a:-5', 'a:1e3', 'a:0x10']) {
    const r = parseExpectOffers(raw);
    console.log(`selftest malformed ${JSON.stringify(raw)} -> ${r.error ?? 'ACCEPTED'}`);
    if (!r.error) problems.push(`EXPECT_OFFERS ${JSON.stringify(raw)} should be malformed`);
  }
  const ok = parseExpectOffers(' a:1 , b:2.5 ');
  if (!ok.pairs || ok.pairs.length !== 2 || ok.pairs[1][1] !== 2.5) problems.push('valid EXPECT_OFFERS did not parse');
  if (problems.length) { for (const p of problems) console.error(`SELFTEST FAIL: ${p}`); process.exit(SELFTEST_FAIL_EXIT); }
  console.log(`SELFTEST OK: extraction, parser and exact comparison behave (not a check verdict, exit ${SELFTEST_OK_EXIT})`);
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

const { failures, got } = evaluatePage(html, { origin: ORIGIN, expected: new Map(parsed.pairs), vipPrice: EXPECT_VIP, wrongPrice: WRONG_PRICE, wrongSlug: WRONG_SLUG });
console.log(`deployed offers: ${[...got].map(([s, p]) => `${s}:${p}`).join(',')}`);
if (failures.length) { for (const f of failures) console.error(`FAIL: ${f}`); process.exit(1); }
console.log(`PASS: ${ORIGIN}/national-show JSON-LD, ${got.size} offer(s) equal the pinned set exactly, VIP ${got.get('vip')}`);
