// nos-critique-r18 F1 rendered (fresh PUBLIC and PREVIEW production builds, next start 3010-3019 minus 3013). QA input, hash-locked.
// Goldens: goldens/f1-spec.md, f1-baseline.json. Both modes, 1280 and 390, on the checkout step /tickets/<slug> for two purchasable products
// (the early-bird admission Codi checked, and a programme product), against the tickets hub /national-show/tickets in the same build.
//   R1  WCAG 4.1.3: the submit button has no live-region ancestor; exactly one live region reads "Total R…", and it is a <p>
//       (aria-live=polite, aria-atomic=true) inside [data-catalogue-total]; no live region on the page contains a link, button or field;
//       pressing the quantity stepper's "more" button changes that <p>'s text, and the region still reads only "Total R…".
//   R2  one h1, and no other heading (h1-h6, role=heading) carries the h1 text; the summary card's name is a <p> with no role whose computed
//       type and box equal BASE's h2 (P3 option a: identical styling).
//   R3  breadcrumb (amended 2026-10-19, Codi FINAL): exactly one nav[aria-label=Breadcrumb], inside the hero copy, directly before the h1.
//       Its children mirror the hub's: hub child 1 (the National Show link), then one span.nk-crumb unit per further item, each holding the
//       hub's separator (span.nk-sep[aria-hidden]) and then the item: "Tickets" as a link to /national-show/tickets (styled as the hub's
//       link), then the current item with the hub current item's tag and attributes (aria-current=page, not a link, no link inside) and
//       the h1 text. Computed styles of the nav, units, links, separators and current item equal the hub's at the same width; every leaf
//       sits inside the viewport, no item taller than its hub counterpart, separators at the hub's size.
//   R6  line breaks (both pages, the hub included): every separator is on the first line of the item that follows it (its vertical centre
//       inside that item's first text line box, and left of it), so no line ends with a dash; the trail's text sits on at most 2 lines at
//       390 and on 1 line at 1280.
//   R4  JSON-LD: exactly one BreadcrumbList; its first items equal the hub's BreadcrumbList and the last is
//       { position n+1, name: the h1 text, item: https://saoc.co.za/tickets/<slug> }.
//   R5  no regression: the checkout body (summary card + form) matches its BASE capture (32px block means, f1-baseline.json, tolerance as
//       nonreg.mjs) at the BASE height (+-1px); the h1 and lede boxes equal BASE (+-1px); the hero grows by exactly the breadcrumb's height
//       plus the hero copy's row gap (+-1px); no horizontal overflow.
// `--capture` prints goldens/f1-baseline.json (captured by @architect on BASE 93940e04, both modes).
import { BASE, finish, golden } from './_lib.mjs';
import { MODES, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'f1-rendered.mjs';
const CAPTURE = process.argv.includes('--capture');
const WIDTHS = [1280, 390];
const SLUGS = ['early-bird', 'saoc-symposium'];
const HUB = '/national-show/tickets';
const ORIGIN = 'https://saoc.co.za';
const BLOCK = 32;
const TOL = { level: 16, blocks: 6 };
const NAME_PROPS = ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'color', 'letter-spacing', 'margin-top', 'margin-bottom', 'font-variation-settings', 'text-wrap-style', 'text-transform'];
const NAV_PROPS = ['display', 'flex-wrap', 'column-gap', 'row-gap', 'align-items', 'font-family', 'font-size', 'font-weight', 'color'];
const ITEM_PROPS = ['color', 'font-family', 'font-size', 'font-weight', 'text-decoration-line', 'padding-top', 'padding-bottom', 'width', 'height', 'background-color'];
const failures = [];
const got = {};
let checks = 0;

const near = (a, b) => Math.abs(a - b) <= 1;

async function crumbs(page, props) {
  return page.evaluate(({ NAV_PROPS, ITEM_PROPS }) => {
    const navs = [...document.querySelectorAll('nav[aria-label="Breadcrumb"]')];
    const nav = navs[0];
    if (!nav) return { count: 0 };
    const cs = (el, list) => Object.fromEntries(list.map((p) => [p, getComputedStyle(el).getPropertyValue(p)]));
    const describe = (c) => {
      const r = c.getBoundingClientRect();
      const style = cs(c, ITEM_PROPS);
      if (!c.classList.contains('nk-sep')) { delete style.width; delete style.height; }
      const kids = [...c.children];
      return {
        tag: c.tagName.toLowerCase(), cls: c.getAttribute('class'), hidden: c.getAttribute('aria-hidden'), current: c.getAttribute('aria-current'),
        href: c.getAttribute('href'), text: c.textContent.replace(/\s+/g, ' ').trim(), style, left: r.left, right: r.right, h: Math.round(r.height),
        links: c.querySelectorAll('a').length, children: kids.map(describe),
      };
    };
    // R6: each separator against the first text line of the element after it; all text line tops in the trail.
    const firstLine = (el) => {
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
      const n = w.nextNode();
      if (!n) return null;
      const i = n.textContent.search(/\S/);
      const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1);
      const q = rg.getClientRects()[0];
      return q ? { top: q.top, bottom: q.bottom, left: q.left } : null;
    };
    const seps = [...nav.querySelectorAll('.nk-sep')].map((s) => {
      const q = s.getBoundingClientRect();
      const next = s.nextElementSibling;
      const line = next ? firstLine(next) : null;
      return { mid: (q.top + q.bottom) / 2, right: q.right, line, text: next ? next.textContent.trim() : null };
    });
    const tops = [];
    const tw = document.createTreeWalker(nav, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.textContent.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) if (!tops.some((t) => Math.abs(t - q.top) <= 2)) tops.push(q.top);
    }
    const h1 = document.querySelector('h1');
    const copy = nav.closest('.nos-hero-copy');
    return { count: navs.length, cls: nav.getAttribute('class'), style: cs(nav, NAV_PROPS), items: [...nav.children].map(describe), seps, lines: tops.length, h: Math.round(nav.getBoundingClientRect().height), inHero: !!(copy && copy.closest('section[data-nos-hero]')), beforeH1: nav.nextElementSibling === h1, rowGap: copy ? parseFloat(getComputedStyle(copy).rowGap) || 0 : 0 };
  }, props);
}

function lineFailures(at, c, width) {
  const out = [];
  if (c.seps.length === 0) out.push(`${at}: no .nk-sep separators in the breadcrumb (R6)`);
  for (const s of c.seps) {
    if (!s.line) { out.push(`${at}: a separator has no item after it (R6)`); continue; }
    if (s.mid < s.line.top || s.mid > s.line.bottom || s.right > s.line.left + 0.5) out.push(`${at}: the separator before ${JSON.stringify(s.text)} is not on that item's first line (R6)`);
  }
  const max = width <= 390 ? 2 : 1;
  if (c.lines > max) out.push(`${at}: the trail's text sits on ${c.lines} lines, at most ${max} at ${width}px (R6)`);
  return out;
}

const SAME = ['tag', 'cls', 'hidden', 'current', 'href'];
function sameNode(at, label, g, w, opts = {}) {
  const out = [];
  for (const k of SAME) if (g[k] !== w[k]) out.push(`${at}: breadcrumb ${label} ${k} ${JSON.stringify(g[k])}, want ${JSON.stringify(w[k])} (R3)`);
  if (opts.text !== undefined && g.text !== opts.text) out.push(`${at}: breadcrumb ${label} reads ${JSON.stringify(g.text)}, want ${JSON.stringify(opts.text)} (R3)`);
  for (const [p, v] of Object.entries(w.style)) if (g.style[p] !== v) out.push(`${at}: breadcrumb ${label} ${p} ${g.style[p]}, hub ${v} (R3)`);
  if (!opts.unit && g.h > w.h + 1) out.push(`${at}: breadcrumb ${label} is ${g.h}px tall, the hub's ${w.h}px: it wraps or is squeezed (R3)`);
  if (g.children.length === 0 && (g.left < -0.5 || g.right > opts.width + 0.5)) out.push(`${at}: breadcrumb ${label} spans ${Math.round(g.left)}-${Math.round(g.right)}px, outside the viewport (R3)`);
  return out;
}

const breadcrumbLists = (page) => page.$$eval('script[type="application/ld+json"]', (ss) => ss.flatMap((s) => {
  try { const d = JSON.parse(s.textContent); return (Array.isArray(d) ? d : [d]).filter((x) => x && x['@type'] === 'BreadcrumbList'); } catch { return []; }
}));

async function blockMeans(page, png) {
  return page.evaluate(async ({ b64, block }) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const bw = Math.ceil(c.width / block); const bh = Math.ceil(c.height / block);
    const out = new Array(bw * bh * 3).fill(0); const n = new Array(bw * bh).fill(0);
    for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) {
      const b = Math.floor(yy / block) * bw + Math.floor(xx / block); const i = (yy * c.width + xx) * 4;
      out[b * 3] += d[i]; out[b * 3 + 1] += d[i + 1]; out[b * 3 + 2] += d[i + 2]; n[b] += 1;
    }
    return { w: c.width, h: c.height, bw, bh, means: out.map((v, k) => Math.round(v / n[Math.floor(k / 3)])) };
  }, { b64: png.toString('base64'), block: BLOCK });
}

const baseline = CAPTURE ? null : JSON.parse(golden('f1-baseline.json')).got;

for (const mode of MODES) {
  const srv = await serve(mode);
  if (srv.failures) { failures.push(...srv.failures.map((f) => `${mode}: ${f}`)); continue; }
  const browser = await chromium.launch();
  try {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', extraHTTPHeaders: srv.headers ?? {} });
      const page = await ctx.newPage();
      let hub = null;
      let hubLd = [];
      if (!CAPTURE) {
        const hr = await page.goto(`${srv.origin}${HUB}`, { waitUntil: 'networkidle' });
        if (!hr || hr.status() !== 200) { failures.push(`${mode} ${HUB} @${width}: HTTP ${hr ? hr.status() : 0}`); await ctx.close(); continue; }
        hub = await crumbs(page, { NAV_PROPS, ITEM_PROPS });
        hubLd = await breadcrumbLists(page);
        if (hub.count !== 1 || hub.items.length !== 2 || hub.items[1].cls !== 'nk-crumb' || hub.items[1].children.length !== 2) { failures.push(`${mode} ${HUB} @${width}: the hub breadcrumb is not a link then one nk-crumb unit of separator + current item (R3, hub)`); await ctx.close(); continue; }
        if (hub.items[1].children[1].current !== 'page' || hub.items[1].children[1].links !== 0) failures.push(`${mode} ${HUB} @${width}: the hub's current item must carry aria-current=page and be no link (R3, hub)`);
        failures.push(...lineFailures(`${mode} ${HUB} @${width}`, hub, width));
      }
      for (const slug of SLUGS) {
        checks += 1;
        const route = `/tickets/${slug}`;
        const at = `${mode} ${route} @${width}`;
        const r = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
        if (!r || r.status() !== 200) { failures.push(`${at}: HTTP ${r ? r.status() : 0}`); continue; }
        await page.evaluate(async () => { await document.fonts.ready; });
        if (!(await page.$('[data-catalogue-total]'))) { failures.push(`${at}: no purchase form - sales closed or sold out in the CMS at run time; the check needs a purchasable product (INFRA)`); continue; }
        const m = await page.evaluate(({ NAME_PROPS }) => {
          const norm = (s) => s.replace(/\s+/g, ' ').trim();
          const rect = (el) => { if (!el) return null; const q = el.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height) }; };
          const h1s = [...document.querySelectorAll('h1')];
          const h1 = h1s[0];
          const title = h1 ? norm(h1.textContent) : '';
          const heads = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]')].filter((e) => norm(e.textContent) === title).map((e) => e.tagName.toLowerCase());
          const card = document.querySelector('[data-ticket-variant="summary"]');
          const nameEl = card ? card.querySelector('[data-ticket-name]') : null;
          const name = nameEl ? { tag: nameEl.tagName.toLowerCase(), role: nameEl.getAttribute('role'), text: norm(nameEl.textContent), style: Object.fromEntries(NAME_PROPS.map((p) => [p, getComputedStyle(nameEl).getPropertyValue(p)])), ...rect(nameEl) } : null;
          const body = card ? card.closest('.nk-checkout-summary')?.parentElement : null;
          if (body) body.setAttribute('data-r18-body', '');
          const hero = document.querySelector('section[data-nos-hero]');
          return {
            title, h1Count: h1s.length, heads, name, cardLabel: card ? card.getAttribute('aria-label') : null,
            h1: rect(h1), lede: rect(document.querySelector('[data-nos-hero-lede]')), hero: rect(hero), body: rect(body),
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        }, { NAME_PROPS });
        const png = await page.locator('[data-r18-body]').screenshot({ animations: 'disabled', caret: 'hide' });
        const shot = await blockMeans(page, png);
        if (CAPTURE) {
          got[`${mode} ${route} @${width}`] = { name: m.name, h1: m.h1, lede: m.lede, hero: m.hero, body: m.body, shot };
          continue;
        }
        const b = baseline[`${mode} ${route} @${width}`];
        if (!b) { failures.push(`${at}: no baseline`); continue; }

        // R1
        const live = await page.evaluate(() => {
          const norm = (s) => s.replace(/\s+/g, ' ').trim();
          const LIVE = '[aria-live]:not([aria-live="off"]),[role="status"],[role="alert"],[role="log"]';
          const INTERACTIVE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
          const regions = [...document.querySelectorAll(LIVE)];
          const submit = document.querySelector('[data-catalogue-total]')?.closest('form')?.querySelector('button[type="submit"]');
          const totals = regions.filter((e) => /^Total\b/.test(norm(e.textContent)));
          const t = totals[0];
          return {
            submit: !!submit, submitLive: submit ? !!submit.closest(LIVE) : null,
            withControls: regions.filter((e) => e.querySelector(INTERACTIVE)).map((e) => `${e.tagName.toLowerCase()}: ${norm(e.textContent).slice(0, 60)}`),
            totals: totals.length,
            total: t ? { tag: t.tagName.toLowerCase(), live: t.getAttribute('aria-live'), atomic: t.getAttribute('aria-atomic'), inTotal: !!t.closest('[data-catalogue-total]'), text: norm(t.textContent) } : null,
          };
        });
        const TOTAL = /^Total R\s?[\d\s.,]+$/u;
        if (!live.submit) failures.push(`${at}: no submit button in the purchase form (R1)`);
        else if (live.submitLive) failures.push(`${at}: the submit button is inside a live region (R1, WCAG 4.1.3)`);
        if (live.withControls.length) failures.push(`${at}: live region(s) contain a link, button or field: ${live.withControls.join(' | ')} (R1)`);
        if (live.totals !== 1 || !live.total) failures.push(`${at}: ${live.totals} live regions read "Total", want exactly 1 (R1)`);
        else {
          const t = live.total;
          if (t.tag !== 'p' || t.live !== 'polite' || t.atomic !== 'true' || !t.inTotal) failures.push(`${at}: the Total live region is <${t.tag} aria-live=${t.live} aria-atomic=${t.atomic}>${t.inTotal ? '' : ' outside [data-catalogue-total]'}, want <p aria-live=polite aria-atomic=true> inside it (R1)`);
          if (!TOTAL.test(t.text)) failures.push(`${at}: the Total live region reads ${JSON.stringify(t.text)}, want only "Total R…" (R1)`);
        }

        // R2
        if (m.h1Count !== 1) failures.push(`${at}: ${m.h1Count} h1 elements (R2)`);
        if (m.heads.length !== 1) failures.push(`${at}: ${m.heads.length} headings carry the h1 text ${JSON.stringify(m.title)}: ${m.heads.join(', ')} (R2)`);
        if (!m.name) failures.push(`${at}: no summary card name [data-ticket-name] (R2)`);
        else {
          if (m.name.tag !== 'p' || m.name.role !== null) failures.push(`${at}: the summary card name is <${m.name.tag}${m.name.role ? ` role=${m.name.role}` : ''}>, want a <p> with no role (R2)`);
          if (m.name.text !== m.title) failures.push(`${at}: the summary card name reads ${JSON.stringify(m.name.text)}, the h1 ${JSON.stringify(m.title)} (R2)`);
          for (const p of NAME_PROPS) if (m.name.style[p] !== b.name.style[p]) failures.push(`${at}: summary card name ${p} ${m.name.style[p]}, BASE h2 ${b.name.style[p]} (R2)`);
          if (!near(m.name.w, b.name.w) || !near(m.name.h, b.name.h)) failures.push(`${at}: summary card name box ${m.name.w}x${m.name.h}, BASE ${b.name.w}x${b.name.h} (R2)`);
        }
        if (m.cardLabel !== m.title) failures.push(`${at}: the summary card's aria-label is ${JSON.stringify(m.cardLabel)}, BASE carries the product name (R2)`);

        // R3
        const c = await crumbs(page, { NAV_PROPS, ITEM_PROPS });
        if (c.count !== 1) failures.push(`${at}: ${c.count} nav[aria-label=Breadcrumb], want 1 (R3)`);
        else {
          if (!c.inHero || !c.beforeH1) failures.push(`${at}: the breadcrumb is not in the hero copy directly before the h1 (R3)`);
          if (c.cls !== hub.cls) failures.push(`${at}: nav class ${JSON.stringify(c.cls)}, hub ${JSON.stringify(hub.cls)} (R3)`);
          for (const [p, v] of Object.entries(hub.style)) if (c.style[p] !== v) failures.push(`${at}: breadcrumb nav ${p} ${c.style[p]}, hub ${v} (R3)`);
          const [h0, hu] = hub.items;
          const [hs, hc] = hu.children;
          const shape = c.items.map((i) => `${i.tag}.${i.cls ?? ''}[${i.children.length}]`).join(' ');
          if (c.items.length !== 3 || c.items[1].children.length !== 2 || c.items[2].children.length !== 2) failures.push(`${at}: breadcrumb children ${shape}, want the hub's link then two nk-crumb units of separator + item (R3)`);
          else {
            const o = { width };
            failures.push(...sameNode(at, 'item 1', c.items[0], h0, { ...o, text: h0.text }));
            for (const [i, label] of [[1, 'unit 2'], [2, 'unit 3']]) {
              failures.push(...sameNode(at, label, c.items[i], hu, { ...o, unit: true })); // a unit's height follows its item (a link carries 10px padding)
              failures.push(...sameNode(at, `${label} separator`, c.items[i].children[0], hs, o));
            }
            failures.push(...sameNode(at, 'item 2', c.items[1].children[1], { ...h0, href: HUB }, { ...o, text: hc.text }));
            const cur = c.items[2].children[1];
            failures.push(...sameNode(at, 'current item', cur, hc, { ...o, text: m.title }));
            if (cur.current !== 'page' || cur.tag === 'a' || cur.href !== null || cur.links !== 0) failures.push(`${at}: the current item must carry aria-current=page and be no link (R3)`);
          }
          failures.push(...lineFailures(at, c, width));
        }

        // R4
        const ld = await breadcrumbLists(page);
        if (hubLd.length !== 1) failures.push(`${mode} ${HUB} @${width}: ${hubLd.length} BreadcrumbList nodes on the hub (INFRA)`);
        else if (ld.length !== 1) failures.push(`${at}: ${ld.length} BreadcrumbList nodes, want 1 (R4)`);
        else {
          const hubItems = hubLd[0].itemListElement ?? [];
          const wantLd = { ...hubLd[0], itemListElement: [...hubItems, { '@type': 'ListItem', position: hubItems.length + 1, name: m.title, item: `${ORIGIN}${route}` }] };
          if (JSON.stringify(ld[0]) !== JSON.stringify(wantLd)) failures.push(`${at}: BreadcrumbList ${JSON.stringify(ld[0])}, want ${JSON.stringify(wantLd)} (R4)`);
        }

        // R5
        if (m.overflow > 0) failures.push(`${at}: scrolls horizontally by ${m.overflow}px (R5)`);
        for (const k of ['h1', 'lede', 'body']) if (!m[k] || !near(m[k].w, b[k].w) || !near(m[k].h, b[k].h)) failures.push(`${at}: ${k} box ${m[k] ? `${m[k].w}x${m[k].h}` : 'missing'}, BASE ${b[k].w}x${b[k].h} (R5)`);
        if (c.count === 1 && !near(m.hero.h - b.hero.h, c.h + c.rowGap)) failures.push(`${at}: the hero grew by ${m.hero.h - b.hero.h}px, want the breadcrumb ${c.h}px + the row gap ${c.rowGap}px (R5)`);
        if (shot.w !== b.shot.w) failures.push(`${at}: checkout body capture width ${shot.w}, BASE ${b.shot.w} (R5)`);
        else {
          const base = [...(await import('node:zlib')).inflateSync(Buffer.from(b.shot.means, 'base64'))];
          const diff = [];
          for (let blk = 0; blk < shot.bw * Math.floor(Math.min(shot.h, b.shot.h) / BLOCK); blk++) {
            const d = Math.max(...[0, 1, 2].map((k) => Math.abs(shot.means[blk * 3 + k] - base[blk * 3 + k])));
            if (d > TOL.level) diff.push(`(${(blk % shot.bw) * BLOCK},${Math.floor(blk / shot.bw) * BLOCK}) d${d}`);
          }
          if (diff.length > TOL.blocks) failures.push(`${at}: ${diff.length} checkout body blocks changed (> ${TOL.blocks}): ${diff.slice(0, 8).join(' ')} (R5)`);
        }

        // R1 (interaction): the stepper's "more" button changes the Total line, which stays the whole live text.
        const before = await page.evaluate(() => document.querySelector('[data-catalogue-total] [aria-live]')?.textContent.replace(/\s+/g, ' ').trim() ?? null);
        const more = page.locator('.nk-qty button').last();
        if (before === null) continue;
        if (!(await more.isEnabled())) { failures.push(`${at}: the quantity stepper's "more" button is disabled at load (R1)`); continue; }
        await more.click();
        const after = await page.waitForFunction((prev) => {
          const t = document.querySelector('[data-catalogue-total] [aria-live]')?.textContent.replace(/\s+/g, ' ').trim();
          return t && t !== prev ? t : null;
        }, before, { timeout: 5000 }).then((h) => h.jsonValue()).catch(() => null);
        if (!after) failures.push(`${at}: pressing "more" did not change the Total live region (${JSON.stringify(before)}) (R1)`);
        else if (!TOTAL.test(after)) failures.push(`${at}: after "more" the Total live region reads ${JSON.stringify(after)}, want only "Total R…" (R1)`);
      }
      await ctx.close();
    }
  } catch (e) {
    failures.push(`render error: ${e && e.message ? e.message : e}`);
  } finally {
    await browser.close();
    await srv.stop();
  }
}

if (CAPTURE) {
  if (failures.length) finish(NAME, failures);
  const { deflateSync } = await import('node:zlib');
  const out = {};
  for (const [k, v] of Object.entries(got)) out[k] = { ...v, shot: { w: v.shot.w, h: v.shot.h, bw: v.shot.bw, bh: v.shot.bh, means: deflateSync(Buffer.from(v.shot.means)).toString('base64') } };
  process.stdout.write(`${JSON.stringify({ recorded: `${MODES.join(' and ')} builds of BASE ${BASE}: the checkout summary card name (BASE h2), h1, lede, hero and checkout body boxes; ${BLOCK}px block means of the checkout body`, got: out })}\n`);
  process.exit(0);
}
finish(NAME, failures, `${checks} checkout captures (${MODES.join('/')}, ${WIDTHS.join('/')}): the Total line alone is live, one heading carries the title, the hub breadcrumb and BreadcrumbList lead to the product, and the checkout body is unchanged.`);
