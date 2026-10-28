// ES-1 rendered, on a production build served by `next start` (needs a current build). Two surfaces:
//   F  the authenticated body, via the env-gated fixture /events-fixtures/submit (EVENT_SUBMIT_FIXTURES=1, hosted-runtime guarded)
//   U  the unauthenticated LoginPrompt, which is the real /events/submit with no session cookie, on a flagless server
// Everything is measured against /contact (the reference), never asserted from class names:
//   h1 computed family and weight equal /contact's (Crimson Pro 300, serif); labels equal /contact's family, size,
//   letter-spacing, text-transform; every form control has an associated visible label (control.labels, label[for]);
//   the submit button (F) and the /contact link (U) equal /contact's submit button on bg, colour, family, size, weight,
//   radius, min-height, padding; scrollWidth <= viewport at 390 (and at 1280); no "Sanity" / "document ID" / "Host society ID"
//   in visible text, labels, options, placeholders or aria attributes; no class token containing "gray-"
//   F only: select#hostSocietyId lists the three fixture society names, each option value is the id, the empty first option is
//   "optional", and after choosing a name the form's FormData posts hostSocietyId=<id> (the POST itself needs a Firebase session)
// Run as: node contracts/checks/es1-submit-event/es1-rendered.mjs
import { finish } from '../polish-wave-2026-10-25/_lib.mjs';
import { buildProblem, get, require, startServer } from '../polish-wave-2026-10-25/_server.mjs';

const failures = [];
const stale = buildProblem(['app/(marketing)/events/submit/page.tsx', 'components/events/SubmitEventForm.tsx']);
if (stale.length) finish('es1-rendered', stale);

const { chromium } = require('playwright');
const VIEWPORTS = [
  { width: 390, height: 844, dpr: 3 },
  { width: 1280, height: 800, dpr: 1 },
];
const FIXTURE_SOCIETIES = [
  { id: 'soc-7f3a2c', name: 'Fixture Orchid Society A' },
  { id: 'soc-1b9e44', name: 'Fixture Orchid Society B' },
  { id: 'soc-c05d18', name: 'Fixture Orchid Society C' },
];
const BANNED = /Sanity|document ID|Host society ID/i;
const TYPE_PROPS = ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'textTransform'];
const BUTTON_PROPS = ['backgroundColor', 'color', 'fontFamily', 'fontSize', 'fontWeight', 'borderTopLeftRadius', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];

const props = (el, names) => el.evaluate((n, ns) => { const c = getComputedStyle(n); return Object.fromEntries(ns.map((k) => [k, c[k]])); }, names);
const diff = (a, b) => Object.keys(a).filter((k) => a[k] !== b[k]).map((k) => `${k} ${a[k]} != ${b[k]}`);

async function sweep(page, tag, ref) {
  if ((await page.locator('h1').count()) !== 1) failures.push(`${tag} ${await page.locator('h1').count()} h1 elements, want 1`);
  const h1 = await props(page.locator('h1').first(), ['fontFamily', 'fontWeight']);
  if (h1.fontFamily !== ref.h1.fontFamily || h1.fontWeight !== ref.h1.fontWeight) failures.push(`${tag} h1 is ${h1.fontFamily} ${h1.fontWeight}, want /contact's ${ref.h1.fontFamily} ${ref.h1.fontWeight}`);
  if (!/Crimson/i.test(h1.fontFamily)) failures.push(`${tag} h1 family ${h1.fontFamily} is not the serif token (Crimson Pro)`);
  if ((await page.locator('[data-page-hero]').count()) !== 1) failures.push(`${tag} no [data-page-hero]`);
  const grays = await page.evaluate(() => [...document.querySelectorAll('main *')].filter((n) => typeof n.className === 'string' && /gray-/.test(n.className)).length);
  if (grays) failures.push(`${tag} ${grays} elements carry a gray-* class`);
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
  if (overflow > 0) failures.push(`${tag} horizontal overflow of ${overflow}px`);
  const visible = await page.evaluate(() => [document.body.innerText, ...[...document.querySelectorAll('[aria-label],[title],[placeholder],option,label')].map((n) => n.getAttribute('aria-label') ?? n.getAttribute('title') ?? n.getAttribute('placeholder') ?? n.textContent)].join('\n'));
  if (BANNED.test(visible)) failures.push(`${tag} rendered text mentions Sanity / a document ID`);
}

// Without the flag the fixture must not exist (the page body is also unauthenticated-proof: no session, no form).
const srvU = await startServer();
const srvF = await startServer({ env: { EVENT_SUBMIT_FIXTURES: '1' } });
const browser = await chromium.launch();
try {
  const r404 = await get(srvU.port, '/events-fixtures/submit', 'localhost');
  if (r404.status !== 404) failures.push(`fixture route without the flag answers HTTP ${r404.status}, want 404`);

  for (const vp of VIEWPORTS) {
    const tag = `${vp.width}@${vp.dpr}`;
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${srvU.port}/contact`, { waitUntil: 'load', timeout: 30000 });
    const ref = {
      h1: await props(page.locator('h1').first(), ['fontFamily', 'fontWeight']),
      label: await props(page.locator('label[for="cf-name"]'), TYPE_PROPS),
      button: await props(page.locator('main form button[type=submit]'), BUTTON_PROPS),
    };
    if (!/Crimson/i.test(ref.h1.fontFamily) || ref.h1.fontWeight !== '300') failures.push(`${tag} reference /contact h1 is ${ref.h1.fontFamily} ${ref.h1.fontWeight} (check bug)`);

    // U: unauthenticated /events/submit
    const ru = await page.goto(`http://localhost:${srvU.port}/events/submit`, { waitUntil: 'load', timeout: 30000 });
    if (!ru || ru.status() !== 200) failures.push(`U ${tag} /events/submit: HTTP ${ru ? ru.status() : 'none'}`);
    else {
      await sweep(page, `U ${tag}`, ref);
      if (!/Members only/.test(await page.locator('h1').first().innerText())) failures.push(`U ${tag} h1 is not "Members only"`);
      const link = page.locator('a[href="/contact"]').filter({ hasText: 'Contact us about membership' });
      if ((await link.count()) !== 1) failures.push(`U ${tag} expected one "Contact us about membership" link to /contact, found ${await link.count()}`);
      else {
        const d = diff(await props(link, BUTTON_PROPS), ref.button);
        if (d.length) failures.push(`U ${tag} CTA differs from /contact's submit button: ${d.join('; ')}`);
        const b = await link.boundingBox();
        if (!b || b.height < 44) failures.push(`U ${tag} CTA is ${b ? b.height.toFixed(1) : 'hidden'}px tall, want >=44`);
      }
    }

    // F: the authenticated body via the fixture
    const rf = await page.goto(`http://localhost:${srvF.port}/events-fixtures/submit`, { waitUntil: 'load', timeout: 30000 });
    if (!rf || rf.status() !== 200) { failures.push(`F ${tag} fixture: HTTP ${rf ? rf.status() : 'none'}`); await ctx.close(); continue; }
    await sweep(page, `F ${tag}`, ref);
    const labels = page.locator('main form label');
    const ln = await labels.count();
    if (ln < 8) failures.push(`F ${tag} only ${ln} labels in the form`);
    for (let i = 0; i < ln; i++) {
      const d = diff(await props(labels.nth(i), TYPE_PROPS), ref.label);
      if (d.length) { failures.push(`F ${tag} label ${i} differs from /contact's label: ${d.join('; ')}`); break; }
      if (!(await labels.nth(i).isVisible())) failures.push(`F ${tag} label ${i} is not visible`);
    }
    const controls = page.locator('main form input:not([type=hidden]), main form select, main form textarea');
    const cn = await controls.count();
    for (let i = 0; i < cn; i++) {
      const info = await controls.nth(i).evaluate((n) => ({ id: n.id, labels: [...(n.labels ?? [])].map((l) => l.textContent.trim()) }));
      if (!info.id || info.labels.length === 0 || !info.labels[0]) failures.push(`F ${tag} control ${i} (#${info.id}) has no associated label`);
    }
    const btn = page.locator('main form button[type=submit]');
    const bd = diff(await props(btn, BUTTON_PROPS), ref.button);
    if (bd.length) failures.push(`F ${tag} submit differs from /contact's submit button: ${bd.join('; ')}`);

    const sel = page.locator('select#hostSocietyId');
    if ((await sel.count()) !== 1) failures.push(`F ${tag} no select#hostSocietyId`);
    else {
      if (!/^Host society\b/.test((await page.locator('label[for="hostSocietyId"]').innerText()).trim())) failures.push(`F ${tag} host society label does not start with "Host society"`);
      const options = await sel.locator('option').evaluateAll((os) => os.map((o) => ({ value: o.value, text: o.textContent.trim() })));
      const [first, ...rest] = options;
      if (!first || first.value !== '') failures.push(`F ${tag} first host society option must have an empty value (the field is optional)`);
      const got = rest.map((o) => `${o.text}=${o.value}`).join('|');
      const want = FIXTURE_SOCIETIES.map((s) => `${s.name}=${s.id}`).join('|');
      if (got !== want) failures.push(`F ${tag} select options are "${got}", want "${want}"`);
      await sel.selectOption({ label: FIXTURE_SOCIETIES[1].name });
      const posted = await page.locator('main form').evaluate((f) => new FormData(f).get('hostSocietyId'));
      if (posted !== FIXTURE_SOCIETIES[1].id) failures.push(`F ${tag} choosing "${FIXTURE_SOCIETIES[1].name}" posts hostSocietyId=${posted}, want ${FIXTURE_SOCIETIES[1].id}`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  srvU.stop();
  srvF.stop();
}
finish('es1-rendered', failures);
