// Gate for nos-type-tokens (NR-1, NR-6, NR-7, NR-8, S-2, TYPE-11): a computed-style walk over every NOS route at 390/768/1280/1440/2056 on a fixture-replay production build.
// Usage: node gate-type.mjs   (build.sh first). Exit 1 with a grouped failure list; evidence in ../evidence/gate-type.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { withServer, launchChromium, newContext, ROUTES, VALUES, EVIDENCE_DIR } from './_lib.mjs';
import { collectPage } from './collect.mjs';
import { clampPx, wantWeight, contrast, luminance, opszOf, labelKind, summarise } from './type-rules.mjs';

const V = VALUES;
const TOL = V.tolerancePx;
const R = V.roles;
const cfg = {
  exempt: V.exempt,
  probes: { name: R.nameSelector, docH3: R.docH3Selector, standfirst: R.standfirstSelector, closing: R.closingSelector, prose: R.proseSelector, heroLedeHub: R.heroLedeHubSelector, themeLine: R.themeLineSelector, heroFactDd: R.heroFactDdSelector, num: R.numSelector, measureExempt: V.measureExempt.selector },
  capsAllow: V.labels.capsAllowSelectors,
  labelSet: V.labels.labelSetSelector,
};
const first = (fam) => String(fam).split(',')[0].toLowerCase();
const isFraunces = (n) => first(n.fam).includes('fraunces');
const isKarla = (n) => first(n.fam).includes('karla');
const tiny = (n) => n.w <= V.weightBand.skipBoxPx || n.h <= V.weightBand.skipBoxPx;
const near = (a, b, t = TOL) => Math.abs(a - b) <= t;
const routesToWalk = [...ROUTES.required, '/archive', '/zz-not-a-route-type-gate'];

withServer(14, 'gate-type', async (server, c) => {
  const browser = await launchChromium();
  const fails = [];
  const add = (rule, detail, where) => fails.push({ key: `${rule}: ${detail}`, where });
  const stats = { pages: 0, frauncesNodes: 0, wViolations: 0, perViewport: {} };

  /** Rules that apply to every walked page, and to the opened Menu panel. */
  function walkBasic(nodes, where) {
    for (const n of nodes) {
      if (n.inLockup || n.inBanner) continue;
      if (isFraunces(n) && !tiny(n)) {
        stats.frauncesNodes += 1;
        const want = wantWeight(n.size, V.weightBand);
        if (Number(n.wt) !== want) { stats.wViolations += 1; add('R-W', `${n.sel} ${Number(n.size.toFixed(2))}px weight ${n.wt}, want ${want}`, where); }
      }
      if (tiny(n) || n.inFooter) continue; // footer sizes (the 13px lines) are out of scope; only the footer FAMILY is gated (TYPE-11)
      const caps = n.tt === 'uppercase' && n.size >= V.floors.minCapsPx;
      if (n.headTag && n.size < V.floors.minHeadingPx) add('R-F heading <14px', `${n.sel} ${n.size}px`, where);
      else if (n.size < V.floors.minRunningTextPx && !caps) add('R-F text <14px', `${n.sel} ${Number(n.size.toFixed(2))}px "${n.text}"`, where);
      if (n.color === V.colours.violetBanned) add('NR-8 violet text', n.sel, where);
    }
  }

  for (const vw of V.viewports) {
    const ctx = await newContext(browser, { width: vw, height: 900 });
    const page = await ctx.newPage();
    let walked = 0;
    for (const p of routesToWalk) {
      const where = `${p}@${vw}`;
      const resp = await page.goto(`${server.nos}${p}`, { waitUntil: 'load', timeout: 45000 }).catch(() => null);
      if (!resp || resp.status() >= 500) { add('route', 'did not render', where); continue; }
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(250);
      const d = await page.evaluate(collectPage, cfg);
      walked += 1; stats.pages += 1;
      if (V.shots.viewports.includes(vw)) { mkdirSync(`${EVIDENCE_DIR}/shots`, { recursive: true }); await page.screenshot({ path: `${EVIDENCE_DIR}/shots/${p === '/' ? 'home' : p.replace(/^\//, '').replace(/\//g, '_')}-${vw}.png`, fullPage: true }); }
      const N = d.nodes; const vp = d.vw;
      walkBasic(N, where);

      // ---- Karla roles: body, labels, footer (NR-6, NR-8, TYPE-11) ----
      const bodyEl = N.filter((n) => (n.tag === 'p' || n.tag === 'li') && isKarla(n) && n.inMain && !n.inCard && !n.inHeader && !n.inFooter && n.len >= 40 && !tiny(n));
      const bodySize = clampPx(V.clamps.body, vp);
      for (const n of bodyEl) {
        if (n.wt !== String(V.clamps.body.weight)) add('NR-6 body weight', `${n.sel} ${n.wt}, want 450`, where);
        if (!near(n.size, bodySize)) add('NR-6 body size', `${n.sel} ${Number(n.size.toFixed(2))}px, want ${Number(bodySize.toFixed(2))}`, where);
        if (!near(Number.parseFloat(n.lh), V.clamps.body.lh * n.size)) add('NR-6 body line-height', `${n.sel} ${n.lh}, want ${Number((V.clamps.body.lh * n.size).toFixed(1))}px`, where);
        if (n.color !== V.colours.ink700) add('R-C body colour', `${n.sel} ${n.color}, want ink-700`, where);
        if (!n.inForm && !n.matches.measureExempt && !near(n.w, Math.min(n.pw, V.measurePx), V.measureTolPx)) add('R-M measure', `${n.sel} width ${Number(n.w.toFixed(1))}, want ${Math.min(Math.round(n.pw), V.measurePx)}`, where);
      }
      const lead = N.filter((n) => (n.matches.standfirst || n.matches.closing) && !tiny(n));
      for (const n of lead) {
        const k = V.clamps.standfirst;
        if (!isFraunces(n) || n.wt !== String(k.weight)) add('NR-6 standfirst face/weight', `${n.sel} ${first(n.fam)} ${n.wt}, want Fraunces 400`, where);
        if (!near(n.size, clampPx(k, vp))) add('NR-6 standfirst size', `${n.sel} ${Number(n.size.toFixed(2))}px, want ${Number(clampPx(k, vp).toFixed(2))}`, where);
        if (!near(Number.parseFloat(n.lh), k.lh * n.size)) add('NR-6 standfirst line-height', `${n.sel} ${n.lh}`, where);
        if (!near(n.w, Math.min(n.pw, V.measurePx), V.measureTolPx)) add('R-M measure', `${n.sel} width ${Number(n.w.toFixed(1))}, want ${Math.min(Math.round(n.pw), V.measurePx)}`, where);
        if (vp === V.standfirstBodyRatio.atViewport && bodyEl.length) {
          const ratio = n.size / bodyEl[0].size;
          if (ratio < V.standfirstBodyRatio.min || ratio > V.standfirstBodyRatio.max) add('NR-6 standfirst:body ratio', `${ratio.toFixed(2)} outside ${V.standfirstBodyRatio.min}-${V.standfirstBodyRatio.max}`, where);
        }
      }
      const L = V.labels;
      const tuples = new Set();
      for (const n of N) {
        if (n.inLockup || n.inBanner || n.isOptionLabel || tiny(n) || !isKarla(n)) continue;
        if (n.inFooter && !n.cls.includes('nf-head')) continue; // only the footer column heads are held to the Caps tuple; the newsletter form's own button is a SAOC-lane component
        const upper = n.tt === 'uppercase';
        if (!upper && !n.inLabelSet) continue;
        if (n.tag === 'p' && n.len >= 40) continue;
        const kind = labelKind(n, L);
        if (n.cls.includes(L.navLinkClass) && kind !== 'formLabel') add('NR-8 nav link tuple', `${n.sel} is ${kind ?? 'not a tuple'}, nav links use the Form-label tuple (Karla 500/14)`, where);
        tuples.add(`${n.size}/${n.wt}/${n.ls}/${n.tt}`);
        if (!kind) add('NR-8 label tuple', `${n.sel} ${n.size}px w${n.wt} ls ${n.ls} ${n.tt} is not Label, Form label or Caps`, where);
        else if (kind === 'label' && !n.bgImg && n.bg) {
          const light = luminance(n.bg) > L.colours.lightLuminanceMin;
          const want = V.colours[light ? L.colours.light : L.colours.dark];
          if (n.color !== want) add('NR-8 label colour', `${n.sel} ${n.color} on ${light ? 'light' : 'dark'}, want ${want}`, where);
        } else if (kind === 'caps' && !n.closestCapsAllow) add('NR-8 caps outside allowlist', `${n.sel} "${n.text}"`, where);
      }
      if (tuples.size > L.maxTuplesPerRoute) add('NR-8 label count', `${tuples.size} distinct label tuples, max ${L.maxTuplesPerRoute}`, where);
      for (const n of N) {
        if (!n.inFooter || n.inLockup || n.inBanner || tiny(n)) continue;
        const f = first(n.fam);
        if (!f.includes('karla')) add('TYPE-11 footer family', `${n.sel} renders ${f.slice(0, 24)}`, where);
      }
      const controls = await page.evaluate(() => [...document.querySelectorAll('footer input, footer button, footer select, footer textarea, .nf input, .nf button')].map((e) => ({ tag: e.tagName.toLowerCase(), fam: getComputedStyle(e).fontFamily })));
      for (const e of controls) if (!first(e.fam).includes('karla')) add('TYPE-11 footer control family', `${e.tag} renders ${first(e.fam).slice(0, 24)}`, where);

      // ---- headings: Display / H2 / Name / H3 (NR-7) and the hero roles ----
      const heads = d.heads.filter((h) => h.vis);
      const dispSize = clampPx(V.clamps.display, vp);
      let lastH2 = null;
      for (const h of heads) {
        const fr = first(h.fam).includes('fraunces');
        if (h.tag === 'h1' && fr) {
          const k = V.clamps.display;
          const longOk = vp < 768 && h.cls.includes('is-long') && h.size >= 32 && h.size <= dispSize + TOL;
          if (!near(h.size, dispSize) && !longOk) add('NR-7 h1 size', `${h.size}px, want ${Number(dispSize.toFixed(2))}`, where);
          if (h.wt !== String(k.weight)) add('NR-7 h1 weight', h.wt, where);
          if (opszOf(h.fvs) !== k.opsz) add('R-O h1 opsz', `${h.fvs}, want opsz ${k.opsz}`, where);
        } else if (h.tag === 'h2' && V.exemptNodes.some((x) => x.route === p && h.text.startsWith(x.headingStartsWith))) {
          continue; // exempt: SAOC lane (values.json exemptNodes)
        } else if (h.tag === 'h2' && fr) {
          const hooks = V.roles.hooks;
          const role = h.cls.includes(hooks.cardTitle) ? 'title' : h.cls.includes(hooks.h3Visual) ? 'h3' : 'h2';
          const k = V.clamps[role];
          if (!near(h.size, clampPx(k, vp))) add(`NR-7 h2 (${role} role) size`, `${h.size}px, want ${Number(clampPx(k, vp).toFixed(2))} "${h.text}"`, where);
          if (h.wt !== String(k.weight)) add(`NR-7 h2 (${role} role) weight`, `${h.wt}, want ${k.weight}`, where);
          if (opszOf(h.fvs) !== k.opsz) add('R-O h2 opsz', `${h.fvs}, want opsz ${k.opsz} (${role})`, where);
          if (role === 'h2') lastH2 = h;
        } else if (h.tag === 'h2' && !fr) {
          add('NR-7 h2 not Fraunces', `${first(h.fam).slice(0, 24)} "${h.text}"`, where);
        } else if (h.tag === 'h3' && fr) {
          if (h.isName) {
            const k = V.clamps.name;
            if (!near(h.size, clampPx(k, vp)) || h.wt !== String(k.weight)) add('NR-7 Name role', `${h.size}px w${h.wt}, want ${Number(clampPx(k, vp).toFixed(2))}/300`, where);
          }
          if (h.isDocH3) {
            const k = V.clamps.h3;
            if (!near(h.size, clampPx(k, vp)) || h.wt !== String(k.weight)) add('NR-7 H3 role', `${h.size}px w${h.wt}, want ${Number(clampPx(k, vp).toFixed(2))}/400`, where);
          }
          if (lastH2 && h.size > lastH2.size + TOL) add('TYPE-4 h3 larger than its h2', `h3 ${h.size}px > h2 ${lastH2.size}px "${h.text}"`, where);
        }
      }
      for (const n of N) {
        if (tiny(n) || !n.matches) continue;
        const check = (k, key, extra) => {
          if (!isFraunces(n) || n.wt !== String(k.weight) || !near(n.size, clampPx(k, vp)) || (k.opsz && opszOf(n.fvs) !== k.opsz) || (extra && !extra(n))) {
            add(`NR-6 ${key}`, `${n.sel} ${first(n.fam).slice(0, 18)} ${Number(n.size.toFixed(2))}px w${n.wt} ${n.fvs}, want ${Number(clampPx(k, vp).toFixed(2))}px w${k.weight}${k.opsz ? ` opsz ${k.opsz}` : ''}`, where);
          }
        };
        if (n.matches.heroLedeHub) check(V.clamps.heroLedeHub, 'hub lede');
        if (n.matches.themeLine) check(V.clamps.themeLine, 'theme line', (m) => m.style === 'italic');
        if (n.matches.heroFactDd) check(V.clamps.heroFactDd, 'hero fact dd');
      }
      if (V.s2.routes.includes(p)) {
        const nums = N.filter((n) => n.matches.num);
        if (!nums.length) add('S-2', 'no .nos-num numeral found', where);
        for (const n of nums) {
          if (n.color !== V.s2.colour) add('S-2 colour', `${n.color}, want ${V.s2.colour}`, where);
          else if (!n.bgImg && contrast(n.color, n.bg) < V.s2.minContrast) add('S-2 contrast', `${contrast(n.color, n.bg).toFixed(2)}:1 on ${n.bg}`, where);
        }
      }

      // ---- the Menu panel, closed by default: open it once and walk it under the same basic rules ----
      if (p === V.chromePanelOpen.route) {
        const burger = page.locator(V.chromePanelOpen.burger);
        if (await burger.count()) {
          await burger.click().catch(() => {});
          await page.waitForTimeout(500);
          const open = await page.evaluate(collectPage, cfg);
          walkBasic(open.nodes.filter((n) => n.inHeader), `${where} [menu open]`);
          await burger.click().catch(() => {});
        } else add('menu', `${V.chromePanelOpen.burger} not found`, where);
        // NR-6: the page Karla must have a real 450. A static 400/500/600/700 declaration snaps 450 to 500.
        const widths = await page.evaluate(async () => {
          const fam = getComputedStyle(document.querySelector('main p') ?? document.body).fontFamily;
          const w = {};
          for (const wt of [400, 450, 500]) {
            await document.fonts.load(`${wt} 16px ${fam}`, 'Orchid');
            const s = document.createElement('span');
            s.style.cssText = `position:absolute;white-space:nowrap;font-size:40px;font-family:${fam};font-weight:${wt}`;
            s.textContent = 'The National Orchid Show Stellenbosch 2027';
            document.body.appendChild(s); w[wt] = s.getBoundingClientRect().width; s.remove();
          }
          return w;
        });
        if (!(widths[400] + 1 < widths[450] && widths[450] + 1 < widths[500])) add('NR-6 weight 450 is not a real instance', JSON.stringify(widths), where);
      }
    }
    stats.perViewport[vw] = walked;
    if (walked < 20) add('coverage', `only ${walked} routes walked at ${vw}`, `@${vw}`);
    await ctx.close();
  }

  // ---- font delivery (TYPE-15, NR-6): one Karla face, at most 3 font files per route ----
  for (const p of V.fonts.routes) {
    const ctx = await newContext(browser, { width: V.fonts.viewport, height: 900 });
    const page = await ctx.newPage();
    const files = new Set();
    page.on('response', (r) => { if (/\.woff2?(\?|$)/.test(r.url())) files.add(r.url().split('?')[0]); });
    await page.goto(`${server.nos}${p}`, { waitUntil: 'load', timeout: 45000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    // Distinct url() sources of the Karla @font-face rules; a next/font local() fallback face is not a file and is not counted.
    const karlaFiles = await page.evaluate(() => {
      const urls = new Set();
      for (const sheet of document.styleSheets) {
        let rules; try { rules = sheet.cssRules; } catch { continue; }
        for (const r of rules) if (r instanceof CSSFontFaceRule && /karla/i.test(r.style.getPropertyValue('font-family'))) for (const m of r.style.getPropertyValue('src').matchAll(/url\(["']?([^"')]+)["']?\)/g)) urls.add(m[1].split('?')[0]);
      }
      return [...urls];
    });
    stats.fontFiles ??= {}; stats.fontFiles[p] = { total: files.size, karla: karlaFiles.length };
    if (karlaFiles.length !== V.fonts.karlaFilesExactly) add('NR-6 Karla files', `${karlaFiles.length} distinct Karla font files, want exactly ${V.fonts.karlaFilesExactly} (one variable wght range)`, `${p}@${V.fonts.viewport}`);
    if (V.fonts.cap.enabled && files.size > V.fonts.cap.maxFontFilesPerRoute) add('TYPE-15 font files', `${files.size} font files, max ${V.fonts.cap.maxFontFilesPerRoute}`, `${p}@${V.fonts.viewport}`);
    await ctx.close();
  }

  await browser.close();
  const lines = summarise(fails);
  writeFileSync(`${EVIDENCE_DIR}/gate-type.json`, JSON.stringify({ stats, failureGroups: lines, failureCount: fails.length }, null, 1));
  console.log(`gate-type: ${stats.pages} pages walked, ${stats.frauncesNodes} Fraunces nodes, ${stats.wViolations} R-W violations, ${fails.length} failures in total`);
  for (const l of lines) console.log(`  ${l}`);
  c.check('computed-style walk', fails.length === 0, `${fails.length} failure(s); see evidence/gate-type.json`);
  c.check('Fraunces coverage', stats.frauncesNodes > V.baseline.fraunces.nodesFloor * 0.5, `only ${stats.frauncesNodes} Fraunces nodes walked`);
});
