// nos-critique-r6 F4 — rendered check for the SEO item on the production build (next start, 3010-3019, never 3002).
// Parses every <script type="application/ld+json"> on the page, so it checks what a crawler receives.
//   BREADCRUMB  every NOS route: exactly one BreadcrumbList, '@context' https://schema.org, positions 1..n, item 1 =
//               "National Show" -> https://saoc.co.za/national-show, every item an absolute https://saoc.co.za URL, and
//               for each route the Explore index labels on /national-show/faq, the last item is that route's label and URL.
//   LABELS      every crumb name equals the text of a visible link to that URL on the page (the NOS nav labels, verbatim)
//   FAQ         /national-show/faq: each Answer.text EXACTLY equals the visible answer (textContent, whitespace collapsed; closed <details> content has no innerText) of its question; the FAQPage Questions equal, in order, the page's FAQ items that carry no ConfirmationBadge and a non-empty answer (public shows every answered entry as settled, R77; beta only the confirmed ones), in DOM order; each Answer.text is plain text (no tags) and non-empty; with
//               no such items there is no FAQPage node at all. No other route carries a FAQPage.
//   EVENT       the hub's Event node, when present, is still the only Event node and its offers (if any) carry
//               priceCurrency ZAR and a schema.org availability; no offer carries validFrom.
// Run as: node check-rendered-f4.mjs   (NOS_CR6_ROOT selects the worktree)
import { finish, scopeFiles } from './_lib.mjs';
import { AUTH, assertFreshBuild, require, startServer } from './_server.mjs';

const NAME = 'check-rendered-f4.mjs';
const failures = [];
const { chromium } = require('playwright');
const ORIGIN = 'https://saoc.co.za';
const ROUTES = ['', 'about', 'what-to-expect', 'plan-your-visit', 'faq', 'programme', 'exhibitors', 'vendors', 'sponsors', 'sa-exhibitors', 'international-guests', 'symposium', 'wosa-conference', 'workshops', 'conferences', 'archive', 'tickets'].map((r) => (r ? `/national-show/${r}` : '/national-show'));

const stale = assertFreshBuild(scopeFiles());
if (stale.length > 0) finish(NAME, stale);

const grab = () => ({
  ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
  index: [...document.querySelectorAll('.nos-index a[href^="/national-show"]')].map((a) => [a.getAttribute('href'), a.textContent.trim()]),
  faq: [...document.querySelectorAll('details')].map((d) => ({
    q: (d.querySelector('summary span:last-child') ?? d.querySelector('summary'))?.textContent.trim() ?? '',
    badge: !!d.querySelector('summary [data-confirmation-badge]'),
    answer: (d.querySelector('summary ~ div')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  })),
  links: [...document.querySelectorAll('a[href]')].filter((a) => a.offsetParent !== null).map((a) => [a.getAttribute('href'), a.textContent.replace(/\s+/g, ' ').trim()]).filter(([, t]) => t),
});


// Public mode (no beta wall): the FAQPage question set and order must equal the visible question set and order (lead 2026-10-17: one list, two renderings).
async function checkFaqPublic() {
  const srv = await startServer({ publicMode: true });
  let b;
  try {
    b = await chromium.launch();
    const pg = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    const res = await pg.goto(`${srv.origin}/national-show/faq`, { waitUntil: 'networkidle' });
    if (!res || res.status() !== 200) { failures.push(`public /national-show/faq: HTTP ${res && res.status()} (is the public build reachable without the beta wall?)`); return; }
    const g = await pg.evaluate(grab);
    const nodes = g.ld.flatMap((t) => { try { const j = JSON.parse(t); return Array.isArray(j) ? j : [j]; } catch { return []; } }).filter((n) => n['@type'] === 'FAQPage');
    const visible = g.faq.filter((f) => f.q && f.answer);
    if (visible.length === 0) { failures.push('public /national-show/faq: no visible answered FAQ items; the public comparison would be vacuous'); return; }
    if (nodes.length !== 1) { failures.push(`public /national-show/faq: ${nodes.length} FAQPage nodes, want 1`); return; }
    const got = (nodes[0].mainEntity ?? []).map((q) => q.name);
    const want = visible.map((f) => f.q);
    if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`public /national-show/faq: FAQPage question set/order differs from the visible list.\n    want ${JSON.stringify(want)}\n    got  ${JSON.stringify(got)}`);
    for (const q of nodes[0].mainEntity ?? []) {
      const shown = visible.find((f) => f.q === q.name)?.answer;
      if (shown !== undefined && (q.acceptedAnswer?.text ?? '').replace(/\s+/g, ' ').trim() !== shown) failures.push(`public /national-show/faq: Answer.text for "${q.name}" is not exactly the visible answer`);
    }
  } finally {
    if (b) await b.close();
    srv.stop();
  }
}

let browser;
let stop = () => {};
try {
  const srv = await startServer();
  stop = srv.stop;
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, extraHTTPHeaders: { authorization: AUTH } });
  const page = await ctx.newPage();
  const labels = new Map();
  const hubRes = await page.goto(`${srv.origin}/national-show/faq`, { waitUntil: 'networkidle' }); // the hub no longer carries the Explore index (F18a); inner pages do
  if (!hubRes || hubRes.status() !== 200) throw new Error(`/national-show/faq HTTP ${hubRes && hubRes.status()}`);
  for (const [h, t] of (await page.evaluate(grab)).index) labels.set(h, t);
  if (labels.size < 10) failures.push(`the Explore index on /national-show/faq yielded only ${labels.size} labels; cannot derive the expected breadcrumb names`);

  for (const route of ROUTES) {
    const res = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
    if (!res || res.status() !== 200) { failures.push(`${route}: HTTP ${res && res.status()}`); continue; }
    const g = await page.evaluate(grab);
    let nodes;
    for (const t of g.ld) if (t.includes('</')) failures.push(`${route}: a JSON-LD script body contains "</" (unescaped; a </script> in CMS text would break out of the tag)`);
    try { nodes = g.ld.map((t) => JSON.parse(t)); } catch (e) { failures.push(`${route}: a JSON-LD script is not valid JSON (${e.message})`); continue; }
    const all = nodes.flatMap((n) => (Array.isArray(n) ? n : [n]));
    const crumbs = all.filter((n) => n['@type'] === 'BreadcrumbList');
    if (crumbs.length !== 1) { failures.push(`${route}: ${crumbs.length} BreadcrumbList nodes, want exactly 1`); }
    else {
      const c = crumbs[0];
      const items = c.itemListElement ?? [];
      if (c['@context'] !== 'https://schema.org') failures.push(`${route}: breadcrumb @context ${c['@context']}`);
      if (items.length < 1) failures.push(`${route}: breadcrumb has no items`);
      items.forEach((it, i) => {
        if (it.position !== i + 1) failures.push(`${route}: breadcrumb position ${it.position} at index ${i}`);
        if (typeof it.name !== 'string' || it.name.trim() === '') failures.push(`${route}: breadcrumb item ${i + 1} has no name`);
        if (typeof it.item !== 'string' || !it.item.startsWith(`${ORIGIN}/`)) failures.push(`${route}: breadcrumb item ${i + 1} url ${it.item} is not an absolute ${ORIGIN} URL`);
      });
      for (const it of items) {
        const path = (it.item ?? '').replace(ORIGIN, '');
        const texts = g.links.filter(([h]) => h === path).map(([, t]) => t);
        if (texts.length > 0 && !texts.includes(it.name)) failures.push(`${route}: breadcrumb "${it.name}" for ${path} does not equal a visible nav label (${[...new Set(texts)].join(' | ')})`);
      }
      if (items[0] && (items[0].name !== 'National Show' || items[0].item !== `${ORIGIN}/national-show`)) failures.push(`${route}: first crumb must be National Show -> ${ORIGIN}/national-show, got ${JSON.stringify(items[0])}`);
      if (labels.has(route)) {
        const last = items[items.length - 1];
        if (!last || last.name !== labels.get(route) || last.item !== `${ORIGIN}${route}`) failures.push(`${route}: last crumb ${JSON.stringify(last)}, want "${labels.get(route)}" -> ${ORIGIN}${route}`);
      }
    }
    const faqNodes = all.filter((n) => n['@type'] === 'FAQPage');
    if (route === '/national-show/faq') {
      const settled = g.faq.filter((f) => f.q && !f.badge && f.answer);
      if (settled.length === 0) { if (faqNodes.length !== 0) failures.push('/national-show/faq: a FAQPage node is emitted but no FAQ item is confirmed with an answer'); }
      else if (faqNodes.length !== 1) failures.push(`/national-show/faq: ${faqNodes.length} FAQPage nodes, want 1`);
      else {
        const got = (faqNodes[0].mainEntity ?? []).map((q) => q.name);
        const want = settled.map((f) => f.q);
        if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`/national-show/faq: FAQPage questions differ from the confirmed items on the page.\n    want ${JSON.stringify(want)}\n    got  ${JSON.stringify(got)}`);
        for (const q of faqNodes[0].mainEntity ?? []) {
          const t = q.acceptedAnswer?.text;
          if (q['@type'] !== 'Question' || q.acceptedAnswer?.['@type'] !== 'Answer') failures.push(`/national-show/faq: malformed Question/Answer for "${q.name}"`);
          const shown = settled.find((f) => f.q === q.name)?.answer;
          if (shown !== undefined && typeof t === 'string' && t.replace(/\s+/g, ' ').trim() !== shown) failures.push(`/national-show/faq: Answer.text for "${q.name}" is not exactly the visible answer.\n    visible ${JSON.stringify(shown)}\n    jsonld  ${JSON.stringify(t)}`);
          if (typeof t !== 'string' || t.trim() === '' || /<[a-z/][^>]*>/i.test(t)) failures.push(`/national-show/faq: Answer.text for "${q.name}" must be non-empty plain text`);
        }
      }
    } else if (faqNodes.length > 0) failures.push(`${route}: carries a FAQPage node`);
    if (route === '/national-show') {
      const events = all.filter((n) => n['@type'] === 'Event');
      if (events.length > 1) failures.push(`hub: ${events.length} Event nodes, want at most 1`);
      for (const o of events[0]?.offers ?? []) {
        if (o.priceCurrency !== 'ZAR') failures.push(`hub offer ${o.name}: priceCurrency ${o.priceCurrency}`);
        if (!/^https:\/\/schema\.org\/(InStock|SoldOut|PreOrder)$/.test(o.availability ?? '')) failures.push(`hub offer ${o.name}: availability ${o.availability}`);
        if ('validFrom' in o) failures.push(`hub offer ${o.name}: validFrom present (no source field; must not be added)`);
      }
    }
  }
  await ctx.close();
} catch (err) {
  failures.push(`${err.name}: ${err.message}`);
} finally {
  if (browser) await browser.close();
  stop();
}
try { await checkFaqPublic(); } catch (err) { failures.push(`public mode: ${err.name}: ${err.message}`); }
finish(NAME, failures, `SEO rendered: one valid BreadcrumbList on each of ${ROUTES.length} NOS routes (National Show first, labels match the Explore index), FAQPage only on /faq and equal to the confirmed items, Event offers ZAR with no validFrom.`);
