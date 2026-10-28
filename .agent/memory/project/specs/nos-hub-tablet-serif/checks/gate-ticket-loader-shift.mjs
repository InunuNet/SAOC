// TL-1 gate (NOS Design P3): the /tickets/[slug] loading shell reserves the lede, so the hero does not grow when the page settles.
// Usage: node gate-ticket-loader-shift.mjs. For every ticket slug the /tickets hub links to (the hub reads the same Sanity ticketType
// documents the slug page reads; nothing is written), at 1440@1 and 390@3: a client navigation from /faq with the RSC request held 800ms
// exposes the loader; a requestAnimationFrame logger records the hero. The last loader frame is compared with the settled frame.
// Asserts: the loader lede is two aria-hidden line boxes with no text, each holding one bar 0.55lh tall, centred, lede colour at 15% alpha, no bone class, a gap between the bars; lede shift 0 for a 2-line lede; |lede shift| <= one lede line for every slug (measured on the lede block, so a long product name that wraps the title or breadcrumb at 390 is listed as a FINDING, not folded in); the title
// element and first-copy-child top never move; no pulse element. Lists every slug whose lede is 3+ lines at 390. A slug with no description
// settles with no lede, which the loader cannot know: it is listed as a finding with its stated reason, not asserted.
import { ROUTES, VALUES, launchChromium, newContext, withServer } from './_lib.mjs';

const TL = VALUES.tl1;
const HOLD_MS = 800;
const LOADER_ATTEMPTS = 8;

function installLogger() {
  window.__frames = [];
  window.__logging = true;
  const t0 = performance.now();
  const tick = () => {
    if (!window.__logging) return;
    const hero = document.querySelector('section[data-nos-hero="inner"]');
    const title = hero?.querySelector('.nos-hero-title');
    const first = hero?.querySelector('.nos-hero-copy')?.firstElementChild;
    const lede = hero?.querySelector('[data-nos-hero-lede]');
    const lh = lede ? parseFloat(getComputedStyle(lede).lineHeight) : 0;
    window.__frames.push({
      t: Math.round(performance.now() - t0), path: location.pathname, hero: Boolean(hero), titleTag: title ? title.tagName : null,
      firstTop: first ? first.getBoundingClientRect().top + scrollY : null,
      heroH: hero ? hero.getBoundingClientRect().height : null,
      titleH: title ? title.getBoundingClientRect().height : 0,
      crumbsH: hero?.querySelector('.nos-hero-copy > nav') ? hero.querySelector('.nos-hero-copy > nav').getBoundingClientRect().height : 0,
      ledeH: lede ? lede.getBoundingClientRect().height : 0,
      hasLede: Boolean(lede), lineH: lh, ledeLines: lede && lh ? Math.round(lede.getBoundingClientRect().height / lh) : 0,
      ledeText: lede ? (lede.textContent ?? '').replace(/\s+/g, '').length : 0,
      ledeColor: lede ? getComputedStyle(lede).color : null,
      bars: lede ? [...lede.children].map((box) => {
        const bar = box.firstElementChild;
        const lr = lede.getBoundingClientRect();
        const br = box.getBoundingClientRect();
        const r = bar ? bar.getBoundingClientRect() : null;
        const cs = bar ? getComputedStyle(bar) : null;
        return { hidden: box.getAttribute('aria-hidden') === 'true', boxH: br.height, boxTop: br.top, boxW: br.width / lr.width, kids: box.children.length, barH: r ? r.height : 0, barTop: r ? r.top : 0, barBottom: r ? r.bottom : 0, barW: r ? r.width / br.width : 0, bg: cs ? cs.backgroundColor : null, radius: cs ? cs.borderTopLeftRadius : null, cls: `${box.getAttribute('class') ?? ''} ${bar ? bar.getAttribute('class') ?? '' : ''}` };
      }) : [],
      sections: document.querySelectorAll('.nos-section').length,
      pulse: document.querySelectorAll('.animate-pulse, [class*="pulse"]').length,
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// TL-2a: the current-page crumb (the product name) is one line below 768, truncated by CSS only; the full name stays in the DOM and the accessible name.
async function checkCrumb(context, url, tag, vp, c) {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('.nk-crumbs [aria-current="page"]:visible').first().waitFor({ timeout: 20000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  const m = await page.evaluate(() => {
    // The document can also hold the loading shell's own (hidden) crumbs beside the resolved page: the settled nav is the visible one with a current crumb.
    const nav = [...document.querySelectorAll('.nk-crumbs')].find((n) => n.querySelector('[aria-current="page"]') && n.getClientRects().length > 0);
    const cur = nav?.querySelector('[aria-current="page"]');
    // Row membership by vertical centre: a link carries block padding the unpadded current crumb does not, so tops differ on one line.
    const tops = nav ? [...nav.querySelectorAll('a, [aria-current="page"]')].map((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; }) : [];
    const holder = cur ? [cur, cur.parentElement].find((el) => el && getComputedStyle(el).textOverflow === 'ellipsis') ?? cur : null;
    const hs = holder ? getComputedStyle(holder) : null;
    return { has: Boolean(cur), text: (cur?.textContent ?? '').trim(), h1: (document.querySelector('h1')?.textContent ?? '').trim(), tops, ellipsis: hs ? hs.textOverflow === 'ellipsis' : false, clipped: hs ? hs.overflow === 'hidden' || hs.overflowX === 'hidden' : false, nowrap: hs ? hs.whiteSpace === 'nowrap' : false };
  });
  c.check(`${tag} the current-page crumb exists and carries the full product name (${m.text})`, m.has && m.text === m.h1 && m.text.length > 0);
  const snap = await page.locator('.nk-crumbs:visible', { has: page.locator('[aria-current="page"]') }).first().ariaSnapshot();
  c.check(`${tag} the full name is in the breadcrumb's accessible name`, snap.includes(m.h1), snap.replace(/\s+/g, ' '));
  if (vp.width < TL.crumbTruncateBelowPx) {
    c.check(`${tag} the breadcrumb is one line (crumb vertical centres ${JSON.stringify(m.tops)}, within 2px)`, m.tops.length > 0 && Math.max(...m.tops) - Math.min(...m.tops) <= 2);
    c.check(`${tag} the current-page crumb is ellipsis-truncated by CSS (text-overflow ellipsis, overflow hidden, nowrap)`, m.ellipsis && m.clipped && m.nowrap, JSON.stringify(m));
  } else {
    c.check(`${tag} the truncation is scoped below ${TL.crumbTruncateBelowPx}px (no ellipsis at this width)`, !m.ellipsis, JSON.stringify(m));
  }
  await page.close();
}

// Both colours are painted over white on a canvas in a blank page, so a color-mix or oklab computed value compares by what it paints.
async function colourMatches(context, ledeColor, bgs) {
  const probe = await context.newPage();
  const ok = await probe.evaluate(([lede, list, alpha]) => {
    const px = (fill) => { const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1, 1); g.fillStyle = fill; g.fillRect(0, 0, 1, 1); return [...g.getImageData(0, 0, 1, 1).data]; };
    const probeEl = document.createElement('span'); probeEl.style.color = lede; document.body.appendChild(probeEl);
    const rgb = getComputedStyle(probeEl).color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const want = px(`rgba(${rgb.join(',')},${alpha})`);
    return list.every((bg) => px(bg).every((v, i) => Math.abs(v - want[i]) <= 1));
  }, [ledeColor, bgs, TL.barAlpha]);
  await probe.close();
  return ok;
}

await withServer(6, 'ticket loader shift', async (server, c) => {
  const browser = await launchChromium();
  try {
    const listed = [];
    for (const vp of TL.viewports) {
      const context = await newContext(browser, vp);
      const page = await context.newPage();
      await page.route((url) => url.searchParams.has('_rsc') && !url.pathname.startsWith('/faq'), async (route) => {
        await new Promise((r) => setTimeout(r, HOLD_MS));
        await route.continue();
      });
      await page.goto(`${server.nos}${ROUTES.validTicketProbe.hub}`, { waitUntil: 'load' });
      const slugs = await page.evaluate(([pattern, exclude]) => [...new Set([...document.querySelectorAll('a[href]')].map((a) => (a.getAttribute('href') ?? '').split('?')[0]).filter((h) => new RegExp(pattern).test(h) && !exclude.includes(h)))], [ROUTES.validTicketProbe.linkPattern, ROUTES.validTicketProbe.exclude]);
      c.check(`[${vp.name}] the hub lists at least one ticket slug to probe`, slugs.length > 0);
      for (const path of slugs) {
        const tag = `[${vp.name} ${path}]`;
        // A fresh page per attempt so the client router cache of an earlier visit cannot hide the loader; up to LOADER_ATTEMPTS attempts (the shell can be on screen for a single frame once the held request is released).
        let frames = [];
        let loader = [];
        let pushed = false;
        for (let attempt = 0; attempt < LOADER_ATTEMPTS && !loader.length; attempt += 1) {
          const probe = await context.newPage();
          await probe.route((url) => url.searchParams.has('_rsc') && !url.pathname.startsWith('/faq'), async (route) => {
            await new Promise((r) => setTimeout(r, HOLD_MS));
            await route.continue();
          });
          await probe.goto(`${server.nos}/faq`, { waitUntil: 'load' });
          await probe.evaluate(installLogger);
          pushed = await probe.evaluate((p) => { const r = window.next?.router; if (!r) return false; r.push(p); return true; }, path);
          if (pushed) {
            await probe.waitForFunction((p) => location.pathname === p, path, { timeout: 15000 }).catch(() => {});
            await probe.waitForFunction(() => { const h = document.querySelector('h1'); return (h?.textContent ?? '').replace(/ /g, '').trim().length > 0; }, undefined, { timeout: 20000 }).catch(() => {});
            await probe.waitForTimeout(500);
            frames = (await probe.evaluate(() => { window.__logging = false; return window.__frames; })).filter((f) => f.path === path && f.hero);
            // The ticket page has no .nos-section, so the loader is the frames whose title is the shell's p.nos-hero-title; the settled frame has the h1.
            loader = frames.filter((f) => f.titleTag === 'P');
          }
          await probe.close();
        }
        c.check(`${tag} client navigation available (window.next.router)`, pushed);
        const settled = frames[frames.length - 1];
        c.check(`${tag} the loader frame was observed`, loader.length > 0 && Boolean(settled) && settled.titleTag === 'H1', 'delay did not expose a loader');
        if (!loader.length || !settled || settled.titleTag !== 'H1') continue;
        const last = loader[loader.length - 1];
        const bars = last.bars;
        const lh = last.lineH;
        c.check(`${tag} the loader lede is ${TL.loaderBars} aria-hidden line boxes with no text, one bar in each`, last.hasLede && last.ledeText === 0 && bars.length === TL.loaderBars && bars.every((x) => x.hidden && x.kids === 1), JSON.stringify(bars));
        c.check(`${tag} each line box is one lede line tall (${lh}px) and each bar ${TL.barHeightLh}lh tall, vertically centred, ${TL.barRadiusPx}px radius`, bars.length === TL.loaderBars && bars.every((x) => Math.abs(x.boxH - lh) <= 0.5 && Math.abs(x.barH - TL.barHeightLh * lh) <= 0.5 && Math.abs((x.barTop + x.barBottom) / 2 - (x.boxTop + x.boxH / 2)) <= 0.5 && x.radius === `${TL.barRadiusPx}px`), JSON.stringify(bars));
        c.check(`${tag} the bars are ${TL.barWidths.join('% and ')}% wide and there is a gap between them`, bars.length === TL.loaderBars && bars.every((x, i) => Math.abs(x.barW * 100 - TL.barWidths[i]) <= 0.5) && bars[1].barTop - bars[0].barBottom >= TL.minGapLh * lh, JSON.stringify(bars.map((x) => [x.barW, x.barTop, x.barBottom])));
        c.check(`${tag} no bone class on the loader lede`, bars.every((x) => !/bone/.test(x.cls)), bars.map((x) => x.cls).join(' | '));
        const colour = await colourMatches(context, last.ledeColor, bars.map((x) => x.bg));
        c.check(`${tag} the bar colour is the lede colour ${last.ledeColor} at alpha ${TL.barAlpha}`, colour, JSON.stringify(bars.map((x) => x.bg)));
        c.check(`${tag} the first copy child stays at one position across every frame`, Math.max(...frames.map((f) => f.firstTop)) - Math.min(...frames.map((f) => f.firstTop)) <= 0.5);
        c.check(`${tag} no pulse element in any frame`, frames.every((f) => f.pulse === 0));
        // The title (the product name) and the last breadcrumb (also the name) are unknown to a name-agnostic loader: a long name that wraps at 390
        // grows the hero by a title or crumb line. That is not the lede's shift, so the lede figure is measured on the lede block and the rest is listed.
        const rawShift = settled.heroH - last.heroH;
        const titleShift = settled.titleH - last.titleH;
        const crumbShift = settled.crumbsH - last.crumbsH;
        if (vp.width < TL.crumbTruncateBelowPx) {
          c.check(`${tag} the settled breadcrumb row is as tall as the loader's (delta ${crumbShift.toFixed(2)}px)`, Math.abs(crumbShift) <= 0.5);
          if (Math.abs(titleShift) > 0.5) listed.push(`${tag} TITLE RESIDUAL (accepted, TL-2b): the product name wraps the title, +${titleShift.toFixed(2)}px (raw hero shift ${rawShift.toFixed(2)}px)`);
        } else if (Math.abs(titleShift) + Math.abs(crumbShift) > 0.5) listed.push(`${tag} FINDING (stated reason): the product name moves the hero by title ${titleShift.toFixed(2)}px and breadcrumb ${crumbShift.toFixed(2)}px (raw hero shift ${rawShift.toFixed(2)}px)`);
        await checkCrumb(context, `${server.nos}${path}`, tag, vp, c);
        if (!settled.hasLede) { listed.push(`${tag} FINDING (stated reason): the ticket has no description, so it settles with no lede and the loader's two bars cannot know that (loader ${last.heroH}px, settled ${settled.heroH}px)`); continue; }
        const shift = settled.ledeH - last.ledeH;
        if (settled.ledeLines === 2) c.check(`${tag} lede shift is 0 for a 2-line lede (got ${shift.toFixed(2)}px)`, Math.abs(shift) <= 0.5);
        c.check(`${tag} lede shift is within one lede line (|${shift.toFixed(2)}| <= ${settled.lineH}px, lede ${settled.ledeLines} lines)`, Math.abs(shift) <= settled.lineH + 0.5);
        if (settled.ledeLines >= 3) listed.push(`${tag} 3+ LINES: lede is ${settled.ledeLines} lines, lede shift ${shift.toFixed(2)}px`);
        console.log(`note: ${tag} lede ${settled.ledeLines} lines, lede shift ${shift.toFixed(2)}px, raw hero shift ${rawShift.toFixed(2)}px (loader ${last.heroH}px, settled ${settled.heroH}px)`);
      }
      await context.close();
    }
    for (const line of listed) console.log(line);
  } finally { await browser.close(); }
});
