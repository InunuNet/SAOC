// NOS 404 gate (NOS Design, LT-1 scope). Usage: node gate-not-found.mjs. Every not-found route in goldens/sweep-routes.json, on the nos host
// at 1280, 390, 888 and 889: HTTP 404, exactly one h1, the h1 is the display serif and, at 32px or more, computes to weight 300.
// A conditional not-found route that does not answer 404 is logged NOT CHECKED with its reason, never silent.
import { readdirSync, statSync } from 'node:fs';
import { ROOT, ROUTES, VALUES, launchChromium, newContext, withServer } from './_lib.mjs';
import { classify } from './lt1-classify.mjs';

const NF = VALUES.lt1.notFound;

// Every dynamic-segment directory under app/(nos), relative to the project root.
function dynamicSegmentDirs(dir = 'app/(nos)') {
  const found = [];
  for (const name of readdirSync(`${ROOT}/${dir}`)) {
    const rel = `${dir}/${name}`;
    if (!statSync(`${ROOT}/${rel}`).isDirectory()) continue;
    if (/^\[.+\]$/.test(name)) found.push(rel);
    found.push(...dynamicSegmentDirs(rel));
  }
  return found;
}

function readPage([forbidden, heroSelector]) {
  const text = document.body.innerText;
  return { forbidden: forbidden.filter((f) => text.includes(f)), heroTitles: document.querySelectorAll(heroSelector).length };
}

function readH1s() {
  const first = (family) => family.split(',')[0].trim().replace(/^["']|["']$/g, '');
  const probe = document.createElement('span');
  probe.style.fontFamily = 'var(--serif)';
  (document.querySelector('.nos-theme') ?? document.body).appendChild(probe);
  const serifFace = first(getComputedStyle(probe).fontFamily);
  probe.remove();
  return [...document.querySelectorAll('h1')].map((el) => {
    const cs = getComputedStyle(el);
    const face = first(cs.fontFamily);
    return { text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 70), face, serif: face === serifFace || /fraunces/i.test(face), size: parseFloat(cs.fontSize), weight: cs.fontWeight, cls: (el.getAttribute('class') ?? '').slice(0, 90), inNosTheme: Boolean(el.closest('.nos-theme')) };
  });
}

await withServer(5, 'nos 404 h1', async (server, c) => {
  for (const dir of dynamicSegmentDirs()) {
    const probe = ROUTES.dynamicSegments[dir];
    c.check(`dynamic segment ${dir} has a bad-param route in sweep-routes.json`, Boolean(probe) && ROUTES.notFoundRoutes.some((n) => n.path === probe && n.required), probe ?? 'unlisted');
  }
  const browser = await launchChromium();
  try {
    const probe = ROUTES.validTicketProbe;
    const probeContext = await newContext(browser, VALUES.lt1.viewports.find((v) => v.name === NF.viewports[0]));
    const probePage = await probeContext.newPage();
    await probePage.goto(`${server.nos}${probe.hub}`, { waitUntil: 'load' });
    const hrefs = await probePage.evaluate(() => [...document.querySelectorAll('a[href]')].map((el) => (el.getAttribute('href') ?? '').split('?')[0]));
    const real = hrefs.find((h) => new RegExp(probe.linkPattern).test(h) && !probe.exclude.includes(h));
    if (!real) c.note(`NOT CHECKED (stated reason): no real ticket link on ${probe.hub}: ${probe.note}`);
    else {
      const res = await probePage.goto(`${server.nos}${real}`, { waitUntil: 'load' });
      c.check(`a real ticket ${real} still answers 200 (not 404)`, res?.status() === 200, String(res?.status()));
    }
    await probeContext.close();
    for (const vp of VALUES.lt1.viewports.filter((v) => NF.viewports.includes(v.name))) {
      const context = await newContext(browser, vp);
      const page = await context.newPage();
      for (const route of ROUTES.notFoundRoutes) {
        const tag = `[${vp.name} ${route.path}]`;
        const res = await page.goto(`${server.nos}${route.path}`, { waitUntil: 'load' });
        if (!route.required && res?.status() !== NF.status) { c.note(`NOT CHECKED (stated reason): ${tag} -> ${res?.status()}: ${route.source}`); continue; }
        c.check(`${tag} responds ${NF.status}`, res?.status() === NF.status, String(res?.status()));
        await page.evaluate(() => document.fonts.ready);
        const h1s = await page.evaluate(readH1s);
        c.check(`${tag} exactly ${NF.h1Count} h1 (got ${h1s.length})`, h1s.length === NF.h1Count);
        const seen = await page.evaluate(readPage, [NF.forbiddenText, NF.heroTitleSelector]);
        c.check(`${tag} renders none of ${JSON.stringify(NF.forbiddenText)} in the DOM text (got ${JSON.stringify(seen.forbidden)})`, seen.forbidden.length === 0);
        if (route.requireHeroTitle) c.check(`${tag} renders the NOS not-found hero (${NF.heroTitleSelector} count ${seen.heroTitles})`, seen.heroTitles === 1);
        for (const h of h1s) {
          c.check(`${tag} h1 "${h.text}" is inside .nos-theme`, h.inNosTheme);
          c.check(`${tag} h1 is the display serif (got ${h.face})`, h.serif);
          const display = h.size >= NF.minSizePx - VALUES.lt1.epsilonPx;
          const want = display ? NF.weight : '400';
          c.check(`${tag} h1 ${h.size}px is weight ${want} (got ${h.weight}, ${classify(h)})`, h.weight === want, h.cls);
          if (vp.width >= 1024 || vp.name.startsWith('889')) c.check(`${tag} h1 reaches ${NF.minSizePx}px at this viewport (got ${h.size})`, display);
        }
        c.note(`note: ${tag} ${JSON.stringify(h1s.map((h) => ({ size: h.size, weight: h.weight, cls: h.cls })))}`);
      }
      await context.close();
    }
  } finally { await browser.close(); }
});
