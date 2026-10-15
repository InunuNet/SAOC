// Shared helpers for the nos-own-brand-chrome F2 checks (R14 type mapping + R15 hero). Run from the worktree root:
//   node --import tsx/esm contracts/checks/nos-own-brand-chrome/f2/<check>.mjs
// The server is spawned by ../_lib.mjs (`next start` on NOS_PORT, default 3617) unless NOS_REUSE_SERVER=1 with NOS_BASE.
// Every constant below is cited to the F2 golden (goldens/f2/f2-type-hero-spec.md) and through it to the approved
// mock (index.html lines) or to r14-type-mapping.md. Where the mapping and the mock CSS disagree the mock wins.
export * from '../_lib.mjs';

export const F2_GOLDEN_DIR = '.agent/memory/project/specs/nos-own-brand-chrome/goldens/f2';

// ---- hero ramp (NOS Design rulings R15/9 and R25, 2026-10-16; supersedes index.html:139 / :247 for this case) ----
// 90deg, every stop rgb(11,10,20) = --black #0B0A14 (I:21). The second stop tracks the copy column cap max-width min(640px, 50%) + 48px.
export const SCRIM_RGB = [11, 10, 20];
export const SCRIM_RAMP = { alphas: [0.92, 0.86, 0.42, 0.18, 0.06], stops: [0, 'colcap', 66, 82, 100] };
export const HUB_RAMP = SCRIM_RAMP;
export const INNER_RAMP = SCRIM_RAMP;
export const COLUMN_CAP_PX = 640; // copy column max-width min(640px, 50%) at >=1024
// Both heroes stack at <=1023px (R15/9): copy on solid black above the photo, 4:3 (16:9 between 768 and 1023), no scrim.
export const HUB_STACK_MAX = 1023;
export const INNER_STACK_MAX = 1023;
export const HUB_H1_SMALL_MAX = 700; // HANDOFF "Hub hero": at <=700px the h1 is clamp(2.8rem, 12vw, 3.4rem)
export const NARROW_MAX = 700; // facts-after-CTAs and full-width CTAs (I:307, I:318) stay at the mock's 700px
export const HERO_WIDTHS = [1280, 1100, 1024, 1023, 768, 767, 620, 390, 375];
export const INNER_H1_CH = 14; // NOS Design ruling 2026-10-15 (Q3): inner h1 max-width 14ch (the mock's 9ch, I:249, is superseded); hub 11ch, I:141
export const HUB_H1_CH = 11;

export const INK_700 = [58, 54, 84]; // #3A3654, ruling 2026-10-15 Q5 (body copy)
export const ROYAL = [33, 26, 87]; // #211A57
export const OPSZ_ALLOWED = [24, 28, 32, 36, 48, 72, 96]; // every opsz pinned in the mock CSS (:158 48, :143 28, :184 32, :171 72, :198 96, :214 36, :216 24)
export const FAMILY_OK = /^(__)?(fraunces|karla)\b/i;
export const FAMILY_BAD = /cormorant|jost|mono|jetbrains|crimson|manrope|lora|courier|menlo|consolas|sfmono/i;

const px = (n) => `${n}px`;
export const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---- in-page: every visible text-bearing element (and form control), with the computed type facts the checks need ----
export function snapshotText() {
  const out = [];
  const seen = new Set();
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (!(r.width > 2 && r.height > 2)) return false; // also drops .sr-only (1x1)
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      if (e.hasAttribute('hidden')) return false;
    }
    return true;
  };
  const push = (el) => {
    if (seen.has(el) || !visible(el)) return;
    seen.add(el);
    const cs = getComputedStyle(el);
    const hero = el.closest('[data-nos-hero]');
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: String(el.className?.baseVal ?? el.className ?? '').slice(0, 200),
      text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
      family: cs.fontFamily,
      size: parseFloat(cs.fontSize),
      weight: Number(cs.fontWeight),
      style: cs.fontStyle,
      lh: cs.lineHeight === 'normal' ? NaN : parseFloat(cs.lineHeight),
      ls: cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing),
      tt: cs.textTransform,
      fvs: cs.fontVariationSettings,
      fos: cs.fontOpticalSizing,
      fvn: cs.fontVariantNumeric,
      maxW: cs.maxWidth,
      color: cs.color,
      chrome: !!el.closest('#nh, #nd, #nf'),
      hero: hero ? hero.getAttribute('data-nos-hero') : null,
      button: !!el.closest('[data-nos-button]'),
      heroText: el.getAttribute('data-nos-hero-text') || '',
      eyebrow: el.hasAttribute('data-nos-hero-eyebrow'),
      lede: el.hasAttribute('data-nos-hero-lede'),
      h: el.getBoundingClientRect().height,
      w: el.getBoundingClientRect().width,
    });
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim() || !n.parentElement) continue;
    if (n.parentElement.closest('script, style, noscript, template')) continue;
    push(n.parentElement);
  }
  for (const el of document.querySelectorAll('input:not([type=hidden]), textarea, select, button')) push(el);
  return out;
}

export const opszOf = (fvs) => {
  const m = /"opsz"\s+([\d.]+)/.exec(fvs ?? '');
  return m ? Number(m[1]) : null;
};
export const firstFamily = (fam) => fam.split(',')[0].replace(/["']/g, '').trim();
export const isFraunces = (t) => /fraunces/i.test(firstFamily(t.family));
export const isKarla = (t) => /karla/i.test(firstFamily(t.family));

export const describe = (t) => `${t.tag}${t.cls ? '.' + t.cls.split(/\s+/).slice(0, 2).join('.') : ''} "${t.text}"`;

// ---- gradients: parse a computed linear-gradient(90deg, rgba(r, g, b, a) <pos>, ...) (stops split at top-level commas) ----
export function parseGradient(bg) {
  const inner = /linear-gradient\((.+)\)\s*$/.exec(bg)?.[1] ?? '';
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of inner) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  parts.push(cur.trim());
  const angle = parts.shift() ?? null;
  const stops = parts.map((part) => {
    const m = /^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)\s*(.+)$/.exec(part);
    return m ? { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: m[4] === undefined ? 1 : Number(m[4]), pos: m[5].trim() } : { rgb: null, a: 1, pos: part };
  });
  const nonRgb = /oklab|oklch|color\(|lab\(|lch\(|hsl|#/.test(bg);
  return { angle, stops, nonRgb };
}

// A stop position as a fraction of the hero width: 0px / 0, 66%, px, or the column-cap calc (48px + min(640px, 50%)).
function posFraction(pos, heroWidth) {
  const t = pos.replace(/\s+/g, '');
  let m = /^([\d.]+)%$/.exec(t);
  if (m) return Number(m[1]) / 100;
  m = /^([\d.]+)(px)?$/.exec(t);
  if (m) return Number(m[1]) / heroWidth;
  if (/^calc\((48px\+min\(640px,50%\)|min\(640px,50%\)\+48px)\)$/.test(t)) return (Math.min(COLUMN_CAP_PX, 0.5 * heroWidth) + 48) / heroWidth;
  return NaN;
}

// Judge one scrim gradient against a ramp. Returns a list of problem strings (empty = matches).
export function judgeRamp(bg, ramp, label, heroWidth) {
  const g = parseGradient(bg);
  const bad = [];
  if (g.nonRgb) bad.push(`${label}: stops are not literal rgba() (got "${bg.slice(0, 100)}")`);
  if (g.angle !== '90deg') bad.push(`${label}: angle ${g.angle}, want 90deg`);
  if (g.stops.length !== ramp.alphas.length) bad.push(`${label}: ${g.stops.length} stops, want ${ramp.alphas.length}`);
  g.stops.forEach((st, i) => {
    if (!st.rgb || !st.rgb.every((c, k) => Math.abs(c - SCRIM_RGB[k]) <= 1)) bad.push(`${label}: stop ${i} rgb(${st.rgb}) is not near-black rgb(${SCRIM_RGB}) (never purple)`);
    if (ramp.alphas[i] !== undefined && !near(st.a, ramp.alphas[i], 0.006)) bad.push(`${label}: stop ${i} alpha ${st.a}, want ${ramp.alphas[i]}`);
    const want = ramp.stops[i];
    if (want === undefined) return;
    const got = posFraction(st.pos, heroWidth);
    const wantFrac = want === 'colcap' ? (Math.min(COLUMN_CAP_PX, 0.5 * heroWidth) + 48) / heroWidth : want / 100;
    if (!(Math.abs(got - wantFrac) * heroWidth <= 1.5)) bad.push(`${label}: stop ${i} at "${st.pos}", want ${want === 'colcap' ? 'calc(min(640px, 50%) + 48px)' : want + '%'} (${(wantFrac * heroWidth).toFixed(0)}px of ${heroWidth.toFixed(0)}px)`);
  });
  return bad;
}

// ---- in-page: everything the hero checks measure ----
export function heroInfo() {
  const hero = document.querySelector('[data-nos-hero]');
  if (!hero) return null;
  const hs = getComputedStyle(hero);
  const R = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left, right: r.right, width: r.width, height: r.height };
  };
  const rendered = (el) => el.getClientRects().length > 0;
  const gradients = [];
  for (const el of [hero, ...hero.querySelectorAll('*')]) {
    if (!rendered(el)) continue;
    for (const pseudo of [null, '::before', '::after']) {
      const cs = getComputedStyle(el, pseudo);
      if (!/gradient/.test(cs.backgroundImage)) continue;
      if (pseudo && (cs.content === 'none' || cs.content === 'normal' || cs.content === '')) continue;
      if (Number(cs.opacity) === 0 || cs.visibility === 'hidden') continue;
      gradients.push({ where: `${el.tagName.toLowerCase()}${pseudo ?? ''}.${String(el.className).slice(0, 30)}`, bg: cs.backgroundImage });
    }
  }
  const img = hero.querySelector('img');
  const media = hero.querySelector('[data-nos-hero-media]') ?? img?.parentElement ?? null;
  const ms = media ? getComputedStyle(media) : null;
  const h1 = hero.querySelector('h1');
  const lede = hero.querySelector('[data-nos-hero-lede]');
  const dl = hero.querySelector('dl');
  const buttons = [...hero.querySelectorAll('[data-nos-hero-button]')];
  const countdown = [...hero.querySelectorAll('[data-nos-hero-text^="countdown-"]')].filter(rendered);
  // `ch` as the h1 itself resolves it: probe a zero-height box inside it.
  let ch = null;
  if (h1) {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;height:0;width:1ch';
    h1.appendChild(probe);
    ch = probe.getBoundingClientRect().width;
    probe.remove();
  }
  const lastBtn = buttons[buttons.length - 1];
  const firstCd = countdown[0];
  const orderOk = !lastBtn || !firstCd || !!(lastBtn.compareDocumentPosition(firstCd) & Node.DOCUMENT_POSITION_FOLLOWING);
  const copyBottom = Math.max(0, ...[h1, lede, dl, ...buttons, ...countdown].filter(Boolean).map((e) => R(e).bottom));
  const texts = [];
  const w = document.createTreeWalker(hero, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (!n.textContent.trim()) continue;
    const p = n.parentElement;
    if (!p || p.closest('[data-nos-hero-button]') || !rendered(p)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    if (!(r.width > 1 && r.height > 1)) continue;
    texts.push({ inH1: !!p.closest('h1'), text: n.textContent.trim().slice(0, 30), color: getComputedStyle(p).color, x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height });
  }
  return {
    kind: hero.getAttribute('data-nos-hero'),
    variant: hero.getAttribute('data-nos-hero-variant'), // F3 R29: "type" = typographic hero (no photo, no scrim), "photo" or absent = the F2 photo hero
    hero: R(hero),
    bgColor: hs.backgroundColor,
    flexDirection: hs.flexDirection,
    minHeight: parseFloat(hs.minHeight) || 0,
    innerHeight,
    innerWidth,
    gradients,
    img: R(img),
    imgPos: img ? getComputedStyle(img).position : null,
    media: R(media),
    mediaPos: ms?.position ?? null,
    mask: ms ? (ms.maskImage || ms.webkitMaskImage || 'none') : 'none',
    h1: R(h1),
    h1Size: h1 ? parseFloat(getComputedStyle(h1).fontSize) : null,
    ch,
    dl: R(dl),
    lede: R(lede),
    buttons: buttons.map(R),
    countdown: countdown.map((e) => ({ ...R(e), key: e.getAttribute('data-nos-hero-text') })),
    orderOk,
    eyebrows: hero.querySelectorAll('[data-nos-hero-eyebrow]').length,
    heroText: hero.textContent.replace(/\s+/g, ' ').trim(),
    copyBottom,
    texts,
  };
}

// ---- relative luminance / contrast (WCAG 2.x) ----
export const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
export const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const contrast = (a, b) => { const [hi, lo] = lum(a) >= lum(b) ? [a, b] : [b, a]; return (lum(hi) + 0.05) / (lum(lo) + 0.05); };
export const parseColor = (s) => {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/.exec(s);
  return m ? { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: m[4] === undefined ? 1 : Number(m[4]) } : null;
};

// Brightest / darkest pixel inside a PNG buffer region, decoded in the page.
export async function extremes(page, pngBuf) {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const L = (r, g, b) => { const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    let hi = [0, 0, 0], lo = [255, 255, 255], hiL = -1, loL = 2;
    for (let i = 0; i < d.length; i += 4) {
      const l = L(d[i], d[i + 1], d[i + 2]);
      if (l > hiL) { hiL = l; hi = [d[i], d[i + 1], d[i + 2]]; }
      if (l < loL) { loL = l; lo = [d[i], d[i + 1], d[i + 2]]; }
    }
    return { hi, lo };
  }, pngBuf.toString('base64'));
}

export const expectedH2 = (vw) => Math.min(Math.max(32, 24 + 0.016 * vw), 39); // clamp(2rem, 1.5rem + 1.6vw, 2.4375rem), index.html:158
export const expectedH1 = (vw, kind) => (kind === 'hub' && vw <= HUB_H1_SMALL_MAX
  ? Math.min(Math.max(44.8, 0.12 * vw), 54.4) // clamp(2.8rem, 12vw, 3.4rem), index.html:315 / HANDOFF "Hub hero"
  : kind === 'hub'
    ? Math.min(Math.max(51.2, 32 + 0.04 * vw), 88) // clamp(3.2rem, 2rem + 4vw, 5.5rem), index.html:141
    : Math.min(Math.max(41.6, 25.6 + 0.04 * vw), 88)); // inner only, ruling 2026-10-15 Q3: clamp(2.6rem, 1.6rem + 4vw, 5.5rem)
export const expectedHubLede = (vw) => Math.min(Math.max(20.8, 17.6 + 0.008 * vw), 26); // clamp(1.3rem, 1.1rem + .8vw, 1.625rem), index.html:143
export { px };
