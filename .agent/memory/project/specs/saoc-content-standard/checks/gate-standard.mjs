// saoc-content-standard F1 runtime gate. Usage (repo root):
//   node .agent/memory/project/specs/saoc-content-standard/checks/gate-standard.mjs <check> [--fresh]
// <check> is one of CHECKS below. Measures every route in goldens/standard.json at 1440x900 and 390x844
// against a dev server it starts itself (or SAOC_BASE_URL), caches the measurements keyed on the git
// tree state, and exits 1 listing every violation for the requested check.
// Needs: node_modules (playwright, next) and .env.local (Sanity read) in the repo root.
import { spawn, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { chromium } from '@playwright/test';

const SPEC = '.agent/memory/project/specs/saoc-content-standard';
const STD = JSON.parse(readFileSync(`${SPEC}/goldens/standard.json`, 'utf8'));
const CACHE_DIR = '.tmp/sandbox/saoc-standard-gate';
const CHECKS = ['grid', 'measure', 'h2', 'rhythm', 'breadcrumb', 'aside', 'eyebrow', 'facts', 'firstscreen', 'contrast', 'home', 'focus', 'overflow', 'strongp', 'absent'];

const check = process.argv[2];
if (!CHECKS.includes(check)) { console.error(`unknown check ${check}; one of ${CHECKS.join(', ')}`); process.exit(2); }
const fresh = process.argv.includes('--fresh');

function stateKey() {
  const head = execSync('git rev-parse HEAD').toString().trim();
  const diff = execSync('git diff HEAD -- app components lib content proxy.ts').toString();
  const untracked = execSync("git ls-files --others --exclude-standard -- app components lib content").toString();
  return createHash('sha1').update(head + diff + untracked + readFileSync(`${SPEC}/goldens/standard.json`)).digest('hex');
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

async function startServer() {
  if (process.env.SAOC_BASE_URL) return { base: process.env.SAOC_BASE_URL, stop: () => {} };
  const port = await freePort();
  const child = spawn('node_modules/.bin/next', ['dev', '--port', String(port)], {
    env: { ...process.env, BETA_PASSWORD_WALL_OFF: 'true', NEXT_TELEMETRY_DISABLED: '1' },
    stdio: 'ignore',
  });
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(`${base}/about`, { redirect: 'manual' }); if (r.status < 500) break; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { base, stop: () => child.kill('SIGTERM') };
}

// Runs inside the page. Returns plain JSON.
function pageProbe() {
  const px = (v) => parseFloat(v) || 0;
  const rect = (el) => { const r = el.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left, right: r.right, width: r.width, height: r.height }; };
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const out = { url: location.pathname };
  const ch = (el) => { const p = document.createElement('span'); p.style.cssText = 'position:absolute;visibility:hidden;width:100ch;height:0'; el.appendChild(p); const w = p.getBoundingClientRect().width / 100; p.remove(); return w; };
  const probeVar = (name) => { const p = document.createElement('div'); p.style.cssText = `position:absolute;visibility:hidden;font-size:var(${name})`; document.body.appendChild(p); const v = px(getComputedStyle(p).fontSize); p.remove(); return v; };
  out.displaySm = probeVar('--display-sm');
  out.docW = document.documentElement.scrollWidth - innerWidth;
  const hero = q('[data-page-hero]');
  out.hero = hero ? rect(hero) : null;
  const bc = q('nav[aria-label="Breadcrumb"]');
  out.breadcrumb = bc ? { rect: rect(bc), current: !!q('[aria-current="page"]', bc) } : null;
  const layout = q('[data-doc-layout]');
  const main = q('[data-doc-main]');
  out.layout = layout ? { rect: rect(layout), cols: getComputedStyle(layout).gridTemplateColumns, gap: px(getComputedStyle(layout).columnGap), display: getComputedStyle(layout).display } : null;
  out.main = main ? rect(main) : null;
  const asides = qa('[data-doc-aside]');
  out.asideCount = asides.length;
  const a = asides[0];
  if (a) {
    const cs = getComputedStyle(a);
    const nested = qa('*', a).filter((e) => getComputedStyle(e).boxShadow !== 'none').length;
    const idx = q('nav[data-doc-index]', a);
    out.aside = {
      kind: a.getAttribute('data-doc-aside-kind'), rect: rect(a), radius: px(cs.borderTopLeftRadius), shadow: cs.boxShadow, position: cs.position,
      top: px(cs.top), text: a.textContent.replace(/\s+/g, ' ').trim(), nestedShadows: nested,
      index: idx ? { label: idx.getAttribute('aria-label'), links: qa('[data-doc-index-link]', idx).map((l) => ({ h: l.getBoundingClientRect().height, href: l.getAttribute('href') })), headings: qa('h1,h2,h3,h4,h5,h6', idx).length } : null,
    };
  }
  const prose = qa('.doc-prose');
  out.prose = prose.map((el) => { const c = ch(el); return { widthCh: el.getBoundingClientRect().width / c, paraCh: Math.max(0, ...qa('p', el).map((p) => p.getBoundingClientRect().width / c)) }; });
  out.h2 = qa('[data-doc-main] h2').map((h) => { const cs = getComputedStyle(h); return { size: px(cs.fontSize), weight: Number(cs.fontWeight), top: rect(h).top, bottom: rect(h).bottom, text: h.textContent.trim().slice(0, 40) }; });
  out.eyebrows = qa('[data-doc-layout] .eyebrow, [data-doc-layout] p.font-mono.uppercase').map((e) => e.textContent.trim().slice(0, 40));
  out.strongP = qa('[data-doc-main] p').filter((p) => p.children.length === 1 && p.firstElementChild.tagName === 'STRONG' && p.textContent.trim() === p.firstElementChild.textContent.trim()).map((p) => p.textContent.trim().slice(0, 40));
  const facts = q('[data-hero-facts]');
  if (facts) {
    const items = qa('[data-hero-fact]', facts).map((f) => { const dt = q('dt', f), dd = q('dd', f); const sd = getComputedStyle(dd), st = getComputedStyle(dt); return { term: dt?.textContent.trim(), value: dd?.textContent.trim(), ddWeight: Number(sd.fontWeight), dtSize: px(st.fontSize), dtTransform: st.textTransform, ddColor: sd.color, dtColor: st.color, ddRect: rect(dd), dtRect: rect(dt), ddAbove: dd && dt ? dd.getBoundingClientRect().top < dt.getBoundingClientRect().top : false }; });
    out.facts = { count: facts.getAttribute('data-fact-count'), inHero: !!hero && hero.contains(facts), rect: rect(facts), items, count2: qa('[data-hero-facts]').length };
  } else out.facts = null;
  const h1 = q('h1');
  out.h1 = h1 ? { text: h1.textContent.trim().slice(0, 60) } : null;
  out.heroImage = hero ? (q('img', hero)?.getAttribute('src') ?? '') : '';
  out.bodyText = document.body.innerText;
  out.showBand = !!q('[data-home-section="show-band"]');
  const d = q('[data-home-show-date]');
  const cta = qa('main a').find((x) => /National Show/i.test(x.textContent));
  out.homeDate = d ? { text: d.textContent.trim(), rect: rect(d), inHeroCtaGroup: !!cta && !!cta.parentElement && cta.parentElement.contains(d) || (!!cta && !!cta.closest('section') && cta.closest('section').contains(d)) } : null;
  out.homeCta = cta ? { text: cta.textContent.trim(), rect: rect(cta) } : null;
  return out;
}

// Contrast of the fact text against the photo pixels behind it: hide the facts, screenshot their boxes, take the
// lightest pixels (configured percentile) against the text colour, since the text is light on dark.
async function measureContrast(page, items) {
  const results = [];
  await page.addStyleTag({ content: '[data-hero-facts]{visibility:hidden !important}' });
  for (const it of items) {
    for (const key of ['ddRect', 'dtRect']) {
      const r = it[key];
      const clip = { x: Math.max(0, r.left), y: Math.max(0, r.top - (await page.evaluate(() => scrollY))), width: Math.max(1, r.width), height: Math.max(1, r.height) };
      const png = (await page.screenshot({ clip })).toString('base64');
      const color = key === 'ddRect' ? it.ddColor : it.dtColor;
      const ratio = await page.evaluate(async ({ png, color, pct }) => {
        const img = new Image(); img.src = `data:image/png;base64,${png}`; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const lum = (r, gg, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b); };
        const d = g.getImageData(0, 0, c.width, c.height).data; const ls = [];
        for (let i = 0; i < d.length; i += 4) ls.push(lum(d[i], d[i + 1], d[i + 2]));
        ls.sort((a, b) => a - b); const bg = ls[Math.min(ls.length - 1, Math.floor(ls.length * pct))];
        const m = color.match(/[\d.]+/g).map(Number); const a = m[3] ?? 1;
        const fg = lum(m[0], m[1], m[2]); // alpha handled by blending toward the backdrop luminance
        const eff = a * fg + (1 - a) * bg;
        const hi = Math.max(eff, bg), lo = Math.min(eff, bg); return (hi + 0.05) / (lo + 0.05);
      }, { png, color, pct: STD.numbers.heroFacts.contrastPercentile });
      results.push({ key, ratio });
    }
  }
  return results;
}

async function measureAll() {
  const server = await startServer();
  const browser = await chromium.launch();
  const data = { routes: {}, home: {} };
  try {
    for (const [vpName, vp] of Object.entries(STD.viewports)) {
      const ctx = await browser.newContext({ viewport: vp });
      const page = await ctx.newPage();
      for (const route of STD.routes.filter((r) => !r.gated).concat([{ path: '/', id: 'home' }])) {
        const entry = (data.routes[route.id] ??= {});
        try {
          const resp = await page.goto(server.base + route.path, { waitUntil: 'networkidle', timeout: 90000 });
          const probe = await page.evaluate(pageProbe);
          probe.status = resp?.status();
          if (probe.facts && route.facts?.length) probe.contrast = await measureContrast(page, probe.facts.items);
          if (vpName === 'desktop') probe.focus = await focusProbe(page);
          entry[vpName] = probe;
        } catch (e) { entry[vpName] = { error: String(e).slice(0, 200) }; }
      }
      await ctx.close();
    }
  } finally { await browser.close(); server.stop(); }
  return data;
}

async function focusProbe(page) {
  await page.goto(page.url(), { waitUntil: 'load' });
  const ring = await page.evaluate(() => {
    const h1 = document.querySelector('h1'); if (!h1) return null;
    h1.setAttribute('tabindex', '-1'); h1.setAttribute('data-route-focus', ''); h1.focus();
    const cs = getComputedStyle(h1); const r = { focused: document.activeElement === h1, style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
    h1.removeAttribute('data-route-focus'); h1.blur(); return r;
  });
  let link = null;
  for (let i = 0; i < 80 && !link; i++) {
    await page.keyboard.press('Tab');
    link = await page.evaluate(() => { const e = document.activeElement; if (!e || e.tagName !== 'A' || !e.closest('main')) return null; const cs = getComputedStyle(e); return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), shadow: cs.boxShadow, visible: e.matches(':focus-visible') }; });
  }
  return { h1: ring, link };
}

function loadOrMeasure() {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = `${CACHE_DIR}/measure.json`;
  const key = stateKey();
  if (!fresh && existsSync(file)) { const c = JSON.parse(readFileSync(file, 'utf8')); if (c.key === key) return Promise.resolve(c.data); }
  return measureAll().then((data) => { writeFileSync(file, JSON.stringify({ key, data })); return data; });
}

const fails = [];
const bad = (msg) => fails.push(msg);
const N = STD.numbers;
const near = (a, b, t) => Math.abs(a - b) <= t;

function eachRoute(fn, { desktopOnly = false } = {}) {
  for (const route of STD.routes.filter((r) => !r.gated)) {
    for (const vp of desktopOnly ? ['desktop'] : ['desktop', 'mobile']) {
      const m = data.routes[route.id]?.[vp];
      if (!m || m.error || m.status >= 400) { bad(`${route.id}@${vp}: no usable page (${m?.error ?? m?.status})`); continue; }
      fn(route, vp, m);
    }
  }
}

const data = await loadOrMeasure();

// A route that may legitimately render no body grid (a show event without a description) must then
// carry the show band straight after the hero; anything else without a grid is a violation.
function gridAbsent(r, m) {
  if (m.layout || !r.layoutOptional) return false;
  if (!m.showBand) bad(`${r.id}: no [data-doc-layout] and no show band after the hero`);
  return true;
}

switch (check) {
  case 'grid':
    eachRoute((r, vp, m) => {
      if (gridAbsent(r, m)) return;
      if (!m.layout) return bad(`${r.id}@${vp}: no [data-doc-layout]`);
      if (!m.main) return bad(`${r.id}@${vp}: no [data-doc-main]`);
      if (vp === 'desktop' && m.asideCount === 1) {
        const cols = m.layout.cols.split(' ').map(parseFloat);
        if (cols.length !== 2) bad(`${r.id}@desktop: want 2 columns, got "${m.layout.cols}"`);
        else {
          const want = N.gridRatio.main / N.gridRatio.aside;
          if (!near(cols[0] / cols[1], want, want * N.gridRatio.tolerance)) bad(`${r.id}@desktop: grid ratio ${(cols[0] / cols[1]).toFixed(3)} want ${want.toFixed(3)} (7fr/5fr)`);
          if (m.layout.gap < N.gapPxDesktop.min || m.layout.gap > N.gapPxDesktop.max) bad(`${r.id}@desktop: gap ${m.layout.gap}px want ${N.gapPxDesktop.min}-${N.gapPxDesktop.max}`);
        }
      }
      if (vp === 'mobile' && m.aside && Math.abs(m.aside.rect.left - m.main.left) > 1) bad(`${r.id}@mobile: aside not stacked under main`);
      if (m.layout.rect.width < 1000 && vp === 'desktop') bad(`${r.id}@desktop: layout narrower than the container (${m.layout.rect.width})`);
    });
    break;
  case 'measure':
    eachRoute((r, vp, m) => {
      if (gridAbsent(r, m)) return;
      if (!m.prose.length) { if (r.prose !== false) bad(`${r.id}@${vp}: no .doc-prose`); return; }
      for (const p of m.prose) {
        const w = Math.max(p.paraCh, 0) || p.widthCh;
        if (p.widthCh < N.proseMeasureCh.min - 0.5 && vp === 'desktop') bad(`${r.id}@${vp}: prose column ${p.widthCh.toFixed(1)}ch under ${N.proseMeasureCh.min}`);
        if (p.widthCh > N.proseMeasureCh.max + 0.5) bad(`${r.id}@${vp}: prose column ${p.widthCh.toFixed(1)}ch over ${N.proseMeasureCh.max}`);
        void w;
      }
    }, { desktopOnly: true });
    break;
  case 'h2': {
    const seen = new Set();
    eachRoute((r, vp, m) => {
      if (vp !== 'desktop') return;
      for (const h of m.h2) {
        if (!near(h.size, m.displaySm, 0.6)) bad(`${r.id}: h2 "${h.text}" ${h.size}px want --display-sm ${m.displaySm}px`);
        if (h.weight !== N.h2.weight) bad(`${r.id}: h2 "${h.text}" weight ${h.weight} want ${N.h2.weight}`);
        seen.add(`${Math.round(h.size)}/${h.weight}`);
      }
    });
    if (seen.size > 1) bad(`h2 scales differ across routes: ${[...seen].join(', ')}`);
    break;
  }
  case 'rhythm':
    eachRoute((r, vp, m) => {
      if (gridAbsent(r, m)) return;
      if (!m.hero || !m.main) return bad(`${r.id}@${vp}: hero or main missing`);
      const want = vp === 'desktop' ? N.heroToContentPx.desktop : N.heroToContentPx.mobile;
      const got = m.main.top - m.hero.bottom;
      if (!near(got, want, N.heroToContentPx.tolerance)) bad(`${r.id}@${vp}: hero to first content ${got.toFixed(1)}px want ${want}`);
    });
    break;
  case 'breadcrumb':
    eachRoute((r, vp, m) => {
      if (!m.breadcrumb) bad(`${r.id}@${vp}: no nav[aria-label="Breadcrumb"]`);
      else if (!m.breadcrumb.current) bad(`${r.id}@${vp}: breadcrumb has no aria-current item`);
    });
    break;
  case 'aside':
    eachRoute((r, vp, m) => {
      if (gridAbsent(r, m)) return;
      if (m.asideCount > 1) bad(`${r.id}@${vp}: ${m.asideCount} asides, want at most 1`);
      const kind = m.aside?.kind ?? 'none';
      if (r.aside !== 'any' && kind !== r.aside) bad(`${r.id}@${vp}: aside kind "${kind}" want "${r.aside}"`);
      if (!m.aside) return;
      if (m.aside.nestedShadows > 0) bad(`${r.id}@${vp}: ${m.aside.nestedShadows} nested shadowed elements inside the aside card`);
      if (vp === 'desktop') {
        if (m.aside.radius !== N.aside.radiusPx) bad(`${r.id}: aside radius ${m.aside.radius} want ${N.aside.radiusPx}`);
        if (m.aside.shadow === 'none') bad(`${r.id}: aside has no shadow`);
        if (m.aside.position !== 'sticky') bad(`${r.id}: aside position ${m.aside.position} want sticky`);
        if (m.aside.top < N.aside.stickyTopMinPx) bad(`${r.id}: aside sticky top ${m.aside.top} under header ${N.aside.stickyTopMinPx}`);
      }
      if (r.asideMustContain && !m.aside.text.includes(r.asideMustContain)) bad(`${r.id}@${vp}: aside lacks "${r.asideMustContain}"`);
      if (m.aside.kind === 'index') {
        const ix = m.aside.index;
        if (!ix || ix.label !== 'Sections') bad(`${r.id}@${vp}: index nav lacks aria-label="Sections"`);
        else {
          if (ix.links.length < N.aside.indexMinEntries) bad(`${r.id}@${vp}: index has ${ix.links.length} links`);
          if (ix.headings > 0) bad(`${r.id}@${vp}: index shows a visible heading`);
          if (vp === 'desktop') ix.links.forEach((l) => { if (l.h < N.aside.indexRowMinPx - 0.5) bad(`${r.id}: index link ${l.href} is ${l.h}px tall`); });
          const h2s = m.h2.length; if (ix.links.length !== h2s) bad(`${r.id}@${vp}: index has ${ix.links.length} links for ${h2s} h2s`);
        }
      }
    });
    break;
  case 'eyebrow':
    eachRoute((r, vp, m) => { if (m.eyebrows.length) bad(`${r.id}@${vp}: body eyebrow pills ${JSON.stringify(m.eyebrows)}`); }, { desktopOnly: true });
    break;
  case 'strongp':
    eachRoute((r, vp, m) => { if (m.strongP.length) bad(`${r.id}@${vp}: bold-only paragraphs ${JSON.stringify(m.strongP)}`); }, { desktopOnly: true });
    break;
  case 'facts':
    eachRoute((r, vp, m) => {
      const want = r.facts ?? [];
      if (!want.length) { if (m.facts) bad(`${r.id}@${vp}: has a facts row but the golden says none`); return; }
      if (!m.facts) return bad(`${r.id}@${vp}: no [data-hero-facts]`);
      if (!m.facts.inHero) bad(`${r.id}@${vp}: facts are outside [data-page-hero]`);
      if (m.facts.count2 !== 1) bad(`${r.id}@${vp}: ${m.facts.count2} facts rows`);
      if (Number(m.facts.count) !== want.length) bad(`${r.id}@${vp}: data-fact-count ${m.facts.count} want ${want.length}`);
      want.forEach((w, i) => {
        const g = m.facts.items[i];
        if (!g) return bad(`${r.id}@${vp}: missing fact ${w.term}`);
        if (g.term !== w.term || g.value !== w.value) bad(`${r.id}@${vp}: fact ${i} is "${g.term}" / "${g.value}" want "${w.term}" / "${w.value}"`);
        if (g.ddWeight !== N.heroFacts.ddWeight) bad(`${r.id}@${vp}: dd weight ${g.ddWeight}`);
        if (g.dtSize !== N.heroFacts.dtSizePx) bad(`${r.id}@${vp}: dt size ${g.dtSize}`);
        if (g.dtTransform !== 'none') bad(`${r.id}@${vp}: dt text-transform ${g.dtTransform}`);
        if (!g.ddAbove) bad(`${r.id}@${vp}: dd is not visually above dt`);
      });
      // NOS Design round 1: the dd values of one row share a baseline (a wrapped dt must not push its dd up).
      const tops = m.facts.items.map((it) => it.ddRect.top);
      tops.forEach((t, i) => tops.slice(i + 1).forEach((u) => { if (Math.abs(t - u) > 1 && Math.abs(t - u) < 40) bad(`${r.id}@${vp}: fact values are not on one baseline (${t.toFixed(1)} vs ${u.toFixed(1)})`); }));
      if (r.heroImage && !m.heroImage.includes(r.heroImage.replace('.jpg', '')) ) bad(`${r.id}@${vp}: hero image "${m.heroImage}" want ${r.heroImage}`);
      if (r.showBand && !m.showBand && vp === 'desktop') { /* ShowBand marker lives on home markup; event detail keeps its own band */ }
    });
    break;
  case 'firstscreen':
    eachRoute((r, vp, m) => {
      const h = STD.viewports[vp].height;
      if (r.facts?.length) {
        if (!m.facts) return bad(`${r.id}@${vp}: no facts to place in the first screen`);
        if (m.facts.rect.bottom > h) bad(`${r.id}@${vp}: facts end at ${Math.round(m.facts.rect.bottom)}px, past ${h}`);
      }
      if (vp === 'desktop' && r.firstH2InFirstScreen) {
        const first = m.h2[0];
        if (!first) bad(`${r.id}: no h2 in main`);
        else if (first.bottom > h) bad(`${r.id}: first h2 ends at ${Math.round(first.bottom)}px, past ${h}`);
      }
      if (!r.facts?.length && !m.main && !r.layoutOptional) bad(`${r.id}@${vp}: no main column`);
      if (vp === 'desktop' && m.main && m.main.top > h) bad(`${r.id}: the content column starts at ${Math.round(m.main.top)}px, past ${h}`);
    });
    break;
  case 'contrast':
    eachRoute((r, vp, m) => {
      if (!r.facts?.length) return;
      if (!m.contrast?.length) return bad(`${r.id}@${vp}: no contrast samples (facts missing)`);
      m.contrast.forEach((c) => { if (c.ratio < N.heroFacts.contrastMin) bad(`${r.id}@${vp}: ${c.key} contrast ${c.ratio.toFixed(2)} under ${N.heroFacts.contrastMin}`); });
    });
    break;
  case 'home':
    for (const vp of ['desktop', 'mobile']) {
      const m = data.routes.home?.[vp];
      if (!m || m.error) { bad(`home@${vp}: no usable page`); continue; }
      if (!m.homeDate) { bad(`home@${vp}: no ${STD.home.dateSelector}`); continue; }
      if (m.homeDate.text !== STD.home.dateText) bad(`home@${vp}: date "${m.homeDate.text}" want "${STD.home.dateText}"`);
      if (!m.homeCta) bad(`home@${vp}: National Show CTA not found`);
      else if (!/National Show/.test(m.homeCta.text) || m.homeCta.text.includes(STD.home.dateText)) bad(`home@${vp}: CTA label changed: "${m.homeCta.text}"`);
      if (!m.homeDate.inHeroCtaGroup) bad(`home@${vp}: date is not beside the CTA`);
      if (m.homeDate.rect.bottom > STD.viewports[vp].height) bad(`home@${vp}: date at ${Math.round(m.homeDate.rect.bottom)}px is below the first screen`);
    }
    break;
  case 'focus':
    eachRoute((r, vp, m) => {
      const f = m.focus; if (!f) return;
      if (!f.h1) return bad(`${r.id}: no h1`);
      if (!f.h1.focused) bad(`${r.id}: route-focus h1 did not take focus`);
      if (f.h1.style !== 'none' && f.h1.width > 0) bad(`${r.id}: route-focus h1 shows a ring (${f.h1.style} ${f.h1.width}px)`);
      if (!f.link) bad(`${r.id}: no link in main reachable by Tab`);
      else if (!f.link.visible || (f.link.style === 'none' && f.link.shadow === 'none')) bad(`${r.id}: keyboard-focused link shows no ring`);
    }, { desktopOnly: true });
    break;
  case 'overflow':
    eachRoute((r, vp, m) => { if (m.docW > N.overflowTolerancePx) bad(`${r.id}@${vp}: horizontal overflow ${m.docW}px`); });
    break;
  case 'absent':
    eachRoute((r, vp, m) => { for (const t of r.absentText ?? []) if (m.bodyText.includes(t)) bad(`${r.id}@${vp}: still shows "${t}"`); }, { desktopOnly: true });
    break;
}

if (fails.length) { console.error(`${check}: ${fails.length} violation(s)`); fails.slice(0, 25).forEach((f) => console.error('  ' + f)); process.exit(1); }
console.log(`${check}: ok`);
