// saoc-content-standard F3 (NOS Design ruling PG-1) runtime gate. Usage (repo root):
//   node .agent/memory/project/specs/saoc-content-standard/checks/gate-pg1.mjs <check> [--cache] [--site saoc|nos]
// <check> is one of CHECKS. Measures the routes in goldens/pg1.json at five widths against a dev server it
// starts itself (or SAOC_BASE_URL / NOS_BASE_URL), and exits 1 listing every violation for the check.
// `selftest` mutates the live DOM to break each rule and fails unless the judges flag the break, so a green
// run cannot come from a blind detector. Pattern follows gate-standard.mjs. Needs node_modules and .env.local.
import { spawn, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { chromium } from '@playwright/test';

const SPEC = '.agent/memory/project/specs/saoc-content-standard';
const PG = JSON.parse(readFileSync(`${SPEC}/goldens/pg1.json`, 'utf8'));
const N = PG.numbers;
const CACHE_DIR = '.tmp/sandbox/saoc-pg1-gate';
const CHECKS = ['gap', 'split', 'duph2', 'hero', 'fold', 'api', 'selftest'];

const check = process.argv[2];
if (!CHECKS.includes(check)) { console.error(`unknown check ${check}; one of ${CHECKS.join(', ')}`); process.exit(2); }
const useCache = process.argv.includes('--cache');
const site = process.argv.includes('--site') ? process.argv[process.argv.indexOf('--site') + 1] : 'saoc';
const ROUTES = site === 'nos' ? PG.nosRoutes : PG.routes;
const BASE_ENV = site === 'nos' ? process.env.NOS_BASE_URL : process.env.SAOC_BASE_URL;
if (!ROUTES.length) { console.error(`${site}: no routes in goldens/pg1.json (${site === 'nos' ? 'nosRoutes' : 'routes'}); refusing a vacuous pass`); process.exit(1); }
if (site === 'nos' && !BASE_ENV) { console.error('nos: NOS_BASE_URL is required'); process.exit(1); }

async function sanityStamp() {
  try {
    const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]));
    const query = encodeURIComponent('{"n": count(*), "u": *|order(_updatedAt desc)[0]._updatedAt}');
    const res = await fetch(`https://${env.NEXT_PUBLIC_SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/query/${env.NEXT_PUBLIC_SANITY_DATASET}?query=${query}`, { headers: env.SANITY_API_READ_TOKEN ? { Authorization: `Bearer ${env.SANITY_API_READ_TOKEN}` } : {} });
    if (!res.ok) return `unreadable:${Date.now()}`;
    return JSON.stringify((await res.json()).result);
  } catch { return `unreadable:${Date.now()}`; }
}

// Untracked source counts by name AND content: an edit to a new, uncommitted file must invalidate
// the cached measurement just as an edit to a tracked one does.
function untrackedDigest() {
  const files = execSync('git ls-files --others --exclude-standard -- app components lib content').toString().split('\n').filter(Boolean);
  const h = createHash('sha1');
  for (const f of files) h.update(f + '\0').update(existsSync(f) ? readFileSync(f) : '').update('\0');
  return h.digest('hex');
}

async function stateKey() {
  const stamp = await sanityStamp();
  const head = execSync('git rev-parse HEAD').toString().trim();
  const diff = execSync('git diff HEAD -- app components lib content proxy.ts').toString();
  return createHash('sha1').update(site + (BASE_ENV ?? 'local-dev-server') + stamp + head + diff + untrackedDigest() + readFileSync(`${SPEC}/goldens/pg1.json`) + readFileSync(`${SPEC}/checks/gate-pg1.mjs`)).digest('hex');
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

async function startServer() {
  if (BASE_ENV) return { base: BASE_ENV, stop: () => {} };
  const port = await freePort();
  const child = spawn('node_modules/.bin/next', ['dev', '--port', String(port)], {
    env: { ...process.env, BETA_PASSWORD_WALL_OFF: 'true', NEXT_TELEMETRY_DISABLED: '1' },
    stdio: 'ignore',
  });
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 300; i++) {
    try { const r = await fetch(`${base}${ROUTES[0].path}`, { redirect: 'manual' }); if (r.status < 500) break; } catch {}
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
  const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const out = { url: location.pathname, vw: innerWidth };
  const hero = q('[data-page-hero]');
  const h1 = q('h1');
  out.h1 = h1 ? { text: h1.textContent.trim(), norm: norm(h1.textContent) } : null;
  out.hero = null;
  if (hero) {
    const hcs = getComputedStyle(hero);
    const inDl = (e) => !!e.closest('dl');
    const minH = Math.max(px(hcs.minHeight), ...[...hero.children].map((c) => px(getComputedStyle(c).minHeight)));
    const ledes = qa('p', hero).filter((p) => !inDl(p)).sort((a, b) => b.textContent.length - a.textContent.length);
    const lede = ledes[0];
    let lines = 0;
    if (lede) { const cs = getComputedStyle(lede); const lh = cs.lineHeight === 'normal' ? px(cs.fontSize) * 1.25 : px(cs.lineHeight); lines = Math.round(lede.getBoundingClientRect().height / lh); }
    const kids = qa('p, h1, span, dl, a, button, div', hero).filter((e) => e.children.length === 0 || e.matches('h1, dl, a, button, p')).map((e) => e.getBoundingClientRect()).filter((r) => r.height > 0 && r.width > 0);
    const hr = rect(hero);
    const uTop = kids.length ? Math.min(...kids.map((r) => r.top + scrollY)) : hr.top;
    const uBottom = kids.length ? Math.max(...kids.map((r) => r.bottom + scrollY)) : hr.bottom;
    const h1r = h1 ? rect(h1) : null;
    out.hero = {
      rect: hr, minHeightComputed: minH, ledeLines: lines, hasFacts: !!q('[data-hero-facts]', hero),
      hasActions: qa('a, button', hero).filter((e) => !inDl(e)).length > 0,
      topGap: uTop - hr.top, bottomGap: hr.bottom - uBottom,
      h1CenterOffset: h1r ? Math.abs((h1r.left + h1r.right) / 2 - (hr.left + hr.right) / 2) : null,
      h1TextAlign: h1 ? getComputedStyle(h1).textAlign : null,
    };
  }
  const sub = q('[data-sub-nav]');
  out.refBottom = Math.max(out.hero ? out.hero.rect.bottom : 0, sub ? rect(sub).bottom : 0);
  const layout = q('[data-doc-layout]');
  const main = q('[data-doc-main]');
  const band = q('[data-home-section="show-band"]');
  out.layout = layout ? { rect: rect(layout), cols: getComputedStyle(layout).gridTemplateColumns } : null;
  out.main = main ? rect(main) : null;
  out.band = band ? rect(band) : null;
  const asides = qa('[data-doc-aside]');
  out.asideCount = asides.length;
  out.aside = asides[0] ? { rect: rect(asides[0]), kind: asides[0].getAttribute('data-doc-aside-kind'), position: getComputedStyle(asides[0]).position } : null;
  // First section of the first content: padding, hairlines, offset of its first child.
  const sec = main ? main.firstElementChild : null;
  out.firstSection = null;
  if (sec) {
    const cs = getComputedStyle(sec);
    const firstChild = sec.firstElementChild;
    const pseudo = ['::before', '::after'].map((p) => { const ps = getComputedStyle(sec, p); return ps.content !== 'none' && (px(ps.height) <= 2 || px(ps.borderTopWidth) > 0 || px(ps.borderBottomWidth) > 0); }).some(Boolean);
    const boxes = [main, layout, sec].filter(Boolean);
    const firstH2 = q('h2', main);
    const rulesBeforeH2 = qa('hr, [role="separator"]', main).filter((r) => !firstH2 || (r.compareDocumentPosition(firstH2) & Node.DOCUMENT_POSITION_FOLLOWING)).length;
    out.firstSection = {
      top: rect(sec).top, paddingTop: px(cs.paddingTop), borderTop: Math.max(...boxes.map((b) => px(getComputedStyle(b).borderTopWidth))),
      boxShadowHairline: cs.boxShadow !== 'none', pseudoHairline: pseudo, rulesBeforeH2,
      firstChildOffset: firstChild ? rect(firstChild).top - rect(sec).top : 0,
    };
  }
  // h2 geometry.
  out.h2 = qa('h2').map((h) => {
    const r = rect(h);
    const inMain = !!main && main.contains(h);
    const body = h.nextElementSibling;
    const br = body ? rect(body) : null;
    let sideBySide = false;
    if (inMain) {
      for (let c = h; c && c !== main; c = c.parentElement) {
        const p = c.parentElement; if (!p) break;
        const cr = c.getBoundingClientRect();
        if ([...p.children].some((s) => s !== c && s.getBoundingClientRect().height > 0 && s.getBoundingClientRect().left >= cr.right - 1 && s.getBoundingClientRect().top < cr.bottom)) { sideBySide = true; break; }
      }
    }
    return { text: h.textContent.trim().slice(0, 50), norm: norm(h.textContent), inMain, rect: r, bodyBelow: br ? br.top >= r.bottom - 1 : true, bodyBeside: br ? br.left >= r.right - 1 && br.top < r.bottom : false, sideBySide };
  });
  // Fold anchor candidates; judgeFold picks by order: first h2 in main, aside card, a form inside the page body
  // (never the footer newsletter form), the show band, then the first block of [data-doc-main].
  // Band routes anchor on the bottom of the band's first heading, else its first text line, never the band's own bottom.
  let bandAnchor = null;
  if (band) {
    const bh = q('h1, h2, h3, h4, h5, h6', band);
    if (bh) bandAnchor = rect(bh).bottom;
    else {
      const w = document.createTreeWalker(band, NodeFilter.SHOW_TEXT);
      for (let t = w.nextNode(); t; t = w.nextNode()) {
        if (!t.textContent.trim()) continue;
        const rg = document.createRange(); rg.selectNodeContents(t);
        const rr = rg.getBoundingClientRect();
        if (rr.height > 0) { bandAnchor = rr.bottom + scrollY; break; }
      }
    }
  }
  const bodyForm = qa('form').find((f) => !f.closest('footer, [data-site-footer]'));
  const firstH2 = out.h2.find((h) => h.inMain);
  out.anchors = {
    h2: firstH2 ? firstH2.rect.bottom : null,
    aside: out.aside ? out.aside.rect.bottom : null,
    form: bodyForm ? rect(bodyForm).bottom : null,
    band: bandAnchor,
    mainFirst: main && main.firstElementChild ? rect(main.firstElementChild).top : (main ? out.main.top : null),
  };
  // Shared-API runtime shape.
  const dl = q('[data-hero-facts]');
  out.facts = dl ? { tag: dl.tagName, count: dl.getAttribute('data-fact-count'), items: qa('[data-hero-fact]', dl).length, dtBeforeDd: qa('[data-hero-fact]', dl).every((f) => { const dt = q('dt', f), dd = q('dd', f); return !!dt && !!dd && (dt.compareDocumentPosition(dd) & Node.DOCUMENT_POSITION_FOLLOWING); }), inHero: !!hero && hero.contains(dl), rows: qa('[data-hero-facts]').length } : null;
  return out;
}

// ---- judges: pure functions of probe data. Each returns an array of violation strings. ----
const expectGap = (vw) => (vw >= N.gapPx.breakpoint ? N.gapPx.atLeast1024 : N.gapPx.below1024);
const expectMinH = (vw) => Math.min(N.heroMinHeight.capPx, Math.max(N.heroMinHeight.floorPx, vw * N.heroMinHeight.vw / 100));
const near = (a, b, t) => Math.abs(a - b) <= t;

function judgeGap(r, m) {
  const v = [];
  const want = expectGap(m.vw);
  const contentTop = r.firstContent === 'show-band' ? m.band?.top : m.main?.top;
  if (contentTop === undefined || contentTop === null) return [`${r.id}@${m.vw}: no first content (${r.firstContent})`];
  const got = contentTop - m.refBottom;
  if (!near(got, want, N.gapPx.tolerance)) v.push(`${r.id}@${m.vw}: hero to first content ${got.toFixed(1)}px want ${want}`);
  const s = m.firstSection;
  if (r.firstContent === 'doc-main') {
    if (!s) return [...v, `${r.id}@${m.vw}: [data-doc-main] has no first section`];
    if (s.paddingTop > N.firstSection.paddingTop) v.push(`${r.id}@${m.vw}: first section padding-top ${s.paddingTop}px want 0`);
    if (s.borderTop > N.firstSection.borderTop) v.push(`${r.id}@${m.vw}: hairline (border-top ${s.borderTop}px) on the first content box`);
    if (s.pseudoHairline) v.push(`${r.id}@${m.vw}: ::before/::after rule on the first section`);
    if (s.boxShadowHairline) v.push(`${r.id}@${m.vw}: box-shadow on the first section (a shadow hairline)`);
    if (s.rulesBeforeH2 > 0) v.push(`${r.id}@${m.vw}: ${s.rulesBeforeH2} hr/separator before the first h2`);
    if (s.firstChildOffset > N.firstSection.firstChildOffsetMax) v.push(`${r.id}@${m.vw}: first child sits ${s.firstChildOffset.toFixed(1)}px below its section (hidden margin/padding)`);
  }
  return v;
}

function judgeSplit(r, m) {
  const v = [];
  if (m.vw < 1024) return v; // below 1024 the layout is one column; split is a desktop failure
  for (const h of m.h2.filter((x) => x.inMain)) {
    if (h.sideBySide || h.bodyBeside) v.push(`${r.id}@${m.vw}: h2 "${h.text}" sits beside its body (split h2/body)`);
    if (!h.bodyBelow) v.push(`${r.id}@${m.vw}: body of h2 "${h.text}" is not below it`);
    if (m.main && h.rect.right > m.main.right + 1) v.push(`${r.id}@${m.vw}: h2 "${h.text}" overflows the 7fr column`);
    if (m.aside && h.rect.left >= m.aside.rect.left - 1) v.push(`${r.id}@${m.vw}: h2 "${h.text}" is in the 5fr column`);
  }
  if (m.aside && m.main) {
    if (m.aside.rect.left < m.main.right - 1) v.push(`${r.id}@${m.vw}: aside is not in its own right-hand column`);
    const ratio = m.main.width / m.aside.rect.width, want = N.gridRatio.main / N.gridRatio.aside;
    if (!near(ratio, want, want * N.gridRatio.tolerance + 0.15)) v.push(`${r.id}@${m.vw}: 7fr/5fr column ratio ${ratio.toFixed(2)} want ${want.toFixed(2)}`);
    if (m.aside.kind === 'index' && m.aside.position !== 'sticky') v.push(`${r.id}@${m.vw}: index column is ${m.aside.position}, want sticky`);
  }
  return v;
}

function judgeDupH2(r, m) {
  if (!m.h1) return [`${r.id}@${m.vw}: no h1`];
  return m.h2.filter((h) => h.norm === m.h1.norm).map((h) => `${r.id}@${m.vw}: h2 "${h.text}" repeats the h1`);
}

function eligibleOneLine(m) { const h = m.hero; return !!h && h.ledeLines <= 1 && !h.hasFacts && !h.hasActions; }

function judgeHero(r, m) {
  const v = [];
  const h = m.hero;
  if (!h) return [`${r.id}@${m.vw}: no [data-page-hero]`];
  const want = expectMinH(m.vw);
  if (!near(h.minHeightComputed, want, N.heroMinHeight.tolerance)) v.push(`${r.id}@${m.vw}: hero min-height ${h.minHeightComputed.toFixed(1)}px want clamp(320,22vw,380)=${want.toFixed(1)}`);
  if (h.rect.height < want - N.heroMinHeight.tolerance) v.push(`${r.id}@${m.vw}: hero ${h.rect.height.toFixed(1)}px shorter than its min-height ${want.toFixed(1)}`);
  const cap = m.vw === 2056 ? PG.numbers.heroOneLineCap.w2056 : m.vw === 1440 ? PG.numbers.heroOneLineCap.w1440 : null;
  if (cap && eligibleOneLine(m) && h.rect.height > cap + 0.5) v.push(`${r.id}@${m.vw}: one-line hero is ${h.rect.height.toFixed(1)}px want <= ${cap}`);
  if (h.h1CenterOffset !== null && h.h1CenterOffset > N.heroCenter.horizontalTolerancePx) v.push(`${r.id}@${m.vw}: h1 centre is ${h.h1CenterOffset.toFixed(1)}px off the hero centre`);
  if (h.h1TextAlign !== 'center') v.push(`${r.id}@${m.vw}: h1 text-align ${h.h1TextAlign} want center`);
  if (near(h.rect.height, want, 1) && Math.abs(h.topGap - h.bottomGap) > N.heroCenter.verticalImbalanceMaxPx) v.push(`${r.id}@${m.vw}: copy not vertically centred (top gap ${h.topGap.toFixed(0)}px, bottom gap ${h.bottomGap.toFixed(0)}px)`);
  return v;
}

function foldAnchor(r, m) {
  const a = m.anchors;
  if (a.h2 !== null) return { kind: 'h2', pos: a.h2 };
  if (a.aside !== null) return { kind: 'aside', pos: a.aside };
  if (a.form !== null) return { kind: 'form', pos: a.form };
  if (r.firstContent === 'show-band' && a.band !== null) return { kind: 'band', pos: a.band };
  if (a.mainFirst !== null) return { kind: 'main-first-block', pos: a.mainFirst };
  return null;
}

function judgeFold(r, m) {
  const anchor = foldAnchor(r, m);
  if (!anchor) return [`${r.id}@${m.vw}: no first h2, aside card, body form, show band or main block to place above the fold`];
  if (anchor.pos > N.foldPx) return [`${r.id}@${m.vw}: first ${anchor.kind} ends at ${Math.round(anchor.pos)}px, past ${N.foldPx}`];
  return [];
}

function judgeApi(r, m) {
  const v = [];
  const f = m.facts;
  if (f) {
    if (f.tag !== 'DL') v.push(`${r.id}@${m.vw}: [data-hero-facts] is <${f.tag}>, want <dl>`);
    if (Number(f.count) !== f.items) v.push(`${r.id}@${m.vw}: data-fact-count ${f.count} but ${f.items} [data-hero-fact]`);
    if (!f.dtBeforeDd) v.push(`${r.id}@${m.vw}: a fact lacks dt then dd in DOM order`);
    if (!f.inHero) v.push(`${r.id}@${m.vw}: facts are outside [data-page-hero]`);
    if (f.rows !== 1) v.push(`${r.id}@${m.vw}: ${f.rows} facts rows`);
  }
  if (m.asideCount > 1) v.push(`${r.id}@${m.vw}: ${m.asideCount} [data-doc-aside]`);
  if (m.aside && !['content', 'index'].includes(m.aside.kind)) v.push(`${r.id}@${m.vw}: data-doc-aside-kind "${m.aside.kind}"`);
  return v;
}

const WIDTHS = { gap: ['w390', 'w1023', 'w1024', 'w1440', 'w2056'], split: ['w1024', 'w1440', 'w2056'], duph2: ['w1440'], hero: ['w390', 'w1023', 'w1440', 'w2056'], fold: ['w1440'], api: ['w1440'] };
const JUDGES = { gap: judgeGap, split: judgeSplit, duph2: judgeDupH2, hero: judgeHero, fold: judgeFold, api: judgeApi };

async function measureAll(browser, server) {
  const data = {};
  for (const [vpName, vp] of Object.entries(PG.viewports)) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    for (const route of ROUTES) {
      try {
        const resp = await page.goto(server.base + route.path, { waitUntil: 'networkidle', timeout: 90000 });
        const probe = await page.evaluate(pageProbe);
        probe.status = resp?.status();
        (data[route.id] ??= {})[vpName] = probe;
      } catch (e) { (data[route.id] ??= {})[vpName] = { error: String(e).slice(0, 200) }; }
    }
    await ctx.close();
  }
  return data;
}

async function runSelftest(browser, server) {
  // Each mutation breaks one rule on a live page; the matching judge MUST then report a violation.
  const cases = [
    { name: 'first-section padding-top', route: 'about', vp: 'w1440', judge: judgeGap, mutate: () => { document.querySelector('[data-doc-main]').firstElementChild.style.paddingTop = '40px'; } },
    { name: 'gap off by 20px', route: 'about', vp: 'w1440', judge: judgeGap, mutate: () => { document.querySelector('[data-doc-main]').style.marginTop = '20px'; } },
    { name: 'hairline on first section', route: 'about', vp: 'w1440', judge: judgeGap, mutate: () => { document.querySelector('[data-doc-main]').firstElementChild.style.borderTop = '1px solid #000'; } },
    { name: 'shadow hairline on first section', route: 'about', vp: 'w1440', judge: judgeGap, mutate: () => { document.querySelector('[data-doc-main]').firstElementChild.style.boxShadow = '0 -1px 0 #000'; } },
    { name: 'h2 repeats h1', route: 'about', vp: 'w1440', judge: judgeDupH2, mutate: () => { const h = document.createElement('h2'); h.textContent = document.querySelector('h1').textContent; document.querySelector('[data-doc-main]').prepend(h); } },
    { name: 'split h2/body', route: 'privacy', vp: 'w1440', judge: judgeSplit, mutate: () => { const h = document.querySelector('[data-doc-main] h2'); const b = h.nextElementSibling; const w = document.createElement('div'); w.style.cssText = 'display:flex;gap:16px'; h.before(w); w.append(h, b); } },
    { name: 'hero min-height 480', route: 'members', vp: 'w1440', judge: judgeHero, mutate: () => { document.querySelector('[data-page-hero]').style.minHeight = '480px'; } },
    { name: 'content pushed below the fold', route: 'privacy', vp: 'w1440', judge: judgeFold, mutate: () => { document.querySelector('[data-doc-main]').style.marginTop = '900px'; } },
    { name: 'footer-only form must not anchor the fold', route: 'moi', vp: 'w1440', expectKind: 'main-first-block', mutate: () => { document.querySelectorAll('[data-doc-main] h2, [data-doc-aside], [data-doc-main] form').forEach((e) => e.remove()); if (!document.querySelector('footer form')) { const f = document.createElement('form'); (document.querySelector('footer') ?? document.body).append(f); f.style.minHeight = '20px'; } } },
    { name: 'band pushed to 850px with its heading below the fold', route: 'event-detail', vp: 'w1440', judge: judgeFold, mutate: () => { const b = document.querySelector('[data-home-section="show-band"]'); b.style.marginTop = `${850 - (b.getBoundingClientRect().top + scrollY)}px`; } },
    { name: 'band route anchors on the band', route: 'event-detail', vp: 'w1440', expectKind: 'band', mutate: () => { document.querySelectorAll('[data-doc-aside]').forEach((e) => e.remove()); } },
    // CSS rule, not a judge: only the FIRST block of [data-doc-main] loses the content-gap hairline. Gaps are
    // injected at the first-block positions (want 0) and after earlier content in the first child (want > 0).
    { name: 'content-gap hairline only on the first block', route: 'about', vp: 'w1440', gaps: () => {
      const gap = () => { const g = document.createElement('div'); g.setAttribute('data-content-gap', ''); g.textContent = 'x'; return g; };
      const main = document.querySelector('[data-doc-main]');
      const first = main.firstElementChild;
      const width = (g) => parseFloat(getComputedStyle(g).borderTopWidth) || 0;
      const out = [];
      const lead = gap(); first.prepend(lead); out.push(['gap first in the first section', width(lead), true]); lead.remove();
      const wrap = document.createElement('div'); const inner = gap(); wrap.append(inner); first.prepend(wrap);
      out.push(['gap first in the first section\'s first block', width(inner), true]); wrap.remove();
      const later = gap(); first.append(later); out.push(['gap after earlier content in the first section', width(later), false]);
      const prose = first.querySelector('.doc-prose');
      if (prose) { const deep = gap(); prose.append(deep); out.push(['gap after prose inside the first section', width(deep), false]); }
      return out;
    } },
  ];
  const fails = [];
  // Cache key: rewriting an untracked source file under the same name must change the untracked part
  // of the key, and an unchanged file must not. Tested on untrackedDigest() itself: stateKey() also
  // folds in the Sanity stamp, which is the clock when Sanity is unreadable, so a whole-key compare
  // could differ for that reason alone.
  const probe = 'components/.pg1-selftest-untracked.txt';
  try {
    writeFileSync(probe, 'a');
    const a1 = untrackedDigest();
    const a2 = untrackedDigest();
    writeFileSync(probe, 'b');
    const b = untrackedDigest();
    if (a1 !== a2) fails.push('selftest "untracked content changes the cache key": digest differs for unchanged content, so it is not a content hash');
    if (b === a1) fails.push('selftest "untracked content changes the cache key": digest unchanged after an untracked file\'s content changed');
  } finally { rmSync(probe, { force: true }); }
  for (const c of cases) {
    const route = ROUTES.find((r) => r.id === c.route);
    const ctx = await browser.newContext({ viewport: PG.viewports[c.vp] });
    const page = await ctx.newPage();
    await page.goto(server.base + route.path, { waitUntil: 'networkidle', timeout: 90000 });
    if (c.gaps) {
      for (const [label, w, wantZero] of await page.evaluate(c.gaps)) {
        if (wantZero ? w > 0 : w === 0) fails.push(`selftest "${c.name}": ${label} has border-top ${w}px, want ${wantZero ? '0' : '> 0'}`);
      }
      await ctx.close();
      continue;
    }
    await page.evaluate(c.mutate);
    const m = await page.evaluate(pageProbe);
    if (c.expectKind) {
      const got = foldAnchor(route, m)?.kind;
      if (got !== c.expectKind) fails.push(`selftest "${c.name}": fold anchored on ${got}, want ${c.expectKind}`);
      await ctx.close();
      continue;
    }
    const found = c.judge(route, m);
    if (!found.length) fails.push(`selftest "${c.name}": judge reported nothing after the break, so it cannot catch this defect`);
    await ctx.close();
  }
  return fails;
}

const fails = [];
const server = await startServer();
const browser = await chromium.launch();
try {
  if (check === 'selftest') fails.push(...await runSelftest(browser, server));
  else {
    mkdirSync(CACHE_DIR, { recursive: true });
    const file = `${CACHE_DIR}/measure-${site}.json`;
    const key = await stateKey();
    let data = null;
    if (useCache && existsSync(file)) { const c = JSON.parse(readFileSync(file, 'utf8')); if (c.key === key) data = c.data; }
    if (!data) { data = await measureAll(browser, server); writeFileSync(file, JSON.stringify({ key, data })); }
    let eligible = 0, h2Total = 0;
    for (const r of ROUTES) {
      for (const vpName of WIDTHS[check]) {
        const m = data[r.id]?.[vpName];
        if (!m || m.error || m.status >= 400) { fails.push(`${r.id}@${vpName}: no usable page (${m?.error ?? m?.status})`); continue; }
        fails.push(...JUDGES[check](r, m));
        if (check === 'hero' && (vpName === 'w1440' || vpName === 'w2056') && eligibleOneLine(m)) eligible++;
        if (check === 'duph2' || check === 'split') h2Total += m.h2.filter((h) => h.inMain).length;
        if (check === 'split' && vpName === 'w1440' && m.h2.filter((h) => h.inMain).length < r.minH2) fails.push(`${r.id}@${vpName}: ${m.h2.filter((h) => h.inMain).length} h2 in main, golden needs >= ${r.minH2} (a page with no h2 would pass vacuously)`);
      }
    }
    // Non-vacuity: the measurement must have actually met the things it judges.
    if (check === 'hero' && eligible < N.minEligibleOneLineHeroes * 2) fails.push(`only ${eligible} one-line hero measurements across 1440 and 2056; need >= ${N.minEligibleOneLineHeroes * 2}. The height cap would be vacuous`);
    if (check === 'split' && h2Total < N.minH2Total * WIDTHS.split.length) fails.push(`only ${h2Total} main-column h2 measurements; need >= ${N.minH2Total * WIDTHS.split.length}. The split check would be vacuous`);
  }
} finally { await browser.close(); server.stop(); }

if (fails.length) { console.error(`${check}: ${fails.length} violation(s)`); fails.slice(0, 30).forEach((f) => console.error('  ' + f)); process.exit(1); }
console.log(`${check}: ok`);
