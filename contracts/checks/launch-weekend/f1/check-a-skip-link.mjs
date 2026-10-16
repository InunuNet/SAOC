#!/usr/bin/env node
// A1 — skip link: first focusable element on every route type (SAOC and /national-show/*), hidden until
// focused, visible and uncovered when focused, styled from existing :root tokens, Enter moves focus into the
// single <main id="main-content">. /national-show/* routes validate against the NOS token set (NOS_TOKENS), every other route keeps the SAOC set. Also fails on hydration errors (a client SkipLink/ChromeFrame mismatch).
// Usage: BASE_URL=http://localhost:3002 node contracts/checks/launch-weekend/f1/check-a-skip-link.mjs
import { BASE, VIEWPORTS, SAOC_ROUTES, NOS_ROUTES, launch, newPage, open, loadGolden, resolveRoute, report } from './_lib.mjs';

const TOKENS = ['--primary', '--primary-800', '--primary-700', '--primary-100', '--accent', '--accent-soft', '--parchment', '--ivory', '--bone', '--ink', '--muted'];
// NOS palette (--nc-*, declared on :root by components/nos-chrome/nos-chrome.css), defined in the NOS chrome handoff:
// .agent/memory/project/specs/nos-own-brand-chrome/goldens/f1/HANDOFF.md ("Colours" table: royal #211A57, ground #FBFAF0, gold #F3F2D6, violet #7E3F97)
// and goldens/f1/chrome.css:8-11. NosSkipLink is royal on gold per the NOS rulings; a SAOC route must never use these.
const NOS_TOKENS = ['--nc-royal', '--nc-gold', '--nc-ground', '--nc-violet'];
const problems = [];
const bad = (where, m) => problems.push(`${where}: ${m}`);
const { societySlug } = loadGolden('identity-baseline.json');

const browser = await launch();
for (const vp of VIEWPORTS) {
  for (const route of [...SAOC_ROUTES, ...NOS_ROUTES]) {
    const path = resolveRoute(route, societySlug);
    const where = `${vp.name}px ${path}`;
    const { ctx, page } = await newPage(browser, vp);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await open(page, path);

    const pre = await page.evaluate(() => {
      const a = document.querySelector('a[href="#main-content"]');
      if (!a) return null;
      const r = a.getBoundingClientRect();
      return { hiddenInViewport: r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight || (r.width <= 1 && r.height <= 1) };
    });
    if (!pre) { bad(where, 'no <a href="#main-content"> in the document'); await ctx.close(); continue; }
    if (!pre.hiddenInViewport) bad(where, 'skip link is visible before focus (must be visible on focus only)');

    await page.keyboard.press('Tab');
    const tokenSet = path.startsWith('/national-show') ? NOS_TOKENS : TOKENS;
    const f = await page.evaluate((tokens) => {
      const a = document.activeElement;
      if (!a) return { isSkip: false };
      const probe = document.createElement('span');
      document.body.appendChild(probe);
      const norm = (v) => { probe.style.color = v; return getComputedStyle(probe).color; };
      const allowed = new Set(tokens.map((t) => norm(getComputedStyle(document.documentElement).getPropertyValue(t).trim() || 'transparent')));
      probe.remove();
      const r = a.getBoundingClientRect();
      const cs = getComputedStyle(a);
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      const lum = (c) => { const [R, G, B] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * R + 0.7152 * G + 0.0722 * B; };
      const ratio = (a1, b1) => { const [l1, l2] = [lum(a1), lum(b1)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
      const bg = cs.backgroundColor;
      const bgOpaque = /^rgb\(/.test(bg) || /rgba\([^)]*,\s*1\)/.test(bg);
      return {
        isSkip: a.tagName === 'A' && a.getAttribute('href') === '#main-content' && /skip/i.test(a.textContent),
        text: a.textContent.trim(),
        inViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
        w: r.width, h: r.height,
        uncovered: top === a || a.contains(top),
        visible: cs.visibility === 'visible' && Number(cs.opacity) === 1 && cs.clipPath === 'none',
        bgOpaque, color: cs.color, bg,
        tokenColours: allowed.has(cs.color) && allowed.has(bg),
        contrast: bgOpaque ? ratio(cs.color, bg) : 0,
      };
    }, tokenSet);
    if (!f.isSkip) bad(where, `first Tab did not land on the skip link (focused: ${JSON.stringify(f.text ?? null)})`);
    else {
      if (!f.inViewport) bad(where, 'focused skip link is not fully inside the viewport');
      if (!f.uncovered) bad(where, 'focused skip link is covered by another element at its centre');
      if (!f.visible) bad(where, 'focused skip link is not visible (visibility/opacity/clip-path)');
      if (f.w < 44 || f.h < 44) bad(where, `focused skip link ${f.w.toFixed(1)}x${f.h.toFixed(1)} is under 44x44`);
      if (!f.bgOpaque || f.contrast < 4.5) bad(where, `skip link contrast ${f.contrast.toFixed(2)} < 4.5 or non-opaque background (${f.color} on ${f.bg})`);
      if (!f.tokenColours) bad(where, `skip link colours ${f.color} on ${f.bg} are not ${path.startsWith('/national-show') ? 'NOS' : 'existing SAOC'} :root tokens`);
    }

    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const t = await page.evaluate(() => {
      const mains = document.querySelectorAll('main');
      const a = document.activeElement;
      return {
        hash: location.hash, mains: mains.length, idCount: document.querySelectorAll('#main-content').length,
        mainHasId: !!mains[0] && mains[0].id === 'main-content',
        focusIsMain: !!a && a.id === 'main-content',
        focusInMain: !!a && !!a.closest('main'),
      };
    });
    if (t.mains !== 1 || t.idCount !== 1 || !t.mainHasId) bad(where, `need exactly one <main> carrying id="main-content" (main=${t.mains}, #main-content=${t.idCount}, mainHasId=${t.mainHasId})`);
    if (t.hash !== '#main-content') bad(where, `Enter on skip link left hash "${t.hash}"`);
    if (!t.focusIsMain) bad(where, 'after Enter document.activeElement is not #main-content (focus did not move)');
    await page.keyboard.press('Tab');
    const next = await page.evaluate(() => { const a = document.activeElement; return { inMain: !!a && !!a.closest('main'), inChrome: !!a && !!a.closest('header,nav,footer'), tag: a ? a.tagName : null }; });
    if ((next.inChrome && !next.inMain) || (next.tag !== 'BODY' && !next.inMain)) bad(where, 'Tab after the skip jumped back into chrome instead of continuing from <main>');

    const hydration = errors.filter((e) => /hydrat|did not match|server rendered HTML/i.test(e));
    if (hydration.length) bad(where, `hydration error: ${hydration[0].slice(0, 160)}`);
    await ctx.close();
  }
}
await browser.close();
report(problems, `skip link correct on ${SAOC_ROUTES.length + NOS_ROUTES.length} routes x ${VIEWPORTS.length} viewports at ${BASE}`);
