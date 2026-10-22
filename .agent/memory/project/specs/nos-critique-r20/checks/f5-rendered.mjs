// nos-critique-r20 F5 rendered (fresh PUBLIC and PREVIEW production builds, next start 3010-3019 minus 3013). QA input, hash-locked.
// Goldens: goldens/f5-edits.json, f3-edits.json (saocRoutes, nosRoutes, saoc.route). Both modes; 1280 and 390. The SAOC footer (the page's
// last <footer>) is measured on the SAOC routes, the NOS footer (footer#nf) on the NOS routes; the SAOC REG/NPO reference is measured live on
// golden saoc.route on the same build. Fixed and sticky chrome outside the footer is hidden first (visibility, so no box moves).
//   P1  the sign-up input and its submit button share one row in both footers at both widths (same top +-1px, button right of the input).
//   P2  every footer link row is one line: each list row, the WOSA link and each legal link (distinct line-box tops of its text = 1).
//   P3  the WOSA link has text-decoration-line none at rest in both footers; in the NOS footer it is underlined on hover.
//   P4  NOS REG/NPO has SAOC REG/NPO's computed font-weight and tracking (letter-spacing / font-size, +-0.005em; SAOC sets 0.1em at 11px,
//       NOS keeps its 12px), and keeps the NOS gold (the computed ground of the gold sign-up button).
//   P5  both inputs are labelled exactly "Email address"; the placeholder stays "your@email.co.za".
//   P6  both inputs carry autocomplete=email, inputmode=email and spellcheck=false.
import { finish, goldenJson } from './_lib.mjs';
import { MODES, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'f5-rendered.mjs';
const G = goldenJson('f5-edits.json');
const G3 = goldenJson('f3-edits.json');
const failures = [];
let checks = 0;
const near = (a, b, t = 1) => Math.abs(a - b) <= t;

const load = async (page, origin, route, at) => {
  const r = await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
  if (!r || r.status() !== 200) { failures.push(`${at}: HTTP ${r ? r.status() : 0}`); return false; }
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.querySelectorAll('body *').forEach((el) => {
      if (el.closest('footer')) return;
      const pos = getComputedStyle(el).position;
      if (pos === 'fixed' || pos === 'sticky') el.style.visibility = 'hidden';
    });
  });
  return true;
};

const measure = (page, sel, wosaHref) => page.evaluate(({ sel, wosaHref }) => {
  const f = sel === 'last' ? [...document.querySelectorAll('footer')].pop() : document.querySelector(sel);
  if (!f) return null;
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height }; };
  const lines = (el) => { const r = document.createRange(); r.selectNodeContents(el); return new Set([...r.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top))).size; };
  const row = (el) => ({ text: el.textContent.replace(/\s+/g, ' ').trim(), lines: lines(el) });
  const grid = f.firstElementChild;
  const col1 = grid ? grid.firstElementChild : null;
  const reg = f.querySelector('.nf-reg') ?? (col1 ? col1.querySelector(':scope > span') : null);
  const input = f.querySelector('input[type="email"]');
  const button = input && input.form ? input.form.querySelector('button[type="submit"]') : null;
  const wosa = [...f.querySelectorAll('a')].find((a) => a.getAttribute('href') === wosaHref) ?? null;
  const bar = f.children[1] ? f.children[1] : null;
  const rs = reg ? getComputedStyle(reg) : null;
  return {
    rows: [...f.querySelectorAll('ul > li > *')].map(row),
    legal: bar ? [...bar.querySelectorAll('a')].map(row) : [],
    wosa: wosa ? { ...row(wosa), deco: getComputedStyle(wosa).textDecorationLine } : null,
    reg: rs ? { weight: rs.fontWeight, ls: parseFloat(rs.letterSpacing) || 0, fs: parseFloat(rs.fontSize), color: rs.color } : null,
    gold: f.querySelector('.nf-form button') ? getComputedStyle(f.querySelector('.nf-form button')).backgroundColor : null,
    input: input ? { ...box(input), labels: input.labels ? [...input.labels].map((l) => l.textContent.replace(/\s+/g, ' ').trim()) : [], placeholder: input.getAttribute('placeholder'), autocomplete: input.getAttribute('autocomplete'), inputmode: input.getAttribute('inputmode'), spellcheck: input.getAttribute('spellcheck') } : null,
    button: button ? box(button) : null,
  };
}, { sel, wosaHref });

function judge(m, at, skin, saocReg) {
  if (!m) { failures.push(`${at}: footer not measurable (INFRA)`); return; }
  const i = m.input; const b = m.button;
  // P1
  if (!i || !b) failures.push(`${at}: no sign-up input/button (P1)`);
  else if (!near(b.y, i.y) || b.x < i.x + i.w - 0.5) failures.push(`${at}: input (${Math.round(i.x)},${Math.round(i.y)} ${Math.round(i.w)}w) and button (${Math.round(b.x)},${Math.round(b.y)}) are not on one row (P1)`);
  // P2
  for (const r of [...m.rows, ...m.legal, ...(m.wosa ? [m.wosa] : [])]) if (r.lines !== 1) failures.push(`${at}: "${r.text}" runs to ${r.lines} lines, want 1 (P2)`);
  if (m.rows.length === 0) failures.push(`${at}: no list rows (P2)`);
  // P3
  if (!m.wosa) failures.push(`${at}: no WOSA link (P3)`);
  else if (m.wosa.deco !== 'none') failures.push(`${at}: the WOSA link is ${m.wosa.deco} at rest, want none (P3)`);
  // P4
  if (skin === 'NOS') {
    if (!m.reg || !saocReg) failures.push(`${at}: REG/NPO not measurable on both footers (P4)`);
    else {
      if (m.reg.weight !== saocReg.weight) failures.push(`${at}: REG/NPO weight ${m.reg.weight}, SAOC ${saocReg.weight} (P4)`);
      const t = m.reg.ls / m.reg.fs; const s = saocReg.ls / saocReg.fs;
      if (!near(t, s, G.trackingTolerance)) failures.push(`${at}: REG/NPO tracking ${t.toFixed(3)}em (${m.reg.ls}px at ${m.reg.fs}px), SAOC ${s.toFixed(3)}em (${saocReg.ls}px at ${saocReg.fs}px) (P4)`);
      if (!m.gold || m.reg.color !== m.gold) failures.push(`${at}: REG/NPO colour ${m.reg.color}, NOS gold ${m.gold} (P4)`);
    }
  }
  // P5 + P6
  if (i) {
    if (i.labels.length !== 1 || i.labels[0] !== G.label) failures.push(`${at}: input labels ${JSON.stringify(i.labels)}, want ["${G.label}"] (P5)`);
    if (i.placeholder !== G.placeholder) failures.push(`${at}: placeholder ${JSON.stringify(i.placeholder)}, want ${JSON.stringify(G.placeholder)} (P5)`);
    if (i.autocomplete !== 'email' || i.inputmode !== 'email' || i.spellcheck !== 'false') failures.push(`${at}: input autocomplete=${i.autocomplete} inputmode=${i.inputmode} spellcheck=${i.spellcheck}, want email/email/false (P6)`);
  }
}

for (const mode of MODES) {
  const srv = await serve(mode);
  if (srv.failures) { failures.push(...srv.failures.map((f) => `${mode}: ${f}`)); continue; }
  const browser = await chromium.launch();
  try {
    for (const width of G.widths) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', extraHTTPHeaders: srv.headers ?? {} });
      const page = await ctx.newPage();
      let saocReg = null;
      if (await load(page, srv.origin, G3.saoc.route, `${mode} SAOC ${G3.saoc.route} @${width} (REG reference)`)) saocReg = (await measure(page, 'last', G.wosaHref))?.reg ?? null;
      for (const [skin, routes, sel] of [['SAOC', G3.saocRoutes, 'last'], ['NOS', G3.nosRoutes, 'footer#nf']]) {
        for (const route of routes) {
          checks += 1;
          const at = `${mode} ${skin} ${route} @${width}`;
          if (!(await load(page, srv.origin, route, at))) continue;
          judge(await measure(page, sel, G.wosaHref), at, skin, saocReg);
          if (skin === 'NOS') {
            const link = page.locator(`footer#nf a[href="${G.wosaHref}"]`);
            if (await link.count()) {
              await link.hover();
              const deco = await link.evaluate((el) => getComputedStyle(el).textDecorationLine);
              if (!deco.includes('underline')) failures.push(`${at}: the WOSA link is ${deco} on hover, want underline (P3)`);
              await page.mouse.move(0, 0);
            }
          }
        }
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

finish(NAME, failures, `${checks} footer captures (${MODES.join('/')}, ${G.widths.join('/')}): the sign-up inline in both footers, every link row one line, WOSA plain at rest and underlined on NOS hover, NOS REG/NPO at SAOC's weight and tracking in gold, "Email address" labels, email inputs with spellcheck off.`);
