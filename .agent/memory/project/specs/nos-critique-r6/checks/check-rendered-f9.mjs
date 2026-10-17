// nos-critique-r6 F9 - rendered check for Brad chrome decisions #2 and #6 (2026-10-15), via NOS Design 2026-10-17, plus the 44px chrome targets and the nav-config naming.
// Production build (next start, 3010-3019, never 3002). Load rule: one suite at a time, Playwright library, single browser, server stopped by PID in finally.
// Baseline: goldens/f9-baseline.json was captured from the BASE build before any f9 edit (node check-rendered-f9.mjs --capture):
//   SAOC utility bar + header (normalized markup hash, top-strip pixel hash) on /, /about, /contact at 390 and 1280;
//   NOS header (box geometry relative to the header, pixel hash of the header clip) at 390, 768 and 1280.
// NOS routes at 390, 768 and 1280: no utility bar element and no SAOC utility link outside the header, drawer and footer, no Search control,
//   the header's top is y=0, height 146px (two rows, position relative, not sticky) at 390 and 97px (sticky) from 700 up, geometry and pixels equal to BASE.
// Targets: at 390 and 1280 every a/button/input in the NOS header and footer is >= 44px high (icon-only controls 44x44), the open drawer too.
// Reachable: Menu (390, 768) and Tickets (390, 768, 1280) visible, the drawer opens and Escape returns focus to Menu.
// Naming: desktop mega-menu (1280) and drawer (390) render "19th National Orchid Show" and the new Symposium descriptor, none of the old strings;
//   the rail links are /national-show/tickets#ticket-day and #ticket-weekend (href only).
// SAOC pages: pixel- and markup-identical to BASE once the four nav-config strings are mapped back.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { BASE, finish, git, projectRoot, specDir } from './_lib.mjs';
import { AUTH, assertFreshBuild, require, startServer } from './_server.mjs';

const NAME = 'check-rendered-f9.mjs';
const BASELINE = path.join(specDir, 'goldens', 'f9-baseline.json');
const CAPTURE = process.argv.includes('--capture');
const F9_FILES = ['components/nos-chrome/NosHeader.tsx', 'components/nos-chrome/nos-chrome.css', 'components/nos-chrome/NosFooter.tsx', 'components/chrome/UtilityBar.tsx', 'components/chrome/nav-config.ts'];
const SAOC_ROUTES = ['/', '/about', '/contact'];
const NOS_ROUTES = ['/national-show', '/national-show/plan-your-visit'];
const NOS_WIDTHS = [{ width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1280, height: 800 }];
const TARGET = 44;
const H_PHONE = 146;
const H_WIDE = 97;
const NEW_LEAD = '19th National Orchid Show';
const OLD_LEAD = '19th SAOC National Orchid Show';
const NEW_SYMP = 'The National Orchid Show Symposium — what it is, its theme, and who it is for.';
const OLD_SYMP = 'The SAOC Symposium — what it is, its theme, and who it is for.';
const RAIL = [['/national-show/tickets#ticket-day', '/tickets/day-visitor'], ['/national-show/tickets#ticket-weekend', '/tickets/weekend-pass']];

const failures = [];
const { chromium } = require('playwright');
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const near = (a, b, t = 1) => Math.abs(a - b) <= t;
const unrename = (html) => html.split(NEW_LEAD).join(OLD_LEAD).split(NEW_SYMP).join(OLD_SYMP).split(RAIL[0][0]).join(RAIL[0][1]).split(RAIL[1][0]).join(RAIL[1][1]);

// In the page: normalized markup of the SAOC utility bar + header, ids stripped so useId drift never reads as a change.
const saocRegion = () => {
  const bar = document.querySelector('[aria-label="Utility bar"]');
  const head = document.querySelector('header');
  const norm = (el) => (el ? el.outerHTML : '').replace(/\s+/g, ' ').replace(/ (id|aria-controls|aria-labelledby|for)="[^"]+"/g, '');
  return { html: norm(bar) + '|' + norm(head), bottom: Math.ceil(head ? head.getBoundingClientRect().bottom : 0) };
};

// In the page: the NOS header's boxes relative to the header, so a moved header (the utility bar leaving) reads as unchanged.
const nosGeometry = () => {
  const nh = document.querySelector('#nh');
  const o = nh.getBoundingClientRect();
  const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); if (b.width === 0 && b.height === 0) return null; return { x: Math.round(b.left), y: Math.round(b.top - o.top), w: Math.round(b.width), h: Math.round(b.height) }; };
  return { top: Math.round(o.top), h: Math.round(o.height * 10) / 10, brand: r('.nh-brand'), nav: r('.nh-nav'), cta: r('.nh-cta'), burger: r('#nh-burger'), position: getComputedStyle(nh).position };
};

async function newPage(browser, vp) {
  const ctx = await browser.newContext({ viewport: vp, extraHTTPHeaders: { authorization: AUTH }, reducedMotion: 'reduce' });
  return { ctx, page: await ctx.newPage() };
}

const nhClip = async (page, width) => {
  const b = await page.evaluate(() => { const r = document.querySelector('#nh').getBoundingClientRect(); return { y: Math.max(r.top, 0) + window.scrollY, h: r.height }; });
  return { x: 0, y: b.y, width, height: Math.ceil(b.h) };
};

// Open SAOC menus: the Show mega-menu (1280) and the mobile menu with National Show expanded (390). Text and hrefs only.
async function saocMenu(page, width) {
  if (width >= 1240) {
    await page.click('nav[aria-label="Primary"] button[aria-expanded]:has-text("National Show")');
    await page.waitForTimeout(400);
    return page.evaluate(() => { const p = document.querySelector('[aria-label="National Show"]:not(button)') || document.querySelector('[data-testid="mega-menu-lead"]').closest('[aria-label]'); return { text: p.textContent.replace(/\s+/g, ' ').trim(), hrefs: [...p.querySelectorAll('a')].map((a) => a.getAttribute('href')) }; });
  }
  await page.click('button[aria-label="Open menu"]');
  await page.waitForTimeout(400);
  const tog = page.locator('nav[aria-label="Mobile primary"] button[aria-expanded]:has-text("National Show")');
  if (await tog.count() > 0 && (await tog.first().getAttribute('aria-expanded')) !== 'true') { await tog.first().click(); await page.waitForTimeout(300); }
  return page.evaluate(() => { const m = document.querySelector('nav[aria-label="Mobile primary"]').closest('[id]') || document.body; return { text: m.textContent.replace(/\s+/g, ' ').trim(), hrefs: [...m.querySelectorAll('a')].map((a) => a.getAttribute('href')) }; });
}

async function captureBaseline(browser, origin) {
  const out = { base: BASE, saoc: {}, nos: {} };
  for (const width of [390, 1280]) {
    const { ctx, page } = await newPage(browser, { width, height: 844 });
    for (const route of SAOC_ROUTES) {
      const shots = [];
      let doms = [];
      for (let i = 0; i < 2; i += 1) {
        await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
        const a = await page.evaluate(saocRegion);
        doms.push(a.html);
        shots.push({ bottom: a.bottom, sha: sha(await page.screenshot({ clip: { x: 0, y: 0, width, height: Math.max(a.bottom, 1) }, animations: 'disabled' })) });
      }
      out.saoc[`${route}@${width}`] = { domSha: sha(doms[0]), domStable: doms[0] === doms[1], bottom: shots[0].bottom, shotSha: shots[0].sha === shots[1].sha && shots[0].bottom === shots[1].bottom ? shots[0].sha : null };
    }
    await ctx.close();
  }
  out.saocMenus = {};
  for (const width of [390, 1280]) {
    const { ctx, page } = await newPage(browser, { width, height: 844 });
    await page.goto(`${origin}/about`, { waitUntil: 'networkidle' });
    out.saocMenus[String(width)] = await saocMenu(page, width);
    await ctx.close();
  }
  for (const vp of NOS_WIDTHS) {
    const { ctx, page } = await newPage(browser, vp);
    await page.goto(`${origin}${NOS_ROUTES[0]}`, { waitUntil: 'networkidle' });
    const geo = await page.evaluate(nosGeometry);
    writeFileSync(path.join(specDir, 'goldens', `f9-header-${vp.width}.png`), await page.screenshot({ clip: await nhClip(page, vp.width), animations: 'disabled', fullPage: true }));
    out.nos[String(vp.width)] = { geo };
    await ctx.close();
  }
  writeFileSync(BASELINE, JSON.stringify(out, null, 2) + '\n');
  console.log(`captured ${BASELINE}`);
}

// In the page: what is above/around the NOS header, and the search controls.
const chromeProbe = () => {
  const vis = (e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const outside = (a) => !a.closest('#nh') && !a.closest('#nd') && !a.closest('main') && !a.closest('footer');
  const stray = [...document.querySelectorAll('a[href^="mailto:info@saoc.co.za"], a[href="/societies"]')].filter((a) => outside(a));
  const pills = [...document.querySelectorAll('a')].filter((a) => outside(a) && a.textContent.trim() === 'saoc.co.za');
  const search = [...document.querySelectorAll('[role="search"], input[type="search"], form[role="search"]')].map((e) => e.tagName.toLowerCase());
  const searchBtns = [...document.querySelectorAll('#nh button, #nh a, #nd button, #nd a')].filter((e) => /search/i.test((e.getAttribute('aria-label') || '') + ' ' + e.textContent)).map((e) => e.textContent.trim().slice(0, 30));
  const nh = document.querySelector('#nh');
  const burger = document.querySelector('#nh-burger');
  const cta = document.querySelector('.nh-cta');
  return {
    bars: document.querySelectorAll('[aria-label="Utility bar"]').length,
    stray: stray.length + pills.length,
    search: search.length + searchBtns.length,
    top: nh.getBoundingClientRect().top,
    h: nh.getBoundingClientRect().height,
    pos: getComputedStyle(nh).position,
    burgerVis: burger ? vis(burger) : false, burgerH: burger ? burger.getBoundingClientRect().height : 0,
    ctaVis: cta ? vis(cta) : false, ctaHref: cta ? cta.getAttribute('href') : null,
  };
};

// In the page: interactive controls under a root that are shorter than 44px (icon-only controls need 44x44). Inline links in running copy are exempt.
const smallTargets = (rootSel) => {
  const out = [];
  for (const root of document.querySelectorAll(rootSel)) {
    for (const el of root.querySelectorAll('a[href], button, input, select, textarea')) {
      const cs = getComputedStyle(el); const b = el.getBoundingClientRect();
      if (b.width <= 1 || b.height <= 1 || cs.display === 'none' || cs.visibility === 'hidden' || el.type === 'hidden' || el.closest('[hidden]')) continue;
      if (el.id === 'nh-sentinel' || el.classList.contains('nh-sentinel')) continue;
      const p = el.closest('p');
      if (el.tagName === 'A' && p && p.textContent.trim() !== el.textContent.trim()) continue;
      const iconOnly = el.textContent.trim() === '' && el.tagName !== 'INPUT';
      if (b.height < 43.5 || (iconOnly && b.width < 43.5)) out.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 36)}" ${Math.round(b.width)}x${Math.round(b.height * 10) / 10}`);
    }
  }
  return out;
};

async function checkNos(browser, origin, base) {
  for (const vp of NOS_WIDTHS) {
    const { ctx, page } = await newPage(browser, vp);
    const phone = vp.width < 700;
    for (const route of NOS_ROUTES) {
      const tag = `${route} @${vp.width}`;
      const res = await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
      if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); continue; }
      const p = await page.evaluate(chromeProbe);
      if (p.bars > 0) failures.push(`${tag}: the SAOC utility bar is still in the DOM (${p.bars}); on NOS the variant renders nothing (Brad chrome decision #2)`);
      if (p.stray > 0) failures.push(`${tag}: ${p.stray} SAOC utility link(s) (email, saoc.co.za, Join a society) remain outside the header, menu and footer`);
      if (p.search > 0) failures.push(`${tag}: ${p.search} Search control(s) on a NOS page (Brad chrome decision #2)`);
      if (!near(p.top, 0, 0.6)) failures.push(`${tag}: the header's top is y=${p.top}, want 0 (no reserved height where the utility bar was)`);
      const wantH = phone ? H_PHONE : H_WIDE;
      if (!near(p.h, wantH, 1.5)) failures.push(`${tag}: header is ${p.h}px high, want ${wantH}px (${phone ? 'two rows' : 'one row, v4'})`);
      if (p.pos !== (phone ? 'relative' : 'sticky')) failures.push(`${tag}: header position ${p.pos}, want ${phone ? 'relative (not sticky, decision #6)' : 'sticky'}`);
      if (!p.ctaVis || p.ctaHref !== '/national-show/tickets') failures.push(`${tag}: the Tickets CTA is not visible or not linked to /national-show/tickets`);
      if (vp.width < 1260 && (!p.burgerVis || p.burgerH < 43.5)) failures.push(`${tag}: the Menu button is missing or under 44px high`);
      if (route === NOS_ROUTES[0]) {
        const g = await page.evaluate(nosGeometry);
        const want = base.nos[String(vp.width)];
        for (const k of ['brand', 'nav', 'cta', 'burger']) {
          const a = g[k]; const b0 = want.geo[k]; const b = b0 && b0.w === 0 && b0.h === 0 ? null : b0;
          if ((a === null) !== (b === null) || (a && b && ['x', 'y', 'w', 'h'].some((q) => !near(a[q], b[q], 1)))) failures.push(`${tag}: ${k} box ${JSON.stringify(a)} differs from BASE ${JSON.stringify(b)} (relative to the header)`);
        }
        if (!near(g.h, want.geo.h, 1.5)) failures.push(`${tag}: header height ${g.h} differs from BASE ${want.geo.h}`);
        const shotDir = path.join(projectRoot, '.tmp', 'sandbox', 'critique-r6-shots', 'f9');
        mkdirSync(shotDir, { recursive: true });
        const devPng = path.join(shotDir, `header-${vp.width}.png`);
        writeFileSync(devPng, await page.screenshot({ clip: await nhClip(page, vp.width), animations: 'disabled', fullPage: true }));
        try { execFileSync('python3', [path.join(specDir, 'goldens', 'compare-png.py'), path.join(specDir, 'goldens', `f9-header-${vp.width}.png`), devPng], { encoding: 'utf8' }); } catch (e) { failures.push(`${tag}: header pixels differ from BASE beyond the sub-pixel tolerance: ${String(e.stdout ?? e.message).trim()}`); }
      }
      if (vp.width !== 768) {
        const small = [...await page.evaluate(smallTargets, '#nh'), ...await page.evaluate(smallTargets, 'footer')];
        for (const s of small) failures.push(`${tag}: target under 44px: ${s}`);
      }
    }
    // scroll behaviour
    await page.goto(`${origin}${NOS_ROUTES[0]}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(400);
    const sc = await page.evaluate(() => { const nh = document.querySelector('#nh'); return { top: nh.getBoundingClientRect().top, cls: nh.classList.contains('is-scrolled') }; });
    if (phone && sc.top > -10) failures.push(`@${vp.width} scrolled: the phone header must scroll away (decision #6), its top is ${sc.top}`);
    if (!phone && (!near(sc.top, 0, 0.6) || !sc.cls)) failures.push(`@${vp.width} scrolled: the header must stay sticky at 0 with .is-scrolled (top ${sc.top}, class ${sc.cls})`);
    await page.evaluate(() => window.scrollTo(0, 0));
    if (vp.width < 1260) await checkDrawer(page, vp);
    else await checkMega(page);
    await ctx.close();
  }
}

async function checkDrawer(page, vp) {
  const tag = `drawer @${vp.width}`;
  await page.click('#nh-burger');
  await page.waitForTimeout(400);
  const d = await page.evaluate(() => {
    const nd = document.querySelector('#nd');
    return {
      open: !nd.hidden && getComputedStyle(nd).display !== 'none' && getComputedStyle(nd).visibility !== 'hidden',
      text: nd.textContent.replace(/\s+/g, ' '), hrefs: [...nd.querySelectorAll('a')].map((a) => a.getAttribute('href')),
      bars: document.querySelectorAll('[aria-label="Utility bar"]').length,
    };
  });
  if (!d.open) { failures.push(`${tag}: the drawer did not open`); return; }
  if (!d.text.includes(NEW_LEAD)) failures.push(`${tag}: the drawer lead does not read "${NEW_LEAD}"`);
  if (d.text.includes(OLD_LEAD)) failures.push(`${tag}: the old lead "${OLD_LEAD}" is still in the drawer`);
  if (!d.text.includes(NEW_SYMP)) failures.push(`${tag}: the Symposium descriptor is not "${NEW_SYMP}"`);
  if (d.text.includes(OLD_SYMP) || d.text.includes('SAOC Symposium')) failures.push(`${tag}: the old Symposium descriptor is still in the drawer`);
  for (const [want, old] of RAIL) { if (!d.hrefs.includes(want)) failures.push(`${tag}: no drawer link to ${want}`); if (d.hrefs.includes(old)) failures.push(`${tag}: the old rail link ${old} remains`); }
  if (vp.width === 390) for (const s of await page.evaluate(smallTargets, '#nd')) failures.push(`${tag}: target under 44px: ${s}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => { const nd = document.querySelector('#nd'); return { open: !nd.hidden && getComputedStyle(nd).display !== 'none' && getComputedStyle(nd).visibility !== 'hidden', focus: document.activeElement && document.activeElement.id }; });
  if (after.open) failures.push(`${tag}: Escape did not close the drawer`);
  else if (after.focus !== 'nh-burger') failures.push(`${tag}: after Escape focus is on "${after.focus}", want #nh-burger`);
}

async function checkMega(page) {
  const tag = 'mega-menu @1280';
  await page.click('#nh-show-trigger');
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    const mega = document.querySelector('#nh-mega');
    if (!mega) return null;
    return { text: mega.textContent.replace(/\s+/g, ' '), hrefs: [...mega.querySelectorAll('a')].map((a) => a.getAttribute('href')), small: null };
  });
  if (!m) { failures.push(`${tag}: #nh-mega not found after clicking the National Show trigger`); return; }
  if (!m.text.includes(NEW_LEAD)) failures.push(`${tag}: the lead does not read "${NEW_LEAD}"`);
  if (m.text.includes(OLD_LEAD)) failures.push(`${tag}: the old lead "${OLD_LEAD}" is still in the mega-menu`);
  if (!m.text.includes(NEW_SYMP)) failures.push(`${tag}: the Symposium descriptor is not "${NEW_SYMP}"`);
  if (m.text.includes(OLD_SYMP) || m.text.includes('SAOC Symposium')) failures.push(`${tag}: the old Symposium descriptor is still in the mega-menu`);
  for (const [want, old] of RAIL) { if (!m.hrefs.includes(want)) failures.push(`${tag}: no rail link to ${want}`); if (m.hrefs.includes(old)) failures.push(`${tag}: the old rail link ${old} remains`); }
  for (const s of await page.evaluate(smallTargets, '#nh-mega')) failures.push(`${tag}: target under 44px: ${s}`);
  await page.keyboard.press('Escape');
}

async function checkSaoc(browser, origin, base) {
  for (const width of [390, 1280]) {
    const { ctx, page } = await newPage(browser, { width, height: 844 });
    for (const route of SAOC_ROUTES) {
      const key = `${route}@${width}`;
      const want = base.saoc[key];
      await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
      const now = await page.evaluate(saocRegion);
      if (want.domStable && sha(unrename(now.html)) !== want.domSha) failures.push(`SAOC ${key}: utility bar + header markup differs from BASE`);
      if (route === '/about') {
        await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
        const menu = await saocMenu(page, width);
        const baseMenu = base.saocMenus[String(width)];
        const mt = unrename(menu.text);
        const mh = menu.hrefs.map((h) => unrename(h));
        if (mt !== baseMenu.text) failures.push(`SAOC open menu @${width}: text differs from BASE beyond the 2 strings and 2 hrefs (naming ruling)`);
        if (JSON.stringify(mh) !== JSON.stringify(baseMenu.hrefs)) failures.push(`SAOC open menu @${width}: hrefs differ from BASE beyond the 2 rail hrefs`);
        if (!menu.text.includes(NEW_LEAD) || !menu.text.includes(NEW_SYMP) || menu.text.includes(OLD_LEAD) || menu.text.includes('SAOC Symposium')) failures.push(`SAOC open menu @${width}: must show "${NEW_LEAD}" and the new Symposium descriptor (site-wide naming ruling), none of the old`);
        for (const [want, old] of RAIL) { if (!menu.hrefs.includes(want) || menu.hrefs.includes(old)) failures.push(`SAOC open menu @${width}: rail href ${want} missing or ${old} still present`); }
        await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
      }
      if (!now.html.includes('Utility bar')) failures.push(`SAOC ${key}: the utility bar is gone from a SAOC page`);
      if (want.shotSha) {
        const shot = sha(await page.screenshot({ clip: { x: 0, y: 0, width, height: Math.max(now.bottom, 1) }, animations: 'disabled' }));
        if (now.bottom !== want.bottom || shot !== want.shotSha) failures.push(`SAOC ${key}: utility bar + header pixels differ from BASE (strip ${now.bottom}px vs ${want.bottom}px)`);
      }
    }
    await ctx.close();
  }
}

const stale = assertFreshBuild(F9_FILES);
if (stale.length > 0 && !CAPTURE) finish(NAME, stale);
if (CAPTURE) {
  const dirty = git('diff', '--name-only', BASE, '--', ...F9_FILES).trim();
  if (dirty) { console.error(`refusing to capture: ${dirty} differs from ${BASE}; the baseline must come from an unedited BASE build`); process.exit(2); }
  if (stale.length > 0) { console.error(stale.join('\n')); process.exit(2); }
}
if (!CAPTURE && !existsSync(BASELINE)) finish(NAME, [`goldens/f9-baseline.json is missing; capture it from a BASE build first (node ${NAME} --capture)`]);

let browser;
let stop = () => {};
try {
  const srv = await startServer();
  stop = srv.stop;
  browser = await chromium.launch();
  if (CAPTURE) {
    await captureBaseline(browser, srv.origin);
  } else {
    const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
    await checkNos(browser, srv.origin, base);
    await checkSaoc(browser, srv.origin, base);
  }
} catch (err) {
  failures.push(`${err.name}: ${err.message}`);
} finally {
  if (browser) await browser.close();
  stop();
}
if (!CAPTURE) finish(NAME, failures, 'Brad chrome decisions #2/#6: no utility bar or Search on NOS pages, header at y=0 (146px relative at 390, 97px sticky from 700), chrome targets >= 44px, nav-config naming and rail links, SAOC chrome identical to BASE.');
else if (failures.length > 0) finish(NAME, failures);
