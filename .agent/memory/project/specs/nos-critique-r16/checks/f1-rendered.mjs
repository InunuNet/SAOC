// nos-critique-r16 F1 rendered (fresh PUBLIC and PREVIEW production builds, next start 3010-3019 minus 3013). QA input, hash-locked.
// Golden: goldens/f1-edits.json. Every measurement runs in both modes; geometry at 1280 and 390.
//   R1  vendor submits: "Submit application" (/vendors/apply) and "Continue" (/vendors/register) carry the reference "Buy ticket" button's
//       exact class list (/national-show/wosa-conference, NOS Button primary) and its computed background (#211a57), text colour, radius,
//       min-height and type; text vs fill >= 4.5:1; keyboard focus paints an indicator outside the button >= 3:1 against the page ground.
//   R2  "Back to tickets" on /tickets/confirmation: box height >= 24px at 1280 and 390, width, font size and line height as at BASE
//       (padding only; the visible text is unchanged).
//   R3  sentence case: each route's h1 equals `after`, its <title> is the template with `titleHead`, og:title starts with `titleHead`; the
//       /vendors h2 equals the golden `after` and no h1/h2 still reads `before`; the "Exhibit & trade pages" subnav names /vendors `after`.
//   R4  /national-show/exhibitors has no "← Show overview" link and no [data-nos-backlink].
//   R5  /national-show/programme renders the hub's Programme section: a #programme section whose text and link targets equal the hub's
//       (/national-show/tickets #programme) on the same build, with the same card boxes (+-1px) at 1280 and 390, after the page's own
//       content and before its "Explore the show" index.
import { finish, goldenJson } from './_lib.mjs';
import { MODES, require, serve } from './_server.mjs';
import { ratio, round2 } from './_color.mjs';
import { fillOf, focusIndicator } from './_probe.mjs';

const { chromium } = require('playwright');
const NAME = 'f1-rendered.mjs';
const G = goldenJson('f1-edits.json');
const WIDTHS = [1280, 390];
const failures = [];
let checks = 0;
const near = (a, b, d = 1) => Math.abs(a - b) <= d;

for (const mode of MODES) {
  const srv = await serve(mode);
  if (srv.failures) { failures.push(...srv.failures.map((f) => `${mode}: ${f}`)); continue; }
  const browser = await chromium.launch();
  try {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, extraHTTPHeaders: srv.headers ?? {} });
      const page = await ctx.newPage();
      const at = (route) => `${mode} ${route} @${width}`;
      const go = async (route) => { const r = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' }); return r ? r.status() : 0; };
      const byText = (label) => page.locator('a, button').filter({ hasText: new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }).first();
      const buttonFacts = async (loc) => loc.evaluate((e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return { cls: e.className, radius: s.borderRadius, minH: s.minHeight, h: Math.round(r.height), font: `${s.fontWeight} ${s.fontSize} ${s.textTransform} ${s.letterSpacing}` }; });

      // R1
      await go(G.buttons.reference.route);
      const refLoc = byText(G.buttons.reference.label);
      if (!(await refLoc.count())) { failures.push(`${at(G.buttons.reference.route)}: reference "${G.buttons.reference.label}" not found (R1)`); }
      const ref = (await refLoc.count()) ? { ...(await buttonFacts(refLoc)), fill: await fillOf(page, refLoc) } : null;
      for (const t of G.buttons.targets) {
        checks += 1;
        if ((await go(t.route)) !== 200) { failures.push(`${at(t.route)}: not 200 (R1)`); continue; }
        const loc = byText(t.label);
        if (!(await loc.count())) { failures.push(`${at(t.route)}: no "${t.label}" button (R1)`); continue; }
        const f = await buttonFacts(loc);
        const fill = await fillOf(page, loc);
        const bg = `rgb(${fill.bg.join(', ')})`;
        if (bg !== G.buttons.background) failures.push(`${at(t.route)}: "${t.label}" background ${bg}, want ${G.buttons.background} (R1)`);
        if (ref) {
          if (f.cls !== ref.cls) failures.push(`${at(t.route)}: "${t.label}" class list differs from the reference "${G.buttons.reference.label}": ${JSON.stringify(f.cls)} vs ${JSON.stringify(ref.cls)} (R1)`);
          for (const k of ['radius', 'minH', 'h', 'font']) if (f[k] !== ref[k]) failures.push(`${at(t.route)}: "${t.label}" ${k} ${f[k]}, reference ${ref[k]} (R1)`);
          if (fill.fg.join() !== ref.fill.fg.join()) failures.push(`${at(t.route)}: "${t.label}" text rgb(${fill.fg}), reference rgb(${ref.fill.fg}) (R1)`);
        }
        const tr = ratio(fill.fg, fill.bg);
        if (tr < G.buttons.minTextRatio) failures.push(`${at(t.route)}: "${t.label}" text rgb(${fill.fg}) on rgb(${fill.bg}) = ${round2(tr)}:1, want >= ${G.buttons.minTextRatio} (R1)`);
        const fi = await focusIndicator(page, loc, fill.ground);
        if (!fi.fv || fi.changed === 0 || fi.best < G.buttons.minFocusRatio) failures.push(`${at(t.route)}: "${t.label}" focus indicator fv=${fi.fv} changed=${fi.changed}px best=${round2(fi.best)}:1 against ground rgb(${fill.ground}), want >= ${G.buttons.minFocusRatio} (R1)`);
      }

      // R2
      checks += 1;
      await go(G.backLink.route);
      await page.waitForTimeout(400);
      const back = byText(G.backLink.label);
      if (!(await back.count())) failures.push(`${at(G.backLink.route)}: no "${G.backLink.label}" link (R2)`);
      else {
        const b = await back.evaluate((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return { w: r.width, h: r.height, fs: s.fontSize, lh: s.lineHeight, deco: s.textDecorationLine }; });
        if (b.h < G.backLink.minHeight) failures.push(`${at(G.backLink.route)}: "${G.backLink.label}" is ${round2(b.w)}x${round2(b.h)}, want height >= ${G.backLink.minHeight} (R2)`);
        if (!near(b.w, G.backLink.before.w, 0.5)) failures.push(`${at(G.backLink.route)}: width ${round2(b.w)}, BASE ${G.backLink.before.w}: padding only, vertical (R2)`);
        if (b.fs !== '14px' || b.lh !== '21.7px' || b.deco !== 'underline') failures.push(`${at(G.backLink.route)}: text changed (font ${b.fs}/${b.lh}, decoration ${b.deco}) (R2)`);
      }

      if (width === 1280) {
        // R3
        for (const p of G.sentenceCase.pairs) {
          checks += 1;
          if ((await go(p.route)) !== 200) { failures.push(`${at(p.route)}: not 200 (R3)`); continue; }
          const s = await page.evaluate(() => ({ h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()), h2: [...document.querySelectorAll('main h2')].map((h) => h.textContent.trim()), title: document.title, og: document.querySelector('meta[property="og:title"]')?.content ?? '' }));
          if (s.h1.length !== 1 || s.h1[0] !== p.after) failures.push(`${at(p.route)}: h1 ${JSON.stringify(s.h1)}, want "${p.after}" (R3)`);
          const title = G.sentenceCase.titleTemplate.replace('{head}', p.titleHead);
          if (s.title !== title) failures.push(`${at(p.route)}: <title> "${s.title}", want "${title}" (R3)`);
          if (!s.og.startsWith(`${p.titleHead} — `)) failures.push(`${at(p.route)}: og:title "${s.og}", want it to start with "${p.titleHead} — " (R3)`);
          if ([...s.h1, ...s.h2].includes(p.before)) failures.push(`${at(p.route)}: a heading still reads "${p.before}" (R3)`);
          if (p.subnav) {
            const label = await page.evaluate(({ nav, href }) => { const n = document.querySelector(`nav[aria-label="${nav}"]`); const a = n && [...n.querySelectorAll('a')].find((x) => x.getAttribute('href') === href); return a ? a.textContent.trim() : null; }, p.subnav);
            if (label !== p.after) failures.push(`${at(p.route)}: "${p.subnav.nav}" label for ${p.subnav.href} is ${JSON.stringify(label)}, want "${p.after}" (R3)`);
          }
          if (p.route === G.sentenceCase.h2.route) {
            if (!s.h2.includes(G.sentenceCase.h2.after)) failures.push(`${at(p.route)}: no h2 "${G.sentenceCase.h2.after}" (h2s ${JSON.stringify(s.h2)}) (R3)`);
            if (s.h2.includes(G.sentenceCase.h2.before)) failures.push(`${at(p.route)}: h2 still "${G.sentenceCase.h2.before}" (R3)`);
          }
        }
      }

      // R4
      checks += 1;
      await go(G.exhibitorsBackLink.route);
      const bl = await page.evaluate((text) => ({ attr: document.querySelectorAll('[data-nos-backlink]').length, text: [...document.querySelectorAll('a')].filter((a) => a.textContent.trim() === text).length }), G.exhibitorsBackLink.text);
      if (bl.attr || bl.text) failures.push(`${at(G.exhibitorsBackLink.route)}: back link still present (${bl.attr} [data-nos-backlink], ${bl.text} "${G.exhibitorsBackLink.text}") (R4)`);

      // R5
      checks += 1;
      const section = async (route) => {
        await go(route);
        return page.evaluate((id) => {
          const s = document.getElementById(id);
          if (!s) return null;
          const idx = document.querySelector('nav[aria-label="Explore the show pages"]');
          return {
            text: s.innerText.replace(/\s+/g, ' ').trim(), hrefs: [...s.querySelectorAll('a')].map((a) => a.getAttribute('href')),
            cards: [...s.querySelectorAll('.nk-wrap')].map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }),
            beforeIndex: idx ? Boolean(s.compareDocumentPosition(idx) & Node.DOCUMENT_POSITION_FOLLOWING) : null,
            h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()),
          };
        }, G.programme.sectionId);
      };
      const hub = await section(G.programme.hubRoute);
      const prog = await section(G.programme.route);
      if (!hub) failures.push(`${at(G.programme.hubRoute)}: hub has no #${G.programme.sectionId} section (R5)`);
      else if (!prog) failures.push(`${at(G.programme.route)}: no #${G.programme.sectionId} section (R5)`);
      else {
        if (prog.text !== hub.text) failures.push(`${at(G.programme.route)}: Programme section text differs from the hub's: ${JSON.stringify(prog.text.slice(0, 160))} vs ${JSON.stringify(hub.text.slice(0, 160))} (R5)`);
        if (JSON.stringify(prog.hrefs) !== JSON.stringify(hub.hrefs)) failures.push(`${at(G.programme.route)}: card links ${JSON.stringify(prog.hrefs)}, hub ${JSON.stringify(hub.hrefs)} (R5)`);
        if (prog.cards.length !== hub.cards.length || !prog.cards.every((c, i) => near(c[0], hub.cards[i][0]) && near(c[1], hub.cards[i][1]))) failures.push(`${at(G.programme.route)}: card boxes ${JSON.stringify(prog.cards)}, hub ${JSON.stringify(hub.cards)} (R5)`);
        if (prog.beforeIndex !== true) failures.push(`${at(G.programme.route)}: the section is not before the "Explore the show" index (R5)`);
        if (JSON.stringify(prog.h1) !== '["Programme"]') failures.push(`${at(G.programme.route)}: h1 ${JSON.stringify(prog.h1)}, want ["Programme"] (R5)`);
      }
      await ctx.close();
    }
  } catch (e) {
    failures.push(`${mode}: render error: ${e && e.message ? e.message : e}`);
  } finally {
    await browser.close();
    await srv.stop();
  }
}
finish(NAME, failures, `F1 rendered: ${checks} checks across ${MODES.join('/')} at ${WIDTHS.join('/')}: royal NOS submit buttons, a >=24px back link, sentence-case heads, no exhibitors back link, programme cards equal to the hub's.`);
