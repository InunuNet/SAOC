// sponsor-enquiry-both-hosts RUN-AFTER-DEPLOY render gate (non-required): the NOS Design ruling as rendered, not declared.
// Real Chromium against the deployed NOS sponsors page at 1440x900 and 390x844:
//   anchor gate : click the hero CTA (#enquire); the enquiry card's top must sit between the sticky chrome's bottom +16 and +40
//   computed    : card #F3F2D6 / radius 16 / shadow / padding 32 (24 below 768); label Karla 500 14; input 1px border, radius 8, height >= 48;
//                 2px violet focus ring; submit background #211A57; fields column <= 640
//   consent     : the consent label is EXCLUDED from the field-label rule - Karla 450 16px / line-height 1.5, checkbox centred on its first line;
//                 field labels stay Karla 500 14px
//   success     : (NR-4, no box in a box) the API is MOCKED in the browser (page.route fulfils 201; NOTHING reaches the server or Firestore),
//                 a valid form is submitted, and inside the card there are 0 borders and 0 padding below the card, role=status stays with
//                 the focus on the success heading, and the card's x and width do not move
//   SAOC pin    : the SAOC /sponsors form labels are still the SAOC mono 11px (the NOS styling did not leak)
// Writes nothing: the one submit is answered by an in-browser mock, never the server. Basic Auth is read from BETA_BASIC_AUTH_USER/PASSWORD in-script and never printed.
// Run as: node --env-file-if-exists=.env.local <this file>   (from the project root, after deploy)
// Exit 0 PASS, 1 FAIL (a real finding), 77 inconclusive (credentials, browser or host unavailable).
import { chromium } from 'playwright';

const NOS = 'https://nos.saoc.co.za/national-show/sponsors';
const SAOC = 'https://beta.saoc.co.za/sponsors';
const VIEWPORTS = [{ name: '1440', width: 1440, height: 900, pad: 32 }, { name: '390', width: 390, height: 844, pad: 24 }];
const user = process.env.BETA_BASIC_AUTH_USER;
const pass = process.env.BETA_BASIC_AUTH_PASSWORD;
if (!user || !pass) { console.error('INCONCLUSIVE: BETA_BASIC_AUTH_USER / BETA_BASIC_AUTH_PASSWORD not set (run from the project root with .env.local)'); process.exit(77); }

const failures = [];
const fail = (m) => failures.push(m);
let browser;
try { browser = await chromium.launch(); } catch (error) { console.error(`INCONCLUSIVE: chromium unavailable (${error.name})`); process.exit(77); }

const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };

async function measure(page) {
  return page.evaluate(() => {
    const card = document.querySelector('[data-sponsor-enquiry="nos"]');
    if (!card) return null;
    const cs = getComputedStyle(card);
    const label = card.querySelector('form label');
    const input = card.querySelector('form input[type="text"]');
    const submit = card.querySelector('form button[type="submit"]');
    const form = card.querySelector('form');
    const ls = label && getComputedStyle(label); const is = input && getComputedStyle(input); const ss = submit && getComputedStyle(submit);
    // The sticky chrome: the lowest bottom edge among fixed/sticky elements pinned to the top of the viewport.
    let chromeBottom = 0;
    for (const el of document.querySelectorAll('body *')) {
      const p = getComputedStyle(el).position;
      if (p !== 'fixed' && p !== 'sticky') continue;
      const r = el.getBoundingClientRect();
      if (r.top <= 1 && r.height > 0 && r.bottom > chromeBottom && r.bottom < innerHeight / 2) chromeBottom = r.bottom;
    }
    return {
      cardTop: card.getBoundingClientRect().top, chromeBottom,
      card: { bg: cs.backgroundColor, radius: cs.borderTopLeftRadius, shadow: cs.boxShadow, padTop: cs.paddingTop, padLeft: cs.paddingLeft },
      formWidth: form ? form.getBoundingClientRect().width : null,
      label: ls && { family: ls.fontFamily, size: ls.fontSize, weight: ls.fontWeight },
      input: is && { border: is.borderTopWidth, radius: is.borderTopLeftRadius, height: input.getBoundingClientRect().height },
      submitBg: ss && ss.backgroundColor,
    };
  });
}

try {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, httpCredentials: { username: user, password: pass } });
    const page = await context.newPage();
    try {
      const res = await page.goto(NOS, { waitUntil: 'networkidle', timeout: 45000 });
      if (!res || res.status() !== 200) { fail(`${vp.name}: ${NOS} returned ${res?.status()}, want 200`); await context.close(); continue; }
    } catch (error) { console.error(`INCONCLUSIVE: could not load ${NOS} (${error.name})`); process.exit(77); }

    const cta = page.locator('a[data-sponsors-hero-cta][href="#enquire"], [data-sponsors-hero-cta][href="#enquire"]').first();
    if ((await cta.count()) === 0) { fail(`${vp.name}: hero CTA does not link to #enquire`); await context.close(); continue; }
    await cta.click();
    await page.waitForTimeout(1200);
    const m = await measure(page);
    if (!m) { fail(`${vp.name}: no [data-sponsor-enquiry="nos"] card on the page`); await context.close(); continue; }

    const gap = m.cardTop - m.chromeBottom;
    if (gap < 16 || gap > 40) fail(`${vp.name}: after the CTA click the card top sits ${gap.toFixed(1)}px below the chrome bottom, want 16..40`);
    if (m.card.bg !== rgb('#f3f2d6')) fail(`${vp.name}: card background ${m.card.bg}, want ${rgb('#f3f2d6')}`);
    if (m.card.radius !== '16px') fail(`${vp.name}: card radius ${m.card.radius}, want 16px`);
    if (!m.card.shadow || m.card.shadow === 'none') fail(`${vp.name}: card has no box-shadow`);
    if (m.card.padTop !== `${vp.pad}px` || m.card.padLeft !== `${vp.pad}px`) fail(`${vp.name}: card padding ${m.card.padTop}/${m.card.padLeft}, want ${vp.pad}px`);
    if (m.formWidth !== null && m.formWidth > 640.5) fail(`${vp.name}: fields column ${m.formWidth}px wide, want <= 640`);
    if (!m.label || !/karla/i.test(m.label.family) || m.label.size !== '14px' || m.label.weight !== '500') fail(`${vp.name}: label type ${JSON.stringify(m.label)}, want Karla 500 14px`);
    if (!m.input || m.input.border !== '1px' || m.input.radius !== '8px' || m.input.height < 47.5) fail(`${vp.name}: input ${JSON.stringify(m.input)}, want 1px border, radius 8, height >= 48`);
    if (m.submitBg !== rgb('#211a57')) fail(`${vp.name}: submit background ${m.submitBg}, want ${rgb('#211a57')}`);

    await page.locator('[data-sponsor-enquiry="nos"] form input[type="text"]').first().focus();
    const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { width: s.outlineWidth, color: s.outlineColor, style: s.outlineStyle }; });
    if (ring.width !== '2px' || ring.style === 'none' || ring.color !== rgb('#7e3f97')) fail(`${vp.name}: focus ring ${JSON.stringify(ring)}, want 2px violet ${rgb('#7e3f97')}`);

    // Consent label: body role, checkbox aligned to the first line; field labels untouched.
    const consent = await page.evaluate(() => {
      const label = document.querySelector('[data-sponsor-enquiry="nos"] label[for="se-consent"]');
      const box = document.getElementById('se-consent');
      const text = label?.querySelector('span');
      if (!label || !box || !text) return null;
      const s = getComputedStyle(label);
      const range = document.createRange(); range.selectNodeContents(text);
      const line = range.getClientRects()[0];
      const b = box.getBoundingClientRect();
      return { family: s.fontFamily, size: s.fontSize, weight: s.fontWeight, lineHeight: s.lineHeight, delta: line ? Math.abs((b.top + b.height / 2) - (line.top + line.height / 2)) : null };
    });
    if (!consent) fail(`${vp.name}: consent label not found`);
    else {
      if (!/karla/i.test(consent.family) || consent.size !== '16px' || consent.weight !== '450' || consent.lineHeight !== '24px') fail(`${vp.name}: consent label ${JSON.stringify(consent)}, want Karla 450 16px / 24px line-height`);
      if (consent.delta === null || consent.delta > 1.5) fail(`${vp.name}: checkbox centre is ${consent.delta}px off the first line's centre, want <= 1.5`);
    }

    // Success state with the API mocked: no box in a box, card does not move, focus on the heading.
    await page.route(/\/api\/sponsors\/enquire$/, (route) => route.fulfill({ status: 201, contentType: 'application/json', body: '{"success":true}' }));
    const before = await page.evaluate(() => { const r = document.querySelector('[data-sponsor-enquiry="nos"]').getBoundingClientRect(); return { x: r.x + scrollX, width: r.width }; });
    const scope = page.locator('[data-sponsor-enquiry="nos"]');
    await scope.locator('#se-contactName').fill('Render Check');
    await scope.locator('#se-email').fill('render-check@example.com');
    await scope.locator('#se-message').fill('Render check only, the API is mocked.');
    await scope.locator('#se-consent').check();
    await scope.locator('button[type="submit"]').click();
    await page.waitForSelector('[data-sponsor-enquiry="nos"] [role="status"]', { timeout: 10000 }).catch(() => {});
    const done = await page.evaluate(() => {
      const card = document.querySelector('[data-sponsor-enquiry="nos"]');
      const status = card.querySelector('[role="status"]');
      const r = card.getBoundingClientRect();
      const inner = status ? [status, ...status.querySelectorAll('*')] : [];
      const bad = inner.filter((el) => { const s = getComputedStyle(el); return ['Top', 'Right', 'Bottom', 'Left'].some((d) => parseFloat(s['border' + d + 'Width']) > 0 && s['border' + d + 'Style'] !== 'none') || ['Top', 'Right', 'Bottom', 'Left'].some((d) => parseFloat(s['padding' + d]) > 0); }).length;
      const st = status && getComputedStyle(status);
      return { hasStatus: Boolean(status), bad, bg: st && st.backgroundColor, focusId: document.activeElement && document.activeElement.id, x: r.x + scrollX, width: r.width };
    });
    if (!done.hasStatus) fail(`${vp.name}: no role=status success state after a (mocked) submit`);
    else {
      if (done.bad !== 0) fail(`${vp.name}: ${done.bad} element(s) inside the success state carry a border or padding (no box in a box)`);
      if (done.bg !== 'rgba(0, 0, 0, 0)' && done.bg !== 'transparent') fail(`${vp.name}: success box background ${done.bg}, want transparent`);
      if (done.focusId !== 'enquire-success-heading') fail(`${vp.name}: focus is on "${done.focusId}", want enquire-success-heading`);
    }
    if (Math.abs(done.x - before.x) > 0.5 || Math.abs(done.width - before.width) > 0.5) fail(`${vp.name}: card moved on success (x ${before.x} -> ${done.x}, width ${before.width} -> ${done.width})`);
    await context.close();
  }

  // SAOC pin: the SAOC form is not restyled.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, httpCredentials: { username: user, password: pass } });
  const page = await context.newPage();
  try {
    const res = await page.goto(SAOC, { waitUntil: 'networkidle', timeout: 45000 });
    if (!res || res.status() !== 200) fail(`saoc: ${SAOC} returned ${res?.status()}, want 200`);
    else {
      const label = await page.evaluate(() => { const l = document.querySelector('[data-sponsor-enquiry="saoc"] form label'); if (!l) return null; const s = getComputedStyle(l); return { family: s.fontFamily, size: s.fontSize }; });
      if (!label) fail('saoc: no enquiry form label found');
      else if (label.size !== '11px' || /karla/i.test(label.family)) fail(`saoc: label ${JSON.stringify(label)}, want the SAOC mono 11px (NOS styling must not leak)`);
    }
  } catch (error) { console.error(`INCONCLUSIVE: could not load ${SAOC} (${error.name})`); process.exit(77); }
  await context.close();
} finally {
  await browser.close();
}

if (failures.length) { console.error(`FAIL (${failures.length}):\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('PASS: NOS enquiry card renders per the ruling at 1440 and 390; anchor lands 16-40px under the chrome; SAOC form unchanged');
