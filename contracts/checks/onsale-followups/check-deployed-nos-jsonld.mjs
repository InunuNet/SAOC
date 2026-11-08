// onsale-followups RUN-AFTER-DEPLOY check: the deployed NOS /national-show Event JSON-LD offers carry the active
// show's VIP price and no wrong-show price. Plain check, not the browser_deployed_check kind: that kind's live
// re-check sends no auth and beta answers 401 behind the Basic Auth wall (backlog 2026-10-07,
// execution/browser_deployed_check.sh:188). Credentials are read from BETA_BASIC_AUTH_USER / BETA_BASIC_AUTH_PASSWORD
// inside this script and never printed.
// Run as: node --env-file-if-exists=.env.local <this file>   (from the project root, after the change is deployed)
// Env: NOS_ORIGIN (default https://nos.saoc.co.za), EXPECT_VIP_PRICE (default 300, the Brad-settled live VIP price),
// WRONG_SHOW_PRICE (default 999, the impostor price of the fixture), WRONG_SHOW_SLUG (default fictional-test-show-general-admission).
// Exit 0 PASS, 1 FAIL (a real finding), 77 inconclusive (credentials missing or host unreachable): contract.py reads 77 as a skip.
// `--self-test` runs the page-listable filter and the effective-price mirror against synthetic rows only (no network,
// no env). It is NOT a check run and never prints PASS: it prints `SELFTEST OK` and exits SELFTEST_OK_EXIT (3), or prints
// `SELFTEST FAIL` lines and exits SELFTEST_FAIL_EXIT (4). Neither code is 0, 1 or 77, so a caller cannot read it as a
// check verdict; a check PASS (exit 0) requires a successful live Sanity query or an explicit EXPECT_OFFERS.
// The page's filters and price logic, copied literally (this plain .mjs cannot import TS); keep them identical to their
// sources: TICKET_CATEGORIES <- lib/data/ticket-hub-source.ts:24; an undefined category counts as admission <-
// activeTicketTypesByCategoryQuery, sanity/queries.ts:157; DEMO_TICKET_TYPE_SLUG <- lib/demo-ticket-type.ts:15, and the
// demo rule (flag OR reserved slug) <- isDemoTicketTypeDoc, lib/demo-ticket-type.ts:35-37.
// REGULAR_PRICE_SIBLING_SLUG <- lib/admission-siblings.ts:4-7; isWithinEarlyBirdWindow <- lib/checkout-reservation.ts:364-372
// (UTC calendar day: the window runs to the START of the UTC day after the cutoff's UTC date, exclusive);
// resolveEffectivePrice <- lib/checkout-reservation.ts:379-388; the regular-price fallback chain (sibling's live price,
// then the row's own regularPrice, then null) <- toTypeInput, lib/data/ticket-hub-source.ts:70-90. A null effective price
// means the page emits no offer for that slug (buildTicketOffers drops a null-price card, lib/ticket-offers.ts:21), so
// that slug is left out of the expected set and any offer carrying it fails as unexpected.
const SELFTEST_OK_EXIT = 3;
const SELFTEST_FAIL_EXIT = 4;
const TICKET_CATEGORIES = ['admission', 'conference', 'workshop-field-trip'];
const DEMO_TICKET_TYPE_SLUG = 'demo-general-admission';
const REGULAR_PRICE_SIBLING_SLUG = { 'weekend-pass-early-bird': 'weekend-pass', 'early-bird': 'day-visitor' };
const isPageListable = (t) =>
  (t.category == null ? true : TICKET_CATEGORIES.includes(t.category)) && !(t.demo === true || t.slug === DEMO_TICKET_TYPE_SLUG);
// lib/checkout-reservation.ts:364-372, same semantics line for line.
const isWithinEarlyBirdWindow = (now, cutoffIso) => {
  if (cutoffIso === null || cutoffIso === undefined) return true;
  const cutoffEndExclusive = new Date(cutoffIso);
  cutoffEndExclusive.setUTCDate(cutoffEndExclusive.getUTCDate() + 1);
  return now.getTime() < cutoffEndExclusive.getTime();
};
// lib/checkout-reservation.ts:379-388, same semantics line for line.
const resolveEffectivePrice = ({ price, regularPrice, earlyBirdCutoff, now }) => {
  if (!earlyBirdCutoff) return price;
  if (isWithinEarlyBirdWindow(now, earlyBirdCutoff)) return price;
  return regularPrice;
};
// toTypeInput + buildHubCards, lib/data/ticket-hub-source.ts:70-105: the page's expected offer set, slug -> effective
// price, from already page-listable rows. The page renders with `new Date()` at ISR time
// (app/(nos)/national-show/page.tsx:246); `now` here is the check's clock, so only a run inside the ISR window
// (revalidate = 60) straddling a UTC cutoff midnight can differ from the served page.
const expectedOffersFrom = (rows, now) => {
  const priceBySlug = Object.fromEntries(rows.map((t) => [t.slug, t.price ?? null]));
  const out = [];
  for (const t of rows) {
    if (typeof t.price !== 'number') continue;
    const sibling = REGULAR_PRICE_SIBLING_SLUG[t.slug];
    const siblingPrice = sibling ? (priceBySlug[sibling] ?? null) : null;
    const effective = resolveEffectivePrice({
      price: t.price,
      regularPrice: siblingPrice ?? t.regularPrice ?? null,
      earlyBirdCutoff: t.earlyBirdCutoff ?? null,
      now,
    });
    if (effective === null) continue;
    out.push([t.slug, effective]);
  }
  return out;
};
if (process.argv.includes('--self-test')) {
  const problems = [];
  const listableCases = [
    [{ slug: 'general-admission', category: 'admission', demo: false }, true],
    [{ slug: 'conference-pass', category: 'conference', demo: null }, true],
    [{ slug: 'field-trip', category: 'workshop-field-trip' }, true],
    [{ slug: 'legacy-admission', category: null }, true],
    [{ slug: 'orchid-mug', category: 'merch', demo: false }, false],
    [{ slug: 'blank-category', category: '' }, false],
    [{ slug: DEMO_TICKET_TYPE_SLUG, category: 'admission', demo: false }, false],
    [{ slug: DEMO_TICKET_TYPE_SLUG, category: 'admission' }, false],
    [{ slug: 'flagged-demo', category: 'admission', demo: true }, false],
  ];
  for (const [row, want] of listableCases) {
    const got = isPageListable(row);
    console.log(`selftest listable ${row.slug} (category ${JSON.stringify(row.category ?? null)}): ${got}`);
    if (got !== want) problems.push(`${row.slug} listable ${got}, want ${want}`);
  }
  // Effective price under a fixed clock so the cases are deterministic. Cutoffs are UTC calendar dates.
  const NOW = new Date('2026-11-08T12:00:00.000Z');
  const priceRows = [
    { slug: 'day-visitor', price: 100, regularPrice: null, earlyBirdCutoff: null },
    { slug: 'early-bird', price: 80, regularPrice: null, earlyBirdCutoff: '2026-10-31' },
    { slug: 'weekend-pass', price: 250, regularPrice: null, earlyBirdCutoff: null },
    { slug: 'weekend-pass-early-bird', price: 200, regularPrice: null, earlyBirdCutoff: '2027-01-31' },
    { slug: 'conference-early', price: 500, regularPrice: 650, earlyBirdCutoff: '2026-11-07' },
    { slug: 'conference-late', price: 500, regularPrice: 650, earlyBirdCutoff: '2026-11-08' },
    { slug: 'orphan-early-bird', price: 40, regularPrice: null, earlyBirdCutoff: '2026-01-01' },
    { slug: 'unpriced', price: null, regularPrice: null, earlyBirdCutoff: null },
  ];
  const wantPrices = {
    'day-visitor': 100,
    'early-bird': 100, // cutoff passed: the sibling day-visitor's live price
    'weekend-pass': 250,
    'weekend-pass-early-bird': 200, // cutoff ahead: its own early-bird price
    'conference-early': 650, // cutoff passed: the row's own regularPrice
    'conference-late': 500, // the cutoff date itself still counts (window closes at the next UTC midnight)
  }; // orphan-early-bird (expired, no regular price) and unpriced yield no offer
  const gotPrices = Object.fromEntries(expectedOffersFrom(priceRows, NOW));
  for (const [slug, price] of Object.entries(gotPrices)) console.log(`selftest expected ${slug}: ${price}`);
  for (const slug of ['orphan-early-bird', 'unpriced']) console.log(`selftest expected ${slug}: ${slug in gotPrices ? gotPrices[slug] : '(no offer)'}`);
  const slugs = new Set([...Object.keys(wantPrices), ...Object.keys(gotPrices)]);
  for (const slug of slugs) if (gotPrices[slug] !== wantPrices[slug]) problems.push(`${slug} expected ${gotPrices[slug]}, want ${wantPrices[slug]}`);
  if (problems.length) { for (const p of problems) console.error(`SELFTEST FAIL: ${p}`); process.exit(SELFTEST_FAIL_EXIT); }
  console.log(`SELFTEST OK: ${listableCases.length} listable rows and ${priceRows.length} price rows behave as the page would (not a check verdict, exit ${SELFTEST_OK_EXIT})`);
  process.exit(SELFTEST_OK_EXIT);
}
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
// Expected offer set. EXPECT_OFFERS="slug:price,slug:price" selects EXACT mode (offer set must equal it). Without it the
// set is derived from LIVE Sanity: the active show's (ACTIVE_SHOW_ID, default show-19-2027) active ticketType documents the
// page can list (isPageListable above: the page's three categories, demo flag or reserved slug excluded), slug -> the
// EFFECTIVE price the page renders now (expectedOffersFrom above: a passed early-bird cutoff yields the regular price),
// read over the non-CDN query API (NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET,
// optional SANITY_API_READ_TOKEN as a Bearer header; read only, nothing printed). It is checked as a SUBSET: any offer
// outside it, or with a different price, fails; an expected type that is absent does not (the hub collapses siblings).
// The live query being unreachable is INCONCLUSIVE (77): no recorded fixture stands in, so stale data never decides a PASS.
const ACTIVE_SHOW = process.env.ACTIVE_SHOW_ID ?? 'show-19-2027';
// active/show mirror activeTicketTypesByCategoryQuery plus ticketTypeMatchesActiveShow (lib/ticket-on-sale.ts:57-63);
// category and demo are filtered by isPageListable, regularPrice and earlyBirdCutoff feed expectedOffersFrom (the page's
// resolveEffectivePrice path), so --self-test exercises the same code the live run uses.
const SANITY_QUERY = '*[_type == "ticketType" && active == true && show._ref == $show]{"slug": slug.current, price, regularPrice, earlyBirdCutoff, category, demo}';
async function liveExpected() {
  const project = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  if (!project || !dataset) { console.error('INCONCLUSIVE: NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET not set (run from the project root with .env.local)'); process.exit(77); }
  const token = process.env.SANITY_API_READ_TOKEN;
  const url = `https://${encodeURIComponent(project)}.api.sanity.io/v2024-01-01/data/query/${encodeURIComponent(dataset)}?query=${encodeURIComponent(SANITY_QUERY)}&%24show=${encodeURIComponent(JSON.stringify(ACTIVE_SHOW))}`;
  try {
    const r = await fetch(url, { headers: token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(20000) });
    if (r.status !== 200) { console.error(`INCONCLUSIVE: live Sanity ticketType query returned ${r.status}`); process.exit(77); }
    const result = (await r.json()).result;
    const rows = Array.isArray(result) ? result.filter(isPageListable) : [];
    if (rows.length === 0) { console.error('INCONCLUSIVE: live Sanity returned no page-listable ticketType rows for the active show'); process.exit(77); }
    const pairs = expectedOffersFrom(rows, new Date());
    if (pairs.length === 0) { console.error('INCONCLUSIVE: no page-listable active-show ticketType resolves to an effective price'); process.exit(77); }
    return pairs;
  } catch (error) {
    console.error(`INCONCLUSIVE: could not reach live Sanity (${error.name})`);
    process.exit(77);
  }
}
const exact = Boolean(process.env.EXPECT_OFFERS);
const expected = new Map(
  exact
    ? process.env.EXPECT_OFFERS.split(',').map((kv) => kv.trim().split(':')).map(([slug, price]) => [slug, Number(price)])
    : await liveExpected()
);
// VIP is pinned after the live/exact set is built: the Brad-settled price overrides whatever a vip row's effective price
// would be, and a vip row that resolved to no offer is still expected at EXPECT_VIP.
expected.set('vip', EXPECT_VIP);
const failures = [];
const got = new Map(offers.map((o) => [slugOf(o), Number(o.price)]));
if (!got.has('vip')) failures.push('no VIP offer');
for (const [slug, price] of got) {
  if (price === WRONG_PRICE) failures.push(`offer ${slug} carries the wrong-show price ${WRONG_PRICE}`);
  if (slug === WRONG_SLUG) failures.push(`an offer links the wrong-show type ${WRONG_SLUG}`);
  if (!expected.has(slug)) failures.push(`unexpected offer ${slug} (${price}) is not in the expected active-show set`);
  else if (expected.get(slug) !== price) failures.push(`offer ${slug} price is ${price}, want ${expected.get(slug)}`);
}
if (exact) for (const slug of expected.keys()) if (!got.has(slug)) failures.push(`expected offer ${slug} is missing (exact mode)`);
if (got.size !== offers.length) failures.push('duplicate offer slugs in the JSON-LD');
if (failures.length) { for (const f of failures) console.error(`FAIL: ${f}`); process.exit(1); }
console.log(`PASS: ${ORIGIN}/national-show JSON-LD, ${offers.length} offer(s) all inside the expected active-show set (${exact ? 'exact' : 'subset'} mode), VIP ${got.get('vip')}; expected set: ${[...expected].map(([s, p]) => `${s}:${p}`).join(',')}`);
