// F1d: the SERVER HTML (no JavaScript executed) already carries the hero <img> with fetchpriority=high and its matching preload; the header
// lockup is not prioritised but stays loading="eager" with the default fetchpriority. Reads DC_BASE_URL (beta credentials from the environment,
// never printed); with no DC_BASE_URL it starts the local fixture server like the browser checks.
import { withSite, check, finish } from './lib.mjs';
const tag = (html, re) => (html.match(re) || [null])[0];
await withSite(async ({ base, deployed }) => {
  const user = process.env.BETA_BASIC_AUTH_USER; const pass = process.env.BETA_BASIC_AUTH_PASSWORD;
  const headers = process.env.DC_BASE_URL && user && pass ? { Authorization: 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64') } : {};
  for (const path of deployed ? ['/', '/about'] : ['/about']) {
    const res = await fetch(base + path, { headers }); const html = await res.text(); const w = path;
    check(res.status === 200, `${w} status ${res.status}`);
    const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
    const heroImg = imgs.find((t) => /data-nimg="fill"/.test(t) && !/emblem|footer/.test(t) && !/loading="lazy"/.test(t));
    const high = imgs.filter((t) => /fetchpriority="high"/i.test(t));
    check(high.length === 1, `${w}: ${high.length} <img fetchpriority="high"> in the server HTML, want exactly 1 (the hero)`);
    check(!!heroImg && /fetchpriority="high"/i.test(heroImg), `${w}: the hero <img> in the server HTML lacks fetchpriority="high"`);
    const pre = [...html.matchAll(/<link\b[^>]*rel="preload"[^>]*as="image"[^>]*>/gi)].map((m) => m[0]);
    check(pre.length === 1 && /imagesrcset=/i.test(pre[0] ?? '') && /imagesizes=/i.test(pre[0] ?? ''), `${w}: want exactly one image preload with imagesrcset+imagesizes in the server HTML, found ${pre.length}`);
    const lockup = imgs.find((t) => /saoc-lockup/.test(t));
    check(!!lockup, `${w}: header lockup <img> missing`);
    if (lockup) { check(!/fetchpriority="high"/i.test(lockup), `${w}: lockup still has fetchpriority=high`); check(!/loading="lazy"/i.test(lockup), `${w}: lockup is loading=lazy, must be eager`); check(/loading="eager"/i.test(lockup), `${w}: lockup lacks explicit loading="eager"`); }
  }
});
finish('hero-html');
