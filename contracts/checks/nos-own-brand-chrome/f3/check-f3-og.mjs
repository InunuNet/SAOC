// F3-J3 og card (NOS Design J3, Acceptance bar rev 2: the build serves the generic dark-green SAOC /og card, so this fails today).
// Every NOS route's og:image is a NOS card, measured on the real PNG (goldens/f3/og-spec.json):
//   1200x630 (response pixels AND og:image:width / og:image:height); royal #211A57 ground (right-edge strip is all ground, no gradient, no green);
//   the supplied reversed NOS horizontal lockup top-left at about 560px wide (ink 470..600px wide, ink aspect of the supplied file, undistorted);
//   the page title in light type below it (Fraunces 300, not measurable from pixels: source-checked in F3 static `og-source`);
//   "saoc.co.za/national-show" in 12px Karla gold bottom-left (warm cream pixels present); never the SAOC card: not byte-identical to the
//   SAOC /og card, none of the SAOC greens, and one distinct image per distinct page title.
// og:image URLs are absolute against the production origin, so only pathname + search are kept and fetched from NOS_BASE.
import { BASE, allRoutes, readGolden, main, openPage, withBrowser, VP_DESKTOP } from './_f3lib.mjs';

const meta = (html, prop) => {
  const tag = new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]*>`, 'i').exec(html)?.[0] ?? '';
  return /content="([^"]*)"/i.exec(tag)?.[1]?.replace(/&amp;/g, '&') ?? null;
};
const local = (u) => { const x = new URL(u, BASE); return `${BASE}${x.pathname}${x.search}`; };

async function sample(page, url, spec) {
  return page.evaluate(async ({ url, spec }) => {
    const res = await fetch(url);
    const ct = res.headers.get('content-type') ?? '';
    const buf = await res.arrayBuffer();
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    const hash = [...new Uint8Array(hashBuf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    if (!res.ok || !/^image\/(png|jpeg)/.test(ct)) return { status: res.status, ct, hash };
    const bmp = await createImageBitmap(new Blob([buf], { type: ct }));
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    const { width: W, height: H } = c;
    const d = ctx.getImageData(0, 0, W, H).data;
    const px = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const ground = spec.ground;
    // right-edge strip: share of pixels that are exactly the ground
    let strip = 0, stripGround = 0;
    for (let y = 0; y < H; y++) for (let x = Math.max(0, W - 60); x < W; x++) { strip++; if (dist(px(x, y), ground) <= 3) stripGround++; }
    // lockup ink bbox: the first block of ink rows (x < 720) from the top, ended by a 24px band with no ink (the title sits below that band)
    let minX = W, maxX = -1, minY = -1, maxY = -1, empty = 0;
    for (let y = 0; y < H - 90; y++) {
      let rowInk = false;
      for (let x = 0; x < Math.min(W, 720); x++) if (dist(px(x, y), ground) > 40) { rowInk = true; if (x < minX) minX = x; if (x > maxX) maxX = x; }
      if (rowInk) { if (minY < 0) minY = y; maxY = y; empty = 0; } else if (minY >= 0 && ++empty >= 24) break;
    }
    // title zone: light pixels between the lockup block and the url line
    let title = 0;
    for (let y = Math.max(0, maxY + 1); y < H - 90; y++) for (let x = 40; x < Math.min(W, 1100); x++) if (dist(px(x, y), ground) > 120) title++;
    // url zone: bottom-left; brightest pixel
    let urlInk = 0, bright = [0, 0, 0], brightL = -1;
    for (let y = Math.max(0, H - 90); y < H; y++) for (let x = 0; x < Math.min(W, 520); x++) { const p = px(x, y); if (dist(p, ground) > 60) { urlInk++; const l = p[0] + p[1] + p[2]; if (l > brightL) { brightL = l; bright = p; } } }
    // SAOC greens anywhere
    let green = 0;
    for (let i = 0; i < d.length; i += 4) { const p = [d[i], d[i + 1], d[i + 2]]; if (spec.saocGreens.some((g) => dist(p, g) < 20)) green++; }
    return { status: res.status, ct, hash, W, H, strip, stripGround, ink: maxX >= 0 ? { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 } : null, title, urlInk, bright, corner: px(5, 5), green };
  }, { url, spec });
}

await main('F3-J3 og', async (r) => {
  const spec = readGolden('og-spec.json');
  await withBrowser(async (browser) => {
    const routes = await allRoutes(browser);
    const { ctx, page } = await openPage(browser, VP_DESKTOP, '/about');
    const saocHtml = await (await fetch(`${BASE}/about`)).text();
    const saocUrl = meta(saocHtml, 'og:image');
    if (!saocUrl) { r.fail('/about has no og:image to compare against'); await ctx.close(); return; }
    const saoc = await sample(page, local(saocUrl), spec);
    r.note(`SAOC /about og: ${saocUrl} -> ${saoc.W}x${saoc.H} corner ${saoc.corner}`);
    const byTitle = new Map();
    for (const route of routes) {
      const res = await fetch(`${BASE}${route}`);
      const tag = route;
      if (res.status !== 200) { r.fail(`${tag}: HTTP ${res.status}`); continue; }
      const html = await res.text();
      const url = meta(html, 'og:image');
      if (!url) { r.fail(`${tag}: no og:image meta`); continue; }
      const mw = Number(meta(html, 'og:image:width')), mh = Number(meta(html, 'og:image:height'));
      if (mw !== spec.width || mh !== spec.height) r.fail(`${tag}: og:image:width/height ${mw}x${mh}, want ${spec.width}x${spec.height}`);
      const tw = meta(html, 'twitter:image');
      if (!tw) r.fail(`${tag}: no twitter:image meta`);
      else if (new URL(tw, BASE).pathname + new URL(tw, BASE).search !== new URL(url, BASE).pathname + new URL(url, BASE).search) r.fail(`${tag}: twitter:image ${tw} differs from og:image ${url}`);
      const s = await sample(page, local(url), spec);
      if (!s.W) { r.fail(`${tag}: og:image ${url} answers ${s.status} ${s.ct}, not a PNG/JPEG`); continue; }
      if (s.W !== spec.width || s.H !== spec.height) r.fail(`${tag}: og image is ${s.W}x${s.H}, want ${spec.width}x${spec.height}`);
      if (s.hash === saoc.hash) r.fail(`${tag}: og image is byte-identical to the SAOC /og card`);
      if (s.stripGround / s.strip < 0.995) r.fail(`${tag}: right-edge strip is ${(100 * s.stripGround / s.strip).toFixed(1)}% royal ground, want >=99.5% (royal #211A57, no gradient or decoration)`);
      if (s.green > 20) r.fail(`${tag}: ${s.green} pixels in the SAOC green palette; the NOS card is never green`);
      if (!s.ink) r.fail(`${tag}: no lockup ink in the top-left block`);
      else {
        const { w, h, minX, minY } = s.ink;
        if (w < spec.lockup.inkWidthMin || w > spec.lockup.inkWidthMax) r.fail(`${tag}: lockup ink is ${w}px wide, want ${spec.lockup.inkWidthMin}..${spec.lockup.inkWidthMax}px (about 560px wide)`);
        if (Math.abs(w / h - spec.lockup.inkAspect) > spec.lockup.inkAspectTol) r.fail(`${tag}: lockup ink aspect ${(w / h).toFixed(2)}, want ${spec.lockup.inkAspect} +-${spec.lockup.inkAspectTol} (the supplied file, undistorted)`);
        if (minX < spec.lockup.leftMin || minX > spec.lockup.leftMax || minY < spec.lockup.topMin || minY > spec.lockup.topMax) r.fail(`${tag}: lockup ink starts at (${minX}, ${minY}), want top-left within x ${spec.lockup.leftMin}..${spec.lockup.leftMax}, y ${spec.lockup.topMin}..${spec.lockup.topMax}`);
      }
      if (s.title < spec.titleMinInkPixels) r.fail(`${tag}: ${s.title} light title pixels below the lockup, want >=${spec.titleMinInkPixels}`);
      const [br, bg, bb] = s.bright;
      if (s.urlInk < spec.url.minInkPixels || !(br >= 200 && bg >= 200 && bb >= 150 && bb <= 235 && br - bb >= 10 && br - bb <= 70)) r.fail(`${tag}: "${spec.url.text}" line not found in gold bottom-left (ink ${s.urlInk}px, brightest rgb(${s.bright}))`);
      const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? route;
      byTitle.set(title, [...(byTitle.get(title) ?? []), { route, hash: s.hash }]);
    }
    const hashes = new Map();
    for (const [title, rows] of byTitle) {
      const h = rows[0].hash;
      if (hashes.has(h)) r.fail(`og image for "${title}" (${rows[0].route}) is identical to the one for "${hashes.get(h)}"; the page title is drawn per route`);
      else hashes.set(h, title);
    }
    await ctx.close();
  });
});
