// A7: the standard, measured identically on every route in goldens/route-table.json at 390@3, 768@2, 1024@2 and 1440@2.
//   hero      a photo hero where the route has a crop (routes with photo null print NEEDS PHOTO, never a silent pass); served >= required
//             (required = ceil(max(boxW, boxH x srcW/srcH) x DPR), also at 2056@2); one h1; no h2 equals the h1
//   gap       sub-nav bottom (hero bottom when there is no sub-nav) to the first content in [data-doc-layout]: 64px >= 1024, 48px below
//   measure   .prose paragraphs 55-75ch (>= 768); one column below 960
//   grid      >= 961: aside right of the prose, ~5/7 of its width, sticky at 100px, the container at most 12% empty at 1440; < 960: aside follows
//   type      h2 and h3 computed style equals standard.json and is identical across routes
//   hygiene   no p whose only child is strong; no eyebrow above a heading; no coloured side border > 1px; no nested cards; no pill; targets;
//             no horizontal scroll
//   facts     (routes with facts) 2-4 dd/dt, every box fully inside the first viewport at 1440x900 and 390x844@3, contrast >= 4.5 on the
//             photo pixels behind each fact; sub-nav and first h2 visible at 1440x900
//   focus     a focused h1[tabindex="-1"] paints no outline, ring or shadow, on load and after client navigation
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { AUTH, BANNED, CROPS, RETIRED, gotoRoute, EXCLUDED, ROUTES, STD, driveState, launchChromium, newContext, withServer } from './_lib.mjs';

const HERO_IMG = 'section[data-nos-hero] [data-nos-hero-media] img';
const wantGap = (w) => (w >= 1024 ? STD.gap.atOrAbove1024 : STD.gap.below1024);
const h2Px = (w) => Math.min(39, Math.max(32, 24 + 0.016 * w));
const typeSeen = {};

async function heroSharpness(page, route, vp, c, tag) {
  const crop = CROPS.find((k) => k.crop === route.photo);
  const found = await page.waitForFunction((sel) => { const i = document.querySelector(sel); return i && i.complete && i.naturalWidth > 0; }, HERO_IMG, { timeout: 20000 }).then(() => true, () => false);
  c.check(`${tag} hero photo present and loaded`, found);
  const idv = await page.evaluate((sel) => document.querySelector(sel)?.currentSrc ?? '', HERO_IMG);
  if (route.photo) c.check(`${tag} the hero serves the route's signed-off crop ${route.photo}`, decodeURIComponent(idv).includes(`nos-hero-${route.photo}`), idv);
  if (!found) return;
  const geo = await page.evaluate((sel) => { const img = document.querySelector(sel); const hero = document.querySelector('section[data-nos-hero]').getBoundingClientRect(); const b = img.getBoundingClientRect(); const h1 = document.querySelector('h1')?.getBoundingClientRect(); const md = img.closest('[data-nos-hero-media]')?.getBoundingClientRect() ?? b; return { mw: md.width, mright: (md.right - hero.left) / hero.width * 100, left: (b.left - hero.left) / hero.width * 100, right: (b.right - hero.left) / hero.width * 100, w: b.width, heroW: hero.width, top: b.top, h1Bottom: h1 ? h1.bottom : 0 }; }, HERO_IMG);
  if (vp.width >= 1024) {
    const bx = await page.evaluate((sel) => { const img = document.querySelector(sel); const media = img?.closest('[data-nos-hero-media]') ?? img?.parentElement; const radii = [img, media].filter(Boolean).map((e) => ['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'].map((k) => parseFloat(getComputedStyle(e)[`border${k}Radius`]) || 0)).flat(); const mk = [media, img, media?.parentElement].filter(Boolean).map((e) => `${getComputedStyle(e).maskImage} ${getComputedStyle(e).webkitMaskImage}`).join(' | '); return { maxRadius: Math.max(...radii), mask: mk }; }, HERO_IMG);
    c.check(`${tag} P1 the .ihero photo box has radius 0 (${bx.maxRadius}) and its left 22% is masked into the black (${bx.mask.slice(0, 90)})`, bx.maxRadius === 0 && /linear-gradient/.test(bx.mask) && /22%/.test(bx.mask));
  }
  if (vp.width >= 1024) c.check(`${tag} photo box runs 38%-100% of the hero (measured ${geo.left.toFixed(1)}%-${geo.right.toFixed(1)}%)`, Math.abs(geo.left - STD.hero.photoBox.atOrAbove1024.leftPctOfHero) <= STD.hero.photoBox.atOrAbove1024.tolerancePct && Math.abs(geo.right - 100) <= 1);
  else if (vp.width < 768) c.check(`${tag} below 768 the photo is a full-width band that leads, the copy follows (PG-1 4; NH2 supersedes the (c) 'under the copy' wording)`, Math.abs(geo.w - geo.heroW) <= 1 && geo.top <= geo.h1Bottom - 1);
  else c.check(`${tag} 768-1023 the photo is the right-hand panel at 42% of the hero, flush right (NH2; the (c) 'stacked below 1024' wording is superseded) (media ${(geo.mw / geo.heroW * 100).toFixed(1)}%, right ${geo.mright.toFixed(1)}%; the img inside is ${(geo.w / geo.heroW * 100).toFixed(1)}%)`, Math.abs(geo.mw / geo.heroW - 0.42) <= 0.02 && Math.abs(geo.mright - 100) <= 1);
  const r = await page.evaluate(async (sel) => {
    const img = document.querySelector(sel); const b = img.getBoundingClientRect();
    const probe = new Image(); probe.src = img.currentSrc; await probe.decode();
    return { boxW: b.width, boxH: b.height, dpr: devicePixelRatio, src: img.currentSrc, served: probe.naturalWidth, servedH: probe.naturalHeight };
  }, HERO_IMG);
  if (!crop) { c.check(`${tag} route has a crop in the proposals`, false); return; }
  const aspect = crop.width / crop.height;
  const required = Math.ceil(Math.max(r.boxW, r.boxH * aspect) * r.dpr - 0.5);
  c.check(`${tag} served ${r.served} >= required ${required} = max(box ${Math.round(r.boxW)}, ${Math.round(r.boxH)} x ${aspect.toFixed(3)}) x ${r.dpr}`, r.served >= required, r.src);
  c.check(`${tag} required ${required} <= the cut's native ${crop.width} (not clamped)`, required <= crop.width);
}

const HR1_RAMP = 'linear-gradient(90deg,rgba(11,10,20,0.92)0%,rgba(11,10,20,0.88)38%,rgba(11,10,20,0.45)56%,rgba(11,10,20,0.12)76%,rgba(11,10,20,0.04)100%)';
/** HR-1 (NOS Design): at >= 1024 the hero scrim ramp is exactly HR1_RAMP. Implementation-agnostic: whichever hero element or ::before / ::after carries a 90deg rgba(11,10,20) gradient, all of them are this ramp. */
async function heroRampCheck(page, tag, c) {
  const grads = await page.evaluate(() => {
    const hero = document.querySelector('section[data-nos-hero]'); if (!hero || hero.getAttribute('data-nos-hero') === 'hub') return [];
    const out = [];
    for (const e of [hero, ...hero.querySelectorAll('*')]) for (const ps of [null, '::before', '::after']) {
      const bi = getComputedStyle(e, ps).backgroundImage;
      if (/linear-gradient\(/.test(bi) && /rgba\(11, ?10, ?20/.test(bi) && /90deg/.test(bi)) out.push({ at: `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}${ps ?? ''}`, bi: bi.replace(/\s+/g, '') });
    }
    return out;
  });
  c.check(`${tag} HR-1 the hero scrim ramp is exactly rgba(11,10,20) 0.92 0% / 0.88 38% / 0.45 56% / 0.12 76% / 0.04 100% at 90deg (${grads.map((g) => g.at).join(', ') || 'no gradient found'})`, grads.length >= 1 && grads.every((g) => g.bi === HR1_RAMP), grads.filter((g) => g.bi !== HR1_RAMP).map((g) => `${g.at}: ${g.bi.slice(0, 160)}`).join(' | '));
}
/** HR-1 contrast: text hidden, p95 luminance of the photo pixels behind each hero text range (crumb, h1, lede, dt, dd) against the text colour; >= 4.5, h1 >= 3, at 1440 and 2056. */
async function heroTextContrast(page, tag, c) {
  const items = await page.evaluate(() => {
    const hero = document.querySelector('section[data-nos-hero]'); if (!hero) return [];
    const pick = (sel, kind) => [...hero.querySelectorAll(sel)].filter((e) => e.textContent.trim()).map((e) => {
      const rg = document.createRange(); rg.selectNodeContents(e); const rects = [...rg.getClientRects()].filter((q) => q.width > 0 && q.height > 0);
      if (!rects.length) return null;
      const x0 = Math.min(...rects.map((q) => q.left)); const y0 = Math.min(...rects.map((q) => q.top)); const x1 = Math.max(...rects.map((q) => q.right)); const y1 = Math.max(...rects.map((q) => q.bottom));
      const probe = kind === 'crumb' ? ([...e.querySelectorAll('a, span, li')].find((n) => n.textContent.trim()) ?? e) : e;
      const rgb = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number);
      return { kind, t: e.textContent.replace(/\s+/g, ' ').trim().slice(0, 24), x: x0, y: y0, w: x1 - x0, h: y1 - y0, rgb };
    }).filter(Boolean);
    return [...pick('nav', 'crumb'), ...pick('h1', 'h1'), ...pick('[data-nos-hero-lede]', 'lede'), ...pick('[data-hero-facts] dt', 'dt'), ...pick('[data-hero-facts] dd', 'dd')];
  });
  if (!items.length) return;
  const style = await page.addStyleTag({ content: 'section[data-nos-hero] *{color:transparent !important;text-shadow:none !important;-webkit-text-fill-color:transparent !important}' });
  const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const L = (rgb) => 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  const bad = [];
  for (const it of items) {
    const buf = await page.screenshot({ clip: { x: Math.max(0, it.x), y: Math.max(0, it.y), width: Math.max(1, it.w), height: Math.max(1, it.h) } });
    const p95 = await page.evaluate(async (b64) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const cv = new OffscreenCanvas(bmp.width, bmp.height); const ctx = cv.getContext('2d'); ctx.drawImage(bmp, 0, 0);
      const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data; const ls = []; const g = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      for (let p = 0; p < d.length; p += 4) ls.push(0.2126 * g(d[p]) + 0.7152 * g(d[p + 1]) + 0.0722 * g(d[p + 2]));
      ls.sort((a, z) => a - z); return ls[Math.floor(ls.length * 0.95)];
    }, buf.toString('base64'));
    const t = L(it.rgb); const ratio = (Math.max(t, p95) + 0.05) / (Math.min(t, p95) + 0.05);
    if (ratio < (it.kind === 'h1' ? 3 : 4.5)) bad.push(`${it.kind} "${it.t}" ${ratio.toFixed(2)}`);
  }
  await style.evaluate((n) => n.remove());
  c.check(`${tag} HR-1 hero text contrast on the photo pixels behind it (p95, text hidden): crumb, lede, dt, dd >= 4.5 and h1 >= 3 (${items.length} ranges)`, bad.length === 0, bad.join('; '));
}

/** FACTS-1: the shared hero facts grammar, measured on every route that has a facts row. */
async function factsGrammar(page, vp, c, tag) {
  const f = await page.evaluate(() => {
    const dl = document.querySelector('[data-hero-facts]'); if (!dl) return null;
    const cs = getComputedStyle(dl); const items = [...dl.querySelectorAll('[data-hero-fact]')];
    const it = items[0] ? getComputedStyle(items[0]) : null; const dd = dl.querySelector('dd'); const dt = dl.querySelector('dt');
    const dds = dd ? getComputedStyle(dd) : null; const dts = dt ? getComputedStyle(dt) : null;
    const num = (v) => parseFloat(v);
    return { n: items.length, display: cs.display, cols: cs.gridTemplateColumns.trim().split(/\s+/).length, bt: num(cs.borderTopWidth), btc: cs.borderTopColor, mt: num(cs.marginTop), pt: num(cs.paddingTop), colGap: num(cs.columnGap), rowGap: num(cs.rowGap),
      itemDisplay: it?.display, itemDir: it?.flexDirection, itemGap: num(it?.gap), itemCols: it?.gridTemplateColumns, itemPad: num(it?.paddingTop) , itemPadB: num(it?.paddingBottom), itemBT: num(it?.borderTopWidth), lastBB: num(items.length ? getComputedStyle(items[items.length - 1]).borderBottomWidth : 0), itemAlign: it?.alignItems,
      ddFam: dds?.fontFamily.split(',')[0].replace(/["']/g, '').toLowerCase(), ddW: dds?.fontWeight, ddPx: num(dds?.fontSize), ddLh: num(dds?.lineHeight) / num(dds?.fontSize), dtPx: num(dts?.fontSize), dtFam: dts?.fontFamily.split(',')[0].replace(/["']/g, '').toLowerCase(),
      ddAfterDt: dd && dt ? Boolean(dt.compareDocumentPosition(dd) & Node.DOCUMENT_POSITION_FOLLOWING) : null, ddAbove: dd && dt ? dd.getBoundingClientRect().top <= dt.getBoundingClientRect().top : null,
      dateNoWrap: (() => { const t = [...dl.querySelectorAll('[data-hero-fact]')].find((x) => /^dates$/i.test(x.querySelector('dt')?.textContent.trim() ?? '')); if (!t) return null; const d = t.querySelector('dd'); const cs = getComputedStyle(d); return { ws: cs.whiteSpace, lines: Math.round(d.getBoundingClientRect().height / parseFloat(cs.lineHeight)) }; })(), venueLines: (() => { const t = [...dl.querySelectorAll('[data-hero-fact]')].find((x) => /^venue$/i.test(x.querySelector('dt')?.textContent.trim() ?? '')); if (!t) return null; const d = t.querySelector('dd'); const cs = getComputedStyle(d); return Math.round(d.getBoundingClientRect().height / parseFloat(cs.lineHeight)); })(),
      copyKids: [...(dl.closest('.nos-hero-copy')?.children ?? [])].every((k) => getComputedStyle(k).minWidth === '0px'), sw: document.documentElement.scrollWidth, iw: innerWidth };
  });
  if (!f) return;
  const dd768 = Math.min(24, Math.max(20.8, 17.6 + 0.005 * vp.width));
  c.check(`${tag} FACTS-1 dd is Fraunces 300 and dt is Karla (${f.ddFam} ${f.ddW}, ${f.dtFam})`, f.ddFam.includes('fraunces') && f.ddW === '300' && f.dtFam.includes('karla'));
  c.check(`${tag} FACTS-1 hero copy children have min-width 0`, f.copyKids);
  if (vp.width >= 1440) {
    if (f.dateNoWrap) c.check(`${tag} the dates dd is nowrap and one line (${f.dateNoWrap.ws}, ${f.dateNoWrap.lines} line(s))`, f.dateNoWrap.ws === 'nowrap' && f.dateNoWrap.lines === 1);
    if (f.venueLines !== null) c.check(`${tag} the venue dd takes at most 2 lines (${f.venueLines})`, f.venueLines <= 2);
  }
  c.check(`${tag} no horizontal overflow (${f.sw} <= ${f.iw})`, f.sw <= f.iw);
  if (vp.width >= 768) {
    c.check(`${tag} FACTS-1 list is a grid of ${f.n} auto columns, justify start, margin-top 4, padding-top 20, 1px top rule (${f.display}, ${f.cols} cols, mt ${f.mt}, pt ${f.pt}, bt ${f.bt})`, f.display === 'grid' && f.cols === f.n && f.mt === 4 && f.pt === 20 && f.bt === 1 && /232, 230, 194/.test(f.btc));
    c.check(`${tag} FACTS-1 gaps 20px / clamp(32px,3.5vw,56px) (${f.rowGap} / ${f.colGap})`, f.rowGap === 20 && Math.abs(f.colGap - Math.min(56, Math.max(32, 0.035 * vp.width))) <= 1);
    c.check(`${tag} FACTS-1 item is flex column-reverse gap 6, dd above dt (${f.itemDisplay} ${f.itemDir} ${f.itemGap})`, f.itemDisplay === 'flex' && f.itemDir === 'column-reverse' && f.itemGap === 6 && f.ddAbove === true);
    c.check(`${tag} FACTS-1 dd ${f.ddPx.toFixed(1)}px ~ ${dd768.toFixed(1)}, line-height ${f.ddLh.toFixed(2)} ~ 1.15; dt 15px (${f.dtPx})`, Math.abs(f.ddPx - dd768) <= 0.6 && Math.abs(f.ddLh - 1.15) <= 0.03 && f.dtPx === 15);
  } else {
    c.check(`${tag} FACTS-1 rows: grid 72px | 1fr, gap 16, baseline, padding-block 12, hairline above each and below the last, no border-top on the list (${f.itemCols}; ${f.itemBT}; ${f.lastBB}; list ${f.bt})`, f.itemDisplay === 'grid' && /^72px /.test(f.itemCols ?? '') && f.itemGap === 16 && f.itemAlign === 'baseline' && f.itemPad === 12 && f.itemPadB === 12 && f.itemBT >= 1 && f.lastBB >= 1 && f.bt === 0);
    c.check(`${tag} FACTS-1 dt 14px, dd 20px line-height 1.3 (${f.dtPx}, ${f.ddPx}, ${f.ddLh.toFixed(2)})`, f.dtPx === 14 && f.ddPx === 20 && Math.abs(f.ddLh - 1.3) <= 0.03);
  }
}

/** SP-1 (NOS Design golden, root comms.md "/sponsors golden (SP-1)"): the /sponsors-only structure, copy sources and gates. */
const SPDIR = '.agent/memory/project/specs/nos-content-standard/goldens/sources/';
const spUnmd = (b) => b.replace(/\\([.\-_*#>()[\]!])/g, '$1').replace(/\*\*|__/g, '').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
const spLine = (file, n) => spUnmd(readFileSync(SPDIR + file, 'utf8').split('\n')[n - 1] ?? '');
function spQa(q) {
  const L = readFileSync(SPDIR + 'faq.md', 'utf8').split('\n'); const i = L.findIndex((l) => new RegExp(`^\\*\\*${q}\\. `).test(l));
  if (i < 0) return null; const ans = []; for (let k = i + 1; k < L.length && !/^\*\*\d+\. /.test(L[k]); k += 1) if (L[k].trim()) ans.push(spUnmd(L[k]));
  return { q: spUnmd(L[i]).replace(/^\d+\.\s*/, ''), a: ans };
}
async function sp1Checks(page, route, vp, c, tag) {
  const S = route.sp1Sources;
  const m = await page.evaluate(() => {
    const lum = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    const L = (css) => { const n = css.match(/[\d.]+/g).map(Number); return 0.2126 * lum(n[0]) + 0.7152 * lum(n[1]) + 0.0722 * lum(n[2]); };
    const txt = (e) => e.textContent.replace(/\s+/g, ' ').trim();
    const btns = [...document.querySelectorAll('main a[class*="btn"], main button')].filter((b) => b.getBoundingClientRect().height > 0).map((b) => { const cs = getComputedStyle(b); const fg = L(cs.color); const bg = L(cs.backgroundColor); return { t: txt(b).slice(0, 30), h: b.getBoundingClientRect().height, ratio: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05), bgA: cs.backgroundColor.startsWith('rgba') && /, 0\)$/.test(cs.backgroundColor) }; });
    const aside = document.querySelector('[data-doc-aside]'); const ab = aside ? ([...aside.querySelectorAll('a')].find((a) => /inline-flex|btn/.test(a.className)) ?? [...aside.querySelectorAll('a')].sort((p, q) => q.getBoundingClientRect().height - p.getBoundingClientRect().height)[0] ?? null) : null;
    const abc = ab ? getComputedStyle(ab) : null;
    const h2s = [...document.querySelectorAll('main h2')].map(txt);
    const bec = [...document.querySelectorAll('main h2')].find((h) => /become a sponsor/i.test(txt(h)));
    const h3s = bec ? [...document.querySelectorAll('main h3')].filter((h) => bec.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING).map(txt) : [];
    const reach = ['/symposium', '/wosa-conference', '/vendors'].map((hr) => { const a = [...document.querySelectorAll('[data-doc-main] a')].find((x) => x.getAttribute('href')?.endsWith(hr)); return a ? a.getBoundingClientRect().height : null; });
    const cta = document.querySelector('.sp-hero-cta, [data-sponsors-hero-cta]'); const ctaShown = cta ? cta.getBoundingClientRect().height > 0 && getComputedStyle(cta).display !== 'none' : null;
    const hero = document.querySelector('section[data-nos-hero]');
    const reachA = [...document.querySelectorAll('[data-doc-main] a')].filter((x) => /\/(symposium|wosa-conference|vendors)$/.test(x.getAttribute('href') ?? ''));
    const bullets = reachA.filter((a) => { const li = a.closest('li'); const ul = a.closest('ul, ol'); return (li && getComputedStyle(li).listStyleType !== 'none') || (ul && getComputedStyle(ul).listStyleType !== 'none'); }).length;
    const wh = [...document.querySelectorAll('main h2')].find((h) => /^show sponsors$/i.test(h.textContent.trim())); const whb = wh?.getBoundingClientRect(); const thanksEl = wh ? [...document.querySelectorAll('main p')].find((p) => wh.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING) : null; const tb = thanksEl?.getBoundingClientRect();
    const wallStacked = whb && tb ? { below: tb.top >= whb.bottom - 1, sameLeft: Math.abs(tb.left - whb.left) <= 2 } : null;
    const btnList = [...document.querySelectorAll('main a[class*="btn"], main a[class*="inline-flex"]')].map((b) => ({ t: txt(b).slice(0, 24), cls: String(b.className).split(/\s+/).find((x) => /^nos-/.test(x)) ?? '', r: parseFloat(getComputedStyle(b).borderTopLeftRadius) || 0 })); const btnRadius = Math.max(0, ...btnList.map((b) => b.r)); const btnRadii = btnList.map((b) => `${b.cls || b.t}:${b.r}`).join(' ');
    const strip = Math.max(0, ...[...document.querySelectorAll('main [aria-hidden="true"]')].filter((e) => !e.closest('section[data-nos-hero]')).map((e) => e.querySelectorAll('img').length));
    const body = document.querySelector('main')?.textContent.replace(/\s+/g, ' ') ?? '';
    return { bullets, wallStacked, btnRadius, btnRadii, btnDistinct: [...new Set(btnList.map((b) => b.r))], h1: txt(document.querySelector('h1')), terms: [...(hero?.querySelectorAll('[data-hero-facts] dt') ?? [])].map(txt), btns, h2s, h3s, reach, ctaShown, strip, body, asideKind: aside?.getAttribute('data-doc-aside-kind'), asideBtn: abc ? { fg: L(abc.color), bg: L(abc.backgroundColor), h: ab.getBoundingClientRect().height, w: ab.getBoundingClientRect().width, aw: aside.getBoundingClientRect().width } : null, asideText: aside ? txt(aside) : '', main: document.querySelector('[data-doc-main]')?.textContent.replace(/\s+/g, ' ') ?? '' };
  });
  const has = (hay, needle) => hay.includes(needle);
  c.check(`${tag} SP-1 h1 is "Sponsors" and the facts are Dates, Venue, Host (${m.h1}; ${m.terms.join(' | ')})`, m.h1 === 'Sponsors' && JSON.stringify(m.terms) === JSON.stringify(['Dates', 'Venue', 'Host']));
  c.check(`${tag} SP-1 the standfirst is What to Expect v1.0 line ${S.standfirst.line} verbatim`, has(m.main, spLine(S.standfirst.file, S.standfirst.line)));
  c.check(`${tag} SP-1 theme prose is About v1.2 line ${S.themeProse.line} verbatim`, has(m.main, spLine(S.themeProse.file, S.themeProse.line)) || has(m.body, spLine(S.themeProse.file, S.themeProse.line)));
  c.check(`${tag} SP-1 reach register: three link rows to /symposium, /wosa-conference, /vendors, each >= 44px (${m.reach.join(',')})`, m.reach.every((h) => h !== null && h >= 44));
  c.check(`${tag} SP-1 h2 "Become a sponsor" with the two FAQ Q&As (Q80, Q81) as h3, verbatim`, m.h2s.some((t) => /^become a sponsor$/i.test(t)) && S.qa.every((e, i) => { const q = spQa(e.q); return q && m.h3s[i] && m.h3s[i].replace(/^\d+\.\s*/, '') === q.q && q.a.every((a) => has(m.body, a)); }), m.h3s.join(' | '));
  c.check(`${tag} SP-1 the sponsor wall: h2 "Show sponsors" and the council's thanks (About v1.2 line ${S.thanks.line}) verbatim`, m.h2s.some((t) => /^show sponsors$/i.test(t)) && has(m.body, spLine(S.thanks.file, S.thanks.line)));
  c.check(`${tag} SP-1 the sponsorship email is ${S.email}, not ${S.notEmail} (D-SP1)`, has(m.body, S.email) && !has(m.body, S.notEmail));
  c.check(`${tag} SP-1 no tier names, no preview chrome (no TBC chip, no "PLACEHOLDER COPY")`, !/PLACEHOLDER COPY/i.test(m.body) && !/(Gold|Silver|Bronze) (sponsor|partner)|Conservation Partner/i.test(m.body) && !/to be confirmed/i.test(m.body));
  c.check(`${tag} SP-1 no bullets on the reach rows (${m.bullets})`, m.bullets === 0);
  c.check(`${tag} SP-1 the wall head is stacked: h2, then the thanks line below it, same left edge (${JSON.stringify(m.wallStacked)})`, Boolean(m.wallStacked) && m.wallStacked.below && m.wallStacked.sameLeft);
  c.check(`${tag} SP-1 the shared NOS Button has ONE radius, 10px, on every Button link (RB-1: R17 wins; NOS Design withdrew the SP-1 2px note) (${m.btnRadii})`, m.btnDistinct.length === 1 && m.btnDistinct[0] === 10);
  c.check(`${tag} SP-1 an aria-hidden photo strip of three tiles, counted as images inside one aria-hidden container (${m.strip})`, m.strip >= 3);
  c.check(`${tag} SP-1 the aside is ONE content card with a full-width button, pale on royal (kind ${m.asideKind})`, m.asideKind === 'content' && m.asideBtn && m.asideBtn.bg < m.asideBtn.fg && m.asideBtn.w >= m.asideBtn.aw * 0.8 - 2, JSON.stringify(m.asideBtn));
  c.check(`${tag} SP-1 every button is >= 44px with contrast >= 4.5 (${m.btns.map((b) => `${b.t}:${b.h.toFixed(0)}/${b.ratio.toFixed(1)}`).join(' ')})`, m.btns.every((b) => b.h >= 44 && (b.ratio >= 4.5 || b.bgA)));
  if (m.ctaShown !== null) c.check(`${tag} SP-1 the hero CTA shows only below 1024 (shown ${m.ctaShown})`, m.ctaShown === (vp.width < 1024));
}

/** PV-G1 (NOS Design golden, root comms.md from line 2964): the /plan-your-visit-only structure. */
// The empty first/last number cells need SAOC's DocumentIndex to carry a `number` field; required only once that source has one.
const IDX_SRC = existsSync('components/ui/DocumentIndex.tsx') ? readFileSync('components/ui/DocumentIndex.tsx', 'utf8') : '';
const NUMBER_FIELD_LANDED = /data-index-number/.test(IDX_SRC);
async function pyvChecks(page, route, vp, c, tag) {
  const P = route.pyv;
  const m = await page.evaluate(() => {
    const txt = (e) => e.textContent.replace(/\s+/g, ' ').trim();
    const idx = [...document.querySelectorAll('nav[data-doc-index] a')].map((a) => ({ n: (a.querySelector('[data-index-number]') ?? a.querySelector('span'))?.textContent.trim() ?? '', t: txt(a).slice(0) }));
    const venue = [...document.querySelectorAll('main h2')].find((h) => /^the venue$/i.test(txt(h)))?.closest('section, div');
    const vcs = venue ? getComputedStyle(venue) : null; const vb = venue?.getBoundingClientRect();
    const em = [...document.querySelectorAll('main h2')].find((h) => /^in an emergency$/i.test(txt(h))); const emSec = em?.closest('section'); const eb = emSec?.getBoundingClientRect();
    const tels = [...document.querySelectorAll('a[href^="tel:"]')].map((a) => ({ href: a.getAttribute('href'), h: a.getBoundingClientRect().height }));
    const links = [...document.querySelectorAll('[data-doc-main] a[rel~="noopener"]')].map((a) => a.getBoundingClientRect().height);
    const close = [...document.querySelectorAll('main *')].find((e) => e.children.length === 0 && /^start planning your visit today/i.test(txt(e)));
    const closeStyle = close ? { tag: close.tagName, fam: getComputedStyle(close).fontFamily.toLowerCase(), w: getComputedStyle(close).fontWeight } : null;
    const kids = venue ? [...venue.querySelectorAll('h3')].map(txt) : [];
    return { idx, venue: Boolean(venue), venueInMain: Boolean(venue?.closest('[data-doc-main]')), venueBg: vcs?.backgroundColor, venueRadius: parseFloat(vcs?.borderTopLeftRadius ?? '0'), venueCols: venue ? Math.max(1, ...[...venue.children].map((k) => getComputedStyle(k).display === 'grid' ? getComputedStyle(k).gridTemplateColumns.trim().split(/\s+/).length : 1), vcs.display === 'grid' ? vcs.gridTemplateColumns.trim().split(/\s+/).length : 1) : 0, emOutside: Boolean(emSec && !emSec.closest('[data-doc-main]')), emFull: eb ? eb.width >= innerWidth - 1 : false, emAfterGrid: emSec ? Boolean(document.querySelector('[data-doc-layout]')?.compareDocumentPosition(emSec) & Node.DOCUMENT_POSITION_FOLLOWING) : false, tels, links, closeStyle, kids, venueAddrBr: venue?.querySelectorAll('address br').length ?? 0, sw: document.documentElement.scrollWidth, iw: innerWidth };
  });
  c.check(`${tag} PV-G1 the index is The venue, 1-7, In an emergency (${m.idx.length}); first and last rows have an empty number cell${NUMBER_FIELD_LANDED ? '' : ' (PENDING SAOC: DocumentIndex has no number field; not required yet)'}`, JSON.stringify(m.idx.map((e) => e.t.replace(/^\d+\.\s*/, '').trim())) === JSON.stringify(P.index.map((e) => e.replace(/^\d+\.\s*/, ''))) && (!NUMBER_FIELD_LANDED || (m.idx[0].n === '' && m.idx[m.idx.length - 1].n === '')), JSON.stringify(m.idx.map((e) => e.t)));
  c.check(`${tag} PV-G1 "The venue" card first in the main column: white, radius 10, from her Section 1 block, address with her line breaks (${m.venueAddrBr} br), 2 columns from 768 and 1 below (${m.venueCols})`, m.venue && m.venueInMain && m.venueRadius === 10 && m.venueAddrBr >= 4 && (vp.width >= 768 ? m.venueCols >= 2 : m.venueCols === 1) && m.kids.includes('Getting there') && m.kids.includes('Public Transport'), JSON.stringify(m.kids));
  c.check(`${tag} PV-G1 "In an emergency" is a full-bleed band after the body grid (outside the main column: ${m.emOutside}, full width: ${m.emFull}, after: ${m.emAfterGrid})`, m.emOutside && m.emFull && m.emAfterGrid);
  c.check(`${tag} PV-G1 the three tel: links are present and >= 44px (${m.tels.map((t) => `${t.href}:${Math.round(t.h)}`).join(' ')})`, P.tel.every((h) => m.tels.some((t) => t.href === h && t.h >= 44)));
  c.check(`${tag} PV-G1 link register rows are >= 48px with rel noopener (${m.links.length}, min ${Math.round(Math.min(...m.links, 999))})`, m.links.length > 0 && m.links.every((h) => h >= 47.5));
  c.check(`${tag} PV-G1 her closing line is Fraunces 300 and not a heading (${JSON.stringify(m.closeStyle)})`, Boolean(m.closeStyle) && !/^H\d$/.test(m.closeStyle.tag) && m.closeStyle.fam.includes('fraunces') && m.closeStyle.w === '300');
  c.check(`${tag} PV-G1 no overflow at any width (${m.sw} <= ${m.iw})`, m.sw <= m.iw);
}

/** PG-G1 (NOS Design golden, root comms.md from line 3125): the /programme timetable board. Hours come from What to Expect v1.0, verbatim. */
/** TICKET_PRODUCTS.workshops.when and .meta, read from source at gate time (never hard-coded here). */
function workshopsRowSource() {
  const src = readFileSync('lib/data/ticket-presentation.ts', 'utf8');
  const block = src.slice(src.indexOf('workshops: {'));
  const when = block.match(/when:\s*'([^']+)'/)?.[1] ?? null;
  const metaRaw = block.match(/meta:\s*(`[^`]*`|'[^']*')/)?.[1] ?? null;
  const capName = metaRaw?.match(/\$\{(\w+)\}/)?.[1];
  let cap = null;
  if (capName) for (const f of ['lib/data/ticket-presentation.ts', ...readdirSync('lib', { recursive: true }).filter((x) => /\.ts$/.test(String(x))).map((x) => `lib/${x}`)]) { const m = readFileSync(f, 'utf8').match(new RegExp(`${capName}\\s*(?::[^=]+)?=\\s*(\\d+)`)); if (m) { cap = m[1]; break; } }
  const meta = metaRaw ? metaRaw.slice(1, -1).replace(/\$\{\w+\}/, cap ?? '') : null;
  return { when, meta };
}
async function programmeChecks(page, route, vp, c, tag) {
  const P = route.pgSources;
  const WS = workshopsRowSource();
  c.check(`${tag} PG-G1 the workshops source strings were read from lib/data/ticket-presentation.ts (${JSON.stringify(WS)})`, Boolean(WS.when) && Boolean(WS.meta) && /\d/.test(WS.meta));
  const wte = readFileSync(`${SPDIR}${P.file}`, 'utf8');
  c.check(`${tag} PG-G1 her heading and date line exist in What to Expect v1.0 (so they can never drift)`, wte.includes(P.h2) && wte.includes(P.line));
  for (const d of P.days) c.check(`${tag} PG-G1 her hours for ${d.wd} exist in her doc: "${d.hours}"`, wte.includes(d.hours));
  const m = await page.evaluate(() => {
    const txt = (e) => e.textContent.replace(/\s+/g, ' ').trim();
    const h2s = [...document.querySelectorAll('main h2')].map(txt);
    const board = document.querySelector('ol, [data-programme-board]'); const days = board ? [...board.querySelectorAll(':scope > li')] : [];
    const dayInfo = days.map((li) => { const b = li.getBoundingClientRect(); const a = [...li.querySelectorAll('a')].map((x) => ({ href: x.getAttribute('href'), h: x.getBoundingClientRect().height, t: txt(x) })); return { t: txt(li), top: Math.round(b.top), left: Math.round(b.left), w: b.width, dateCell: (li.querySelector('p, [class*="date"]')?.getBoundingClientRect().width ?? 0), a }; });
    const bc = board ? getComputedStyle(board) : null; const bb = board?.getBoundingClientRect();
    const later = [...document.querySelectorAll('[data-programme-body] a[href$="/workshops"], main a[href$="/workshops"]:not(nav a):not(.nos-subnav a):not([data-nos-subnav] a)')].filter((a) => !a.closest('nav, .nos-subnav, section[data-nos-hero]')).map((a) => ({ t: txt(a), h: a.getBoundingClientRect().height, below: board ? a.getBoundingClientRect().top >= bb.bottom - 1 : false }))[0] ?? null;
    const tickets = document.querySelector('#programme .nk-grid, .nk-grid'); const tb = [...document.querySelectorAll('main h2')].find((h) => /^tickets$/i.test(txt(h)));
    const ph = /PLACEHOLDER COPY|AI placeholder|to be confirmed/i.test(document.querySelector('main')?.textContent ?? '');
    const focusRing = (() => { const a = days.flatMap((li) => [...li.querySelectorAll('a')])[0]; if (!a) return null; a.focus(); const s = getComputedStyle(a); return { os: s.outlineStyle, ow: parseFloat(s.outlineWidth), bs: s.boxShadow }; })();
    return { h2s, dayInfo, bcols: bc ? bc.gridTemplateColumns.trim().split(/\s+/).length : 0, bradius: bc ? parseFloat(bc.borderTopLeftRadius) : null, bbg: bc?.backgroundColor, later, hasGrid: Boolean(tickets), hasTicketsH2: Boolean(tb), gridAfterH2: tb && tickets ? Boolean(tb.compareDocumentPosition(tickets) & Node.DOCUMENT_POSITION_FOLLOWING) : false, ph, focusRing, sw: document.documentElement.scrollWidth, iw: innerWidth };
  });
  c.check(`${tag} PG-G1 exactly two h2: "${P.h2s[0]}" and "Tickets"; no h2 "Programme" (${m.h2s.join(' | ')})`, JSON.stringify(m.h2s.map((t) => t.replace(/\s+/g, ' '))) === JSON.stringify(P.h2s) && !m.h2s.some((t) => /^programme$/i.test(t)));
  c.check(`${tag} PG-G1 the line "${P.line}" is rendered`, m.dayInfo.length === 4 && (await page.evaluate((t) => (document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' ').includes(t), P.line)));
  c.check(`${tag} PG-G1 the board has four days: ${P.days.map((d) => `${d.wd} ${d.d}`).join(', ')} with her opening hours verbatim`, m.dayInfo.length === 4 && P.days.every((d, i) => m.dayInfo[i].t.includes(d.wd) && m.dayInfo[i].t.includes(d.d) && m.dayInfo[i].t.includes(d.hours)), m.dayInfo.map((d) => d.t.slice(0, 40)).join(' | '));
  c.check(`${tag} PG-G1 symposium and WOSA are linked tiles on their days (Friday, Saturday), each >= 44px`, P.days.filter((d) => d.tile).every((d, _i) => { const di = P.days.indexOf(d); return m.dayInfo[di]?.a.some((x) => x.href?.endsWith(d.tile) && x.h >= 44); }));
  c.check(`${tag} PG-G1 the session tiles are keyboard focusable with a visible focus (${JSON.stringify(m.focusRing)})`, Boolean(m.focusRing) && ((m.focusRing.os !== 'none' && m.focusRing.ow > 0) || m.focusRing.bs !== 'none'));
  const tops = new Set(m.dayInfo.map((d) => d.top)); const lefts = new Set(m.dayInfo.map((d) => d.left));
  if (vp.width >= 1024) c.check(`${tag} PG-G1 four day columns in one row (${m.bcols} cols, ${tops.size} row(s))`, tops.size === 1 && lefts.size === 4);
  else if (vp.width >= 600) c.check(`${tag} PG-G1 the board is 2x2 (${tops.size} rows, ${lefts.size} cols)`, tops.size === 2 && lefts.size === 2);
  else c.check(`${tag} PG-G1 below 600 one row per day with a 108px date column (${tops.size} rows, date cell ${Math.round(m.dayInfo[0]?.dateCell ?? 0)})`, tops.size === 4 && lefts.size === 1 && Math.abs((m.dayInfo[0]?.dateCell ?? 0) - 108) <= 2);
  c.check(`${tag} PG-G1 the board is one white card with radius 10 (${m.bradius}, ${m.bbg})`, m.bradius === 10 && /255, 255, 255/.test(m.bbg ?? ''));
  c.check(`${tag} PG-G1 workshops: one ruled link row below the board whose text is TICKET_PRODUCTS.workshops.when and .meta ("${WS.when}" and "${WS.meta}"), >= 44px (${JSON.stringify(m.later)})`, Boolean(m.later) && m.later.below && m.later.h >= 44 && m.later.t.includes(WS.when ?? '\0') && m.later.t.includes(WS.meta ?? '\0') && m.later.t.includes('Workshops'));
  c.check(`${tag} PG-G1 h2 "Tickets" is followed by the unchanged .nk-grid`, m.hasTicketsH2 && m.hasGrid && m.gridAfterH2);
  c.check(`${tag} PG-G1 no placeholder or TBC copy anywhere`, !m.ph);
  c.check(`${tag} PG-G1 no overflow (${m.sw} <= ${m.iw})`, m.sw <= m.iw);
}

/** Card images (the .nk-grid cards on /programme and /tickets): naturalWidth >= box x DPR at 2056@2 (no upscale), not lazy above the fold. */
async function cardImageChecks(page, vp, c, tag) {
  const imgs = await page.evaluate(async () => {
    const out = [];
    for (const img of document.querySelectorAll('.nk-grid img')) {
      const b = img.getBoundingClientRect(); if (!b.width || !b.height) continue;
      const probe = new Image(); probe.src = img.currentSrc; try { await probe.decode(); } catch { /* reported below as zero */ }
      out.push({ src: img.currentSrc.slice(-60), w: b.width, h: b.height, nw: probe.naturalWidth, nh: probe.naturalHeight, dpr: devicePixelRatio, lazy: img.loading === 'lazy', top: b.top });
    }
    return { out, ih: innerHeight };
  });
  c.check(`${tag} card images exist (${imgs.out.length})`, imgs.out.length > 0);
  for (const i of imgs.out) {
    const req = Math.ceil(Math.max(i.w, i.h * (i.nw / Math.max(i.nh, 1))) * i.dpr - 0.5);
    c.check(`${tag} card image served ${i.nw} >= required ${req} (box ${Math.round(i.w)}x${Math.round(i.h)}, ${(i.nw / req).toFixed(2)})`, i.nw >= req, i.src);
    if (i.top < imgs.ih) c.check(`${tag} an above-the-fold card image is not loading=lazy`, !i.lazy, i.src);
  }
}

/** SX-G1 delta onto /vendors (NOS Design, root comms.md L3350). The invited-vendor wall is gated (D-SX1). */
/** IG-G1 (NOS Design, root comms.md L3350): /international-guests. Zero guests is a valid public state; with guests, one editorial profile per row. */
async function igChecks(page, route, vp, c, tag) {
  const I = route.ig;
  const m = await page.evaluate((demo) => {
    const num = (v) => parseFloat(v) || 0; const txt = (e) => e.textContent.replace(/\s+/g, ' ').trim();
    const main = document.querySelector('main'); const rows = [...document.querySelectorAll('[data-guest-profile]')];
    const h1 = txt(document.querySelector('h1'));
    const rowInfo = rows.map((r) => {
      const rb = r.getBoundingClientRect(); const cs = getComputedStyle(r);
      const img = r.querySelector('[data-guest-portrait] img'); const por = r.querySelector('[data-guest-portrait]'); const pb = por?.getBoundingClientRect(); const pcs = por ? getComputedStyle(por) : null;
      const dts = [...r.querySelectorAll('dl dt')].map(txt); const dds = [...r.querySelectorAll('dl dd')].map(txt);
      const sum = r.querySelector('details > summary'); const sb = sum?.getBoundingClientRect();
      const upper = [r, ...r.querySelectorAll('*')].filter((e) => getComputedStyle(e).textTransform === 'uppercase' && txt(e).length > 0).length;
      const role = r.querySelector('[data-guest-role]');
      const countryIdx = dts.findIndex((d) => /^country$/i.test(d));
      const nameEl = r.querySelector('h2, h3'); const pid = r.getAttribute('data-presenter-id');
      return { pid, name: nameEl ? txt(nameEl) : '', nameTag: nameEl ? nameEl.tagName : null, top: rb.top + scrollY, left: rb.left, w: rb.width, display: cs.display, cols: cs.gridTemplateColumns.trim().split(/\s+/).length, firstCol: num(cs.gridTemplateColumns.trim().split(/\s+/)[0]),
        por: Boolean(por), hasImg: Boolean(img), natW: img?.naturalWidth ?? 0, boxW: img ? img.getBoundingClientRect().width : 0, aspect: pb && pb.height ? pb.width / pb.height : null, sticky: pcs?.position, stickyTop: pcs ? num(pcs.top) : null, radius: pcs ? num(pcs.borderTopLeftRadius) : null,
        dts, dds, hasSummary: Boolean(sum), summaryH: sb ? sb.height : 0, summaryText: sum ? txt(sum) : '', upper, role: role ? txt(role) : null, roleUpper: role ? getComputedStyle(role).textTransform : null, country: countryIdx >= 0 ? dds[countryIdx] ?? '' : null,
        placeholderTile: Boolean(r.querySelector('[data-placeholder], [data-guest-portrait]:not(:has(img))')), bgImg: por ? getComputedStyle(por).backgroundImage !== 'none' : false };
    });
    const filter = document.querySelector('[data-guest-filter]');
    const fitems = filter ? [...filter.querySelectorAll('a, button')].map((e) => e.getBoundingClientRect().height) : [];
    const t = (main?.textContent ?? '').replace(/\s+/g, ' ');
    return { h1, rowInfo, filter: Boolean(filter), fitems, tAll: t, demoAttr: document.querySelectorAll('[data-demo]').length, demoHit: (() => { // A demo value may occur inside a speaker's real bio (Michael Tibbs owns The Exotic Plant Company, his frozen bio says so); it is banned in the fact cells (dl) and anywhere outside the profiles.
      const cl = main.cloneNode(true); cl.querySelectorAll('[data-guest-profile] details, [data-guest-profile] p').forEach((n) => n.remove()); cl.querySelectorAll('script, style, noscript, template').forEach((n) => n.remove()); const td = (cl.textContent ?? '').replace(/\s+/g, ' '); return demo.filter((d) => td.includes(d)); })(),
      grid: document.querySelectorAll('main [class*="grid"] > [data-guest-profile]').length, h2s: [...main.querySelectorAll('h2')].map(txt), layout: Boolean(document.querySelector('[data-doc-layout]')), sw: document.documentElement.scrollWidth, iw: innerWidth };
  }, I.demoValues);
  c.check(`${tag} IG-G1 h1 is "${I.h1}" in sentence case (${m.h1})`, m.h1 === I.h1);
  c.check(`${tag} IG-G1 never prints demo values from her shots (${m.demoHit.join(', ')}; data-demo x${m.demoAttr})`, m.demoHit.length === 0 && m.demoAttr === 0);
  c.check(`${tag} IG-G1 no horizontal scroll (390 sw = cw)`, m.sw <= m.iw);
  const rows = m.rowInfo;
  if (I.event && I.count != null) c.check(`${tag} PR-1 ${I.count} presenters, each an <${I.nameTag.toLowerCase()}> name under the h2 "Presenters" (${rows.length}: ${rows.map((x) => x.nameTag).join(',')})`, rows.length === I.count && rows.every((x) => x.nameTag === I.nameTag));
  if (rows.length === 0 && !I.event) {
    c.check(`${tag} IG-G1 zero guests: hero and sub-nav only, no ABSENCE_STATEMENT, no RealEmptyListing labels, no filter, no h2 (${m.h2s.join(' | ')})`, m.h2s.length === 0 && !m.filter && !/to be confirmed|TBC|placeholder|no international guests|coming soon|not yet (announced|confirmed)/i.test(m.tAll) && !m.layout);
    return;
  }
  if (rows.length === 0) return;
  if (I.orderFile) {
    const src = existsSync(I.orderFile) ? readFileSync(I.orderFile, 'utf8') : '';
    const body = src.match(new RegExp(`${I.orderConst}[^=]*=\\s*\\[([^\\]]*)\\]`))?.[1] ?? '';
    const ids = [...body.matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
    const ranked = rows.map((x) => ({ id: x.pid, at: ids.indexOf(x.pid) })).filter((x) => x.at >= 0).map((x) => x.at);
    // The sequence in presenter-order.ts is NOS Design's sample (Codi), not her document, and the file's own rule is that a Sanity `order` wins; SAOC has now set order in the CMS. So the CMS order is the order: the gate asserts the ids (and that the file's list is _id-keyed), and reports a difference from the fallback as a note, never a failure.
    c.check(`${tag} PR-1 every profile carries a unique data-presenter-id (the CMS _id) (${rows.map((x) => x.pid).join(', ')})`, rows.every((x) => x.pid) && new Set(rows.map((x) => x.pid)).size === rows.length && ids.length > 0);
    if (!ranked.every((v, k) => k === 0 || v > ranked[k - 1])) c.note(`${tag} PR-1 the rendered order differs from the PRESENTER_FALLBACK_SEQUENCE sample; expected while the CMS sets \`order\` (the CMS wins)`);
  }
  if (I.mustName) c.check(`${tag} her documents outrank the CMS: the rendered name is "${I.mustName}" (${rows.map((x) => x.name).join(' | ')})`, rows.some((x) => x.name === I.mustName) && !rows.some((x) => x.name.includes(I.bannedName)));
  c.check(`${tag} IG-G1 no uppercase anywhere in the profiles, including the record title and the role label (${rows.map((r) => r.upper).join(',')})`, rows.every((r) => r.upper === 0));
  c.check(`${tag} IG-G1 one editorial profile per row, never a card grid: rows stack (distinct tops, same left) and no grid wraps the rows (${m.grid})`, m.grid === 0 && rows.every((r, i) => i === 0 || (r.top - rows[i - 1].top > 100 && Math.abs(r.left - rows[0].left) <= 1)));
  c.check(`${tag} IG-G1 role label present on every row and not uppercase`, rows.every((r) => r.role && r.roleUpper !== 'uppercase'));
  if (!I.event) c.check(`${tag} IG-G1 listing rule: every row has a country, and it is not South Africa (${rows.map((r) => r.country).join(' | ')})`, rows.every((r) => r.country !== null && r.country !== '' && !/^south africa$/i.test(r.country)));
  if (I.listed) c.check(`${tag} IG-G1 lists exactly ${I.listed.map((e) => e.name).join(' and ')}, no one else, with their country and organisation from the CMS (${rows.map((x) => `${x.name}: ${x.country}`).join(' | ')})`, rows.length === I.listed.length && I.listed.every((e) => { const row = rows.find((x) => x.name.includes(e.name)); if (!row) return false; const oi = row.dts.findIndex((d) => /^organi[sz]ation$/i.test(d)); return row.country === e.country && oi >= 0 && row.dds[oi] === e.organisation; }));
  if (!I.event) c.check(`${tag} PR-1 on /international-guests the name stays an h2`, rows.every((x) => x.nameTag === (I.nameTag ?? 'H2')));
  c.check(`${tag} IG-G1 empty facts omitted: no dash, TBC or empty cell, and every dt has its dd (${rows.map((r) => r.dts.length + '/' + r.dds.length).join(',')})`, rows.every((r) => r.dts.length === r.dds.length && r.dds.every((d) => d !== '' && !/^[-–—]+$/.test(d) && !/^(tbc|to be confirmed|n\/a)$/i.test(d)) && r.dts.every((d) => d !== '')));
  { const real = await page.evaluate(async () => { const out = []; for (const r of [...document.querySelectorAll('[data-guest-profile]')]) { const im = r.querySelector('[data-guest-portrait] img'); if (!im) { out.push({ w: 0, cdn: false }); continue; } const cur = im.currentSrc || im.src; const u = new URL(cur, location.href); const orig = u.pathname.startsWith('/_next/image') ? new URL(u.searchParams.get('url'), location.href) : u; out.push({ w: await new Promise((res) => { const n = new Image(); n.onload = () => res(n.naturalWidth); n.onerror = () => res(0); n.src = orig.href; }), cdn: orig.hostname === 'cdn.sanity.io' }); } return out; }); rows.forEach((r, i) => { if (r.hasImg) { r.natW = real[i]?.w ?? r.natW; r.cdn = real[i]?.cdn ?? false; } });
    for (const r of rows) if (r.hasImg && r.cdn && r.natW && r.natW < Math.floor(r.boxW * vp.dsf) - 1) c.note(`${tag} OWNER (data): ${r.name} portrait is a ${r.natW}px source file but needs ${Math.round(r.boxW * vp.dsf)}px; the owner supplies a larger original (PR-1 below still decides whether it may show)`); }
  c.check(`${tag} IG-G1 no portrait is upscaled (the selected file's width >= box x DPR) and no placeholder tile: a portrait element always holds a photo (${rows.map((r) => r.hasImg ? r.natW + '/' + Math.round(r.boxW * vp.dsf) : '-').join(' ')})`, rows.every((r) => !r.por || (r.hasImg && (r.natW >= Math.floor(r.boxW * vp.dsf) - 1 || (r.cdn && r.natW > 0)))) && rows.every((r) => !r.placeholderTile && !r.bgImg));
  if (rows.some((r) => r.hasImg)) {
    const r0 = rows.find((r) => r.hasImg);
    c.check(`${tag} IG-G1 portrait 4:5 with radius 10${vp.width >= 768 ? ', sticky at top 100' : ''} (${r0.aspect && r0.aspect.toFixed(2)}, r ${r0.radius}, ${r0.sticky} ${r0.stickyTop})`, r0.aspect !== null && Math.abs(r0.aspect - 0.8) <= 0.03 && r0.radius === 10 && (vp.width < 768 || (r0.sticky === 'sticky' && r0.stickyTop === 100)));
  }
  if (vp.width >= 768) c.check(`${tag} IG-G1 row is two columns, the first at most ${I.boxMax ?? 320}px (${rows[0].cols} cols, ${rows[0].firstCol}px)`, rows.every((r) => r.display === 'grid' && r.cols === 2 && r.firstCol <= (I.boxMax ?? 320) + 1));
  const nat = await page.evaluate(async () => {
    const out = [];
    for (const r of [...document.querySelectorAll('[data-guest-profile]')]) {
      const im = r.querySelector('[data-guest-portrait] img'); if (!im) continue;
      let native = im.naturalWidth;
      // The ORIGINAL file width: unwrap /_next/image to its url param, then read the width from the Sanity asset id (`<hash>-<w>x<h>.<ext>`, immune to any ?w= transform in the query); only if that is absent, load the original with its query stripped.
      try { const u = new URL(im.currentSrc || im.src, location.href); const orig = u.pathname.startsWith('/_next/image') ? new URL(u.searchParams.get('url'), location.href) : u; const m = orig.pathname.match(/-(\d+)x(\d+)\.[a-z]+$/i);
        if (m) native = Number(m[1]); else { orig.search = ''; native = await new Promise((res) => { const n = new Image(); n.onload = () => res(n.naturalWidth); n.onerror = () => res(0); n.src = orig.href; }); } } catch { native = 0; }
      out.push({ name: (r.querySelector('h2, h3')?.textContent ?? '').replace(/\s+/g, ' ').trim(), native });
    }
    return out;
  });
  c.check(`${tag} PR-1 photo rule: a portrait shows only when its source is >= ${I.minPortraitSourceW}px wide (${nat.map((n) => n.name.slice(0, 12) + ' ' + n.native).join(', ')})`, nat.every((n) => n.native >= I.minPortraitSourceW));
  for (const nm of I.mustHavePhoto ?? []) { const row = rows.find((x) => x.name.includes(nm)); if (row) c.check(`${tag} PR-1 ${nm} shows a portrait (source >= ${I.minPortraitSourceW})`, row.hasImg); }
  for (const nm of I.mustNotHavePhoto ?? []) { const row = rows.find((x) => x.name.includes(nm)); if (row) c.check(`${tag} PR-1 ${nm} has no portrait and no placeholder tile (source below ${I.minPortraitSourceW})`, !row.hasImg && !row.por && !row.placeholderTile); }
  const withBio = rows.filter((r) => r.hasSummary);
  c.check(`${tag} IG-G1 <details> summary reads "Read full bio" and is >= 44px (${withBio.map((r) => Math.round(r.summaryH)).join(',')})`, withBio.every((r) => /read full bio/i.test(r.summaryText) && r.summaryH >= 44));
  if (withBio.length) {
    const ring = await page.evaluate(() => { const s = document.querySelector('[data-guest-profile] details > summary'); s.focus({ focusVisible: true }); const cs = getComputedStyle(s); return { outline: cs.outlineStyle, ow: parseFloat(cs.outlineWidth), shadow: cs.boxShadow }; });
    c.check(`${tag} IG-G1 the <details> summary has a visible focus ring (${ring.outline} ${ring.ow}px / ${ring.shadow})`, (ring.outline !== 'none' && ring.ow > 0) || ring.shadow !== 'none');
  }
  const roles = new Set(rows.map((r) => r.role));
  c.check(`${tag} IG-G1 the role filter renders only when the guests span >= 2 roles (${roles.size} roles, filter ${m.filter})`, m.filter === (roles.size >= 2));
  if (m.filter) c.check(`${tag} IG-G1 filter items are >= 44px (${m.fitems.map(Math.round).join(',')})`, m.fitems.every((h) => h >= 44));
}

/** SAOC rule: no image renders wider than its own pixel width. For every img in main: rendered width x DPR <= the source's native width, and a next/image
 *  request never asks for a w= above the source's native width (the optimiser upscales, so naturalWidth of the served variant is not the evidence). */
async function noUpscaleChecks(page, vp, c, tag) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(400); await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => Promise.all([...document.images].filter((i) => i.loading === 'lazy' && !i.complete).map((i) => new Promise((r) => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); setTimeout(r, 4000); }))));
  const imgs = await page.evaluate(async () => {
    const out = [];
    for (const im of [...document.querySelectorAll('main img')]) {
      const b = im.getBoundingClientRect(); if (b.width < 2 || b.height < 2) continue;
      const cur = im.currentSrc || im.src; let want = null; let native = im.naturalWidth; let src = cur;
      // naturalWidth is density-corrected when the img has a w-descriptor srcset, so it is never the file's width: load the selected candidate on its own.
      if (cur && !new URL(cur, location.href).pathname.startsWith('/_next/image')) native = await new Promise((res) => { const n = new Image(); n.onload = () => res(n.naturalWidth); n.onerror = () => res(null); n.src = cur; });
      try { const u = new URL(cur, location.href); if (u.pathname.startsWith('/_next/image')) { want = Number(u.searchParams.get('w')); src = u.searchParams.get('url') ?? cur; const abs = new URL(src, location.href).href; native = await new Promise((res) => { const n = new Image(); n.onload = () => res(n.naturalWidth); n.onerror = () => res(null); n.src = abs; }); } } catch { /* leave native as the served naturalWidth */ }
      out.push({ alt: (im.alt || '').slice(0, 30), w: b.width, want, native, src: src.slice(0, 80), cdn: new URL(src, location.href).hostname === 'cdn.sanity.io' });
    }
    return out;
  });
  // An original that will not load (or reports 0 width) cannot be proven, so it fails: a broken or blocked source must not pass silently.
  // A cdn.sanity.io image that will not load is the environment (no network), not the code: it is listed as ENV, never silently passed and never counted as a code failure.
  const envBad = imgs.filter((i) => i.cdn && !i.native); for (const i of envBad) c.note(`${tag} ENV: cdn.sanity.io image did not load (${i.alt} ${i.src}); width not provable without network`);
  // A loaded cms (cdn.sanity.io) image whose own source file is smaller than the need is DATA for the owner to replace, not code: listed as OWNER by name. Upscaling of any other image stays a failure.
  const owner = imgs.filter((i) => i.cdn && i.native && (i.w * vp.dsf > i.native + 1 || (i.want !== null && i.want > i.native + 1))); for (const i of owner) c.note(`${tag} OWNER (data): ${i.alt || i.src} is a ${i.native}px source file but needs ${Math.round(i.w * vp.dsf)}px; the owner supplies a larger original (not a code failure)`);
  const bad = imgs.filter((i) => !(i.cdn && !i.native) && !owner.includes(i) && (!i.native || i.w * vp.dsf > i.native + 1 || (i.want !== null && i.want > i.native + 1)));
  c.check(`${tag} no image renders wider than its own pixel width (${imgs.length} imgs; rendered x DPR <= native and w= <= native)`, bad.length === 0, bad.slice(0, 4).map((i) => `${i.alt ? i.alt + " " : ""}${i.src}: ${Math.round(i.w * vp.dsf)}px wanted, w=${i.want}, native ${i.native ?? 'UNLOADABLE (cannot prove the width)'}`).join('; '));
}

/** Her wording for an event's hours, read from the frozen excerpt of her answers doc ("9am to 5pm"); never reformatted (her time-format question is open). */
function hoursOf(label) { const l = readFileSync(`${SPDIR}leeann-answers-hours.md`, 'utf8').split('\n').find((x) => x.startsWith(label)); return l?.match(/\d{1,2}(?::\d{2})?(?:am|pm) to \d{1,2}(?::\d{2})?(?:am|pm)/)?.[0] ?? null; }
/** The event date as a "D Month YYYY" string from a FAQ answer ("24th September 2027" -> "24 September 2027"). */
function faqDate(n) { const q = spQa(n); const m = q ? q.a.join(' ').match(/(\d{1,2})(?:st|nd|rd|th)? ([A-Z][a-z]+) (\d{4})/) : null; return m ? `${m[1]} ${m[2]} ${m[3]}` : null; }
function dateTimeChecks(c, tag, sg, facts, S, hoursLabel, dateFaqN) {
  const hours = hoursOf(hoursLabel); const want = faqDate(dateFaqN);
  const date = facts.find((f) => f.t === 'Date'); const time = facts.find((f) => f.t === 'Time');
  c.check(`${tag} ${sg} her sources are real: hours "${hours}" (her answers doc) and the date "${want}" (FAQ ${dateFaqN}) were found in the frozen copies`, Boolean(hours) && Boolean(want));
  c.check(`${tag} ${sg} the date agrees with her FAQ ${dateFaqN} (${want}; a weekday prefix is allowed) (${date?.d})`, Boolean(want) && Boolean(date) && date.d.includes(want));
  const venue = facts.find((f) => f.t === 'Venue'); if (venue) c.check(`${tag} ${sg} the venue renders from the CMS, never as the FAQ phrase (${venue.d}); no venue string is asserted (owner item cccc is open)`, !/same venue as/i.test(venue.d));
  c.check(`${tag} ${sg} the time is her wording "${hours}", not reformatted (${time?.d})`, Boolean(hours) && Boolean(time) && time.d === hours);
}

/** Known issue: the runtime lede shifted the sub-nav by about 103px at 390. Sample the sub-nav's page position at DOMContentLoaded, at load and 1.5s and 3s later; it must not move. */
async function subnavStable(page, server, route, c, tag) {
  const p2 = await page.context().newPage();
  await p2.addInitScript(() => { window.__tops = []; const sample = () => { const s = document.querySelector('.nos-subnav'); if (s) window.__tops.push(Math.round(s.getBoundingClientRect().top + scrollY)); };
    document.addEventListener('DOMContentLoaded', sample); window.addEventListener('load', () => { sample(); setTimeout(sample, 1500); setTimeout(sample, 3000); }); });
  await p2.setViewportSize(page.viewportSize());
  if (await gotoRoute(p2, server, route.nos, c, tag)) {
    await p2.waitForTimeout(3500);
    const tops = await p2.evaluate(() => window.__tops);
    c.check(`${tag} no layout shift of the sub-nav after load (positions ${tops.join(', ')})`, tops.length >= 2 && Math.max(...tops) - Math.min(...tops) <= 2);
  }
  await p2.close();
}

/** Rev 44 (SAOC wants the italic preload in our branch): /symposium reserves no lede height and nothing shifts. The theme lede carries no min-height, its box is the same at DOMContentLoaded, load, 1.5s and 3s, no layout-shift entry has the lede or the sub-nav as a source, and exactly one font preload exists, with the italic face loaded by the load event. Run at 390 and 768. */
async function symposiumLedeStable(page, server, route, vp, c, tag) {
  if (vp.width !== 390 && vp.width !== 768) return;
  const p2 = await page.context().newPage();
  await p2.addInitScript(() => {
    window.__h = []; window.__shifts = []; window.__fontAtLoad = null;
    const sample = () => { const l = document.querySelector('[data-nos-lede="theme"]'); if (l) window.__h.push(Math.round(l.getBoundingClientRect().height * 10) / 10); };
    try { new PerformanceObserver((list) => { for (const e of list.getEntries()) { if (e.hadRecentInput) continue; window.__shifts.push({ v: e.value, src: (e.sources || []).map((x) => { const n = x.node; return n && n.nodeType === 1 ? (n.matches('[data-nos-lede]') ? 'lede' : n.closest('.nos-subnav') ? 'subnav' : n.closest('section[data-nos-hero]') ? 'hero' : 'other') : 'other'; }) }); } }).observe({ type: 'layout-shift', buffered: true }); } catch { /* unsupported: the height samples still gate */ }
    document.addEventListener('DOMContentLoaded', sample);
    window.addEventListener('load', () => { window.__fontAtLoad = [...document.fonts].filter((f) => f.style === 'italic' && f.status === 'loaded').length; sample(); setTimeout(sample, 1500); setTimeout(sample, 3000); });
  });
  const woffReqs = []; p2.on('request', (rq) => { if (/\.woff2(\?|$)/.test(rq.url())) woffReqs.push(new URL(rq.url()).pathname); });
  await p2.setViewportSize(page.viewportSize());
  if (await gotoRoute(p2, server, route.nos, c, tag)) {
    await p2.waitForTimeout(3500);
    const m = await p2.evaluate(() => {
      const l = document.querySelector('[data-nos-lede="theme"]'); const cs = l ? getComputedStyle(l) : null;
      let lines = null; let lh = null; let h = null;
      if (l) { const rg = document.createRange(); rg.selectNodeContents(l); lines = new Set([...rg.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top))).size; lh = parseFloat(cs.lineHeight); h = l.getBoundingClientRect().height; }
      const faces = []; for (const sh of document.styleSheets) { let rules; try { rules = [...sh.cssRules]; } catch { continue; } for (const r of rules) if (r.type === CSSRule.FONT_FACE_RULE) faces.push({ fam: r.style.getPropertyValue('font-family').replace(/["']/g, '').trim(), style: r.style.getPropertyValue('font-style').trim(), weight: r.style.getPropertyValue('font-weight').trim(), urls: [...r.style.getPropertyValue('src').matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((x) => new URL(x[1], location.href).pathname) }); }
      const ledeFam = cs?.fontFamily.replace(/["']/g, '') ?? '';
      return { faces, ledeFam, lede: Boolean(l), lines, lh, h, minH: cs?.minHeight ?? null, hs: window.__h, shifts: window.__shifts, italicAtLoad: window.__fontAtLoad,
        preloads: [...document.querySelectorAll('link[rel="preload"][as="font"]')].map((n) => n.getAttribute('href')) };
    });
    c.check(`${tag} SY-G1 (Rev 44) the theme lede reserves no height: computed min-height is auto or 0 (${m.minH})`, m.lede && (m.minH === 'auto' || m.minH === '0px' || m.minH === 'normal'));
    c.check(`${tag} SY-G1 (Rev 44) the lede box does not change height after first paint (${m.hs.join(', ')})`, m.hs.length >= 2 && Math.max(...m.hs) - Math.min(...m.hs) <= 1);
    c.check(`${tag} SY-G1 (Rev 44, NOS Design L4250) after fonts load the lede height is its line count x line-height, no blank line (${m.lines} lines x ${m.lh}px = ${Math.round(m.lines * m.lh)}, box ${Math.round(m.h)})`, m.lines >= 1 && Number.isFinite(m.lh) && Math.abs(m.h - m.lines * m.lh) <= 2);
    const pre = m.preloads[0] ? new URL(m.preloads[0], 'http://x').pathname : null;
    const preFace = m.faces.find((f) => pre && f.urls.includes(pre));
    c.check(`${tag} SY-G1 (Rev 44, SAOC condition) the one font preload is an italic 300 @font-face with its own generated family (${preFace ? `${preFace.fam} ${preFace.style} ${preFace.weight}` : 'no @font-face points at the preloaded url'})`, Boolean(preFace) && /italic/.test(preFace.style) && /^300$/.test(preFace.weight));
    c.check(`${tag} SY-G1 (Rev 44, SAOC condition) the lede's computed font-family includes that preloaded instance's generated family, not the fonts.ts one (lede: ${m.ledeFam.slice(0, 120)})`, Boolean(preFace) && m.ledeFam.includes(preFace.fam));
    const italicUrls = new Set(m.faces.filter((f) => /italic/.test(f.style)).flatMap((f) => f.urls));
    const italicReqs = woffReqs.filter((u) => italicUrls.has(u));
    c.check(`${tag} SY-G1 (Rev 44, SAOC condition) /symposium makes exactly one network request for an italic woff2, and it is the preloaded url (${italicReqs.length}: ${italicReqs.join(', ')}; preload ${pre})`, italicReqs.length === 1 && italicReqs[0] === pre);
    const bad = m.shifts.filter((x) => x.src.some((k) => k === 'lede' || k === 'subnav'));
    c.check(`${tag} SY-G1 (Rev 44) no layout shift has the lede or the sub-nav as a source (${m.shifts.length} entries, ${bad.length} on lede or sub-nav)`, bad.length === 0, JSON.stringify(bad));
    c.check(`${tag} SY-G1 (Rev 44) exactly one font preload on /symposium, and an italic face is already loaded at the load event (${m.preloads.length} preloads; italic loaded ${m.italicAtLoad})`, m.preloads.length === 1 && (m.italicAtLoad ?? 0) >= 1, m.preloads.join(' | '));
  }
  await p2.close();
}

/** WO-G1 (NOS Design, root comms.md L3436): /wosa-conference. All copy is verbatim from her frozen documents. */
async function woChecks(page, route, vp, c, tag, server) {
  const W = route.wo;
  const para = (file, starts) => { const l = readFileSync(`${SPDIR}${file}`, 'utf8').split('\n').find((x) => x.includes(starts)); return l ? spUnmd(l.slice(l.indexOf(starts))) : ''; };
  const sentence = (file, starts) => para(file, starts).match(/^.*?[.!?](?=\s|$)/)?.[0] ?? '';
  const lede = para(W.ledeFrom.file, W.ledeFrom.startsWith); const standfirst = sentence(W.standfirst.file, W.standfirst.startsWith); const paragraph = para(W.paragraph.file, W.paragraph.startsWith);
  const qa = W.faqQuestions.map((n) => ({ n, ...spQa(n) }));
  c.check(`${tag} WO-G1 sources are real: lede, standfirst, paragraph and ${qa.length} FAQ entries were found in the frozen copies`, lede.length > 20 && standfirst.length > 40 && paragraph.length > 80 && qa.every((q) => q.q && q.a.length), `${lede.slice(0, 30)} | ${standfirst.slice(0, 30)}`);
  const m = await page.evaluate((W) => {
    const txt = (e) => e.textContent.replace(/\s+/g, ' ').trim();
    const hero = document.querySelector('section[data-nos-hero]'); const main = document.querySelector('[data-doc-main]'); const aside = document.querySelector('[data-doc-aside]');
    const facts = hero ? [...hero.querySelectorAll('[data-hero-facts] dt')].map((dt) => { const dd = dt.nextElementSibling; const cs = dd ? getComputedStyle(dd) : null; return { t: txt(dt), d: dd ? txt(dd) : '', ws: cs?.whiteSpace, h: dd ? dd.getBoundingClientRect().height : 0, lh: cs ? parseFloat(cs.lineHeight) : 0 }; }) : [];
    const h2s = [...document.querySelectorAll('main h2')].map(txt); const faqH2 = [...document.querySelectorAll('main h2')].find((h) => txt(h) === W.faqH2);
    const h3s = faqH2 ? [...document.querySelectorAll('main h3')].filter((h) => !h.closest('[data-guest-profile]') && faqH2.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING).map(txt) : [];
    const acs = aside ? getComputedStyle(aside) : null; const card = aside ? aside.querySelector('[data-ticket-card], .nk-ticket, .nk-grid') : null;
    const mb = main ? main.getBoundingClientRect() : null; const ab = aside ? aside.getBoundingClientRect() : null;
    return { h1: txt(document.querySelector('h1')), heroText: hero ? txt(hero) : '', facts, h2s, h3s, hasFaqH2: Boolean(faqH2), faqInMain: Boolean(faqH2?.closest('[data-doc-main]')), mainText: main ? txt(main) : '', all: txt(document.querySelector('main')),
      card: Boolean(card), asidePos: acs?.position, asideTop: acs ? parseFloat(acs.top) : null, asideW: ab ? ab.width : 0, asideY: ab ? ab.top + scrollY : null, mainY: mb ? mb.top + scrollY : null, profiles: document.querySelectorAll('[data-guest-profile]').length, presentersH2: h2s.includes('Presenters'),
      crumb: hero ? txt(hero.querySelector('nav, [aria-label*="readcrumb"]') ?? hero).slice(0, 60) : '' };
  }, W);
  const norm = (t) => t.replace(/\s+/g, ' ').trim();
  c.check(`${tag} WO-G1 h1 is "${W.h1}" and the crumb reads National Show - WOSA Conference (${m.h1} | ${m.crumb})`, m.h1 === W.h1 && /National Show\s*[—–-]\s*WOSA Conference/.test(m.crumb));
  c.check(`${tag} WO-G1 the hero lede is her FAQ section 7 line, verbatim`, m.heroText.includes(norm(lede)), lede);
  c.check(`${tag} WO-G1 FACTS-1 renders from the CMS ticket: Date / Time / Venue in that order for whichever are present, an empty cell omitted (no "Dates to follow", TBC or dash), the date nowrap and one line, the venue at most ${W.venueMaxLines} lines (${m.facts.map((f) => `${f.t}=${f.d}`).join('; ')})`, (m.facts.length >= 2 && (() => { const order = ['Date', 'Time', 'Venue']; const idx = m.facts.map((f) => order.indexOf(f.t)); return idx.every((i, k) => i >= 0 && (k === 0 || i > idx[k - 1])); })()) && m.facts.every((f) => f.d !== '' && !/follow|tbc|to be confirmed|^[-\u2013\u2014]+$/i.test(f.d)) && m.facts.filter((f) => f.t === 'Date').every((f) => /nowrap/.test(f.ws) && f.h <= f.lh * 1.4) && m.facts.filter((f) => f.t === 'Venue').every((f) => f.h <= f.lh * (W.venueMaxLines + 0.4)));
  dateTimeChecks(c, tag, 'WO-G1', m.facts, W, W.hoursLine, W.dateFaq);
  c.check(`${tag} WO-G1 main column: her WOSA sentence (What to Expect v1.0), then her paragraph (About v1.2), both verbatim, in that order`, (() => { const a = m.mainText.indexOf(norm(standfirst)); const b = m.mainText.indexOf(norm(paragraph)); return a >= 0 && b > a; })());
  c.check(`${tag} WO-G1 h2 "${W.faqH2}" sits in the main column over exactly her questions ${W.faqQuestions.join(', ')} as h3, and 47/48/50/52 are left out (${m.h3s.length} h3)`, m.hasFaqH2 && m.faqInMain && JSON.stringify(m.h3s.map((t) => t.replace(/^\d+\.\s*/, ''))) === JSON.stringify(qa.map((q) => q.q)));
  c.check(`${tag} WO-G1 each FAQ answer matches her document byte for byte (including her spellings)`, qa.every((q) => q.a.every((a) => m.mainText.includes(norm(a)))), qa.filter((q) => !q.a.every((a) => m.mainText.includes(norm(a)))).map((q) => q.n).join(','));
  c.check(`${tag} WO-G1 one 7/5 grid: the aside holds the live WOSA ticket card, sticky at top 100 from 1024, static and at most 440px below (${m.card}; ${m.asidePos} ${m.asideTop}; ${Math.round(m.asideW)}px)`, m.card && (vp.width >= 1024 ? m.asidePos === 'sticky' && m.asideTop === 100 : (m.asidePos !== 'sticky' && m.asideW <= 441)));
  if (vp.width < 1024) c.check(`${tag} WO-G1 below 1024 the ticket comes first (aside y ${Math.round(m.asideY)} < copy y ${Math.round(m.mainY)})`, m.asideY !== null && m.asideY < m.mainY);
  c.check(`${tag} WO-G1 the builder sections "About the Conference", "Attending", "About WOSA" (and its partner-site paragraph) and the PLACEHOLDER chips are gone`, W.absent.every((x) => !m.all.includes(x)), W.absent.filter((x) => m.all.includes(x)).join(', '));
  c.check(`${tag} WO-G1 no presenters section until a conferencePresenter has event = wosa (${m.profiles} profiles, "Presenters" h2 ${m.presentersH2})`, m.profiles > 0 || !m.presentersH2);
  await subnavStable(page, server, route, c, tag);
}

/** WK-G1 (NOS Design, root comms.md L3963): /workshops. Copy is FAQ v1.0 section 8 verbatim; workshop records render only once SAOC enters them. */
async function wkChecks(page, route, vp, c, tag) {
  const W = route.wk;
  const faq57 = spQa(W.faqStand); const sentences = faq57 ? faq57.a.join(' ').match(/[^.!?]+[.!?]/g)?.map((x) => x.trim()) ?? [] : [];
  const qa = W.faqQuestions.map((n) => ({ n, ...spQa(n) }));
  c.check(`${tag} WK-G1 sources are real: FAQ ${W.faqStand} has 3 sentences and FAQ ${W.faqQuestions.join('/')} were found in the frozen copy`, sentences.length === 3 && qa.every((q) => q.q && q.a.length), String(sentences.length));
  const m = await page.evaluate((W) => {
    const txt = (e) => e.textContent.replace(/\s+/g, ' ').trim();
    const hero = document.querySelector('section[data-nos-hero]'); const main = document.querySelector('[data-doc-main]'); const aside = document.querySelector('[data-doc-aside]');
    const facts = hero ? [...hero.querySelectorAll('[data-hero-facts] dt')].map((dt) => ({ t: txt(dt), d: dt.nextElementSibling ? txt(dt.nextElementSibling) : '' })) : [];
    const faqH2 = [...document.querySelectorAll('main h2')].find((h) => txt(h) === W.faqH2);
    const h3s = faqH2 ? [...document.querySelectorAll('main h3')].filter((h) => faqH2.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING).map(txt) : [];
    const acs = aside ? getComputedStyle(aside) : null; const ab = aside ? aside.getBoundingClientRect() : null; const mb = main ? main.getBoundingClientRect() : null;
    const cards = document.querySelectorAll('[data-ticket-card]').length;
    const recs = [...document.querySelectorAll('[data-workshop-record]')].map((r) => {
      const rb = r.getBoundingClientRect(); const lvl = r.querySelector('[data-level]'); const dot = r.querySelector('[data-level-dot]'); const pl = r.querySelector('[data-places]'); const h2 = r.querySelector('h2');
      const dds = [...r.querySelectorAll('dd')].map(txt); const pill = [r, ...r.querySelectorAll('*')].some((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius) >= 999 && e.textContent.trim().length > 0);
      return { top: rb.top + scrollY, left: rb.left, h2: Boolean(h2), level: lvl ? txt(lvl) : null, dot: dot ? { w: dot.getBoundingClientRect().width, bg: getComputedStyle(dot).backgroundColor } : null, places: pl ? txt(pl) : null, dds, pill, demo: r.querySelectorAll('[data-demo]').length };
    });
    const gridWrap = document.querySelectorAll('main [class*="grid"] > [data-workshop-record]').length;
    return { h1: txt(document.querySelector('h1')), heroText: hero ? txt(hero) : '', facts, mainText: main ? txt(main) : '', all: txt(document.querySelector('main')), h2s: [...document.querySelectorAll('main h2')].map(txt), hasFaqH2: Boolean(faqH2), h3s, cards,
      asidePos: acs?.position, asideTop: acs ? parseFloat(acs.top) : null, asideW: ab ? ab.width : 0, asideY: ab ? ab.top + scrollY : null, mainY: mb ? mb.top + scrollY : null, recs, gridWrap, demoAttr: document.querySelectorAll('[data-demo]').length,
      crumb: hero ? txt(hero.querySelector('nav, [aria-label*="readcrumb"]') ?? hero).slice(0, 60) : '' };
  }, W);
  const norm = (t) => t.replace(/\s+/g, ' ').trim();
  c.check(`${tag} WK-G1 h1 is "${W.h1}" and the crumb reads National Show - Workshops (${m.h1} | ${m.crumb})`, m.h1 === W.h1 && /National Show\s*[—–-]\s*Workshops/.test(m.crumb));
  c.check(`${tag} WK-G1 no lede: the builder line "Book Sunset Cocktails and guided Field Trip outings..." is not in the hero`, !/Book Sunset Cocktails|Field Trip outings/.test(m.heroText));
  c.check(`${tag} WK-G1 FACTS-1 renders whichever of ${W.factTerms.join(' / ')} exist, in that order, with no TBC or dash (${m.facts.map((f) => `${f.t}=${f.d}`).join('; ')})`, (() => { const idx = m.facts.map((f) => W.factTerms.indexOf(f.t)); return m.facts.length >= 2 && idx.every((i, k) => i >= 0 && (k === 0 || i > idx[k - 1])); })() && m.facts.every((f) => f.d !== '' && !/follow|tbc|to be confirmed|^[-–—]+$/i.test(f.d)));
  c.check(`${tag} WK-G1 main: FAQ ${W.faqStand}'s first sentence is the standfirst, its second sentence follows as body, the third is dropped`, (() => { const a = m.mainText.indexOf(norm(sentences[0] ?? 'x')); const b = m.mainText.indexOf(norm(sentences[1] ?? 'x')); return a >= 0 && b > a && !m.mainText.includes(norm(sentences[2] ?? 'x')); })());
  c.check(`${tag} WK-G1 h2 "${W.faqH2}" over FAQ ${W.faqQuestions.join(', ')} as h3 with the answers verbatim`, m.hasFaqH2 && JSON.stringify(m.h3s.map((t) => t.replace(/^\d+\.\s*/, ''))) === JSON.stringify(qa.map((q) => q.q)) && qa.every((q) => q.a.every((a) => m.mainText.includes(norm(a)))), m.h3s.join(' | '));
  c.check(`${tag} WK-G1 exactly one ticket card (the live Workshops product), sticky at top 100 from 1024, static and at most 440px below (${m.cards}; ${m.asidePos} ${m.asideTop}; ${Math.round(m.asideW)}px)`, m.cards === 1 && (vp.width >= 1024 ? m.asidePos === 'sticky' && m.asideTop === 100 : (m.asidePos !== 'sticky' && m.asideW <= 441)));
  if (vp.width < 1024) c.check(`${tag} WK-G1 below 1024 the ticket comes first (aside y ${Math.round(m.asideY)} < copy y ${Math.round(m.mainY)})`, m.asideY !== null && m.asideY < m.mainY);
  c.check(`${tag} WK-G1 the status box and chip, the SESSIONS_NOTE sentences, the "Programme" h2 and the Sunset Cocktails card are gone`, W.absentText.every((x) => !m.all.includes(x)) && W.absentH2.every((x) => !m.h2s.includes(x)), [...W.absentText.filter((x) => m.all.includes(x)), ...W.absentH2.filter((x) => m.h2s.includes(x))].join(', '));
  c.check(`${tag} WK-G1 demo values never ship (data-demo x${m.demoAttr})`, m.demoAttr === 0);
  if (m.recs.length) {
    const R = m.recs;
    c.check(`${tag} WK-G1 workshop records are ruled rows in the main column, never a grid (${R.length} rows)`, m.gridWrap === 0 && R.every((r, i) => i === 0 || (r.top - R[i - 1].top > 60 && Math.abs(r.left - R[0].left) <= 1)) && R.every((r) => r.h2));
    c.check(`${tag} WK-G1 each level shows its WORD beside a ${route.wk && 10}px dot in the ruled colour (Beginner / Intermediate / Advanced), never a pill (${R.map((r) => `${r.level}:${r.dot && r.dot.bg}`).join(' ')})`, R.every((r) => r.level === null || (Object.keys(W.levels).includes(r.level) && r.dot && Math.abs(r.dot.w - 10) <= 0.5 && r.dot.bg === W.levels[r.level])) && R.every((r) => !r.pill));
    c.check(`${tag} WK-G1 places read "n of N places left" or "Fully booked"; empty fact cells are omitted (no dash, TBC or empty dd)`, R.every((r) => (r.places === null || new RegExp(W.places).test(r.places)) && r.dds.every((d) => d !== '' && !/^[-–—]+$/.test(d) && !/^(tbc|to be confirmed)$/i.test(d))));
  } else c.note(`${tag} WK-G1 no workshop records rendered (expected until SAOC enters them and workshopSession gains level / duration / places; see spec.md gap)`);
}

/** CR-G1 (NOS Design, root comms.md L3989): /conferences, "Conference registration". Two rows, each with its own live ticket card; all copy is FAQ v1.0 verbatim. */
async function crChecks(page, route, vp, c, tag) {
  const C = route.cr;
  const introOf = (heading) => { const L = readFileSync(`${SPDIR}faq.md`, 'utf8').split('\n'); const i = L.findIndex((l) => spUnmd(l) === heading); if (i < 0) return ''; for (let k = i + 1; k < L.length; k += 1) if (L[k].trim()) return spUnmd(L[k]); return ''; };
  const rowsSrc = C.rows.map((r) => ({ ...r, intro: introOf(r.introHeading), body: spQa(r.faqBody), date: faqDate(r.dateFaq), hours: hoursOf(r.hoursLine) }));
  c.check(`${tag} CR-G1 sources are real: both FAQ intros, FAQ ${C.rows.map((r) => r.faqBody).join('/')} answers, the dates and the hours were found in the frozen copies`, rowsSrc.every((r) => r.intro && r.body && r.body.a.length && r.date && r.hours), rowsSrc.map((r) => `${r.intro.slice(0, 20)}|${r.date}|${r.hours}`).join(' ; '));
  const m = await page.evaluate((C) => {
    const txt = (e) => e.textContent.replace(/\s+/g, ' ').trim();
    const hero = document.querySelector('section[data-nos-hero]');
    const facts = hero ? [...hero.querySelectorAll('[data-hero-facts] dt')].map((dt) => { const dd = dt.nextElementSibling; const cs = dd ? getComputedStyle(dd) : null; return { t: txt(dt), d: dd ? txt(dd) : '', ws: cs?.whiteSpace, h: dd ? dd.getBoundingClientRect().height : 0, lh: cs ? parseFloat(cs.lineHeight) : 0 }; }) : [];
    const rows = [...document.querySelectorAll('[data-conference-row]')].map((r) => {
      const h2 = r.querySelector('h2'); const link = [...r.querySelectorAll('a')].find((a) => /^About /.test(txt(a)));
      const cards = r.querySelectorAll('[data-ticket-card]'); const card = cards[0]; const cb = card ? card.getBoundingClientRect() : null; const rb = r.getBoundingClientRect();
      const rect = (sel) => { const e = r.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top + scrollY, left: b.left, right: b.right, bottom: b.bottom + scrollY }; };
      const sf = rect('[data-conference-standfirst]'); const bd = rect('[data-conference-body]'); const lk = link ? (() => { const b = link.getBoundingClientRect(); return { top: b.top + scrollY, left: b.left, right: b.right }; })() : null; const cardR = card ? (() => { const b = card.getBoundingClientRect(); return { top: b.top + scrollY, left: b.left, right: b.right, bottom: b.bottom + scrollY }; })() : null;
      return { sf, bd, lk, cardR, text: txt(r), h2: h2 ? txt(h2) : null, h2Px: h2 ? parseFloat(getComputedStyle(h2).fontSize) : null, link: link ? txt(link) : null, href: link ? link.getAttribute('href') : null, linkH: link ? link.getBoundingClientRect().height : 0, cards: cards.length, cardY: cb ? cb.top + scrollY : null, cardW: cb ? cb.width : 0, top: rb.top + scrollY, h2Y: h2 ? h2.getBoundingClientRect().top + scrollY : null,
        pill: [r, ...r.querySelectorAll('*')].some((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius) >= 999 && e.textContent.trim().length > 0), ruleAbove: parseFloat(getComputedStyle(r).borderTopWidth) };
    });
    return { h1: txt(document.querySelector('h1')), heroText: hero ? txt(hero) : '', facts, rows, h2s: [...document.querySelectorAll('main h2')].map(txt), cards: document.querySelectorAll('[data-ticket-card]').length, all: txt(document.querySelector('main')),
      crumb: hero ? txt(hero.querySelector('nav, [aria-label*="readcrumb"]') ?? hero).slice(0, 70) : '' };
  }, C);
  const norm = (t) => t.replace(/\s+/g, ' ').trim();
  c.check(`${tag} CR-G1 h1 is "${C.h1}", the crumb reads National Show - ${C.h1} (${m.h1} | ${m.crumb})`, m.h1 === C.h1 && /National Show\s*[—–-]\s*Conference registration/.test(m.crumb));
  c.check(`${tag} CR-G1 no lede: the builder line "Register for the National Orchid Show Symposium or the WOSA Conference." is not in the hero`, !m.heroText.includes(C.absentText[0]));
  c.check(`${tag} CR-G1 FACTS-1 is event-labelled ${C.factTerms.join(' / ')}: each date from its FAQ, the time her wording "${rowsSrc[0].hours}", dds nowrap (${m.facts.map((f) => `${f.t}=${f.d}`).join('; ')})`,
    JSON.stringify(m.facts.map((f) => f.t)) === JSON.stringify(C.factTerms) && m.facts[0]?.d.includes(rowsSrc[0].date) && m.facts[1]?.d.includes(rowsSrc[1].date) && m.facts[2]?.d === rowsSrc[0].hours && m.facts.every((f) => /nowrap/.test(f.ws)));
  c.check(`${tag} CR-G1 two rows, one per conference, each with exactly its own live ticket card (${m.rows.length} rows, ${m.cards} cards)`, m.rows.length === 2 && m.cards === 2 && m.rows.every((r) => r.cards === 1));
  rowsSrc.forEach((S, i) => {
    const r = m.rows[i]; if (!r) return;
    const t = r.text;
    c.check(`${tag} CR-G1 row ${i + 1} h2 is the nav label "${S.h2}" in Fraunces display size (${r.h2} ${r.h2Px}px)`, r.h2 === S.h2 && r.h2Px >= 35);
    c.check(`${tag} CR-G1 row ${i + 1}: her FAQ intro sentence, the FAQ ${S.faqBody} answer, then "${S.link} →" appear verbatim in that order`, (() => { const a = t.indexOf(norm(S.intro)); const b = t.indexOf(norm(S.body.a[0])); const l = t.indexOf(S.link); return a >= 0 && b > a && l > b; })(), S.intro.slice(0, 40));
    c.check(`${tag} CR-G1 row ${i + 1} link "${r.link}" goes to ${S.hrefHas} and is at least 44px tall (${r.href}, ${Math.round(r.linkH)}px)`, Boolean(r.link) && r.link.startsWith(S.link) && (r.href ?? '').includes(S.hrefHas) && r.linkH >= 44);
    c.check(`${tag} CR-G1 row ${i + 1} carries the hooks [data-conference-standfirst] and [data-conference-body]`, Boolean(r.sf) && Boolean(r.bd));
    if (vp.width < 1024) c.check(`${tag} CR-G1 row ${i + 1} below 1024 the order is h2, standfirst, TICKET, body, link (y ${[r.h2Y, r.sf?.top, r.cardR?.top, r.bd?.top, r.lk?.top].map((v) => v && Math.round(v)).join(' < ')}), the card at most 440px wide`, Boolean(r.sf && r.bd && r.cardR && r.lk) && r.h2Y < r.sf.top && r.sf.top < r.cardR.top && r.cardR.top < r.bd.top && r.bd.top < r.lk.top && r.cardW <= 441);
    else c.check(`${tag} CR-G1 row ${i + 1} from 1024 the card sits beside the main column (card left ${r.cardR && Math.round(r.cardR.left)} >= body right ${r.bd && Math.round(r.bd.right)}, overlapping the row's text vertically)`, Boolean(r.sf && r.bd && r.cardR) && r.cardR.left >= r.bd.right - 2 && r.cardR.left >= r.sf.right - 2 && r.cardR.top < r.bd.bottom && r.cardR.bottom > r.sf.top);
  });
  c.check(`${tag} CR-G1 the two rows are stacked, never a 2-up grid (row tops ${m.rows.map((r) => Math.round(r.top)).join(', ')}), with a rule between them and no pill`, m.rows.length === 2 && m.rows[1].top - m.rows[0].top > 200 && m.rows.every((r) => !r.pill) && m.rows[1].ruleAbove >= 1 && m.rows[0].ruleAbove === 0);
  c.check(`${tag} CR-G1 the "Programme" h2 is gone (${m.h2s.join(' | ')})`, C.absentH2.every((x) => !m.h2s.includes(x)));
}

/** AB-G1 (NOS Design, root comms.md L4012): /about. The seven paragraphs are About 2.1 v1.2 verbatim, straight quotes kept. */
async function abChecks(page, route, vp, c, tag) {
  const A = route.ab;
  const m = await page.evaluate((A) => {
    const txt = (e) => e.textContent.replace(/\s+/g, ' ').trim();
    const hero = document.querySelector('section[data-nos-hero]'); const main = document.querySelector('[data-doc-main]'); const aside = document.querySelector('[data-doc-aside]');
    const facts = hero ? [...hero.querySelectorAll('[data-hero-facts] dt')].map((dt) => ({ t: txt(dt), d: dt.nextElementSibling ? txt(dt.nextElementSibling) : '' })) : [];
    const theme = hero ? [...hero.querySelectorAll('*')].filter((e) => e.children.length === 0 || e.tagName === 'P').find((e) => txt(e).includes(A.themeTitle)) : null;
    const tcs = theme ? getComputedStyle(theme) : null; const tl = theme ? parseFloat(tcs.lineHeight) : 0;
    const paras = main ? [...main.querySelectorAll('p')].map(txt).filter(Boolean) : [];
    const links = aside ? [...aside.querySelectorAll('a')].map((a) => ({ t: txt(a), h: a.getBoundingClientRect().height, href: a.getAttribute('href') })) : [];
    const acs = aside ? getComputedStyle(aside) : null; const ab = aside ? aside.getBoundingClientRect() : null; const mb = main ? main.getBoundingClientRect() : null;
    const up = [...document.querySelectorAll('main *')].filter((e) => getComputedStyle(e).textTransform === 'uppercase' && txt(e).length > 0 && !e.closest('section[data-nos-hero]')).map((e) => txt(e).slice(0, 30));
    const closing = main ? [...main.querySelectorAll('p')].pop() : null; const ccs = closing ? getComputedStyle(closing) : null;
    const first = main ? main.querySelector('p') : null; const fcs = first ? getComputedStyle(first) : null;
    return { h1: txt(document.querySelector('h1')), crumb: hero ? txt(hero.querySelector('nav, [aria-label*="readcrumb"]') ?? hero).slice(0, 60) : '', facts, theme: theme ? { text: txt(theme), italic: tcs.fontStyle, fam: tcs.fontFamily.split(',')[0].replace(/["']/g, '').toLowerCase(), w: tcs.fontWeight, lines: tl ? Math.round(theme.getBoundingClientRect().height / tl) : 0, mw: tcs.maxWidth, fs: parseFloat(tcs.fontSize), wrap: tcs.textWrap || tcs.textWrapStyle } : null,
      paras, mainText: main ? txt(main) : '', links, asidePos: acs?.position, asideTop: acs ? parseFloat(acs.top) : null, asideY: ab ? ab.top + scrollY : null, mainBottom: mb ? mb.bottom + scrollY : null, mainY: mb ? mb.top + scrollY : null, asideDl: aside ? aside.querySelectorAll('dl').length : 0, asideBtn: aside ? aside.querySelectorAll('[class*="btn"], button').length : 0, up, all: txt(document.querySelector('main')),
      closing: closing ? { fam: ccs.fontFamily.split(',')[0].replace(/["']/g, '').toLowerCase(), w: ccs.fontWeight } : null, firstFam: fcs ? fcs.fontFamily.split(',')[0].replace(/["']/g, '').toLowerCase() : null, firstW: fcs?.fontWeight, smart: /[‘’“”]/.test(main ? main.textContent : '') };
  }, A);
  const st = driveState(route); const blocks = [];
  if (st.state === 'ok') { const S = st.text.split('\n\n').map((x) => x.trim()).filter((x) => x && !x.startsWith('**')); blocks.push(...S); }
  const norm = (t) => t.replace(/\s+/g, ' ').trim();
  c.check(`${tag} AB-G1 h1 is "${A.h1}" and the crumb reads National Show - About the show (${m.h1} | ${m.crumb})`, m.h1 === A.h1 && /National Show\s*[—–-]\s*About the show/.test(m.crumb));
  c.check(`${tag} AB-G1 FACTS-1 has exactly ${A.factTerms.length} cells, ${A.factTerms.join(' / ')} (${m.facts.map((f) => `${f.t}=${f.d}`).join('; ')})`, JSON.stringify(m.facts.map((f) => f.t)) === JSON.stringify(A.factTerms) && m.facts.every((f) => f.d !== ''));
  c.check(`${tag} AB-G1 the theme is in the hero in quotation marks, Fraunces italic 300, max-width ${A.themeMaxWidthEm}em, balanced, on exactly ${A.themeLines} lines (${m.theme && `${m.theme.italic} ${m.theme.fam} ${m.theme.w}; ${m.theme.lines} lines; ${m.theme.mw}; ${m.theme.wrap}`})`,
    Boolean(m.theme) && /["“”]/.test(m.theme.text) && m.theme.italic === 'italic' && m.theme.fam.includes('fraunces') && m.theme.w === '300' && m.theme.lines === A.themeLines && m.theme.wrap === 'balance' && (m.theme.mw === `${A.themeMaxWidthEm * m.theme.fs}px` || Math.abs(parseFloat(m.theme.mw) - A.themeMaxWidthEm * m.theme.fs) <= 1));
  c.check(`${tag} AB-G1 ${A.paragraphs} paragraphs in the main column, About 2.1 v1.2 verbatim and in her order (${m.paras.length}; v1.2 has ${blocks.length})`, blocks.length === A.paragraphs && m.paras.length === A.paragraphs && blocks.every((b, i) => m.paras[i] === norm(b)), blocks.map((b, i) => (m.paras[i] === norm(b) ? '' : `p${i + 1}`)).filter(Boolean).join(','));
  c.check(`${tag} AB-G1 her straight quotes and apostrophes are kept: no smartened quote in the main column`, !m.smart);
  c.check(`${tag} AB-G1 p1 is the Fraunces 300 standfirst and p7 the Fraunces 300 closing line (${m.firstFam} ${m.firstW}; ${m.closing && `${m.closing.fam} ${m.closing.w}`})`, m.firstFam?.includes('fraunces') && m.firstW === '300' && Boolean(m.closing) && m.closing.fam.includes('fraunces') && m.closing.w === '300');
  c.check(`${tag} AB-G1 the gateway aside has exactly the ${A.gateway.length} nav-label links in her order, each row >= ${A.gatewayMinRow}px, each with a → arrow (not ↗) (${m.links.map((l) => `${l.t}:${Math.round(l.h)}`).join(' | ')})`, JSON.stringify(m.links.map((l) => l.t.replace(/\s*[→↗].*$/, '').trim())) === JSON.stringify(A.gateway) && m.links.every((l) => l.h >= A.gatewayMinRow && l.t.includes('→') && !l.t.includes('↗')));
  { const ring = await page.evaluate(() => { const a = document.querySelector('[data-doc-aside] a'); if (!a) return null; a.focus({ focusVisible: true }); const cs = getComputedStyle(a); return { o: cs.outlineStyle, ow: parseFloat(cs.outlineWidth), sh: cs.boxShadow }; }); c.check(`${tag} AB-G1 the gateway links have a visible focus ring (${ring && `${ring.o} ${ring.ow}px / ${ring.sh}`})`, Boolean(ring) && ((ring.o !== 'none' && ring.ow > 0) || ring.sh !== 'none')); }
  c.check(`${tag} AB-G1 the aside is sticky at top 100 from 1024, and below 1024 static and after the text (${m.asidePos} ${m.asideTop}; aside y ${Math.round(m.asideY)} vs text bottom ${Math.round(m.mainBottom)})`, vp.width >= 1024 ? (m.asidePos === 'sticky' && m.asideTop === 100) : (m.asidePos !== 'sticky' && m.asideY >= m.mainBottom - 2));
  c.check(`${tag} AB-G1 gone: uppercase labels (${m.up.join(', ')}), "Cycle", the facts aside (dl) and the Tickets + Plan your visit button pair (${m.asideDl} dl, ${m.asideBtn} buttons)`, m.up.length === 0 && !m.all.includes('Cycle') && m.asideDl === 0 && m.asideBtn === 0);
}

/** WE-G1 (NOS Design, root comms.md L4033): /what-to-expect. Every copy string is parsed from the frozen What to Expect v1.0 (struck-through lines dropped); admission prices are read from /tickets, never typed. */
async function weChecks(page, route, vp, c, tag, server) {
  const W = route.we; const norm = (t) => t.replace(/\s+/g, ' ').trim(); const strip = (t) => norm(t.replace(/\*/g, ''));
  const lines = readFileSync(`${SPDIR}${W.sourceFile}`, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  const struck = (l) => /^\**~~/.test(l);
  const live = lines.filter((l) => !struck(l));
  const at = (h) => live.findIndex((l) => strip(l) === h);
  const between = (from, to) => { const i = at(from); const k = to ? at(to) : live.length; return i < 0 ? [] : live.slice(i + 1, k < 0 ? live.length : k); };
  const stand = live.find((l) => !l.startsWith('**'));
  const hours = between('Opening hours', 'Admission').map((l) => { const [a, ...b] = strip(l).split(' – '); return { label: a, value: b.join(' – ') }; });
  const adm = between('Admission', null).filter((l) => /, R\d/.test(l)).slice(0, W.admissionIds.length).map((l) => { const x = strip(l).match(/^(.*), (R\d[\d ,.]*)$/); return { name: x[1], doc: x[2] }; });
  const cta = live.find((l) => strip(l) === 'See ticket prices and book →') ? 'See ticket prices and book →' : null;
  const food = between('Food and refreshments', 'Photography').map(strip);
  const photo = between('Photography', 'Accessibility').map(strip);
  const access = between('Accessibility', 'Section 3').map(strip);
  const s3 = between('What to Expect', null).map(strip);
  const dateLabel = 'Show dates – for public entrance'; const dateValue = strip(live[at(dateLabel) + 1] ?? '');
  const struckText = lines.filter(struck).map((l) => strip(l.replace(/~~/g, ''))).filter((t) => t.length > 20);
  c.check(`${tag} WE-G1 sources are real: stand, ${W.hoursRows} hours, ${W.admissionIds.length} admission names, CTA, food 1, photography 2, accessibility 3, Section 3 ${W.section3Paragraphs} were parsed from the frozen What to Expect v1.0`, Boolean(stand) && hours.length === W.hoursRows && adm.length === W.admissionIds.length && Boolean(cta) && food.length === 1 && photo.length === 2 && access.length === 3 && s3.length === W.section3Paragraphs && Boolean(dateValue), `${hours.length}/${adm.length}/${food.length}/${photo.length}/${access.length}/${s3.length}`);
  const m = await page.evaluate((W) => {
    const txt = (e) => e.textContent.replace(/\s+/g, ' ').trim(); const fam = (e) => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').toLowerCase();
    const hero = document.querySelector('section[data-nos-hero]'); const q = (s) => document.querySelector(s); const rect = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top + scrollY, b: b.bottom + scrollY, w: b.width, h: b.height }; };
    const stand = q('[data-we-stand]'); const card = q('[data-we-card]'); const rest = q('[data-we-rest]'); const s3 = q('[data-we-s3]'); const ccs = card ? getComputedStyle(card) : null;
    const rows = (sel) => { const dl = q(sel); return dl ? [...dl.querySelectorAll('div')].filter((d) => d.querySelector('dt') && d.querySelector('dd')).map((d) => ({ id: d.getAttribute('data-ticket-id'), k: txt(d.querySelector('dt')), v: txt(d.querySelector('dd')), ws: getComputedStyle(d.querySelector('dd')).whiteSpace, tn: getComputedStyle(d.querySelector('dd')).fontVariantNumeric, vf: fam(d.querySelector('dd')), h: d.getBoundingClientRect().height })) : []; };
    const facts = hero ? [...hero.querySelectorAll('[data-hero-facts] dt')].map((dt) => ({ t: txt(dt), d: dt.nextElementSibling ? txt(dt.nextElementSibling) : '', ws: dt.nextElementSibling ? getComputedStyle(dt.nextElementSibling).whiteSpace : '', h: dt.nextElementSibling ? dt.nextElementSibling.getBoundingClientRect().height : 0, lh: dt.nextElementSibling ? parseFloat(getComputedStyle(dt.nextElementSibling).lineHeight) : 0 })) : [];
    const blocks = rest ? [...rest.querySelectorAll('h2')].map((h) => { const wrap = h.parentElement; const cs = getComputedStyle(wrap); const ps = [...wrap.querySelectorAll('p')].map(txt); return { h2: txt(h), ps, bg: cs.backgroundColor, bl: parseFloat(cs.borderLeftWidth), br: parseFloat(cs.borderRightWidth), rad: parseFloat(cs.borderTopLeftRadius), bt: parseFloat(cs.borderTopWidth), shadow: cs.boxShadow }; }) : [];
    const s3h = s3 ? s3.parentElement.querySelector('h2') ?? s3.querySelector('h2') : null; const s3h2 = s3h ? s3h.getBoundingClientRect() : null;
    const s3p = s3 ? [...s3.querySelectorAll('p')] : []; const em = s3p[4] ? s3p[4].querySelector('em') : null;
    const up = [...document.querySelectorAll('main *')].filter((e) => getComputedStyle(e).textTransform === 'uppercase' && txt(e).length > 0 && !e.closest('section[data-nos-hero]')).map((e) => txt(e).slice(0, 30));
    const btn = card ? [...card.querySelectorAll('a')].find((a) => a.getAttribute('href') === W.ctaHref) : null; const bcs = btn ? getComputedStyle(btn) : null;
    const hh = card ? [...card.querySelectorAll('h3')].map(txt) : [];
    return { h1: txt(document.querySelector('h1')), crumb: hero ? txt(hero.querySelector('nav, [aria-label*="readcrumb"]') ?? hero).slice(0, 60) : '', heroText: hero ? txt(hero) : '', facts,
      stand: stand ? txt(stand) : null, standFam: stand ? fam(stand) : null, standLeftOfCard: null, card: rect(card), cardPos: ccs?.position, cardTop: ccs ? parseFloat(ccs.top) : null, cardText: card ? txt(card) : '', hh, restR: rect(rest), standR: rect(stand),
      hours: rows('[data-we-hours]'), adm: rows('[data-we-admission]'), blocks, s3: s3p.map(txt), s3Fam: s3p.map((p) => fam(p)), s3W: s3p.map((p) => getComputedStyle(p).fontWeight), emOk: em ? { txt: txt(em), st: getComputedStyle(em).fontStyle, f: fam(em) } : null,
      s3h: s3h ? txt(s3h) : null, s3hTiny: s3h2 ? (s3h2.width <= 1.5 && s3h2.height <= 1.5) : null, up, main: txt(document.querySelector('main')),
      btn: btn ? { t: txt(btn), w: btn.getBoundingClientRect().width, tt: bcs.textTransform, inner: card.getBoundingClientRect().width - parseFloat(ccs.paddingLeft) - parseFloat(ccs.paddingRight) } : null, sw: document.documentElement.scrollWidth, iw: innerWidth };
  }, W);
  c.check(`${tag} WE-G1 h1 is "${W.h1}" and the crumb reads National Show - What to expect (${m.h1} | ${m.crumb})`, m.h1 === W.h1 && /National Show\s*[—–-]\s*What to expect/.test(m.crumb));
  c.check(`${tag} WE-G1 FACTS-1 has exactly ${W.factTerms.join(' / ')} (${m.facts.map((f) => `${f.t}=${f.d}`).join('; ')}); the Dates cell is nowrap on one line`, JSON.stringify(m.facts.map((f) => f.t)) === JSON.stringify(W.factTerms) && m.facts.every((f) => f.d !== '') && m.facts.filter((f) => f.t === 'Dates').every((f) => /nowrap/.test(f.ws) && f.h <= f.lh * 1.4));
  c.check(`${tag} WE-G1 no hero lede: her struck lede is not rendered, and the hero holds only the crumb, h1 and facts`, !m.main.includes('What the show looks like from a visitor') && !m.heroText.includes('What the show looks like'));
  c.check(`${tag} WE-G1 gone: "To be confirmed", the Cloakroom block, the TBC chip, the holding note, and every struck line of her doc (${struckText.length} lines) (${[...W.absentText, ...struckText].filter((t) => m.main.includes(t)).join(' | ').slice(0, 120)})`, [...W.absentText, ...struckText].every((t) => !m.main.includes(t)));
  c.check(`${tag} WE-G1 the Section 1 standfirst is in [data-we-stand], verbatim, with her typo "${W.keepTypo}" kept (${m.stand && m.stand.slice(0, 40)})`, m.stand === strip(stand) && m.stand.includes(W.keepTypo));
  c.check(`${tag} WE-G1 the card shows her label "${dateLabel}" and "${dateValue}" verbatim`, Boolean(m.card) && m.cardText.includes(dateLabel) && m.cardText.includes(dateValue));
  c.check(`${tag} WE-G1 the card has h3 "Opening hours" then h3 "Admission", in her order (${m.hh.join(' | ')})`, JSON.stringify(m.hh) === JSON.stringify(['Opening hours', 'Admission']));
  c.check(`${tag} WE-G1 ${W.hoursRows} hours rows match her doc exactly: ${hours.map((h) => `${h.label} = ${h.value}`).join('; ')} (${m.hours.map((h) => `${h.k} = ${h.v}`).join('; ')}), values nowrap, tabular-nums, Fraunces`, m.hours.length === W.hoursRows && m.hours.every((h, i) => h.k === hours[i].label && h.v === hours[i].value && /nowrap/.test(h.ws) && /tabular-nums/.test(h.tn) && h.vf.includes('fraunces')));
  let prices = null; const p2 = await page.context().newPage(); await p2.setViewportSize(page.viewportSize());
  if (await gotoRoute(p2, server, '/tickets', c, tag)) prices = await p2.evaluate(() => [...document.querySelectorAll('article[data-ticket-card][data-ticket-slug]')].flatMap((card) => { const p = card.querySelector('[data-ticket-price]'); return p ? [{ slug: card.getAttribute('data-ticket-slug'), p: p.textContent.replace(/\s+/g, ' ').trim() }] : []; }));
  await p2.close();
  const onTickets = (id) => (prices ?? []).find((x) => x.slug === W.admissionSlugs[id]) ?? null;
  const order = m.adm.map((a) => W.admissionIds.indexOf(a.id));
  c.check(`${tag} WE-G1 admission rows are keyed by record _id, only her ${W.admissionIds.length} ids, in her order, each with her name (${m.adm.map((a) => `${a.id}:${a.k}`).join(' | ')}); a row whose record is missing or inactive is omitted, not failed`, m.adm.every((a) => W.admissionIds.includes(a.id) && a.k === adm[W.admissionIds.indexOf(a.id)].name) && order.every((x, i) => i === 0 || x > order[i - 1]) && new Set(order).size === order.length);
  c.check(`${tag} WE-G1 omit-if-missing: every active record on /tickets (${W.admissionIds.filter((id) => onTickets(id)).join(', ') || 'none'}) is rendered, and no row is rendered for a record /tickets does not list (${m.adm.map((a) => a.id).join(', ')})`, Boolean(prices) && W.admissionIds.every((id) => Boolean(onTickets(id)) === m.adm.some((a) => a.id === id)));
  c.check(`${tag} WE-G1 every rendered row carries a price equal to its record's price on /tickets, read live, never typed (${m.adm.map((a) => `${a.id}=${a.v} vs ${onTickets(a.id)?.p ?? 'no card'}`).join('; ')}); her doc's figures (${adm.map((a) => a.doc).join(', ')}) are superseded by the ticket records, and R350 is banned on the page`, Boolean(prices) && m.adm.every((a) => /^R\s?\d/.test(a.v) && onTickets(a.id)?.p === a.v));
  c.check(`${tag} WE-G1 the CTA "${cta}" is a full-width royal button in the card to ${W.ctaHref}, not uppercase (${m.btn && `${m.btn.t} ${Math.round(m.btn.w)}/${Math.round(m.btn.inner)} ${m.btn.tt}`})`, Boolean(m.btn) && m.btn.t === cta && m.btn.w >= m.btn.inner - 2 && m.btn.tt === 'none');
  c.check(`${tag} WE-G1 the rest column holds Food and refreshments (1), Photography (2) and Accessibility (3) as ruled blocks, her paragraphs verbatim (${m.blocks.map((b) => `${b.h2}:${b.ps.length}`).join(' | ')})`, JSON.stringify(m.blocks.map((b) => b.h2)) === JSON.stringify(['Food and refreshments', 'Photography', 'Accessibility']) && JSON.stringify(m.blocks.map((b) => b.ps)) === JSON.stringify([food, photo, access]));
  c.check(`${tag} WE-G1 the blocks are ruled, not boxed: no fill, no side borders, no radius, no shadow`, m.blocks.length === 3 && m.blocks.every((b) => /rgba\(0, 0, 0, 0\)|transparent/.test(b.bg) && b.bl === 0 && b.br === 0 && b.rad === 0 && b.shadow === 'none'));
  c.check(`${tag} WE-G1 Section 3: ${W.section3Paragraphs} paragraphs verbatim in her order (${m.s3.length}); its h2 "What to Expect" is screen-reader-only (${m.s3h}, tiny ${m.s3hTiny})`, JSON.stringify(m.s3) === JSON.stringify(s3) && m.s3h === 'What to Expect' && m.s3hTiny === true, s3.map((b, i) => (m.s3[i] === b ? '' : `p${i + 1}`)).filter(Boolean).join(','));
  c.check(`${tag} WE-G1 Section 3 type: p1 and p7 Fraunces 300, the theme in p5 is an <em> in Fraunces italic (${m.s3Fam[0]} ${m.s3W[0]}; ${m.s3Fam[6]} ${m.s3W[6]}; ${m.emOk && `${m.emOk.st} ${m.emOk.f}`})`, m.s3.length === W.section3Paragraphs && m.s3Fam[0]?.includes('fraunces') && m.s3W[0] === '300' && m.s3Fam[6]?.includes('fraunces') && m.s3W[6] === '300' && Boolean(m.emOk) && m.emOk.st === 'italic' && m.emOk.f.includes('fraunces') && m.emOk.txt.includes(W.themeEm.replace(/[“”]/g, '')));
  c.check(`${tag} WE-G1 no uppercase labels anywhere in the body (${m.up.join(', ')})`, m.up.length === 0);
  if (m.card && m.standR && m.restR) {
    if (vp.width >= 1024) {
      c.check(`${tag} WE-G1 two columns: the card is right of the stand and the rest, sticky at ${W.cardStickyTop}; the stand is above the rest (${Math.round(m.card.l)} vs ${Math.round(Math.max(m.standR.r, m.restR.r))}; ${m.cardPos} ${m.cardTop})`, m.card.l >= Math.max(m.standR.r, m.restR.r) - 1 && m.cardPos === 'sticky' && m.cardTop === W.cardStickyTop && m.standR.b <= m.restR.t + 1);
    } else {
      c.check(`${tag} WE-G1 one column below 1024: stand, then card, then rest; the card is static and at most ${W.cardMaxWidthBelow1024}px (stand b ${Math.round(m.standR.b)}, card ${Math.round(m.card.t)}-${Math.round(m.card.b)}, rest t ${Math.round(m.restR.t)}; ${m.cardPos} ${Math.round(m.card.w)}px)`, m.standR.b <= m.card.t + 1 && m.card.b <= m.restR.t + 1 && m.cardPos !== 'sticky' && m.card.w <= W.cardMaxWidthBelow1024 + 1);
    }
  } else c.check(`${tag} WE-G1 the [data-we-card], [data-we-stand] and [data-we-rest] hooks exist`, false);
  c.check(`${tag} WE-G1 no horizontal overflow (${m.sw} <= ${m.iw})`, m.sw <= m.iw);
}

/** EX-G1 (NOS Design, root comms.md EX-G1): /exhibitors. Every copy string is FAQ v1.0 section 4 from the frozen faq.md; the builder sections of the old page must not render. */
async function exChecks(page, route, vp, c, tag) {
  const X = route.ex;
  const stand = spQa(X.stand); const qa = X.faqQuestions.map((n) => ({ n, ...spQa(n) })); const dropped = X.faqAbsent.map((n) => spQa(n));
  c.check(`${tag} EX-G1 sources are real: FAQ ${X.stand} (standfirst) and FAQ ${X.faqQuestions.join('/')} were found in the frozen faq.md`, Boolean(stand?.a.length) && qa.every((q) => q.q && q.a.length) && dropped.every((d) => d?.a.length));
  const m = await page.evaluate((X) => {
    const txt = (e) => e.textContent.replace(/\s+/g, ' ').trim(); const fam = (e) => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').toLowerCase();
    const hero = document.querySelector('section[data-nos-hero]'); const main = document.querySelector('[data-doc-main]'); const aside = document.querySelector('[data-doc-aside]');
    const facts = hero ? [...hero.querySelectorAll('[data-hero-facts] dt')].map((dt) => ({ t: txt(dt), d: dt.nextElementSibling ? txt(dt.nextElementSibling) : '', ws: dt.nextElementSibling ? getComputedStyle(dt.nextElementSibling).whiteSpace : '', h: dt.nextElementSibling ? dt.nextElementSibling.getBoundingClientRect().height : 0, lh: dt.nextElementSibling ? parseFloat(getComputedStyle(dt.nextElementSibling).lineHeight) : 0 })) : [];
    const h1 = document.querySelector('h1'); let heroRest = hero ? txt(hero) : ''; if (hero) { for (const part of [h1 ? txt(h1) : '', hero.querySelector('[data-hero-facts]') ? txt(hero.querySelector('[data-hero-facts]')) : '', txt(hero.querySelector('nav, [aria-label*="readcrumb"]') ?? document.createElement('i'))]) if (part) heroRest = heroRest.replace(part, ''); }
    const paras = main ? [...main.querySelectorAll('p')].map(txt).filter(Boolean) : []; const h2s = main ? [...main.querySelectorAll('h2')].map((h) => ({ t: txt(h), fam: fam(h), w: getComputedStyle(h).fontWeight, px: parseFloat(getComputedStyle(h).fontSize) })) : [];
    const first = main ? main.querySelector('p') : null;
    const links = aside ? [...aside.querySelectorAll('a')].map((a) => ({ t: txt(a), h: a.getBoundingClientRect().height, href: a.getAttribute('href') })) : []; const labelled = aside ? (aside.getAttribute('aria-label') ?? aside.querySelector('[aria-label]')?.getAttribute('aria-label')) : null;
    const acs = aside ? getComputedStyle(aside) : null; const ab = aside ? aside.getBoundingClientRect() : null; const mb = main ? main.getBoundingClientRect() : null;
    const pills = [...document.querySelectorAll('main *')].filter((e) => { const r = getComputedStyle(e).borderTopLeftRadius; return parseFloat(r) >= X.maxRadius; }).map((e) => (e.className || e.tagName).toString().slice(0, 30));
    const up = [...document.querySelectorAll('main *')].filter((e) => getComputedStyle(e).textTransform === 'uppercase' && txt(e).length > 0 && !e.closest('section[data-nos-hero]')).map((e) => txt(e).slice(0, 30));
    return { h1: h1 ? txt(h1) : '', crumb: hero ? txt(hero.querySelector('nav, [aria-label*="readcrumb"]') ?? hero).slice(0, 60) : '', facts, heroRest: heroRest.trim(), paras, h2s, firstFam: first ? fam(first) : null, firstW: first ? getComputedStyle(first).fontWeight : null, links, labelled,
      asidePos: acs?.position, asideTop: acs ? parseFloat(acs.top) : null, asideY: ab ? ab.top + scrollY : null, mainBottom: mb ? mb.bottom + scrollY : null, main: txt(document.querySelector('main')), pills, up,
      chips: document.querySelectorAll('nav[data-doc-index], [data-show-jump-chips], main table, main ol, main h3').length, sw: document.documentElement.scrollWidth, iw: innerWidth };
  }, X);
  const want = [...stand.a, ...qa.flatMap((q) => q.a)];
  c.check(`${tag} EX-G1 h1 is "${X.h1}", the crumb reads National Show - ${X.h1} (${m.h1} | ${m.crumb})`, m.h1 === X.h1 && m.crumb.replace(/\s+/g, ' ').replace(/\s*[—–-]\s*/, ' - ').startsWith(X.crumb));
  c.check(`${tag} EX-G1 no hero lede: the hero holds only the crumb, h1 and facts (rest "${m.heroRest.slice(0, 40)}")`, m.heroRest.length < 8);
  c.check(`${tag} EX-G1 FACTS-1 has exactly ${X.factTerms.join(' / ')} (${m.facts.map((f) => `${f.t}=${f.d}`).join('; ')}); the Dates cell is nowrap on one line`, JSON.stringify(m.facts.map((f) => f.t)) === JSON.stringify(X.factTerms) && m.facts.every((f) => f.d !== '') && m.facts.filter((f) => f.t === 'Dates').every((f) => /nowrap/.test(f.ws) && f.h <= f.lh * 1.4));
  c.check(`${tag} EX-G1 the main column is the FAQ ${X.stand} answer as a Fraunces 300 standfirst, then exactly ${qa.length} Q&As in FAQ order (${X.faqQuestions.join(', ')}), every paragraph verbatim (${m.paras.length} paragraphs, ${want.length} expected)`, JSON.stringify(m.paras) === JSON.stringify(want) && m.firstFam?.includes('fraunces') && m.firstW === '300', want.map((b, i) => (m.paras[i] === b ? '' : `p${i + 1}`)).filter(Boolean).join(','));
  c.check(`${tag} EX-G1 the h2s are her four questions, unnumbered, Fraunces 400 (${m.h2s.map((h) => h.t).join(' | ')})`, JSON.stringify(m.h2s.map((h) => h.t)) === JSON.stringify(qa.map((q) => q.q)) && m.h2s.every((h) => h.fam.includes('fraunces') && h.w === '400'));
  c.check(`${tag} EX-G1 her typo "${X.keepTypo}" is kept, and FAQ ${X.faqAbsent.join('/')} (photography, which lives on /what-to-expect) is not rendered`, m.main.includes(X.keepTypo) && dropped.every((d) => d.a.every((a) => !m.main.includes(a.slice(0, 60)))));
  c.check(`${tag} EX-G1 gone: every builder section, chip and pill (${X.absentText.filter((t) => m.main.includes(t)).join(' | ')}); no jump menu, table, ol or h3 (${m.chips}); no element with radius >= ${X.maxRadius} (${m.pills.join(', ')}); no uppercase label (${m.up.join(', ')})`, X.absentText.every((t) => !m.main.includes(t)) && m.chips === 0 && m.pills.length === 0 && m.up.length === 0);
  c.check(`${tag} EX-G1 the gateway aside is labelled "${X.ariaLabel}" and has the ${X.gateway.length} links in this order, each row >= ${X.gatewayMinRow}px, each with a → arrow (${m.labelled}; ${m.links.map((l) => `${l.t}:${Math.round(l.h)}`).join(' | ')})`, m.labelled === X.ariaLabel && JSON.stringify(m.links.map((l) => l.t.replace(/\s*[→↗].*$/, '').trim())) === JSON.stringify(X.gateway) && m.links.every((l) => l.h >= X.gatewayMinRow && l.t.includes('→') && !l.t.includes('↗') && l.href));
  { const ring = await page.evaluate(() => { const a = document.querySelector('[data-doc-aside] a'); if (!a) return null; a.focus({ focusVisible: true }); const cs = getComputedStyle(a); return { o: cs.outlineStyle, ow: parseFloat(cs.outlineWidth), sh: cs.boxShadow }; }); c.check(`${tag} EX-G1 the gateway links have a visible focus ring (${ring && `${ring.o} ${ring.ow}px / ${ring.sh}`})`, Boolean(ring) && ((ring.o !== 'none' && ring.ow > 0) || ring.sh !== 'none')); }
  c.check(`${tag} EX-G1 the aside is sticky at top 100 from 1024, and below 1024 static and after the text (${m.asidePos} ${m.asideTop}; aside y ${Math.round(m.asideY)} vs text bottom ${Math.round(m.mainBottom)})`, vp.width >= 1024 ? (m.asidePos === 'sticky' && m.asideTop === 100) : (m.asidePos !== 'sticky' && m.asideY >= m.mainBottom - 2));
  c.check(`${tag} EX-G1 no horizontal overflow (${m.sw} <= ${m.iw})`, m.sw <= m.iw);
}

/** CT-G1 (NOS Design, root comms.md CT-G1): /contact. Committee, address, telephone and co-ordinator come from the frozen "2027 Show Contact information" v1.1; the form is unchanged against origin/main. */
async function ctChecks(page, route, vp, c, tag) {
  const X = route.ct; const strip = (t) => spUnmd(t);
  const lines = readFileSync(`${SPDIR}contact.md`, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  const idx = (h) => lines.findIndex((l) => strip(l) === h);
  const iC = idx('Committee'); const iU = lines.findIndex((l) => /^https?:\/\//.test(l));
  const team = lines.slice(iC + 1, iU).filter((l) => !/Needs Surnames/i.test(l)).map((l) => { const k = l.indexOf(' - '); return { name: strip(l.slice(0, k)), role: strip(l.slice(k + 3)) }; });
  const iA = idx('Address of the show'); const place = strip(lines[iA + 1] ?? ''); const addr = strip(lines[iA + 2] ?? '');
  const iT = idx('Telephone number'); const [phone, person, role] = strip(lines[iT + 1] ?? '').split(' - '); const tel = `tel:+27${(phone ?? '').replace(/\D/g, '').replace(/^0/, '')}`;
  c.check(`${tag} CT-G1 sources are real: ${X.committeeRows} committee rows, the place, the address line, the phone and the co-ordinator were parsed from the frozen contact.md`, team.length === X.committeeRows && Boolean(place) && Boolean(addr) && /^\d{3} \d{3} \d{4}$/.test(phone ?? '') && Boolean(person) && Boolean(role), `${team.length}/${place}/${addr.slice(0, 20)}/${phone}`);
  let formNames = []; try { formNames = [...execFileSync('git', ['show', 'origin/main:components/contact/ContactForm.tsx'], { encoding: 'utf8' }).matchAll(/\bname="(\w+)"/g)].map((x) => x[1]); } catch { formNames = []; }
  const m = await page.evaluate((X) => {
    const txt = (e) => e.textContent.replace(/\s+/g, ' ').trim(); const fam = (e) => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').toLowerCase();
    const hero = document.querySelector('section[data-nos-hero]'); const main = document.querySelector('main'); const card = document.querySelector('[data-ct-card]'); const teamEl = document.querySelector('[data-ct-team]'); const form = main.querySelector('form');
    const R = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top + scrollY, b: b.bottom + scrollY, w: b.width }; };
    const h1 = document.querySelector('h1'); let heroRest = hero ? txt(hero) : ''; if (hero) for (const part of [h1 ? txt(h1) : '', hero.querySelector('[data-hero-facts]') ? txt(hero.querySelector('[data-hero-facts]')) : '', txt(hero.querySelector('nav, [aria-label*="readcrumb"]') ?? document.createElement('i'))]) if (part) heroRest = heroRest.replace(part, '');
    const facts = hero ? [...hero.querySelectorAll('[data-hero-facts] dt')].map((dt) => { const dd = dt.nextElementSibling; return { t: txt(dt), d: dd ? txt(dd) : '', tel: dd ? [...dd.querySelectorAll('a[href^="tel:"]')].map((a) => a.getAttribute('href')) : [], bottom: dd ? dd.getBoundingClientRect().bottom + scrollY : 0 }; }) : [];
    const rows = teamEl ? [...teamEl.querySelectorAll('div')].filter((d) => d.querySelector('dt') && d.querySelector('dd')).map((d) => ({ name: txt(d.querySelector('dt')), role: txt(d.querySelector('dd')) })) : [];
    const teamH2 = teamEl ? [...main.querySelectorAll('h2')].filter((h) => txt(h) === X.committeeH2).map(txt) : [];
    const gate = card ? card.querySelector(`[aria-label="${X.gatewayLabel}"]`) : null; const links = gate ? [...gate.querySelectorAll('a')].map((a) => ({ t: txt(a), h: a.getBoundingClientRect().height })) : [];
    const sub = form ? [...form.querySelectorAll('button[type="submit"], input[type="submit"]')][0] : null; const scs = sub ? getComputedStyle(sub) : null;
    const hint = form ? [...form.querySelectorAll('*')].find((e) => e.children.length === 0 && /minimum 10 characters/i.test(e.textContent)) : null; const hcs = hint ? getComputedStyle(hint) : null;
    const cs = card ? getComputedStyle(card) : null;
    const up = [...main.querySelectorAll('*')].filter((e) => getComputedStyle(e).textTransform === 'uppercase' && txt(e).length > 0 && !e.closest('section[data-nos-hero]') && !e.closest('button, [type="submit"], a[class*="inline-flex"]')).map((e) => txt(e).slice(0, 30));
    return { h1: h1 ? txt(h1) : '', crumb: hero ? txt(hero.querySelector('nav, [aria-label*="readcrumb"]') ?? hero).slice(0, 60) : '', heroRest: heroRest.trim(), facts, cardText: card ? txt(card) : '', cardTel: card ? [...card.querySelectorAll('a[href^="tel:"]')].map((a) => ({ h: a.getAttribute('href'), t: txt(a), fam: fam(a) })) : [], rows, teamH2, links, main: (() => { const cl = main.cloneNode(true); cl.querySelectorAll('script, style, noscript, template').forEach((n) => n.remove()); return txt(cl); })(),
      fields: form ? [...form.querySelectorAll('[name]')].map((e) => e.getAttribute('name')) : [], method: form?.getAttribute('method'), action: form?.getAttribute('action'),
      sub: scs ? { bg: scs.backgroundColor, t: txt(sub) } : null, hint: hint ? { t: txt(hint), tt: hcs.textTransform, px: parseFloat(hcs.fontSize), ls: hcs.letterSpacing } : null, up,
      form: R(form), card: R(card), team: R(teamEl), pos: cs?.position, top: cs ? parseFloat(cs.top) : null, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth };
  }, X);
  c.check(`${tag} CT-G1 h1 is "${X.h1}", the crumb reads National Show - Contact (${m.h1} | ${m.crumb}); no hero lede (rest "${m.heroRest.slice(0, 30)}")`, m.h1 === X.h1 && /National Show\s*[—–-]\s*Contact/.test(m.crumb) && m.heroRest.length < 8);
  c.check(`${tag} CT-G1 FACTS-1 is ${X.factTerms.join(' / ')}: ${phone} and ${person} (${m.facts.map((f) => `${f.t}=${f.d}`).join('; ')})`, JSON.stringify(m.facts.map((f) => f.t)) === JSON.stringify(X.factTerms) && m.facts[0]?.d === phone && m.facts[1]?.d === person);
  c.check(`${tag} CT-G1 the tel link is valid, ${tel}, with her number as its text, in the hero and in the card (${m.facts[0]?.tel.join(',')} | ${m.cardTel.map((a) => `${a.h} ${a.t}`).join(',')})`, JSON.stringify(m.facts[0]?.tel) === JSON.stringify([tel]) && m.cardTel.length === 1 && m.cardTel[0].h === tel && m.cardTel[0].t === phone && m.cardTel[0].fam.includes('fraunces'));
  c.check(`${tag} CT-G1 the phone is in the first screen (hero fact bottom ${Math.round(m.facts[0]?.bottom ?? -1)} < viewport ${m.ih})`, Boolean(m.facts[0]) && m.facts[0].bottom < m.ih);
  c.check(`${tag} CT-G1 the card shows "Address of the show", "${place}", "${addr}", "Telephone number" and "${person} - ${role}" as written`, ['Address of the show', place, addr, 'Telephone number', `${person} - ${role}`].every((t) => m.cardText.includes(t)));
  c.check(`${tag} CT-G1 the gateway "${X.gatewayLabel}" has ${X.gateway.join(' / ')} in order, each row >= ${X.gatewayMinRow}px, each with a → arrow (${m.links.map((l) => `${l.t}:${Math.round(l.h)}`).join(' | ')})`, JSON.stringify(m.links.map((l) => l.t.replace(/\s*[→↗].*$/, '').trim())) === JSON.stringify(X.gateway) && m.links.every((l) => l.h >= X.gatewayMinRow && l.t.includes('→')));
  c.check(`${tag} CT-G1 h2 "${X.committeeH2}" and ${team.length} rows, name then role, in her order (${m.rows.length}); the unsurnamed Otto and Nerine row, the bare URL and her Email address?? notes are not rendered`, m.teamH2.length === 1 && JSON.stringify(m.rows) === JSON.stringify(team));
  c.check(`${tag} CT-G1 gone: ${X.absentText.filter((t) => m.main.includes(t)).join(' | ') || 'none of'} the NOT CONFIRMED badge, the placeholder intro, "[" and uppercase labels (${m.up.join(', ')})`, X.absentText.every((t) => !m.main.includes(t)) && m.up.length === 0);
  c.check(`${tag} CT-G1 the form is unchanged: fields ${formNames.join(', ')} and POST with no action (${m.fields.join(', ')}; ${m.method}; ${m.action})`, formNames.length >= 4 && JSON.stringify([...m.fields].sort()) === JSON.stringify([...formNames].sort()) && /^post$/i.test(m.method ?? '') && !m.action);
  c.check(`${tag} CT-G1 the submit uses the royal token ${X.royalRgb}, not the old purple (${m.sub?.bg})`, Boolean(m.sub) && m.sub.bg === X.royalRgb && m.sub.bg !== X.purpleRgb);
  c.check(`${tag} CT-G1 the hint reads "${X.hint}" in sentence case, 14px, not uppercase or tracked (${m.hint && `${m.hint.t} ${m.hint.tt} ${m.hint.px} ${m.hint.ls}`})`, Boolean(m.hint) && m.hint.t === X.hint && m.hint.tt === 'none' && Math.abs(m.hint.px - 14) <= 0.5 && /^(normal|0px)$/.test(m.hint.ls));
  if (m.form && m.card && m.team) {
    if (vp.width >= 1024) c.check(`${tag} CT-G1 two columns: the card is right of the form and the committee, sticky at ${X.cardStickyTop}; the form is above the committee (${m.pos} ${m.top})`, m.card.l >= Math.max(m.form.r, m.team.r) - 1 && m.pos === 'sticky' && m.top === X.cardStickyTop && m.form.b <= m.team.t + 1);
    else c.check(`${tag} CT-G1 below 1024 the order is form, card, committee (form b ${Math.round(m.form.b)}, card ${Math.round(m.card.t)}-${Math.round(m.card.b)}, team t ${Math.round(m.team.t)}; ${m.pos})`, m.form.b <= m.card.t + 1 && m.card.b <= m.team.t + 1 && m.pos !== 'sticky');
  } else c.check(`${tag} CT-G1 the form, [data-ct-card] and [data-ct-team] exist`, false);
  c.check(`${tag} CT-G1 no horizontal overflow (${m.sw} <= ${m.iw})`, m.sw <= m.iw);
}

/** AR-1 (NOS Design, root comms.md AR-1): /archive, "Past shows". A written ruling with no render; layout gates run in preview mode, the filled-state gates only when an edition record renders. */
async function arChecks(page, route, vp, c, tag) {
  const A = route.ar;
  const m = await page.evaluate((A) => {
    const txt = (e) => e.textContent.replace(/\s+/g, ' ').trim(); const fam = (e) => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').toLowerCase();
    const hero = document.querySelector('section[data-nos-hero]'); const main = document.querySelector('main'); const h1 = document.querySelector('h1');
    let heroRest = hero ? txt(hero) : ''; if (hero) for (const part of [h1 ? txt(h1) : '', hero.querySelector('[data-hero-facts]') ? txt(hero.querySelector('[data-hero-facts]')) : '', txt(hero.querySelector('nav, [aria-label*="readcrumb"]') ?? document.createElement('i'))]) if (part) heroRest = heroRest.replace(part, '');
    const pills = [...main.querySelectorAll('*')].filter((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius) >= A.maxRadius).map((e) => (e.className || e.tagName).toString().slice(0, 30));
    const recs = [...main.querySelectorAll(A.recordHook)].map((r) => { const rect = r.getBoundingClientRect(); const a = r.tagName === 'A' ? r : r.querySelector('a'); const year = r.querySelector('[data-edition-year]') ?? r.firstElementChild; const h2 = r.querySelector('h2'); const dts = [...r.querySelectorAll('dl dt')].map(txt); const dds = [...r.querySelectorAll('dl dd')].map(txt);
      return { top: rect.top + scrollY, left: rect.left, href: a?.getAttribute('href'), arrow: txt(r).includes('→'), year: year ? { t: txt(year), fam: fam(year), w: getComputedStyle(year).fontWeight } : null, h2: h2 ? { fam: fam(h2), w: getComputedStyle(h2).fontWeight } : null, dts, dds }; });
    return { h1: h1 ? txt(h1) : '', crumb: hero ? txt(hero.querySelector('nav, [aria-label*="readcrumb"]') ?? hero).slice(0, 60) : '', heroRest: heroRest.trim(), main: (() => { const cl = main.cloneNode(true); cl.querySelectorAll('script, style, noscript, template').forEach((n) => n.remove()); return txt(cl); })(), back: document.querySelectorAll('[data-nos-backlink]').length, pills, recs, grid: [...main.querySelectorAll('*')].some((e) => getComputedStyle(e).display === 'grid' && e.children.length >= 3 && [...e.children].every((k) => k.querySelector('h2, h3') && k.querySelector('a'))), sw: document.documentElement.scrollWidth, iw: innerWidth };
  }, A);
  c.check(`${tag} AR-1 h1 is "${A.h1}" and the crumb reads National Show - Past shows (${m.h1} | ${m.crumb}); no hero lede (rest "${m.heroRest.slice(0, 30)}")`, m.h1 === A.h1 && /National Show\s*[—–-]\s*Past shows/.test(m.crumb) && m.heroRest.length < 8);
  c.check(`${tag} AR-1 gone: ${A.absentText.filter((t) => m.main.includes(t)).join(' | ') || 'none of'} the builder strings (the royal "Looking for the 19th National Show?" band, the unsourced lede, the old h1, the back-link arrow), no [data-nos-backlink] (${m.back}), no element with radius >= ${A.maxRadius} (${m.pills.join(', ')})`, A.absentText.every((t) => !m.main.includes(t)) && m.back === 0 && m.pills.length === 0);
  if (m.recs.length) {
    const years = m.recs.map((r) => parseInt(r.year?.t ?? '', 10));
    c.check(`${tag} AR-1 filled state: ${m.recs.length} edition row(s) as a ruled register, never a card grid, newest first (${years.join(', ')}), stacked in one column`, !m.grid && years.every((y, i) => y > 1900 && (i === 0 || y < years[i - 1])) && m.recs.every((r, i) => (i === 0 || r.top > m.recs[i - 1].top) && Math.abs(r.left - m.recs[0].left) <= 1));
    c.check(`${tag} AR-1 filled state: each row links to /archive/<year> with a → arrow, the year is Fraunces 300, the title an h2 in Fraunces 400, and the facts dl uses only ${A.factTerms.join(' / ')} with no empty or dash cell`, m.recs.every((r) => /\/archive\/\d{4}$/.test(r.href ?? '') && r.arrow && r.year?.fam.includes('fraunces') && r.year.w === '300' && r.h2?.fam.includes('fraunces') && r.h2.w === '400' && r.dts.every((d) => A.factTerms.includes(d)) && r.dds.every((d) => d !== '' && !/^[-–—]+$/.test(d))));
  }
  c.check(`${tag} AR-1 no horizontal overflow (${m.sw} <= ${m.iw})`, m.sw <= m.iw);
}

/** HM-G1 (NOS Design, root comms.md HM-G1): the NOS home, /. Every sentence is verbatim from the frozen About v1.2, What to Expect v1.0 or FAQ v1.0; the home hero component is unchanged apart from its lede, the TBC chip and the facts row. */
async function homeChecks(page, vp, c, tag) {
  // Rev 44: the hub keeps its own scrim (not the DS-1 ramp); it is gated on the outcome, text hidden, p95 >= 4.5 (h1 >= 3) at 1440 and 2056. A failing cell reports its number; the stops are never retuned here.
  if (vp.width === 1440 || vp.width === 2056) await heroTextContrast(page, tag, c);
  const H = ROUTE_TABLE_META.home; const norm = (t) => t.replace(/\s+/g, ' ').trim();
  const rd = (f) => readFileSync(`${SPDIR}${f}`, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  const live = (f) => rd(f).filter((l) => !/^\**~~/.test(l));
  const wte = live('what-to-expect.md'); const s3i = wte.findIndex((l) => spUnmd(l) === 'What to Expect'); const s3 = wte.slice(s3i + 1).map(spUnmd);
  const sentences = (p) => p.match(/[^.!?]+[.!?]+(?=\s|$)/g)?.map(norm) ?? [];
  const wteSentence = (starts) => { for (const p of s3) { const hit = sentences(p).find((x) => x.startsWith(starts)); if (hit) return hit; } return ''; };
  const about = live('about.md').map(spUnmd); const aboutBody = about.slice(2);
  const iH = wte.findIndex((l) => spUnmd(l) === 'Opening hours'); const iA = wte.findIndex((l) => spUnmd(l) === 'Admission');
  const hours = wte.slice(iH + 1, iA).map((l) => { const [a, ...b] = spUnmd(l).split(' – '); return { label: a, value: b.join(' – ') }; });
  const dateLabel = 'Show dates – for public entrance'; const dateLine = spUnmd(wte[wte.findIndex((l) => spUnmd(l) === dateLabel) + 1] ?? '');
  const lede = sentences(s3[0])[0]; const closing = s3[s3.length - 1];
  const f26 = spQa(H.exhibitLead); const f27 = spQa(H.exhibitBody);
  const prog = H.programmeRows.map((r) => ({ ...r, text: r.from === 'wte-sentence' ? wteSentence(r.starts) : (sentences(spQa(r.faq).a[0])[0] ?? '') }));
  const corpus = norm([...about, ...wte.map(spUnmd), ...readFileSync(`${SPDIR}faq.md`, 'utf8').split('\n').map(spUnmd)].join(' '));
  c.check(`${tag} HM-G1 sources are real: the lede, About paragraphs 1 and 3, the dates line, ${H.programmeRows.length} programme sentences, FAQ ${H.exhibitLead}/${H.exhibitBody} and the closing paragraph were found in the frozen copies`, Boolean(lede) && aboutBody.length >= 3 && Boolean(dateLine) && hours.length === 3 && prog.every((p) => p.text.length > 30) && Boolean(f26?.a.length) && Boolean(f27?.a.length) && closing.startsWith('Whether your passion lies'));
  const m = await page.evaluate((H) => {
    const txt = (e) => e.textContent.replace(/\s+/g, ' ').trim(); const fam = (e) => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').toLowerCase();
    const sec = (k) => document.querySelector(`[data-hm-section="${k}"]`); const main = document.querySelector('main') ?? document.body;
    const links = (el) => el ? [...el.querySelectorAll('a')].map((a) => ({ t: txt(a), l: Math.round(a.getBoundingClientRect().left) })) : [];
    const lede = document.querySelector('[data-hm-lede]'); const hero = document.querySelector('section[data-nos-hero], [data-hm-hero], header + section, main > section');
    const facts = [...document.querySelectorAll('.nos-hero-facts dt, [data-hero-facts] dt')].map((dt) => ({ t: txt(dt), tt: getComputedStyle(dt).textTransform, px: parseFloat(getComputedStyle(dt).fontSize) }));
    const about = sec('about'); const card = document.querySelector('[data-hm-visit-card]'); const ps = (el) => el ? [...el.querySelectorAll('p')].map((p) => ({ t: txt(p), fam: fam(p), w: getComputedStyle(p).fontWeight })) : [];
    const exempt = [...document.querySelectorAll('[data-hm-exempt]')];
    const orphan = [...main.querySelectorAll('p')].filter((p) => !exempt.some((x) => x.contains(p)) && !p.closest('footer') && !p.closest('[data-hero-facts], .nos-hero-facts')).map(txt).filter(Boolean);
    const closeEl = sec('closing'); const cp = closeEl ? [...closeEl.querySelectorAll('p')][0] : null; const ccs = cp ? getComputedStyle(cp) : null;
    const rows = (el) => el ? [...el.querySelectorAll('h3')].map((h) => { const row = h.closest('li, article, div'); return { h3: txt(h), p: row ? [...row.querySelectorAll('p')].map(txt) : [], a: row ? row.querySelectorAll('a').length : 0, arrow: row ? txt(row).includes('→') : false }; }) : [];
    return { secs: H.sections.map((k) => Boolean(sec(k))), order: H.sections.map((k) => { const e = sec(k); return e ? e.getBoundingClientRect().top + scrollY : null; }),
      lede: lede ? txt(lede) : null, facts, h2s: [...main.querySelectorAll('h2')].map(txt), body: txt(main),
      aboutP: ps(about), aboutLinks: links(about).map((x) => x.t).filter((t) => /→/.test(t)), cardText: card ? txt(card) : '', cardPos: card ? getComputedStyle(card).position : null, cardLinks: links(card).map((x) => x.t),
      visit: links(sec('visit')), prog: rows(sec('programme')), exhP: ps(sec('exhibit')), exhLinks: links(sec('exhibit')).map((x) => x.t.replace(/\s*→.*$/, '')), exhOl: sec('exhibit') ? sec('exhibit').querySelectorAll('ol').length : 0,
      closing: cp ? { t: txt(cp), fam: fam(cp), w: ccs.fontWeight, mw: ccs.maxWidth, fs: parseFloat(ccs.fontSize), ch: (() => { const pr = document.createElement('span'); pr.style.cssText = 'display:inline-block;width:1ch;position:absolute;visibility:hidden'; cp.appendChild(pr); const w = pr.getBoundingClientRect().width; pr.remove(); return w; })(), wrap: ccs.textWrap || ccs.textWrapStyle } : null, closeLinks: links(closeEl).map((x) => x.t.replace(/\s*→.*$/, '')),
      orphan, sw: document.documentElement.scrollWidth, iw: innerWidth };
  }, H);
  c.check(`${tag} HM-G1 the five bands exist in order: ${H.sections.join(', ')} (${m.secs.join(',')})`, m.secs.every(Boolean) && m.order.every((y, i) => i === 0 || y > m.order[i - 1]));
  c.check(`${tag} HM-G1 gone: ${H.bannedText.filter((t) => m.body.includes(t)).join(' | ') || 'none of'} the builder strings (stats, "Ten judging groups", step cards, the old lede, "Cycle", "Past shows"); no TBC, pending or placeholder chip`, H.bannedText.every((t) => !m.body.includes(t)) && !new RegExp(H.bannedPattern, 'i').test(m.body));
  c.check(`${tag} HM-G1 the hero lede is What to Expect v1.0 section 3 sentence 1, verbatim, in [data-hm-lede] (${m.lede && m.lede.slice(0, 50)})`, m.lede === lede);
  c.check(`${tag} HM-G1 the hero facts are exactly ${H.factTerms.join(' / ')}, labels sentence case, 15px, not uppercase (${m.facts.map((f) => `${f.t} ${f.tt} ${f.px}`).join('; ')})`, JSON.stringify(m.facts.map((f) => f.t)) === JSON.stringify(H.factTerms) && m.facts.every((f) => f.tt === 'none' && Math.abs(f.px - 15) <= 0.5));
  c.check(`${tag} HM-G1 About band: h2 "${H.aboutHeading}", About v1.2 paragraph 1 as a Fraunces 300 lead, paragraph 3 as body, links ${H.aboutLinks.join(' / ')} (${m.aboutP.length} paragraphs)`, m.h2s.includes(H.aboutHeading) && m.aboutP.some((p) => p.t === aboutBody[0] && p.fam.includes('fraunces') && p.w === '300') && m.aboutP.some((p) => p.t === aboutBody[2]) && JSON.stringify([...m.aboutLinks, ...m.cardLinks.filter((t) => /→/.test(t) && !m.aboutLinks.includes(t))]) === JSON.stringify(H.aboutLinks));
  c.check(`${tag} HM-G1 the visit card is static and shows "${dateLabel}", "${dateLine}" and her ${hours.length} hours rows verbatim (${m.cardPos})`, m.cardPos !== null && m.cardPos !== 'sticky' && [dateLabel, dateLine, ...hours.map((h) => h.label), ...hours.map((h) => h.value)].every((t) => m.cardText.includes(t)));
  { const lefts = [...new Set(m.visit.map((l) => l.l))].length; const want = vp.width >= 1024 ? H.visitColumns.desktop : vp.width >= 600 ? H.visitColumns.below1024 : H.visitColumns.below600;
    c.check(`${tag} HM-G1 Visit: h2 "Visit" and the nav-label register ${H.visitLinks.join(' / ')} with a → each, no descriptions, ${want} column(s) (${lefts})`, m.h2s.includes('Visit') && JSON.stringify(m.visit.map((l) => l.t.replace(/\s*→.*$/, ''))) === JSON.stringify(H.visitLinks) && m.visit.every((l) => l.t.includes('→')) && lefts === want); }
  c.check(`${tag} HM-G1 Programme: h2 "Programme" and ${prog.length} rows, h3 nav label + her sentence + →: ${prog.map((p) => p.h3).join(' / ')} (${m.prog.map((r) => r.h3).join(' / ')})`, m.h2s.includes('Programme') && m.prog.length === prog.length && prog.every((p, i) => m.prog[i].h3 === p.h3 && m.prog[i].p.includes(p.text) && m.prog[i].arrow));
  c.check(`${tag} HM-G1 Exhibit & trade: FAQ ${H.exhibitLead} as a Fraunces 300 lead, FAQ ${H.exhibitBody} as body, a register of ${H.exhibitLinks.join(' / ')}, no ordered step cards`, m.h2s.includes('Exhibit & trade') && m.exhP.some((p) => p.t === f26.a[0] && p.fam.includes('fraunces') && p.w === '300') && m.exhP.some((p) => p.t === f27.a[0]) && JSON.stringify(m.exhLinks) === JSON.stringify(H.exhibitLinks) && m.exhOl === 0);
  c.check(`${tag} HM-G1 closing band: her closing paragraph verbatim in Fraunces 300, max-width ${H.closingMaxWidthCh}ch (the width of a "0" in the rendered font x ${H.closingMaxWidthCh}, +-4ch), balanced, then ${H.closingLinks.join(' / ')} (${m.closing && `${m.closing.fam} ${m.closing.w} ${m.closing.mw} ${m.closing.wrap}`})`, Boolean(m.closing) && m.closing.t === closing && m.closing.fam.includes('fraunces') && m.closing.w === '300' && m.closing.wrap === 'balance' && Math.abs(parseFloat(m.closing.mw) - H.closingMaxWidthCh * m.closing.ch) <= m.closing.ch * 4 && JSON.stringify(m.closeLinks) === JSON.stringify(H.closingLinks));
  { const bad = m.orphan.flatMap((p) => sentences(p).length ? sentences(p) : [norm(p)]).filter((x) => !corpus.includes(x)); c.check(`${tag} HM-G1 every visible sentence in a <p> traces verbatim to About v1.2, What to Expect v1.0 or FAQ v1.0 (${m.orphan.length} paragraphs; offenders: ${bad.slice(0, 2).join(' | ').slice(0, 120)})`, m.orphan.length > 0 && bad.length === 0); }
  c.check(`${tag} HM-G1 no horizontal overflow (${m.sw} <= ${m.iw})`, m.sw <= m.iw);
}

/** Per-route facts (NOS Design ruling 2026-10-25): the hero facts equal exactly the set the route's golden lists (route table `facts`); an aside [data-nos-facts] shows only Dates / Venue / Host; "Cycle" and "Triennial" never render. */
async function routeFactsChecks(page, route, vp, c, tag) {
  const F = route.facts; if (!F) return;
  const m = await page.evaluate(() => { const t = (e) => e.textContent.replace(/\s+/g, ' ').trim(); return { hero: [...document.querySelectorAll('section[data-nos-hero] [data-hero-facts] dt')].map(t), aside: [...document.querySelectorAll('[data-nos-facts] dt')].map(t) }; });
  const allowed = [...STD.showFactsLabels.allowedLabels, 'Editions', 'First show'];
  if (F.exact && F.terms) c.check(`${tag} FACTS the hero facts are exactly ${F.terms.join(' / ')} as ${F.golden} lists them (${m.hero.join(' / ')})`, JSON.stringify(m.hero) === JSON.stringify(F.terms));
  else c.check(`${tag} FACTS the hero facts (${m.hero.join(' / ') || 'none'}) use only ${allowed.join(' / ')} (${F.golden}); no golden lists exact terms for this route`, m.hero.every((x) => allowed.includes(x)));
  c.check(`${tag} FACTS the facts aside (${m.aside.join(' / ') || 'none'}) shows only ${STD.showFactsLabels.allowedLabels.join(' / ')}, never Cycle or Triennial`, m.aside.every((x) => STD.showFactsLabels.allowedLabels.includes(x)));
}

/** Ticket-first event routes (SY, WO, WK, CR) sit on SAOC's DocumentLayout at the pinned commit (823308f5): `asideFirst` -> .doc-layout--aside-first, `asideBare` -> .doc-aside--bare, a 440px cap below 1024. With asideFirst the aside precedes main in the DOM and in tab order (so the visual order and the focus order agree); below 1024 it is also first by bounding-box y, and from 1024 it keeps its right-hand column. */
async function ticketLayoutChecks(page, vp, c, tag, perRow = false) {
  const nUnits = perRow ? await page.evaluate(() => document.querySelectorAll('[data-conference-row]').length) : 1;
  if (perRow) c.check(`${tag} TICKET-LAYOUT CR-G1 two [data-conference-row] (${nUnits})`, nUnits === 2);
  for (let u = 0; u < nUnits; u += 1) {
    const lab = perRow ? ` row ${u + 1}` : '';
    const m = await page.evaluate((idx) => {
      const root = idx >= 0 ? document.querySelectorAll('[data-conference-row]')[idx] : document;
      const asides = [...root.querySelectorAll('[data-doc-aside]')]; const aside = asides[0] ?? null;
      const layout = idx >= 0 ? (root.querySelector('[data-doc-layout]') ?? root.closest('[data-doc-layout]')) : document.querySelector('[data-doc-layout]');
      // On a row the "main" is the row's own body: the row's [data-doc-main] if it has one, else its text link ("About the ... →"), which follows the ticket by CR-G1.
      // Real markup (conferences/page.tsx): the row's aside (display: contents below 1024, so its own box is empty) holds the card; the row's main holds h2, [data-conference-standfirst], [data-conference-body] and the .nos-cr-link text link.
      const main = idx >= 0 ? root.querySelector('[data-conference-body]') : document.querySelector('[data-doc-main]');
      const linkEl = idx >= 0 ? root.querySelector('.nos-cr-link') : null; const sfEl = idx >= 0 ? root.querySelector('[data-conference-standfirst]') : null;
      const cardEl = aside ? (aside.querySelector('[data-ticket-card]') ?? aside) : null; const cb = cardEl ? cardEl.getBoundingClientRect() : null; const sb = sfEl ? sfEl.getBoundingClientRect() : null;
      const cs = aside ? getComputedStyle(aside) : null; const ab = aside ? aside.getBoundingClientRect() : null; const mb = main ? main.getBoundingClientRect() : null;
      const sel = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
      const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
      const ta = aside ? [...aside.querySelectorAll(sel)].find(vis) : null;
      const tmRoot = linkEl ?? main; const tm = tmRoot ? (tmRoot.matches(sel) ? (vis(tmRoot) ? tmRoot : null) : [...tmRoot.querySelectorAll(sel)].find(vis) ?? null) : null;
      const label = (e) => (e ? (e.textContent || e.getAttribute('aria-label') || e.tagName).replace(/\s+/g, ' ').trim().slice(0, 30) : null);
      return { layout: Boolean(layout), first: layout?.classList.contains('doc-layout--aside-first') ?? false, bare: aside?.classList.contains('doc-aside--bare') ?? false, nAsides: asides.length, cardTop: cb ? cb.top + scrollY : null, cardB: cb ? cb.bottom + scrollY : null, cardW: cb ? cb.width : 0, sfB: sb ? sb.bottom + scrollY : null, cards: aside ? aside.querySelectorAll('[data-ticket-card]').length : 0, pos: cs?.position, top: cs ? parseFloat(cs.top) : null, w: ab?.width ?? 0, asideB: ab ? ab.bottom + scrollY : null, mainY: mb ? mb.top + scrollY : null, mainL: mb?.left ?? 0, asideL: ab?.left ?? 0, card: aside ? Boolean(aside.querySelector('[data-ticket-card], .nk-ticket, .nk-grid')) : false, asideBeforeMain: Boolean(aside && main && !main.contains(aside) && (aside.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING)), tabAside: label(ta), tabMain: label(tm), tabAsideFirst: ta && tm ? Boolean(ta.compareDocumentPosition(tm) & Node.DOCUMENT_POSITION_FOLLOWING) : null };
    }, perRow ? u : -1);
    if (perRow) c.check(`${tag} TICKET-LAYOUT${lab} exactly one [data-doc-aside], holding exactly that row's one [data-ticket-card] (${m.nAsides} aside, ${m.cards} card)`, m.nAsides === 1 && m.cards === 1);
    c.check(`${tag} TICKET-LAYOUT${lab} [data-doc-layout] carries doc-layout--aside-first, the aside carries doc-aside--bare and holds the ticket card (layout ${m.layout}, first ${m.first}, bare ${m.bare}, card ${m.card})`, m.layout && m.first && m.bare && m.card);
    c.check(`${tag} TICKET-LAYOUT${lab} with asideFirst set the aside precedes ${perRow ? "the row's body link" : 'main'} in DOM order, and the first focusable in the ticket card (${m.tabAside}) comes before the first focusable in ${perRow ? 'the row body' : 'main'} (${m.tabMain}) in tab order (DOM ${m.asideBeforeMain}, tab ${m.tabAsideFirst})`, m.first && m.asideBeforeMain && m.tabAsideFirst !== false);
    if (vp.width >= 1024) c.check(`${tag} TICKET-LAYOUT${lab} from 1024 the aside is sticky and its top is 100 (var(--doc-aside-top) set to 100px on NOS)${perRow ? '' : ' and it sits right of the main column'} (${m.pos} ${m.top}; ${Math.round(m.asideL)} vs ${Math.round(m.mainL)})`, m.pos === 'sticky' && m.top === 100 && (perRow || m.asideL > m.mainL));
    else if (perRow) c.check(`${tag} TICKET-LAYOUT${lab} below 1024 the card sits after the standfirst (bottom ${Math.round(m.sfB ?? -1)}) and before the body (top ${Math.round(m.mainY ?? -1)}): card ${Math.round(m.cardTop ?? -1)}-${Math.round(m.cardB ?? -1)}, at most 440px wide (${Math.round(m.cardW)})`, m.cardTop !== null && m.sfB !== null && m.mainY !== null && m.cardTop >= m.sfB - 1 && m.cardB <= m.mainY + 1 && m.cardW <= 441);
    else c.check(`${tag} TICKET-LAYOUT${lab} below 1024 the ticket card is first by position (aside bottom ${Math.round(m.asideB ?? -1)} <= ${perRow ? 'row body link' : 'main'} top ${Math.round(m.mainY ?? -1)}) and at most 440px wide (${Math.round(m.w)})`, m.asideB !== null && m.asideB <= m.mainY + 1 && m.w <= 441);
  }
}

/** SY-G1 (NOS Design, root comms.md L3387): /symposium. Every copy string is read from a frozen source or the CMS; builder copy is flagged in spec.md. */
async function syChecks(page, route, vp, c, tag, server) {
  const S = route.sy;
  const themeLines = readFileSync(`${SPDIR}symposium-theme.md`, 'utf8').split('\n').map((l) => l.replace(/\*\*/g, '').trim()).filter(Boolean);
  const title = themeLines.find((l) => /^[“"].*[”"]$/.test(l)); const sentence = themeLines[themeLines.length - 1];
  const wteLine = readFileSync(`${SPDIR}what-to-expect.md`, 'utf8').split('\n').find((l) => l.includes(S.wteStarts)) ?? '';
  const wteSentence = wteLine.slice(wteLine.indexOf(S.wteStarts)).match(/^.*?[.!?](?=\s|$)/)?.[0] ?? '';
  const norm = (t) => t.replace(/\s+/g, ' ').trim();
  c.check(`${tag} SY-G1 sources are real: the theme title, the theme sentence and the What to Expect first sentence were found in the frozen copies`, Boolean(title) && sentence.length > 40 && wteSentence.length > 40, `${title ?? 'no title'} | ${wteSentence.slice(0, 40)}`);
  const m = await page.evaluate(({ title, S }) => {
    const txt = (e) => e.textContent.replace(/\s+/g, ' ').trim();
    const hero = document.querySelector('section[data-nos-hero]'); const main = document.querySelector('[data-doc-main]'); const aside = document.querySelector('[data-doc-aside]');
    const titleEl = hero ? [...hero.querySelectorAll('*')].filter((e) => e.children.length === 0 || e.tagName === 'P').find((e) => txt(e) === title) : null;
    const tcs = titleEl ? getComputedStyle(titleEl) : null;
    const italics = [...document.querySelectorAll('main *, section[data-nos-hero] *')].filter((e) => !e.closest('[data-guest-profile], [data-ticket-card]') && getComputedStyle(e).fontStyle === 'italic' && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => txt(e).slice(0, 40));
    const facts = hero ? [...hero.querySelectorAll('[data-hero-facts] dt')].map((dt) => ({ t: txt(dt), d: dt.nextElementSibling ? txt(dt.nextElementSibling) : '', ws: dt.nextElementSibling ? getComputedStyle(dt.nextElementSibling).whiteSpace : '', h: dt.nextElementSibling ? dt.nextElementSibling.getBoundingClientRect().height : 0, lh: dt.nextElementSibling ? parseFloat(getComputedStyle(dt.nextElementSibling).lineHeight) : 0 })) : [];
    const p = [...document.querySelectorAll('main h2')].find((h) => txt(h) === S.presentersH2);
    const cont = document.querySelector('main'); const cb = cont.getBoundingClientRect(); const pb = p ? p.getBoundingClientRect() : null;
    const card = aside ? aside.querySelector('[data-ticket-card], .nk-ticket, .nk-grid') : null; const acs = aside ? getComputedStyle(aside) : null;
    const crumb = hero ? txt(hero.querySelector('nav, [aria-label*="readcrumb"]') ?? hero).slice(0, 60) : '';
    const mb = main ? main.getBoundingClientRect() : null; const ab = aside ? aside.getBoundingClientRect() : null;
    return { asideY: ab ? ab.top + scrollY : null, mainY: mb ? mb.top + scrollY : null, mainText: main ? txt(main) : '', h1: txt(document.querySelector('h1')), titleFound: Boolean(titleEl), titleItalic: tcs?.fontStyle, titleFam: tcs?.fontFamily.split(',')[0].replace(/["']/g, '').toLowerCase(), titleW: tcs?.fontWeight, titlePx: tcs ? parseFloat(tcs.fontSize) : null, titleInHero: Boolean(titleEl),
      italics, facts, presentersFull: p ? { inDocMain: Boolean(p.closest('[data-doc-main]')), w: pb.width, cw: cb.width } : null, card: Boolean(card), asidePos: acs?.position, asideTop: acs ? parseFloat(acs.top) : null, asideW: aside ? aside.getBoundingClientRect().width : 0,
      all: txt(document.querySelector('main')), crumb };
  }, { title, S });
  c.check(`${tag} SY-G1 h1 is "${S.h1}" (NL-1: the nav label, the full name sits on the ticket card) (${m.h1})`, m.h1 === S.h1);
  c.check(`${tag} SY-G1 her theme title ${title} sits in the hero in her quotation marks, Fraunces 300 italic, 22-28px, and is the only italic outside the profiles (${m.titleItalic} ${m.titleFam} ${m.titleW} ${m.titlePx}; italics: ${m.italics.join(' | ')})`, m.titleFound && m.titleItalic === 'italic' && m.titleFam.includes('fraunces') && m.titleW === '300' && m.titlePx >= 21 && m.titlePx <= 28.5 && m.italics.length === 1);
  c.check(`${tag} SY-G1 FACTS-1 renders from the CMS ticket: whichever of Date / Time / Venue are present come in that order, an empty cell is omitted (no "Dates to follow", TBC or dash), the date is nowrap and one line (${m.facts.map((f) => `${f.t}=${f.d}`).join('; ')})`, (m.facts.length >= 2 && (() => { const order = ['Date', 'Time', 'Venue']; const idx = m.facts.map((f) => order.indexOf(f.t)); return idx.every((i, k) => i >= 0 && (k === 0 || i > idx[k - 1])); })()) && m.facts.every((f) => f.d !== '' && !/follow|tbc|to be confirmed|^[-\u2013\u2014]+$/i.test(f.d)) && m.facts.filter((f) => f.t === 'Date').every((f) => /nowrap/.test(f.ws) && f.h <= f.lh * 1.4));
  dateTimeChecks(c, tag, 'SY-G1', m.facts, S, S.hoursLine, S.dateFaq);
  c.check(`${tag} SY-G1 body: her theme sentence, verbatim, then the first What to Expect sentence, verbatim, in the main column`, (() => { const a = m.mainText.indexOf(norm(sentence)); const b = m.mainText.indexOf(norm(wteSentence)); return a >= 0 && b > a; })(), `${m.mainText.indexOf(norm(sentence))} / ${m.mainText.indexOf(norm(wteSentence))}`);
  c.check(`${tag} SY-G1 the aside holds the live symposium ticket card, sticky at 100 from 1024, static and at most 440px below (${m.card}; ${m.asidePos} ${m.asideTop}; ${Math.round(m.asideW)}px)`, m.card && (vp.width >= 1024 ? m.asidePos === 'sticky' && m.asideTop === 100 : (m.asidePos !== 'sticky' && m.asideW <= 441)));
  if (vp.width < 1024) c.check(`${tag} SY-G1 below 1024 the ticket comes first (aside y ${Math.round(m.asideY)} < copy y ${Math.round(m.mainY)})`, m.asideY !== null && m.asideY < m.mainY);
  await subnavStable(page, server, route, c, tag);
  await symposiumLedeStable(page, server, route, vp, c, tag);
  c.check(`${tag} SY-G1 h2 "${S.presentersH2}" is full width, outside the main column (${JSON.stringify(m.presentersFull)})`, Boolean(m.presentersFull) && !m.presentersFull.inDocMain && m.presentersFull.w >= m.presentersFull.cw * 0.85);
  c.check(`${tag} SY-G1 the About/Attending placeholders and the PLACEHOLDER COPY chips are gone`, S.absent.every((t) => !m.all.includes(t)), S.absent.filter((t) => m.all.includes(t)).join(', '));
  c.check(`${tag} SY-G1 the crumb reads National Show - Symposium (${m.crumb})`, /National Show\s*[—–-]\s*Symposium/.test(m.crumb));
}

async function sxChecks(page, route, vp, c, tag) {
  const names = readFileSync(`${SPDIR}sa-exhibitors.md`, 'utf8').split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*-/.test(l)).map((l) => spUnmd(l.replace(/\|/g, ' ')));
  const m = await page.evaluate(() => { const t = (document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' '); const aside = document.querySelector('[data-doc-aside]'); const items = aside ? [...aside.querySelectorAll('li')].map((li) => ({ t: li.textContent.replace(/\s+/g, ' ').trim(), h: li.getBoundingClientRect().height })) : []; const btn = [...document.querySelectorAll('main a')].filter((a) => /vendor application/i.test(a.textContent)); const h2 = [...document.querySelectorAll('[data-doc-aside] h2')].map((h) => h.textContent.trim()); const wall = [...document.querySelectorAll('main h2')].map((h) => h.textContent.trim()); return { t, items, btn: btn.map((b) => ({ shown: b.getBoundingClientRect().height > 0, h: b.getBoundingClientRect().height, href: b.getAttribute('href') })), h2, wall, cta: document.querySelector('.sp-hero-cta, [data-hero-cta]') ? true : null }; });
  c.check(`${tag} SX-G1 the aside is ONE card with h2 "Available at the Show", her six items (each >= 44px) and a full-width Vendor application button`, m.h2.includes('Available at the Show') && m.items.length === 6 && m.items.every((i) => i.h >= 44) && m.btn.some((b) => b.shown && b.href));
  if (route.sx.directory === 'closed') {
    const leaked = names.filter((n) => n.length > 3 && m.t.includes(n));
    c.check(`${tag} SX-G1/D-SX1 the directory is gated closed: none of her ${names.length} invited-vendor names is rendered (${leaked.slice(0, 3).join(', ')})`, names.length >= 20 && leaked.length === 0);
    c.check(`${tag} SX-G1 no lede: the unsourced 'Meet the specialist nurseries' line is not rendered`, !m.t.includes(route.sx.noLedeText ?? 'Meet the specialist nurseries'));
    c.check(`${tag} SX-G1 the Vendor application button is in the empty state (${m.btn.length} buttons)`, m.btn.length >= 1);
  } else {
    c.check(`${tag} SX-G1 D-SX1 open: her ${names.length} rows are rendered in order`, (() => { let at = 0; return names.every((n) => { const k = m.t.indexOf(n, at); if (k < 0) return false; at = k + n.length; return true; }); })());
    c.check(`${tag} SX-G1 the directory heads are her "List of Exhibitors" and "Short List of Invited Vendors"`, m.t.includes('List of Exhibitors') && m.t.includes('Short List of Invited Vendors'));
  }
}

/** /exhibitors (Plant Entry/Registration): no source doc exists, so the public build renders the hero and the contact panel only. */
async function heroOnlyChecks(page, route, vp, c, tag) {
  const m = await page.evaluate(() => { const main = document.querySelector('main'); const h2 = [...main.querySelectorAll('h2')].map((h) => h.textContent.replace(/\s+/g, ' ').trim()); return { h1: document.querySelector('h1')?.textContent.replace(/\s+/g, ' ').trim(), h2, h3: main.querySelectorAll('h3').length, layout: Boolean(document.querySelector('[data-doc-layout]')), tbc: /to be confirmed|PLACEHOLDER COPY/i.test(main.textContent), height: document.documentElement.scrollHeight, contact: Boolean(main.querySelector('[data-contact-panel], a[href^="mailto:"], form')) }; });
  c.check(`${tag} /exhibitors h1 is "${route.headings.h1}" (${m.h1})`, m.h1 === route.headings.h1);
  c.check(`${tag} /exhibitors withheld: no document layout, no h3, h2 only the contact panel or the show index (${m.h2.join(' | ')})`, !m.layout && m.h3 === 0 && m.h2.every((t) => /contact|explore|the show/i.test(t)));
  c.check(`${tag} /exhibitors withheld: no TBC chip or placeholder copy, and the contact panel is present`, !m.tbc && m.contact);
  if (vp.width >= 1440) c.check(`${tag} /exhibitors withheld: the page is hero + contact panel + show index, not 10,000px of invented guidance (${m.height}px <= 3000)`, m.height <= 3000);
}

const SECTION_NAV = 'nav[data-doc-index][aria-label="Sections"]';

/** D7 (FINAL): below 1024 the index is a sticky horizontal scroller. Under 780 the header is not sticky and the scroller sticks at
 env(safe-area-inset-top, 0); from 780 it sticks at the sticky header's height. 32px trailing mask fade only while it overflows; scroll-snap;
 the active item is kept in view. It never overlaps the header and stays reachable when scrolled mid-page. */
async function scrollerChecks(page, vp, c, tag) {
  const s = await page.evaluate((sel) => {
    const nav = document.querySelector(sel); if (!nav) return null;
    const aside = nav.closest('[data-doc-aside]');
    const cands = [nav, nav.querySelector('ul'), aside].filter(Boolean);
    const sc = cands.find((e) => ['auto', 'scroll'].includes(getComputedStyle(e).overflowX)) ?? null;
    const header = document.querySelector('header'); const hs = header ? getComputedStyle(header) : null;
    const stick = [aside, nav].find((e) => e && getComputedStyle(e).position === 'sticky') ?? null;
    return { hasScroller: Boolean(sc), over: sc ? sc.scrollWidth > sc.clientWidth + 1 : false,
      mask: sc ? (getComputedStyle(sc).maskImage !== 'none' && getComputedStyle(sc).maskImage !== '') || (getComputedStyle(sc).webkitMaskImage ?? 'none') !== 'none' : false,
      snap: sc ? getComputedStyle(sc).scrollSnapType : 'none', stick: Boolean(stick), stickTop: stick ? getComputedStyle(stick).top : null,
      headerSticky: Boolean(hs && ['sticky', 'fixed'].includes(hs.position)), headerH: header ? header.getBoundingClientRect().height : 0 };
  }, SECTION_NAV);
  if (!s) { c.check(`${tag} nav[data-doc-index][aria-label="Sections"] exists`, false); return; }
  c.check(`${tag} the index is a horizontal scroller below 1024 (D7)`, s.hasScroller);
  c.check(`${tag} 32px trailing mask fade only while it overflows (overflow ${s.over}, mask ${s.mask})`, s.mask === s.over);
  c.check(`${tag} scroll-snap on the scroller (${s.snap})`, s.snap !== 'none');
  c.check(`${tag} the scroller is sticky`, s.stick);
  const wantTop = vp.width >= 780 ? 97 : 0;
  c.check(`${tag} the scroller sticks at top ${wantTop}px (${s.stickTop}; 97 from 780 up, env(safe-area-inset-top,0) below)`, s.stickTop !== null && Math.abs(parseFloat(s.stickTop) - wantTop) <= 2);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
  await page.waitForTimeout(250);
  const g = await page.evaluate(({ sel, hs }) => { const a = document.querySelector(sel)?.closest('[data-doc-aside]') ?? document.querySelector(sel); const b = a.getBoundingClientRect(); const h = document.querySelector('header'); const hb = hs && h ? h.getBoundingClientRect().bottom : 0; return { top: b.top, hb }; }, { sel: SECTION_NAV, hs: s.headerSticky });
  c.check(`${tag} mid-page the scroller stays reachable and never overlaps the sticky header (top ${Math.round(g.top)}, header bottom ${Math.round(g.hb)})`, g.top >= g.hb - 1 && g.top <= g.hb + 8);
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** The checks that hold on every route: the PG-1 rhythm, no radius >= 999 except the eyebrow, no split h2, no h2 naming a sibling route,
 outline, h4, hero height, legend chip, facts attributes. */
async function extraChecks(page, route, vp, c, tag) {
  const x = await page.evaluate(({ eyebrowSel }) => {
    const lv = (e) => Number(e.tagName[1]);
    const heads = [...document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6, h1')];
    const uniq = [...new Set(heads)].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    let skip = 0; for (let i = 1; i < uniq.length; i += 1) if (lv(uniq[i]) > lv(uniq[i - 1]) + 1) skip += 1;
    const round = [...document.querySelectorAll('body *')].filter((e) => { if (e.closest(eyebrowSel)) return false; const s = getComputedStyle(e); const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && ['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'].some((k) => parseFloat(s[`border${k}Radius`]) >= 999); }).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)}`);
    const split = [...document.querySelectorAll('main h2')].filter((h) => !h.closest('[data-venue-card]') && !h.closest('section, div')?.querySelector('[data-venue-card]')).filter((h) => { let item = h; while (item.parentElement && item.parentElement !== document.querySelector('main')) { const ps = getComputedStyle(item.parentElement); const row = ps.display === 'grid' ? ps.gridTemplateColumns.trim().split(/\s+/).length > 1 : (ps.display === 'flex' && ps.flexDirection.startsWith('row')); if (row && item.parentElement.children.length > 1) return item.textContent.trim() === h.textContent.trim() || item.querySelectorAll('p, ul, ol, details, table, img, a').length === 0; item = item.parentElement; } return false; }).map((h) => h.textContent.trim().slice(0, 30));
    const nkBad = [...document.querySelectorAll('.nk-ticket, .nk-perf, .nk-stamp')].filter((e) => !e.closest('[data-ticket-card]')).length;
    const testBar = document.querySelectorAll('[aria-label="Testing only, not live"]').length;
    const inner = document.querySelector('.nos-hero-inner'); const ic = inner ? getComputedStyle(inner) : null;
    const img = document.querySelector('section[data-nos-hero] [data-nos-hero-media] img'); const ib = img ? img.getBoundingClientRect() : null;
    const first = document.querySelector('[data-doc-main] > section:first-of-type, [data-doc-main] > *:first-child, [data-programme-body] > section:first-of-type'); const fs = first ? getComputedStyle(first) : null;
    const navLabels = [...document.querySelectorAll('header a, .nos-subnav a')].map((a) => a.textContent.trim().replace(/\s+/g, ' ').toLowerCase()).filter(Boolean);
    const h2s = [...document.querySelectorAll('main h2')].map((h) => h.textContent.trim().replace(/\s+/g, ' '));
    const h4s = [...document.querySelectorAll('main h4')].map((h) => { const s = getComputedStyle(h); return { fam: s.fontFamily.split(',')[0].replace(/["']/g, '').toLowerCase(), w: s.fontWeight, px: parseFloat(s.fontSize), mt: parseFloat(s.marginTop), mb: parseFloat(s.marginBottom) }; });
    const proseH3 = () => [...document.querySelectorAll('main h3')].find((h) => !h.closest('[data-venue-card], [data-doc-aside], aside, [data-ticket-card], [data-card], [data-guest-profile], [data-conference-row]')) ?? null;
    const lh = (e) => { if (!e) return null; const s = getComputedStyle(e); return parseFloat(s.lineHeight) / parseFloat(s.fontSize); };
    const hero = document.querySelector('section[data-nos-hero]');
    const facts = document.querySelector('[data-hero-facts]');
    const legend = [...document.querySelectorAll('main *')].filter((e) => !e.closest('details') && e.children.length === 0 && /to be confirmed by the show committee/i.test(e.textContent)).length;
    const railed = [...document.querySelectorAll('main *')].filter((e) => { const s = getComputedStyle(e); return ['Left', 'Right'].some((k) => parseFloat(s[`border${k}Width`]) > 1) || ['Top', 'Bottom', 'Left', 'Right'].some((k) => s[`border${k}Style`] === 'dashed' && parseFloat(s[`border${k}Width`]) >= 2); }).length;
    const h1e = document.querySelector('h1'); const h1s = h1e ? getComputedStyle(h1e) : null;
    const h1i = h1e ? { len: h1e.textContent.replace(/\s+/g, ' ').trim().length, long: h1e.classList.contains('is-long'), px: parseFloat(h1s.fontSize), maxW: h1s.maxWidth, boxW: h1e.getBoundingClientRect().width, wrap: h1s.textWrap || h1s.getPropertyValue('text-wrap'), lines: Math.round(h1e.getBoundingClientRect().height / parseFloat(h1s.lineHeight)), ow: h1s.overflowWrap, ...(() => { const rg = document.createRange(); rg.selectNodeContents(h1e); const rects = [...rg.getClientRects()].filter((q) => q.width > 0); const hb = h1e.getBoundingClientRect(); return { textRight: rects.length ? Math.max(...rects.map((q) => q.right)) : 0, boxRight: hb.right - parseFloat(h1s.paddingRight) - parseFloat(h1s.borderRightWidth) }; })() } : null;
    const subItems = [...document.querySelectorAll('.nos-subnav a')].map((a) => ({ t: a.textContent.replace(/\s+/g, ' ').trim(), cur: a.getAttribute('aria-current') }));
    const crumb = document.querySelector('section[data-nos-hero] nav[aria-label="Breadcrumb"]'); const crumbText = crumb ? crumb.textContent.replace(/\s+/g, ' ').trim() : null;
    return { h1i, subItems, crumbText, nkBad, testBar, vw: innerWidth, innerMin: ic ? parseFloat(ic.minHeight) : null, innerAlign: ic ? ic.alignContent : null, innerPadT: ic ? parseFloat(ic.paddingTop) : null, innerPadB: ic ? parseFloat(ic.paddingBottom) : null, copyPadT: (() => { const e = document.querySelector('.nos-hero-inner .nos-hero-copy'); return e ? parseFloat(getComputedStyle(e).paddingTop) : null; })(), copyPadB: (() => { const e = document.querySelector('.nos-hero-inner .nos-hero-copy'); return e ? parseFloat(getComputedStyle(e).paddingBottom) : null; })(), band: ib && ib.height ? ib.width / ib.height : null, skip, round, split, padTop: fs ? parseFloat(fs.paddingTop) : null, bTop: fs ? parseFloat(fs.borderTopWidth) : null, navLabels, h2s, h4s, h2lh: lh([...document.querySelectorAll('main h2')].find((h) => !h.closest('[data-guest-profile], [data-conference-row]')) ?? null), h3lh: lh(proseH3()),
      heroH: hero ? hero.getBoundingClientRect().height : null, legend, railed, factsCount: facts ? facts.querySelectorAll('[data-hero-fact]').length : 0, factsAttr: facts ? facts.getAttribute('data-fact-count') : null, factTerms: facts ? [...facts.querySelectorAll('dt')].map((e) => e.textContent.trim()) : [], factValues: facts ? [...facts.querySelectorAll('dd')].map((e) => e.textContent.trim()) : [], factCount2: facts ? facts.querySelectorAll('[data-hero-fact]').length >= 2 : true, indexRows: [...document.querySelectorAll('nav[data-doc-index] a')].map((a) => { const b = a.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right }; }), factsOk: facts ? [...facts.querySelectorAll('[data-hero-fact]')].every((f) => f.children[0]?.tagName === 'DT' && f.children[1]?.tagName === 'DD') : true };
  }, { eyebrowSel: '[data-nos-hero-eyebrow]' });
  if (x.h1i) {
    const isLong = x.h1i.len > STD.hero.longTitleChars;
    c.check(`${tag} LT-1 the h1 (${x.h1i.len} chars) ${isLong ? 'carries' : 'does not carry'} .is-long`, x.h1i.long === isLong);
    c.check(`${tag} NL-2 the h1 text fits its box: the text Range ends at ${Math.round(x.h1i.textRight)} <= the content box right ${Math.round(x.h1i.boxRight)} (not a scrollWidth test)`, x.h1i.textRight <= x.h1i.boxRight + 0.5);
    if (isLong) {
      const want = Math.min(64, Math.max(40, 25.6 + 0.026 * vp.width));
      c.check(`${tag} LT-1 the long h1 is clamp(2.5rem, 1.6rem + 2.6vw, 4rem) (${x.h1i.px.toFixed(1)} ~ ${want.toFixed(1)}), max-width none or not narrower than the h1's own box, text-wrap balance, overflow-wrap break-word (${x.h1i.maxW} vs box ${x.h1i.boxW.toFixed(0)}px, ${x.h1i.wrap}, ${x.h1i.ow})`, Math.abs(x.h1i.px - want) <= 1.5 && (x.h1i.maxW === 'none' || parseFloat(x.h1i.maxW) >= x.h1i.boxW - 1) && /balance/.test(x.h1i.wrap) && x.h1i.ow === 'break-word');
      if (vp.width >= 1440) c.check(`${tag} LT-1 the long h1 holds to one line up to 24 characters; a longer title (${x.h1i.len}) may take two inside the hero height cap, because the NH2 copy column is 54% wide (${x.h1i.lines})`, x.h1i.len > 24 ? x.h1i.lines <= 2 : x.h1i.lines === 1);
    }
  }
  if (route.subnav) {
    const items = x.subItems.map((i) => i.t); const cur = x.subItems.filter((i) => i.cur === 'page').map((i) => i.t);
        c.check(`${tag} the sub-nav is ${route.subnav.items.join(' / ')} in order, with no South African exhibitors item (${items.join(' / ')})`, JSON.stringify(items) === JSON.stringify(route.subnav.items));
    c.check(`${tag} exactly one sub-nav item is aria-current and it is "${route.subnav.current}" (${cur.join(', ')})`, cur.length === 1 && cur[0] === route.subnav.current);
  }
  c.check(`${tag} a breadcrumb sits in the hero ('National Show - <page>'): ${x.crumbText}`, Boolean(x.crumbText) && /^National Show/.test(x.crumbText));
  c.check(`${tag} .nk-ticket/.nk-perf/.nk-stamp only inside a purchasable [data-ticket-card] (WS-1)`, x.nkBad === 0, String(x.nkBad));
  c.check(`${tag} the TESTING ONLY bar is absent (it belongs to /tickets/* and the payment step only)`, x.testBar === 0, String(x.testBar));
  {
    const P = STD.hero.pg1;
    if (vp.width >= 768) {
      const wantMin = Math.min(P.max, Math.max(P.min, P.vw * vp.width)); const wantPad = Math.min(P.padMax, Math.max(P.padMin, P.padVw * vp.width));
      c.check(`${tag} .nos-hero-inner min-height ${x.innerMin} ~ ${wantMin.toFixed(0)} (PG-1 4)`, x.innerMin !== null && Math.abs(x.innerMin - wantMin) <= 2);
      c.check(`${tag} .nos-hero-inner align-content start and padding-block ${x.innerPadT}/${x.innerPadB} ~ ${wantPad.toFixed(0)}`, ['start', 'flex-start'].includes(x.innerAlign) && Math.abs(x.innerPadT - wantPad) <= 2 && Math.abs(x.innerPadB - wantPad) <= 2, x.innerAlign);
    } else {
      c.check(`${tag} below 768 the photo band is 2:1 (${x.band && x.band.toFixed(2)}) and the copy (.nos-hero-copy) follows at padding-block ${P.mobilePad}px (${x.copyPadT}/${x.copyPadB}; the inner has ${x.innerPadT}/${x.innerPadB})`, x.band !== null && Math.abs(x.band - P.mobileBandAspect) <= 0.06 && x.copyPadT === P.mobilePad && x.copyPadB === P.mobilePad && x.innerPadT === 0 && x.innerPadB === 0);
    }
  }
  if (vp.width >= 1024 && x.indexRows.length) c.check(`${tag} index rows are >= 44px tall with disjoint boxes (${x.indexRows.length})`, x.indexRows.every((r, i) => r.b - r.t >= 43.5 && (i === 0 || r.t >= x.indexRows[i - 1].b - 0.5)));
  c.check(`${tag} heading outline has no skipped level`, x.skip === 0, String(x.skip));
  c.check(`${tag} no element other than the eyebrow computes border-radius >= 999`, x.round.length === 0, x.round.slice(0, 4).join('; '));
  c.check(`${tag} no split section: no row column holds only an h2 (PG-1 2)`, x.split.length === 0, x.split.join('; '));
  c.check(`${tag} first section has no padding-top and no border-top (PG-1 1)`, x.padTop === 0 && x.bTop === 0, `${x.padTop} ${x.bTop}`);
  c.check(`${tag} no "To be confirmed by the show committee" legend outside a disclosure`, x.legend === 0, String(x.legend));
  c.check(`${tag} no rail: no side border > 1px and no dashed 2px border (NOS Design c)`, x.railed === 0, String(x.railed));
  if (x.h2lh !== null) c.check(`${tag} h2 line-height ${x.h2lh.toFixed(2)} ~ ${STD.heading.h2LineHeight}`, Math.abs(x.h2lh - STD.heading.h2LineHeight) <= 0.03);
  if (x.h3lh !== null) c.check(`${tag} h3 line-height ${x.h3lh.toFixed(2)} ~ ${STD.heading.h3LineHeight}`, Math.abs(x.h3lh - STD.heading.h3LineHeight) <= 0.03);
  if (x.h4s.length) {
    c.check(`${tag} h4 only where the route table allows it (${x.h4s.length})`, route.h4 === true, `route.h4=${route.h4}`);
    if ((route.h4Spec ?? 'pyv') === 'pyv') c.check(`${tag} every h4 is Karla 600 16px, 24px above, 8px below (PYV-1)`, x.h4s.every((h) => h.fam.includes('karla') && h.w === '600' && Math.abs(h.px - 16) <= 0.5 && Math.abs(h.mt - 24) <= 1 && Math.abs(h.mb - 8) <= 1), JSON.stringify(x.h4s[0]));
  }
  for (const t of route.h2FlaggedForDrive ?? []) if (x.h2s.includes(t)) c.note(`${tag} FLAGGED FOR LEE-ANN'S DOC (builder copy, not rewritten): h2 "${t}"`);
  if (!route.h2AreNavLabels) c.check(`${tag} no h2 names a sibling route unless it is a heading in her Drive doc or flagged for her doc`, x.h2s.every((t) => !x.navLabels.includes(t.toLowerCase()) || (route.h2FlaggedForDrive ?? []).includes(t) || (route.drive && driveState(route).text.includes(t))), x.h2s.filter((t) => x.navLabels.includes(t.toLowerCase())).join('; '));
  if (x.factsCount || x.factsAttr) {
    c.check(`${tag} no fact is filler (to be confirmed), no Cycle or invented-label fact, row only with >= 2 facts (${x.factTerms.join(' | ')})`, x.factCount2 && !x.factTerms.some((t) => /^cycle$/i.test(t)) && !x.factValues.some((v) => /to be confirmed/i.test(v)) && (!route.keyFacts || x.factTerms.every((t) => route.keyFacts.some((k) => k.term === t))), JSON.stringify(x.factValues));
    c.check(`${tag} [data-hero-facts] has data-fact-count == items (${x.factsAttr} vs ${x.factsCount}), dt before dd`, Number(x.factsAttr) === x.factsCount && x.factsOk);
  }
  if (vp.width >= 1440) { // PG-1 4, inherited from #76
    const wf = x.factsCount > 0; const rc = route.heroCap?.[vp.width >= 2000 ? '2056' : '1440']; const ltCap = x.h1i && x.h1i.len > 20 ? (vp.width >= 2000 ? STD.hero.longTitleCap.at2056 : STD.hero.longTitleCap.at1440) : Infinity; const cap = rc ?? Math.min(ltCap,  vp.width >= 2000 ? (wf ? STD.hero.heightCap.withFacts2056 : STD.hero.heightCap.at2056) : (wf ? STD.hero.heightCap.withFacts1440 : STD.hero.heightCap.at1440));
    c.check(`${tag} hero height ${Math.round(x.heroH)} <= ${cap} (PG-1 4${wf ? ', with facts: FACTS-1' : ''}${rc ? ', route cap from the golden' : ''})`, x.heroH !== null && x.heroH <= cap);
  }
}

const ROUTE_TABLE_META = JSON.parse(readFileSync('.agent/memory/project/specs/nos-content-standard/goldens/route-table.json', 'utf8'));
await withServer(1, 'standard', async (server, c) => {
  const browser = await launchChromium();
  try {
    const needsPhoto = ROUTES.filter((r) => !r.photo).map((r) => r.nos);
    {
      const vp = { name: '2056@2', width: 2056, height: 1200, dsf: 2 }; const context = await newContext(browser, vp); const page = await context.newPage();
      if (await gotoRoute(page, server, '/tickets', c, `[${vp.name} /tickets cards]`)) { await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(500);
      await cardImageChecks(page, vp, c, `[${vp.name} /tickets cards]`); } await context.close();
    }
    for (const vp of STD.viewports) {
      const tag = `[${vp.name} /]`; const context = await newContext(browser, vp); const page = await context.newPage();
      if (await gotoRoute(page, server, '/', c, tag)) await homeChecks(page, vp, c, tag);
      await context.close();
    }
    for (const e of EXCLUDED) c.note(`EXCLUDED ${e.nos}: ${e.excluded}`);
    c.note(`WS-1: ${STD.ws1.ticketEdge}`);
    c.note(`NEEDS PHOTO (Brad photography need, ${needsPhoto.length}): ${needsPhoto.join(' ')}`);
    for (const r of RETIRED) {
      let res = null; try { res = await fetch(`${server.nos}${r.from}`, { redirect: 'manual', headers: { authorization: AUTH } }); } catch (e) { c.check(`[retired ${r.from}] answers`, false, e.message); }
      if (res) { const loc = res.headers.get('location'); const u = loc ? new URL(loc, server.nos) : null; c.check(`[retired ${r.from}] still returns a ${r.status} (or Next's permanent 308) to ${r.to} on the gate origin (${res.status} ${loc})`, (res.status === r.status || (r.status === 301 && res.status === 308)) && u !== null && u.pathname === r.to && u.origin === new URL(server.nos).origin); }
    }
    for (const route of ROUTES) {
      for (const vp of STD.viewports) {
        const tag = `[${vp.name} ${route.nos}]`;
        const context = await newContext(browser, vp);
        const page = await context.newPage();
        const res = await gotoRoute(page, server, route.nos, c, tag);
        if (!res) { await context.close(); continue; }
        c.check(`${tag} responds 200`, res?.status() === 200, String(res?.status()));
        if (res?.status() !== 200) { await context.close(); continue; }
        await page.waitForSelector('[data-doc-layout], [data-programme-body]', { timeout: 15000 }).catch(() => {});
        { const body = await page.evaluate(() => document.body.textContent.replace(/\s+/g, ' ')); for (const b of BANNED) c.check(`${tag} the banned string "${b.text}" never renders`, !body.includes(b.text), b.why); }
        await routeFactsChecks(page, route, vp, c, tag);
        { const wosaTheme = await page.evaluate(() => [...document.querySelectorAll('[data-ticket-card]')].filter((k) => /WOSA/i.test(k.textContent) && !/symposium/i.test(k.querySelector('h2, h3')?.textContent ?? '')).reduce((n, k) => n + k.querySelectorAll('.nk-theme').length, 0)); c.check(`${tag} the WOSA ticket card has no theme line (.nk-theme) until Lee-Ann supplies one (${wosaTheme})`, wosaTheme === 0); }

        const m = await page.evaluate(({ vpW, aside }) => {
          const r = (e) => { const b = e.getBoundingClientRect(); return { top: b.top + scrollY, bottom: b.bottom + scrollY, left: b.left, right: b.right, w: b.width, h: b.height }; };
          const doc = document.querySelector('[data-doc-layout], [data-programme-body]');
          const sub = document.querySelector('.nos-subnav'); const hero = document.querySelector('section[data-nos-hero]');
          const anchor = sub ?? hero;
          const kids = doc ? [...doc.querySelectorAll('h2, h3, p, [data-doc-aside], [data-doc-main] > *')].filter((e) => e.getBoundingClientRect().height > 0) : [];
          const main = document.querySelector('[data-doc-main]'); const asideEl = document.querySelector('[data-doc-aside]');
          const prose = document.querySelector('main .doc-prose p');
          const probe = prose ? Object.assign(document.createElement('span'), { style: 'width:1ch;display:inline-block;position:absolute;visibility:hidden' }) : null;
          if (probe) prose.parentElement.appendChild(probe);
          const ch = probe ? probe.getBoundingClientRect().width : 0; probe?.remove();
          const wrap = document.querySelector('[data-doc-layout] [data-nos-wrap], [data-doc-layout]');
          const wcs = wrap ? getComputedStyle(wrap) : null;
          const h1s = [...document.querySelectorAll('h1')];
          // Scoped to the main column; the footer show index (nav.nos-index), aside and card headings are not prose headings unless a golden specifies them.
          const EXCL = '[data-venue-card], [data-doc-aside], aside, [data-ticket-card], [data-card], nav, .nos-index, footer, [data-we-card], [data-ct-card], [data-hm-visit-card], [data-guest-profile], [data-conference-row]';
          const scope = document.querySelector('[data-doc-main]') ?? document.querySelector('main');
          const h2s = [...scope.querySelectorAll('h2')].filter((h) => !h.closest(EXCL) && !h.classList.contains('sr-only'));
          const proseH3 = () => [...scope.querySelectorAll('h3')].find((h) => !h.closest(EXCL)) ?? null;
          const cs = (e) => (e ? { fam: getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').toLowerCase(), w: getComputedStyle(e).fontWeight, px: parseFloat(getComputedStyle(e).fontSize) } : null);
          const bold = [...document.querySelectorAll('main p')].filter((p) => p.children.length === 1 && /^(STRONG|B)$/.test(p.firstElementChild.tagName) && p.textContent.trim() === p.firstElementChild.textContent.trim()).length;
          const eyebrow = [...document.querySelectorAll('main h2, main h3')].filter((h) => { const p = h.previousElementSibling; if (!p) return false; const s = getComputedStyle(p); return s.textTransform === 'uppercase' && parseFloat(s.fontSize) <= 13 && p.textContent.trim().length < 40; }).length;
          const sideBorder = [...document.querySelectorAll('main *')].filter((e) => { const s = getComputedStyle(e); return ['Left', 'Right'].some((k) => parseFloat(s[`border${k}Width`]) > 1 && s[`border${k}Style`] !== 'none' && s[`border${k}Color`] !== 'rgba(0, 0, 0, 0)'); }).length;
          const nested = document.querySelectorAll('main .nos-surface .nos-surface, main .nos-card .nos-card, main [data-doc-aside] [data-doc-aside]').length;
          const pills = [...document.querySelectorAll('main a, main button, main summary')].filter((e) => { const b = e.getBoundingClientRect(); if (!b.width || !b.height) return false; const rad = parseFloat(getComputedStyle(e).borderTopLeftRadius) || 0; return rad > 0 && rad >= Math.min(b.width, b.height) / 2 - 1; }).length;
          const small = [...document.querySelectorAll('main a, main button, main summary')].filter((e) => { const b = e.getBoundingClientRect(); if (!b.width || !b.height) return false; const inIdx = e.closest('nav[data-doc-index]'); return b.height + 0.5 < (inIdx ? 44 : 24); }).map((e) => e.textContent.trim().slice(0, 24));
          return {
            hasDoc: Boolean(doc), anchorBottom: anchor ? r(anchor).bottom : null, hasSub: Boolean(sub),
            firstTop: kids.length ? Math.min(...kids.map((e) => r(e).top)) : null,
            h1: h1s.length, h1Text: h1s[0]?.textContent.trim().replace(/\s+/g, ' '), h2Texts: h2s.map((h) => h.textContent.trim().replace(/\s+/g, ' ')),
            variant: hero?.getAttribute('data-nos-hero-variant'), hasImg: Boolean(document.querySelector('section[data-nos-hero] [data-nos-hero-media] img')),
            main: main ? r(main) : null, aside: asideEl ? { ...r(asideEl), pos: getComputedStyle(asideEl).position, cssTop: getComputedStyle(asideEl).top, kind: asideEl.getAttribute('data-doc-aside-kind'), first: Boolean(main && (asideEl.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING)), count: document.querySelectorAll('[data-doc-aside]').length } : null,
            proseW: prose ? prose.getBoundingClientRect().width : null, chars: prose && ch ? prose.getBoundingClientRect().width / ch : null,
            wrapInner: wrap ? r(wrap).w - parseFloat(wcs.paddingLeft) - parseFloat(wcs.paddingRight) : null, wrapLeft: wrap ? r(wrap).left + parseFloat(wcs.paddingLeft) : null,
            h2: cs(h2s[0]), h2Rec: cs(scope.querySelector('[data-edition-record] h2')), h3: cs(proseH3()), bold, eyebrow, sideBorder, nested, pills, small,
            sw: document.documentElement.scrollWidth, iw: innerWidth, hasFacts: Boolean(document.querySelector('[data-hero-facts]')),
            indexNav: document.querySelector('nav[data-doc-index]') ? { ox: getComputedStyle(document.querySelector('nav[data-doc-index]').querySelector('ul') ?? document.body).overflowX } : null,
            vpW, wantAside: aside,
          };
        }, { vpW: vp.width, aside: route.aside });
        if (route.layout === 'hero-only') {
          c.check(`${tag} exactly one h1`, m.h1 === 1, String(m.h1));
          await heroOnlyChecks(page, route, vp, c, tag); await extraChecks(page, route, vp, c, tag); await factsGrammar(page, vp, c, tag);
          if (route.photo) { c.check(`${tag} photo hero`, m.hasImg && m.variant === 'photo', String(m.variant)); await heroSharpness(page, route, vp, c, tag); }
          await context.close(); continue;
        }
        c.check(`${tag} [data-doc-layout] exists`, m.hasDoc);
        if (!m.hasDoc) { await context.close(); continue; }
        c.check(`${tag} exactly one h1`, m.h1 === 1, String(m.h1));
        c.check(`${tag} no h2 repeats the h1`, !m.h2Texts.includes(m.h1Text), m.h1Text);
        c.check(`${tag} gap ${Math.round((m.firstTop - m.anchorBottom) * 10) / 10} == ${wantGap(vp.width)}`, Math.abs(m.firstTop - m.anchorBottom - wantGap(vp.width)) <= STD.gap.tolerancePx);
        c.check(`${tag} no horizontal page scroll`, m.sw <= m.iw);
        c.check(`${tag} no <p> whose sole child is <strong>`, m.bold === 0, String(m.bold));
        c.check(`${tag} no eyebrow above a heading`, m.eyebrow === 0, String(m.eyebrow));
        c.check(`${tag} no coloured side border > 1px`, m.sideBorder === 0, String(m.sideBorder));
        c.check(`${tag} no nested cards`, m.nested === 0, String(m.nested));
        c.check(`${tag} no pills`, m.pills === 0, String(m.pills));
        c.check(`${tag} targets (index 44, other 24)`, m.small.length === 0, m.small.slice(0, 3).join('; '));
        if (route.photo) {
          c.check(`${tag} photo hero`, m.hasImg && m.variant === 'photo', String(m.variant));
          await heroSharpness(page, route, vp, c, tag);
          if (vp.width >= 1024) await heroRampCheck(page, tag, c);
          if (vp.width === 1440 || vp.width === 2056) await heroTextContrast(page, tag, c);
        } else c.note(`${tag} NEEDS PHOTO (hero rendered as variant ${m.variant}); listed, not passed silently`);

        if (route.h2Spec && route.h2SpecScope === 'record') {
          // AR-1: the 25px applies to the edition-title h2 of a record row; the empty state (no records) and the sr-only list heading are not edition titles.
          if (m.h2Rec) c.check(`${tag} edition-title h2 follows the route golden ${route.h2Spec.golden}: ${route.h2Spec.family} ${route.h2Spec.weight} ${route.h2Spec.px}px (${m.h2Rec.fam} ${m.h2Rec.w} ${m.h2Rec.px})`, m.h2Rec.fam.includes(route.h2Spec.family) && m.h2Rec.w === route.h2Spec.weight && Math.abs(m.h2Rec.px - route.h2Spec.px) <= STD.heading.tolerancePx);
          else c.note(`${tag} AR-1 no [data-edition-record] rendered (preview empty state); the 25px edition-title rule has nothing to measure`);
        } else if (m.h2) {
          if (route.h2Spec) {
            // The route's own golden sets its h2 (question or title scale); it overrides the standard h2 and stays out of the cross-route identity check.
            c.check(`${tag} h2 follows the route golden ${route.h2Spec.golden}: ${route.h2Spec.family} ${route.h2Spec.weight} ${route.h2Spec.px}px (${m.h2.fam} ${m.h2.w} ${m.h2.px})`, m.h2.fam.includes(route.h2Spec.family) && m.h2.w === route.h2Spec.weight && Math.abs(m.h2.px - route.h2Spec.px) <= STD.heading.tolerancePx);
          } else {
          const key = `${vp.name}:h2`; const sig = `${m.h2.fam}/${m.h2.w}`; (typeSeen[key] ??= new Map()).set(sig, [...(typeSeen[key].get(sig) ?? []), route.nos]);
          c.check(`${tag} h2 is ${STD.heading.h2.family} ${STD.heading.h2.fontWeight} (${m.h2.fam} ${m.h2.w})`, m.h2.fam.includes(STD.heading.h2.family) && m.h2.w === STD.heading.h2.fontWeight);
          c.check(`${tag} h2 size ${m.h2.px} ~ ${h2Px(vp.width).toFixed(1)}`, Math.abs(m.h2.px - h2Px(vp.width)) <= STD.heading.tolerancePx);
          }
        }
        if (m.h3) {
          const key = `${vp.name}:h3`; const sig = `${m.h3.fam}/${m.h3.w}/${m.h3.px}`; (typeSeen[key] ??= new Map()).set(sig, [...(typeSeen[key].get(sig) ?? []), route.nos]);
          c.check(`${tag} h3 is ${STD.heading.h3.family} ${STD.heading.h3.fontWeight} ${STD.heading.h3Px}px (${m.h3.fam} ${m.h3.w} ${m.h3.px})`, m.h3.fam.includes(STD.heading.h3.family) && m.h3.w === STD.heading.h3.fontWeight && Math.abs(m.h3.px - STD.heading.h3Px) <= STD.heading.tolerancePx);
        }

        if (route.kind === 'document' && m.chars) {
          if (vp.width >= 768) c.check(`${tag} measure ${m.chars.toFixed(0)}ch in ${STD.prose.minCh}-${STD.prose.maxCh}`, m.chars >= STD.prose.minCh && m.chars <= STD.prose.maxCh);
          else c.check(`${tag} measure ${m.chars.toFixed(0)}ch <= ${STD.prose.maxCh}`, m.chars <= STD.prose.maxCh);
        }
        {
          const want = (route.aside === 'we' || route.aside === 'ct') ? 'we' : route.aside === 'none' ? null : (route.aside === 'venue' || route.aside === 'contact' || route.aside === 'content' || route.aside === 'ticket') ? 'content' : 'index';
          if (want === 'we') { /* WE-G1: the card is [data-we-card]; weChecks owns the aside */ }
          else if (route.cr) { /* CR-G1: one aside per [data-conference-row]; ticketLayoutChecks owns it */ }
          else if (!want) c.check(`${tag} listing route renders no [data-doc-aside]`, !m.aside);
          else {
            c.check(`${tag} exactly one [data-doc-aside] of kind ${want}`, Boolean(m.aside) && m.aside.count === 1 && m.aside.kind === want, JSON.stringify(m.aside && { kind: m.aside.kind, count: m.aside.count }));
            if (m.aside && vp.width >= STD.grid.minWidthForTwoColumns) {
              c.check(`${tag} aside is right of the prose column`, m.aside.left >= m.main.right - 1, `${m.aside.left} vs ${m.main.right}`);
              c.check(`${tag} aside is sticky at ${STD.grid.asideStickyTop}px`, m.aside.pos === 'sticky' && Math.abs(parseFloat(m.aside.cssTop) - STD.grid.asideStickyTop) <= STD.grid.asideStickyTopTolerance, `${m.aside.pos} ${m.aside.cssTop}`);
              const ratio = m.aside.w / m.main.w;
              c.check(`${tag} 7fr/5fr: aside/main width ${ratio.toFixed(2)} ~ 0.71`, ratio > 0.6 && ratio < 0.82);
              if (want === 'index') c.check(`${tag} the index aside is first in the DOM`, m.aside.first);
              if (vp.width >= 1440) {
                const covered = Math.max(m.main.right, m.aside.right) - Math.min(m.main.left, m.aside.left);
                const empty = 100 * (1 - covered / m.wrapInner);
                c.check(`${tag} container ${empty.toFixed(0)}% empty <= ${STD.grid.maxEmptyPctOfContainerAt1440}%`, empty <= STD.grid.maxEmptyPctOfContainerAt1440);
              }
            } else if (m.aside && route.aside === 'ticket') c.check(`${tag} the ticket-card aside comes first below 1024 (ticket first): aside bottom ${Math.round(m.aside.bottom)} <= main top ${Math.round(m.main.top)}`, m.aside.bottom <= m.main.top + 1);
            else if (m.aside && want === 'content') c.check(`${tag} content aside follows the main column`, m.aside.top >= m.main.bottom - 1);
            else if (m.aside) await scrollerChecks(page, vp, c, tag);
          }
        }
        await extraChecks(page, route, vp, c, tag);
        await factsGrammar(page, vp, c, tag);
        if (route.sp1) await sp1Checks(page, route, vp, c, tag);
        if (route.pyv) await pyvChecks(page, route, vp, c, tag);
        if (route.pg) await programmeChecks(page, route, vp, c, tag);
        if (route.sx) await sxChecks(page, route, vp, c, tag);
        if (route.ig) await igChecks(page, route, vp, c, tag);
        if (route.sy) await syChecks(page, route, vp, c, tag, server);
        if (route.wo) await woChecks(page, route, vp, c, tag, server);
        if (route.wk) await wkChecks(page, route, vp, c, tag);
        if (route.cr) await crChecks(page, route, vp, c, tag);
        if (route.ab) await abChecks(page, route, vp, c, tag);
        if (route.we) await weChecks(page, route, vp, c, tag, server);
        if (route.ex) await exChecks(page, route, vp, c, tag);
        if (route.aside === 'ticket') await ticketLayoutChecks(page, vp, c, tag, Boolean(route.cr));
        if (route.ct) await ctChecks(page, route, vp, c, tag);
        if (route.ar) await arChecks(page, route, vp, c, tag);
        c.check(`${tag} NL-2 "${STD.navRenamed.from}" is not rendered anywhere in the public page (body, title, meta description); her label is "${STD.navRenamed.to}"`, !(await page.evaluate((t) => [document.body.textContent.replace(/\s+/g, ' '), document.title, ...[...document.querySelectorAll('meta[name="description"], meta[property="og:description"], meta[property="og:title"]')].map((e) => e.getAttribute('content') ?? '')].some((x) => x.includes(t)), STD.navRenamed.from)));
        c.check(`${tag} NAV-G1 the unsourced Workshops line (prefix "${STD.navDroppedPrefix}") is in neither the rendered body nor <meta name="description"> / og:description`, !(await page.evaluate((t) => [document.body.textContent.replace(/\s+/g, ' '), ...[...document.querySelectorAll('meta[name="description"], meta[property="og:description"]')].map((e) => e.getAttribute('content') ?? '')].some((x) => x.includes(t)), STD.navDroppedPrefix)));
        if (route.noUpscale) await noUpscaleChecks(page, vp, c, tag);

        // focus ring on the h1
        const ring = await page.evaluate(() => { const h = document.querySelector('h1'); if (!h) return null; h.setAttribute('tabindex', h.getAttribute('tabindex') ?? '-1'); h.focus(); const s = getComputedStyle(h); return { active: document.activeElement === h, os: s.outlineStyle, ow: parseFloat(s.outlineWidth), sh: s.boxShadow, tab: h.getAttribute('tabindex') }; });
        if (ring) c.check(`${tag} focused h1 paints no outline or shadow (${ring.os} ${ring.ow}px, ${ring.sh})`, (ring.os === 'none' || ring.ow === 0) && ring.sh === 'none');
        await context.close();
      }

      // sharpness at 2056@2 (DS-1: need >= 4112) for photo routes
      if (route.noUpscale) {
        const vp = { name: '2056@2', width: 2056, height: 1200, dsf: 2 };
        const context = await newContext(browser, vp); const page = await context.newPage();
        if (await gotoRoute(page, server, route.nos, c, `[${vp.name} ${route.nos}]`)) await noUpscaleChecks(page, vp, c, `[${vp.name} ${route.nos}]`);
        await context.close();
      }
      if (route.photo) {
        const vp = { name: '2056@2', width: 2056, height: 1200, dsf: 2 };
        const context = await newContext(browser, vp); const page = await context.newPage();
        if (!(await gotoRoute(page, server, route.nos, c, `[${vp.name} ${route.nos}]`))) { await context.close(); continue; }
        await heroSharpness(page, route, vp, c, `[${vp.name} ${route.nos}]`);
        await extraChecks(page, route, vp, c, `[${vp.name} ${route.nos}]`);
        await factsGrammar(page, vp, c, `[${vp.name} ${route.nos}]`);
        await context.close();
      }

      if ((ROUTE_TABLE_META.cardImageRoutes ?? []).includes(route.nos)) {
        const vp = { name: '2056@2', width: 2056, height: 1200, dsf: 2 };
        const context = await newContext(browser, vp); const page = await context.newPage();
        if (!(await gotoRoute(page, server, route.nos, c, `[${vp.name} ${route.nos}]`))) { await context.close(); continue; }
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(500);
        await cardImageChecks(page, vp, c, `[${vp.name} ${route.nos} cards]`);
        await context.close();
      }
      // first screen (facts, sub-nav, first h2)
      for (const vp of STD.firstScreen) {
        const tag = `[first-screen ${vp.name} ${route.nos}]`;
        const context = await newContext(browser, vp); const page = await context.newPage();
        if (!(await gotoRoute(page, server, route.nos, c, tag))) { await context.close(); continue; }
        const f = await page.evaluate(() => ({ ih: innerHeight, sub: document.querySelector('.nos-subnav')?.getBoundingClientRect().bottom ?? null, h2: document.querySelector('main h2')?.getBoundingClientRect() ?? null,
          facts: [...document.querySelectorAll('[data-hero-facts] dd, [data-hero-facts] dt')].map((e) => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; }), count: document.querySelectorAll('[data-hero-facts] dd').length,
          dd: document.querySelector('[data-hero-facts] dd') ? (() => { const s = getComputedStyle(document.querySelector('[data-hero-facts] dd')); return { fam: s.fontFamily.toLowerCase(), w: s.fontWeight }; })() : null }));
        if (f.count > 0 || (route.keyFacts ?? []).length > 0) {
          c.check(`${tag} ${STD.facts.min}-${STD.facts.max} facts (${f.count})`, f.count >= STD.facts.min && f.count <= STD.facts.max);
          c.check(`${tag} every fact box is fully inside the first viewport`, f.facts.length > 0 && f.facts.every((b) => b.top >= 0 && b.bottom <= f.ih && b.left >= 0 && b.right <= vp.width), JSON.stringify(f.facts.find((b) => b.bottom > f.ih)));
          if (f.dd) c.check(`${tag} fact values are Fraunces 300`, f.dd.fam.includes('fraunces') && f.dd.w === '300', JSON.stringify(f.dd));
        }
        if (vp.width === 1440 && route.sp1) {
          const fold = await page.evaluate(() => { const r = (e) => (e ? e.getBoundingClientRect().bottom : null); const sf = document.querySelector('[data-doc-main] p'); const ab = document.querySelector('[data-doc-aside] a[class*="btn"], [data-doc-aside] a'); return { ih: innerHeight, facts: r(document.querySelector('[data-hero-facts]')), sub: r(document.querySelector('.nos-subnav')), sf: r(sf), ab: r(ab) }; });
          c.check(`${tag} SP-1 at 1440x900 the hero facts, sub-nav, standfirst and aside button are above the fold (${JSON.stringify(fold)})`, [fold.facts, fold.sub, fold.sf, fold.ab].every((v) => v !== null && v <= fold.ih));
        }
        if (vp.width === 1440) {
          if (f.sub !== null) c.check(`${tag} sub-nav is visible (bottom ${Math.round(f.sub)} <= ${f.ih})`, f.sub <= f.ih);
          if (f.h2) {
            const tk = route.aside === 'ticket' ? await page.evaluate(() => { const e = document.querySelector('[data-ticket-card]'); return e ? e.getBoundingClientRect().top : null; }) : null;
            const h2In = f.h2.top < f.ih || Boolean(route.pyv); const tkIn = tk !== null && tk < f.ih - 24;
            c.check(`${tag} the first h2 top is under the fold line (top ${Math.round(f.h2.top)} < ${f.ih})${route.pyv ? '; /plan-your-visit is exempt: PYV-1 places the standfirst and three intro paragraphs before "The venue"' : ''}${route.aside === 'ticket' ? `, or on a ticket route the ticket card is the first section and is above the fold (card top ${tk === null ? 'none' : Math.round(tk)})` : ''}`, h2In || tkIn);
          }
          if (route.aside !== 'none' && route.aside !== 'we' && route.aside !== 'ct' && route.aside !== 'ticket' && route.aside !== 'venue' && route.aside !== 'contact' && route.aside !== 'content') {
            const card = await page.evaluate(() => { const e = document.querySelector('[data-doc-aside]'); if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom }; });
            c.check(`${tag} the index card is above the fold on load`, Boolean(card) && card.top < f.ih - 24, JSON.stringify(card));
          }
        }
        await context.close();
      }

      // focus after client navigation: click the first sub-nav link that is not the current page
      {
        const vp = STD.firstScreen[0]; const context = await newContext(browser, vp); const page = await context.newPage();
        if (!(await gotoRoute(page, server, route.nos, c, `[first-screen-nav ${route.nos}]`))) { await context.close(); continue; }
        const target = await page.evaluate(() => { const a = [...document.querySelectorAll('.nos-subnav a')].find((x) => !x.hasAttribute('aria-current')); return a ? a.getAttribute('href') : null; });
        if (target) {
          await page.locator(`.nos-subnav a[href="${target}"]`).first().click();
          await page.waitForURL((u) => u.pathname === target || u.pathname.endsWith(target), { timeout: 15000 }).catch(() => {});
          await page.waitForTimeout(400);
          const o = await page.evaluate(() => { const h = document.querySelector('h1'); const s = h ? getComputedStyle(h) : null; return h ? { active: document.activeElement === h, os: s.outlineStyle, ow: parseFloat(s.outlineWidth), sh: s.boxShadow, bd: s.borderTopWidth } : null; });
          c.check(`[after client navigation from ${route.nos} to ${target}] no ring is painted on the h1 (${JSON.stringify(o)})`, o !== null && (o.os === 'none' || o.ow === 0) && o.sh === 'none');
        }
        await context.close();
      }
    }
    for (const [key, seen] of Object.entries(typeSeen)) c.check(`${key} computed style is identical across routes (${[...seen.entries()].map(([sig, rs]) => `${sig}: ${[...new Set(rs)].join(' ')}`).join(' | ')})`, seen.size === 1);
  } finally { await browser.close(); }
}, { preview: true });
