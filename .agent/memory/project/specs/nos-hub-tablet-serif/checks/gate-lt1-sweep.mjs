// LT-1 sweep. Usage: node gate-lt1-sweep.mjs. Every NOS route in goldens/sweep-routes.json (plus the dynamic routes discovered
// from live links) at 1280 and 390: any display-serif heading computed at >= 32px must be weight 300 (fails otherwise), and a
// serif heading under 32px must stay 400. Writes the full list to evidence/lt1-sweep.json, the list that goes in the PR.
import { writeFileSync } from 'node:fs';
import { SPEC_DIR, ROUTES, VALUES, launchChromium, newContext, withServer } from './_lib.mjs';
import { classify } from './lt1-classify.mjs';

const LT1 = VALUES.lt1;

/** Every heading on the page with its computed face, size and weight, and whether that face is the NOS display serif. */
function collectHeadings() {
  const first = (family) => family.split(',')[0].trim().replace(/^["']|["']$/g, '');
  const serifFaces = new Set();
  // The display serif is whatever `font-family: var(--serif)` resolves to inside .nos-theme (and the chrome's Fraunces variable).
  for (const holder of [document.querySelector('.nos-theme'), document.body]) {
    if (!holder) continue;
    for (const css of ['var(--serif)', 'var(--font-nos-fraunces)']) {
      const probe = document.createElement('span');
      probe.style.fontFamily = css;
      holder.appendChild(probe);
      const face = first(getComputedStyle(probe).fontFamily);
      holder.removeChild(probe);
      if (face && !/^(serif|sans-serif|system-ui|var\()/.test(face)) serifFaces.add(face);
    }
  }
  const out = [];
  for (const el of document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]')) {
    const cs = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || (b.width === 0 && b.height === 0)) continue;
    const face = first(cs.fontFamily);
    out.push({
      tag: el.tagName.toLowerCase(), text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 70), face,
      serif: serifFaces.has(face) || /fraunces/i.test(face), size: parseFloat(cs.fontSize), weight: cs.fontWeight,
      inNosTheme: Boolean(el.closest('.nos-theme')), cls: (el.getAttribute('class') ?? '').slice(0, 90),
    });
  }
  return out;
}

async function discover(page, server, spec) {
  await page.goto(`${server.nos}${spec.from}`, { waitUntil: 'load' }).catch(() => null);
  const hrefs = await page.evaluate((sel) => [...document.querySelectorAll(sel)].map((a) => a.getAttribute('href') ?? ''), spec.selector).catch(() => []);
  const skip = new RegExp(spec.exclude);
  const seen = new Set();
  for (const href of hrefs) {
    const path = href.split(/[?#]/)[0];
    if (!path.startsWith('/') || path.startsWith('//') || skip.test(href) || ROUTES.skipPathPrefixes.some((p) => path.startsWith(p)) || /\.[a-z0-9]+$/i.test(path)) continue;
    seen.add(path);
    if (seen.size >= spec.limit) break;
  }
  return [...seen];
}

await withServer(2, 'lt1 sweep', async (server, c) => {
  const browser = await launchChromium();
  const evidence = { ruling: 'any display-serif heading computed at >= 32px has weight 300; below 32px stays 400', routesSwept: {}, skipped: [], failures: [], displaySerifHeadings: [], smallSerifHeadings: [] };
  try {
    // One context to discover the dynamic routes, then a fresh context per viewport.
    const scout = await newContext(browser, VALUES.hub.band.viewports[0]);
    const scoutPage = await scout.newPage();
    const discovered = [];
    for (const spec of ROUTES.discover) for (const p of await discover(scoutPage, server, spec)) discovered.push({ path: p, label: spec.label });
    await scout.close();
    const planned = new Map();
    for (const p of ROUTES.required) planned.set(p, { required: true });
    for (const r of ROUTES.conditional) planned.set(r.path, { required: false, reason: r.reason });
    for (const n of ROUTES.notFoundRoutes) planned.set(n.path, { required: n.required, expect404: true, reason: n.source });
    for (const d of discovered) if (!planned.has(d.path)) planned.set(d.path, { required: false, reason: `discovered: ${d.label}` });
    c.note(`note: ${planned.size} routes planned (${discovered.length} discovered)`);

    for (const vp of LT1.viewports) {
      let swept = 0;
      const fluidWitness = [];
      for (const [path, info] of planned) {
        const tag = `[${vp.name} ${path}]`;
        // A fresh context per route: /vsp client-side-redirects, and that in-flight navigation aborted the next route's goto
        // (status 0 on the three 404 routes). An isolated page cannot inherit it, so the 404 status is read reliably.
        const context = await newContext(browser, vp);
        const page = await context.newPage();
        try {
        const res = await page.goto(`${server.nos}${path}`, { waitUntil: 'load' }).catch((e) => ({ failed: e.message }));
        const status = res && 'status' in res ? res.status() : 0;
        const finalPath = new URL(page.url()).pathname;
        const offNos = finalPath.startsWith('/admin') || !page.url().startsWith(server.nos);
        const rendered = info.expect404 ? status === 404 : status === 200;
        if (info.required) c.check(`${tag} responds ${info.expect404 ? 404 : 200}`, rendered && !offNos, `${status} ${page.url()}`);
        else if (!rendered || offNos) { evidence.skipped.push({ viewport: vp.name, path, status, finalUrl: page.url(), reason: info.reason }); c.note(`NOT SWEPT (stated reason): ${tag} -> ${status} ${page.url()}: ${info.reason}`); continue; }
        if (!rendered || offNos) continue;
        await page.evaluate(() => document.fonts.ready);
        const headings = await page.evaluate(collectHeadings);
        swept += 1;
        if (LT1.fluidStep.viewports.includes(vp.name)) for (const h of headings) if (h.tag !== 'h2' && /nos-opsz-fluid/.test(h.cls)) fluidWitness.push({ viewport: vp.name, route: path, tag: h.tag, size: h.size, weight: h.weight });
        const serifCount = headings.filter((h) => h.serif).length;
        evidence.routesSwept[`${vp.name} ${path}`] = { status, headings: headings.length, serif: serifCount };
        for (const h of headings) {
          const verdict = classify(h);
          const row = { viewport: vp.name, route: path, tag: h.tag, text: h.text, face: h.face, size: h.size, weight: h.weight, inNosTheme: h.inNosTheme, cls: h.cls };
          if (verdict === 'display-ok' || verdict === 'display-fail') evidence.displaySerifHeadings.push(row);
          if (verdict === 'small-ok' || verdict === 'small-fail') evidence.smallSerifHeadings.push(row);
          if (verdict === 'display-fail' || verdict === 'small-fail' || verdict === 'sans-light-fail') {
            evidence.failures.push({ verdict, ...row });
            c.check(`${tag} ${h.tag} "${h.text}" ${h.size}px/${h.weight} ${verdict === 'display-fail' ? `should be weight ${LT1.displayWeight}` : verdict === 'small-fail' ? `should stay ${LT1.smallWeight}` : 'is a Karla label that must not be weight 300'}`, false, h.cls);
          }
        }
        if (path === LT1.witness.route) {
          const display = headings.filter((h) => h.serif && h.size >= LT1.thresholdPx - LT1.epsilonPx);
          c.check(`${tag} witness route has at least ${LT1.witness.minDisplaySerifHeadings} display serif headings`, display.length >= LT1.witness.minDisplaySerifHeadings, String(display.length));
          const h2s = display.filter((h) => h.tag === 'h2');
          // The witness h2s are the shared content-standard .doc-h2 (main #106), so the expected size is main's computed .doc-h2 rule
          // in this viewport (clamp(32px, 24px + 1.6vw, 39px): 39 at 1280, 32 at 390), never a hard-coded figure. Weight stays 300 (classify above).
          if (LT1.witness.sizesPx[vp.name] !== undefined) {
            const want = await page.evaluate(() => {
              const probe = document.createElement('h2');
              probe.className = 'doc-h2';
              (document.querySelector('.nos-theme') ?? document.body).appendChild(probe);
              const size = parseFloat(getComputedStyle(probe).fontSize);
              probe.remove();
              return size;
            });
            c.check(`${tag} witness h2s compute main's .doc-h2 size ${want}px (#106) at weight ${LT1.displayWeight}`, h2s.length >= 3 && h2s.every((h) => Math.abs(h.size - want) <= 0.6 && h.weight === LT1.displayWeight), JSON.stringify(h2s.map((h) => [h.size, h.weight])));
          }
        }
        } finally {
          await context.close();
        }
      }
      c.check(`[${vp.name}] at least ${LT1.minRoutesSwept} routes swept`, swept >= LT1.minRoutesSwept, String(swept));
      if (LT1.fluidStep.viewports.includes(vp.name)) {
        const at889 = vp.width === 889;
        const weight = at889 ? LT1.displayWeight : LT1.smallWeight;
        c.note(`note: [${vp.name}] non-h2 .nos-opsz-fluid headings rendered: ${fluidWitness.length}`);
        for (const w of fluidWitness) {
          c.check(`[${vp.name} ${w.route}] fluid ${w.tag} computes ${w.size}px, ${at889 ? 'at or over' : 'under'} 32px`, at889 ? w.size >= LT1.thresholdPx - LT1.epsilonPx : w.size < LT1.thresholdPx - LT1.epsilonPx);
          c.check(`[${vp.name} ${w.route}] fluid ${w.tag} is weight ${weight} (got ${w.weight})`, w.weight === weight);
        }
        evidence.fluidStepWitness = [...(evidence.fluidStepWitness ?? []), ...fluidWitness];
      }
    }
    c.check('the sweep found display serif headings at all (the serif probe works)', evidence.displaySerifHeadings.length > 0);
    c.check('the sweep found sub-32px serif headings at all (the 400 side is exercised)', evidence.smallSerifHeadings.length > 0);
  } finally {
    await browser.close();
    writeFileSync(`${SPEC_DIR}/${LT1.artefact}`, `${JSON.stringify(evidence, null, 2)}\n`);
    c.note(`note: wrote ${SPEC_DIR}/${LT1.artefact} (${evidence.displaySerifHeadings.length} display, ${evidence.smallSerifHeadings.length} small, ${evidence.failures.length} failures)`);
  }
});
