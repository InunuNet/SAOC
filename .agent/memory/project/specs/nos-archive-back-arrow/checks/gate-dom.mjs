// Browser gates for the two NOS archive back-arrows, on the production build under fixture replay. One mode per contract assertion:
//   parity   (A6) mirror parity +-0.5px against a forward keepsake: icon width, icon-to-label gap, icon vertical centre against the label
//   mirror   (A7) the icon is one svg.nk-icon, aria-hidden, leads the label with no literal space, at rest its computed transform is a pure scaleX(-1)
//   hover    (A8) hover moves the icon -3px under no-preference and 0 under reduce
//   caps     (A13) both labels compute the NR-8 Caps tuple: Karla, 700, 14px, 0.12em, uppercase
//   focus    (A9) keyboard focus ring, tab-stop count and 44px target match the main baseline (goldens/baseline-main.json); --record writes that baseline
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { BASELINE_FILE, V, gotoSettled, launchChromium, newContext, withServer } from './_lib.mjs';

const MODE = process.argv[2];
const RECORD = process.argv.includes('--record');
const TOL = V.parityTolerancePx;

/** Runs in the page. Everything a gate needs about one back-link: icon, label text node, boxes, styles. Returns null when the link is missing. */
function measureInPage({ selector, label }) {
  const link = document.querySelector(selector);
  if (!link) return null;
  const rect = (r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 });
  const icons = [...link.querySelectorAll('svg.nk-icon')];
  const icon = icons[0] ?? null;
  const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
  let labelNode = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) { if (n.data.trim() === label) { labelNode = n; break; } }
  const range = labelNode ? document.createRange() : null;
  range?.selectNodeContents(labelNode);
  const ics = icon ? getComputedStyle(icon) : null;
  const m = ics?.transform && ics.transform !== 'none' ? ics.transform.match(/matrix\(([^)]+)\)/) : null;
  return {
    iconCount: icons.length,
    hasIcon: Boolean(icon),
    ariaHidden: icon?.getAttribute('aria-hidden') ?? null,
    focusableAttr: icon?.getAttribute('focusable') ?? null,
    iconTabindex: icon?.getAttribute('tabindex') ?? null,
    matrix: m ? m[1].split(',').map(Number) : null,
    iconRect: icon ? rect(icon.getBoundingClientRect()) : null,
    labelRect: range ? rect(range.getBoundingClientRect()) : null,
    labelData: labelNode ? labelNode.data : null,
    iconBeforeLabel: Boolean(icon && labelNode && (icon.compareDocumentPosition(labelNode) & Node.DOCUMENT_POSITION_FOLLOWING)),
    fontSize: ics ? parseFloat(ics.fontSize) : null, // the icon's own font-size: the 1.1em width resolves against it
    marginInlineEnd: ics?.marginInlineEnd ?? null,
    linkRect: rect(link.getBoundingClientRect()),
  };
}

/** The same measurement with the icon's transform forced off, then restored: the unmirrored control for mirror parity. */
async function measureControl(page, spec) {
  return page.evaluate(({ spec, fn }) => {
    const link = document.querySelector(spec.selector);
    const icon = link?.querySelector('svg.nk-icon');
    if (!icon) return null;
    const prev = icon.style.getPropertyValue('transform'); const prevPrio = icon.style.getPropertyPriority('transform');
    icon.style.setProperty('transform', 'none', 'important');
    // eslint-disable-next-line no-new-func
    const out = new Function(`return (${fn})`)()(spec);
    if (prev) icon.style.setProperty('transform', prev, prevPrio); else icon.style.removeProperty('transform');
    return out;
  }, { spec, fn: measureInPage.toString() });
}

const measure = (page, spec) => page.evaluate(measureInPage, spec);
const near = (a, b, tol = TOL) => Math.abs(a - b) <= tol;

/** A forward keepsake text link on NOS today: the first .nk-visit a with an icon on the tickets page, label then arrow. Gap and vertical offset are read from its boxes. */
async function forwardReference(page, server, c) {
  await gotoSettled(page, server, V.forwardReference.page, c);
  const ref = await page.evaluate((selector) => {
    const btn = document.querySelector(selector);
    if (!btn) return null;
    const icon = btn.querySelector('svg.nk-icon');
    const walker = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT);
    let node = null;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) { if (n.data.trim() !== '') { node = n; break; } }
    const range = document.createRange(); range.selectNodeContents(node);
    const lr = range.getBoundingClientRect(); const ir = icon.getBoundingClientRect();
    return { columnGap: parseFloat(getComputedStyle(btn).columnGap), gap: ir.left - lr.right, vDelta: (ir.top + ir.height / 2) - (lr.top + lr.height / 2), width: ir.width, label: node.data.trim() };
  }, V.forwardReference.selector);
  c.check(`a forward keepsake (${V.forwardReference.selector}) exists on ${V.forwardReference.page}`, ref !== null);
  if (ref) {
    c.check(`the forward keepsake link's flex gap is ${V.forwardGapPx}px (golden, .nk-visit a, nos-structure.css:2146 on base); measured ${ref.columnGap}`, near(ref.columnGap, V.forwardGapPx, 0.01));
    c.check(`the forward keepsake's measured icon gap (${ref.gap.toFixed(2)}) equals its flex gap`, near(ref.gap, ref.columnGap));
  }
  return ref;
}

/** NOS_ARROW_SELFTEST=1: the gate's own proof that a correct implementation passes. Injects the spec's fix shape (keepsake ArrowIcon markup, scaleX(-1),
 * margin-inline-end 8px, -3px hover under no-preference only) into the served page, so the same measurements run against it. Never set in the contract. */
async function injectFixShape(page) {
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = `[data-selftest-arrow]{transform:scaleX(-1);margin-inline-end:8px}
      @media (prefers-reduced-motion: no-preference){[data-selftest-arrow]{transition:transform var(--dur-slow) var(--ease-nos)}
      a:hover [data-selftest-arrow]{transform:translateX(-3px) scaleX(-1)}}
      a[data-nos-backlink], main a[href="/archive/2023"] span:first-child{font-family:var(--sans);font-weight:700;font-size:14px;letter-spacing:.12em;text-transform:uppercase}`;
    document.head.append(style);
    const svg = '<svg class="nk-icon" data-selftest-arrow viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
    const back = document.querySelector('a[data-nos-backlink]');
    back.innerHTML = `${svg}Past shows`;
    const earlier = document.querySelector('main a[href="/archive/2023"] span');
    earlier.style.cssText = 'display:inline-flex;align-items:center';
    earlier.innerHTML = `${svg}Earlier`;
  });
}

async function openLinks(page, server, c) {
  await gotoSettled(page, server, V.links[0].page, c);
  if (process.env.NOS_ARROW_SELFTEST === '1') await injectFixShape(page);
  await page.mouse.move(0, 0);
}

async function parity(server, c, browser) {
  const ctx = await newContext(browser); const page = await ctx.newPage();
  const fwd = await forwardReference(page, server, c);
  await openLinks(page, server, c);
  for (const link of V.links) {
    const m = await measure(page, link);
    c.check(`[${link.id}] the link exists (${link.selector})`, m !== null);
    if (!m) continue;
    c.check(`[${link.id}] the link carries a keepsake arrow (svg.nk-icon), found ${m.iconCount}`, m.hasIcon && m.labelRect);
    if (!m.hasIcon || !m.labelRect) continue;
    const ctl = await measureControl(page, link);
    const wantWidth = V.iconWidthEm * m.fontSize;
    c.check(`[${link.id}] icon width ${m.iconRect.width.toFixed(2)} = ${V.iconWidthEm}em of ${m.fontSize}px = ${wantWidth.toFixed(2)} (ruling answer 1)`, near(m.iconRect.width, wantWidth));
    c.check(`[${link.id}] icon width ${m.iconRect.width.toFixed(2)} = ${V.iconWidthPx}px (1.1em of the ${V.caps.fontSizePx}px Caps label)`, near(m.iconRect.width, V.iconWidthPx));
    c.check(`[${link.id}] mirrored width ${m.iconRect.width.toFixed(2)} = unmirrored control ${ctl.iconRect.width.toFixed(2)}`, near(m.iconRect.width, ctl.iconRect.width));
    c.check(`[${link.id}] mirrored left edge ${m.iconRect.left.toFixed(2)} = unmirrored control ${ctl.iconRect.left.toFixed(2)} (mirrors about its own centre)`, near(m.iconRect.left, ctl.iconRect.left));
    c.check(`[${link.id}] mirrored vertical centre ${m.iconRect.cy.toFixed(2)} = unmirrored control ${ctl.iconRect.cy.toFixed(2)}`, near(m.iconRect.cy, ctl.iconRect.cy));
    const gap = m.labelRect.left - m.iconRect.right;
    c.check(`[${link.id}] icon-to-label gap ${gap.toFixed(2)} = ${V.forwardGapPx}px, the forward text-link gap (NOS Design: .nk-visit gap)`, near(gap, V.forwardGapPx));
    if (fwd) c.check(`[${link.id}] gap ${gap.toFixed(2)} = the live forward keepsake gap ${fwd.gap.toFixed(2)}`, near(gap, fwd.gap));
    c.check(`[${link.id}] trailing-side spacing is margin-inline-end ${V.forwardGapPx}px (computed ${m.marginInlineEnd})`, m.marginInlineEnd !== null && near(parseFloat(m.marginInlineEnd), V.forwardGapPx, 0.01));
    const vDelta = m.iconRect.cy - m.labelRect.cy;
    // The label's text-box centre sits a font-metric offset from the line-box centre, so the offset differs with label size (16px forward link vs 14px Caps): the back arrow must be
    // no worse centred on its label than the forward keepsake, within the tolerance. Mirrored-vs-unmirrored vertical equality is the exact check above.
    if (fwd) c.check(`[${link.id}] icon vertical centre vs label |${vDelta.toFixed(2)}| <= the forward keepsake's |${fwd.vDelta.toFixed(2)}| + ${TOL}`, Math.abs(vDelta) <= Math.abs(fwd.vDelta) + TOL);
  }
  await ctx.close();
}

async function mirror(server, c, browser) {
  const ctx = await newContext(browser); const page = await ctx.newPage();
  await openLinks(page, server, c);
  for (const link of V.links) {
    const m = await measure(page, link);
    c.check(`[${link.id}] the link exists (${link.selector})`, m !== null);
    if (!m) continue;
    c.check(`[${link.id}] exactly one svg.nk-icon (found ${m.iconCount})`, m.iconCount === 1);
    if (!m.hasIcon) continue;
    c.check(`[${link.id}] the icon is aria-hidden="true" (got ${m.ariaHidden})`, m.ariaHidden === 'true');
    c.check(`[${link.id}] the icon is focusable="false" and has no tabindex (got ${m.focusableAttr}, ${m.iconTabindex})`, m.focusableAttr === 'false' && m.iconTabindex === null);
    c.check(`[${link.id}] the icon leads the label in the DOM`, m.iconBeforeLabel);
    c.check(`[${link.id}] the label text is exactly "${link.label}" with no literal space (got ${JSON.stringify(m.labelData)})`, m.labelData === link.label);
    const t = m.matrix;
    c.check(`[${link.id}] at rest the computed transform is a pure scaleX(-1): matrix(-1,0,0,1,0,0) (got ${t ? `matrix(${t.join(',')})` : 'none'})`, t !== null && near(t[0], -1, 0.001) && near(t[1], 0, 0.001) && near(t[2], 0, 0.001) && near(t[3], 1, 0.001) && near(t[4], 0, 0.001) && near(t[5], 0, 0.001));
  }
  await ctx.close();
}

async function hover(server, c, browser) {
  for (const [reducedMotion, want] of [['no-preference', V.hoverNudgePx], ['reduce', 0]]) {
    const ctx = await newContext(browser, { reducedMotion }); const page = await ctx.newPage();
    await openLinks(page, server, c);
    for (const link of V.links) {
      const rest = await measure(page, link);
      c.check(`[${link.id}/${reducedMotion}] the link carries an icon to nudge`, Boolean(rest?.hasIcon));
      if (!rest?.hasIcon) continue;
      await page.locator(link.selector).first().hover();
      await page.waitForTimeout(V.hoverSettleMs);
      const hovered = await measure(page, link);
      const delta = hovered.iconRect.left - rest.iconRect.left;
      c.check(`[${link.id}/${reducedMotion}] hover moves the icon ${want}px (moved ${delta.toFixed(2)})`, near(delta, want));
      await page.mouse.move(0, 0);
      await page.waitForTimeout(V.hoverSettleMs);
    }
    await ctx.close();
  }
}

async function caps(server, c, browser) {
  const ctx = await newContext(browser); const page = await ctx.newPage();
  await openLinks(page, server, c);
  const want = V.caps;
  for (const link of V.links) {
    const s = await page.evaluate(({ selector, label }) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node = null;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) { if (n.data.trim().endsWith(label)) { node = n; break; } } // endsWith: on base the text node is the glyph plus the label
      if (!node) return null;
      const cs = getComputedStyle(node.parentElement);
      return { family: cs.fontFamily, weight: cs.fontWeight, size: parseFloat(cs.fontSize), spacing: parseFloat(cs.letterSpacing), transform: cs.textTransform };
    }, link);
    c.check(`[${link.id}] the label "${link.label}" exists`, s !== null);
    if (!s) continue;
    c.check(`[${link.id}] font-family is Karla (got ${s.family})`, s.family.toLowerCase().includes(want.fontFamilyMatch));
    c.check(`[${link.id}] font-weight ${want.fontWeight} (got ${s.weight})`, s.weight === want.fontWeight);
    c.check(`[${link.id}] font-size ${want.fontSizePx}px (got ${s.size})`, near(s.size, want.fontSizePx, 0.01));
    c.check(`[${link.id}] letter-spacing ${want.letterSpacingEm}em = ${(want.letterSpacingEm * want.fontSizePx).toFixed(2)}px (got ${s.spacing})`, near(s.spacing, want.letterSpacingEm * want.fontSizePx, 0.01));
    c.check(`[${link.id}] text-transform ${want.textTransform} (got ${s.transform})`, s.transform === want.textTransform);
  }
  await ctx.close();
}

async function tabTo(page, selector) {
  for (let i = 1; i <= 120; i += 1) {
    await page.keyboard.press('Tab');
    const on = await page.evaluate((sel) => document.activeElement === document.querySelector(sel), selector);
    if (on) return i;
  }
  return -1;
}

async function focus(server, c, browser) {
  const ctx = await newContext(browser); const page = await ctx.newPage();
  const seen = {};
  for (const link of V.links) {
    await openLinks(page, server, c);
    const tabs = await tabTo(page, link.selector);
    c.check(`[${link.id}] keyboard Tab reaches the link`, tabs > 0);
    if (tabs < 0) continue;
    const s = await page.evaluate((sel) => {
      const el = document.querySelector(sel); const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      return { focusVisible: el.matches(':focus-visible'), outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, outlineOffset: cs.outlineOffset, outlineColor: cs.outlineColor, height: r.height };
    }, link.selector);
    seen[link.id] = { tabs, ...s };
    c.check(`[${link.id}] the focused link matches :focus-visible with a drawn outline (${s.outlineStyle} ${s.outlineWidth})`, s.focusVisible && s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0);
    c.check(`[${link.id}] the target is at least ${V.targetFloorPx}px tall (${s.height.toFixed(2)})`, s.height >= V.targetFloorPx);
  }
  if (RECORD) { writeFileSync(BASELINE_FILE, `${JSON.stringify({ recordedAgainst: 'origin/main 8d9027c9', links: seen }, null, 2)}\n`); c.note(`baseline written: ${BASELINE_FILE}`); await ctx.close(); return; }
  c.check(`the main baseline exists (${BASELINE_FILE}); record it on main with: node .../gate-dom.mjs focus --record`, existsSync(BASELINE_FILE));
  if (existsSync(BASELINE_FILE)) {
    const base = JSON.parse(readFileSync(BASELINE_FILE, 'utf8')).links;
    for (const link of V.links) {
      const b = base[link.id]; const s = seen[link.id];
      if (!b || !s) continue;
      c.check(`[${link.id}] tab stops to reach the link are unchanged (${s.tabs} vs ${b.tabs}): the arrow is not a tab stop`, s.tabs === b.tabs);
      for (const k of ['outlineStyle', 'outlineWidth', 'outlineOffset', 'outlineColor']) c.check(`[${link.id}] focus ${k} is unchanged (${s[k]} vs ${b[k]})`, s[k] === b[k]);
      c.check(`[${link.id}] target height is not smaller than main (${s.height.toFixed(2)} vs ${b.height.toFixed(2)})`, s.height >= b.height - TOL);
    }
  }
  await ctx.close();
}

const MODES = { parity, mirror, hover, caps, focus };
if (!MODES[MODE]) { console.error(`usage: gate-dom.mjs <${Object.keys(MODES).join('|')}> [--record]`); process.exit(2); }
await withServer(`gate-dom ${MODE}`, async (server, c) => {
  const browser = await launchChromium();
  try { await MODES[MODE](server, c, browser); } finally { await browser.close(); }
});
