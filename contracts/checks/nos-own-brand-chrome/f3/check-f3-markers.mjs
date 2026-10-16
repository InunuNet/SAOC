// F3 acceptance-bar corrections from NOS Design (2026-10-16), measured on every NOS route:
//  D3 focus (R9/3)  : keyboard focus ring is 2px solid, 2px offset. Violet #7E3F97 on pale/light grounds, pale gold #FBFAF0 on royal/dark grounds.
//                     --ring-focus-on-light stays violet; it is NOT royal-on-light. Resolved ring colour is checked against the ground it sits on.
//  R19 status marker: every [data-confirmation-badge] / [data-exhibitor-marker] is a pill (radius >= half height) with a 1px SOLID line,
//                     Karla 700 12px .14em uppercase, never mono; it is attached to the head of ONE low-tint surface per governed extent (16px radius,
//                     lightest shadow, no border); a surface carries one marker. No dashed border or outline anywhere in <main> (the per-section
//                     dashed rails of audit S3 are replaced).
//  Measure          : running copy <= 60ch; presenter bios (inside ul.pc-grid) <= 68ch.
// The SAOC counterpart (StatusMarker shared with /events and /societies stays byte-identical) is check-f3-saoc-computed.mjs.
import { allRoutes, main, openPage, withBrowser, rgbOf, rgbNear, firstFamily, ROYAL_RGB, LINE_RGB } from './_f3lib.mjs';

const VIOLET = [126, 63, 151]; // #7E3F97
const PALE_GOLD = [251, 250, 240]; // #FBFAF0
const TABS = 14;
const MEASURE_BODY = 60;
const MEASURE_BIO = 68;

function groundAt(e) {
  for (let x = e; x; x = x.parentElement) {
    const m = getComputedStyle(x).backgroundColor.match(/[\d.]+/g);
    if (m && (m.length < 4 || Number(m[3]) > 0.5)) return m.slice(0, 3).map(Number);
  }
  return [255, 255, 255];
}
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };

function focusInfo() {
  const e = document.activeElement;
  if (!e || e === document.body || e.closest('#nh, #nd, #nf')) return null;
  const s = getComputedStyle(e);
  let g = null;
  for (let x = e.parentElement; x; x = x.parentElement) { const m = getComputedStyle(x).backgroundColor.match(/[\d.]+/g); if (m && (m.length < 4 || Number(m[3]) > 0.5)) { g = m.slice(0, 3).map(Number); break; } }
  return { what: `${e.tagName.toLowerCase()} "${(e.textContent ?? '').trim().slice(0, 24)}"`, style: s.outlineStyle, w: parseFloat(s.outlineWidth), off: parseFloat(s.outlineOffset), colour: s.outlineColor, ground: g ?? [255, 255, 255] };
}

function measure() {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden'; };
  const out = { markers: [], dashed: [], prose: [], bios: [] };
  const surfaceOf = (e) => { for (let x = e.parentElement; x && x.tagName !== 'MAIN'; x = x.parentElement) { const s = getComputedStyle(x); if (s.boxShadow !== 'none') return x; } return null; };
  const surfaceCount = new Map();
  for (const m of document.querySelectorAll('[data-confirmation-badge], [data-exhibitor-marker]')) {
    if (!vis(m)) continue;
    const s = getComputedStyle(m); const r = m.getBoundingClientRect();
    const surf = surfaceOf(m);
    surfaceCount.set(surf, (surfaceCount.get(surf) ?? 0) + 1);
    const ss = surf ? getComputedStyle(surf) : null; const sr = surf ? surf.getBoundingClientRect() : null;
    out.markers.push({ text: (m.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30), bw: parseFloat(s.borderTopWidth), bs: s.borderTopStyle, bc: s.borderTopColor, radius: parseFloat(s.borderTopLeftRadius), h: r.height, family: s.fontFamily, size: parseFloat(s.fontSize), weight: Number(s.fontWeight), ls: parseFloat(s.letterSpacing), tt: s.textTransform, surfaceKey: surf ? [...surfaceCount.keys()].indexOf(surf) : -1, surface: surf ? { radius: parseFloat(ss.borderTopLeftRadius), shadow: ss.boxShadow, border: parseFloat(ss.borderTopWidth), headGap: r.top - sr.top } : null });
  }
  out.surfaceShared = [...surfaceCount.entries()].filter(([k, n]) => k && n > 1).length;
  for (const e of document.querySelectorAll('main *')) { if (!vis(e)) continue; const s = getComputedStyle(e); if ((s.borderTopStyle === 'dashed' && parseFloat(s.borderTopWidth) > 0) || (s.outlineStyle === 'dashed' && parseFloat(s.outlineWidth) > 0)) out.dashed.push(`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)}`); }
  const cv = document.createElement('canvas').getContext('2d');
  for (const p of document.querySelectorAll('main p')) {
    if (!vis(p) || (p.textContent ?? '').trim().length < 120 || p.closest('#nh, #nd, #nf')) continue;
    const s = getComputedStyle(p); cv.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    const ch = cv.measureText('0').width;
    const w = p.getBoundingClientRect().width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
    (p.closest('ul.pc-grid') ? out.bios : out.prose).push({ ch: w / ch, text: p.textContent.trim().slice(0, 28) });
  }
  return out;
}

await main('F3 markers/focus/measure', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of await allRoutes(browser)) {
      const { ctx, page, status } = await openPage(browser, { width: 1280, height: 800 }, route);
      const tag = `${route} @1280`;
      if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
      await page.waitForTimeout(200);
      const seen = new Set();
      for (let i = 0; i < TABS; i++) {
        await page.keyboard.press('Tab');
        const f = await page.evaluate(focusInfo);
        if (!f || seen.has(f.what)) continue;
        seen.add(f.what);
        const dark = lum(f.ground) < 0.2;
        const want = dark ? PALE_GOLD : VIOLET;
        if (f.style !== 'solid' || Math.abs(f.w - 2) > 0.1 || Math.abs(f.off - 2) > 0.1) r.fail(`${tag}: D3: focus on ${f.what} is ${f.w}px ${f.style} offset ${f.off}px, want 2px solid offset 2px`);
        else if (!rgbNear(rgbOf(f.colour), want, 2)) r.fail(`${tag}: D3: focus ring on ${f.what} is ${f.colour} over a ${dark ? 'dark' : 'light'} ground rgb(${f.ground.join(',')}), want ${dark ? 'pale gold #FBFAF0' : 'violet #7E3F97'} (never royal-on-light)`);
      }
      const m = await page.evaluate(measure);
      for (const k of m.markers) {
        const id = `${tag}: R19: marker "${k.text}"`;
        if (k.bw < 0.9 || k.bw > 1.1 || k.bs !== 'solid') r.fail(`${id} border is ${k.bw}px ${k.bs}, want 1px solid`);
        if (k.radius < k.h / 2 - 0.5) r.fail(`${id} radius ${k.radius}px on ${k.h.toFixed(0)}px height is not a pill`);
        if (!/karla/i.test(firstFamily(k.family)) || k.weight !== 700 || Math.abs(k.size - 12) > 0.2 || Math.abs(k.ls - 1.68) > 0.15 || k.tt !== 'uppercase') r.fail(`${id} is ${firstFamily(k.family)} ${k.weight} ${k.size}px ls ${k.ls}px ${k.tt}, want Karla 700 12px .14em uppercase (never mono)`);
        if (!k.surface) r.fail(`${id} is not attached to a low-tint shadow surface`);
        else { if (Math.abs(k.surface.radius - 16) > 0.5 || k.surface.border > 0.1) r.fail(`${id} surface is ${k.surface.radius}px radius / ${k.surface.border}px border, want 16px and no border`); if (k.surface.headGap > 96) r.fail(`${id} sits ${k.surface.headGap.toFixed(0)}px below its surface top, want attached to the head`); }
      }
      if (m.surfaceShared) r.fail(`${tag}: R19: ${m.surfaceShared} surface(s) carry more than one marker; one marker per governed extent`);
      for (const d of m.dashed) r.fail(`${tag}: R19: dashed border/outline on ${d} (the per-section dashed rails are replaced)`);
      for (const p of m.prose) if (p.ch > MEASURE_BODY + 0.5) r.fail(`${tag}: measure: "${p.text}" runs ${p.ch.toFixed(0)}ch, want <= ${MEASURE_BODY}ch`);
      for (const p of m.bios) if (p.ch > MEASURE_BIO + 0.5) r.fail(`${tag}: measure: presenter bio "${p.text}" runs ${p.ch.toFixed(0)}ch, want <= ${MEASURE_BIO}ch`);
      await ctx.close();
    }
  });
});
