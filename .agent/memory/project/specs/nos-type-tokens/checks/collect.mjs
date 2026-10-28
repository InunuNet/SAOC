// Runs INSIDE the page (page.evaluate): measures every rendered text element once. Self-contained, no imports. `cfg` carries selectors from goldens/values.json.
export function collectPage(cfg) {
  const out = [];
  const seen = new Set();
  const opaqueBg = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return { c: null, img: true };
      const m = cs.backgroundColor.match(/[\d.]+/g);
      if (m && (m.length === 3 || Number(m[3]) >= 0.99)) return { c: cs.backgroundColor, img: false };
    }
    return { c: 'rgb(255, 255, 255)', img: false };
  };
  const lockups = [...document.querySelectorAll(cfg.exempt.lockup)];
  const banners = [...document.querySelectorAll(cfg.exempt.testBanner)];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.trim();
    const el = n.parentElement;
    if (!text || !el || seen.has(el) || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0 || r.height === 0) continue;
    const bg = opaqueBg(el);
    // The nearest ancestor that generates a box: a display:contents parent (the CR-G1 rule below 1024) has no box and clientWidth 0.
    let parent = el.parentElement;
    while (parent && getComputedStyle(parent).display === 'contents') parent = parent.parentElement;
    const pcs = parent ? getComputedStyle(parent) : null;
    const pw = parent && pcs ? parent.clientWidth - (parseFloat(pcs.paddingLeft) || 0) - (parseFloat(pcs.paddingRight) || 0) : 0;
    const heading = el.closest('h1,h2,h3,h4,h5,h6');
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: String(el.getAttribute('class') ?? ''),
      sel: el.tagName.toLowerCase() + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : ''),
      text: text.slice(0, 36),
      fam: cs.fontFamily,
      size: Number.parseFloat(cs.fontSize),
      wt: cs.fontWeight,
      style: cs.fontStyle,
      fvs: cs.fontVariationSettings,
      ls: cs.letterSpacing,
      tt: cs.textTransform,
      lh: cs.lineHeight,
      color: cs.color,
      bg: bg.c,
      bgImg: bg.img,
      w: r.width,
      h: r.height,
      pw,
      headTag: heading ? heading.tagName.toLowerCase() : null,
      headCls: heading ? String(heading.getAttribute('class') ?? '') : '',
      inFooter: !!el.closest('footer, .nf'),
      inHeader: !!el.closest('.nh, .nd'),
      inMain: !!el.closest('main'),
      inCard: !!el.closest('[class*="nk-"], [class*="card"], .nos-hero'),
      inForm: !!el.closest('form'),
      inLockup: lockups.some((l) => l.contains(el)),
      inBanner: banners.some((b) => b.contains(el)),
      matches: Object.fromEntries(Object.entries(cfg.probes).map(([k, s]) => [k, el.matches(s)])),
      closestCapsAllow: cfg.capsAllow.some((s) => !!el.closest(s)),
      inLabelSet: el.matches(cfg.labelSet),
      len: (el.textContent ?? '').trim().length,
      isOptionLabel: !!el.closest('label')?.querySelector('input[type=checkbox], input[type=radio]'),
    });
  }
  const heads = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => {
    const cs = getComputedStyle(h); const r = h.getBoundingClientRect();
    return { tag: h.tagName.toLowerCase(), cls: String(h.getAttribute('class') ?? ''), wt: cs.fontWeight, fvs: cs.fontVariationSettings, isName: h.matches(cfg.probes.name), isDocH3: h.matches(cfg.probes.docH3), size: Number.parseFloat(cs.fontSize), vis: cs.display !== 'none' && r.width > 2 && r.height > 2, text: (h.textContent ?? '').trim().slice(0, 30), fam: cs.fontFamily };
  });
  return { nodes: out, heads, vw: window.innerWidth };
}
