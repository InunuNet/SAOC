// F6 rendered at 390@3, 768@1, 1280@1 and 1440@2: the /events/submit page body, via the env-gated fixture
// route /events-fixtures/submit (404 without EVENT_SUBMIT_FIXTURES=1). Parity with /contact (the pattern named
// by the ruling), measured, not asserted from class names:
//   h1 has the same computed font-family and weight as /contact's h1, the family is Crimson Pro, weight 300
//   a [data-page-hero] section exists; labels match /contact's label font-family and size
//   every input, select and textarea in the form is >=44px tall
//   a "Host society" select exists: first option has an empty value, every other option's value is an id-shaped
//   string that differs from its visible text, the visible text is a name, the names are sorted, and nothing
//   on the page says "Sanity", "document ID" or "Host society ID"
//   the submit button background equals the resolved --accent (the token of the Join a society CTA, Header.tsx:183, and of ContactForm), and it is >=44px tall
//   no horizontal overflow
// Run as: node contracts/checks/polish-wave-2026-10-25/f6-submit-rendered.mjs   (needs a current build)
import { finish } from './_lib.mjs';
import { buildProblem, get, require, startServer } from './_server.mjs';

const failures = [];
const stale = buildProblem(['components/events/SubmitEventForm.tsx']);
if (stale.length) finish('f6-submit-rendered', stale);

const { chromium } = require('playwright');
const VIEWPORTS = [
  { width: 390, height: 844, dpr: 3 },
  { width: 768, height: 1024, dpr: 1 },
  { width: 1280, height: 800, dpr: 1 },
  { width: 1440, height: 900, dpr: 2 },
];

// Without the flag the fixture must not exist.
const closed = await startServer();
try {
  const r = await get(closed.port, '/events-fixtures/submit', 'localhost');
  if (r.status !== 404) failures.push(`fixture route without the flag answers HTTP ${r.status}, want 404`);
} finally {
  closed.stop();
}

const srv = await startServer({ env: { EVENT_SUBMIT_FIXTURES: '1' } });
const browser = await chromium.launch();
const type = (el) => el.evaluate((n) => { const c = getComputedStyle(n); return { family: c.fontFamily, weight: c.fontWeight, size: c.fontSize }; });
try {
  for (const vp of VIEWPORTS) {
    const tag = `${vp.width}@${vp.dpr}`;
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${srv.port}/contact`, { waitUntil: 'load', timeout: 30000 });
    const contactH1 = await type(page.locator('h1').first());
    const contactLabel = await type(page.locator('label[for="cf-name"]'));
    if (!/Crimson/i.test(contactH1.family) || contactH1.weight !== '300') failures.push(`${tag} reference /contact h1 is ${contactH1.family} ${contactH1.weight}, expected Crimson Pro 300 (check bug)`);

    const r = await page.goto(`http://localhost:${srv.port}/events-fixtures/submit`, { waitUntil: 'load', timeout: 30000 });
    if (!r || r.status() !== 200) { failures.push(`${tag} fixture: HTTP ${r ? r.status() : 'none'}`); await ctx.close(); continue; }
    if ((await page.locator('[data-page-hero]').count()) !== 1) failures.push(`${tag} no [data-page-hero]`);
    if ((await page.locator('h1').count()) !== 1) failures.push(`${tag} ${await page.locator('h1').count()} h1 elements, want 1`);
    const h1 = await type(page.locator('h1').first());
    if (h1.family !== contactH1.family || h1.weight !== '300') failures.push(`${tag} h1 is ${h1.family} ${h1.weight}, want ${contactH1.family} 300`);

    const labels = page.locator('form label');
    const ln = await labels.count();
    if (ln < 8) failures.push(`${tag} only ${ln} labels in the form`);
    for (let i = 0; i < ln; i++) {
      const l = await type(labels.nth(i));
      if (l.family !== contactLabel.family || l.size !== contactLabel.size) { failures.push(`${tag} label ${i} is ${l.family} ${l.size}, want ${contactLabel.family} ${contactLabel.size}`); break; }
    }
    const controls = page.locator('form input:not([type=hidden]), form select, form textarea');
    const cn = await controls.count();
    for (let i = 0; i < cn; i++) {
      const b = await controls.nth(i).boundingBox();
      if (!b || b.height < 44) failures.push(`${tag} form control ${i} is ${b ? b.height.toFixed(1) : 'hidden'}px tall, want >=44`);
    }

    const sel = page.locator('select#hostSocietyId');
    if ((await sel.count()) !== 1) failures.push(`${tag} no select#hostSocietyId`);
    else {
      const label = (await page.locator('label[for="hostSocietyId"]').innerText()).trim();
      if (!/^Host society\b/.test(label)) failures.push(`${tag} host society label is "${label}"`);
      const options = await sel.locator('option').evaluateAll((os) => os.map((o) => ({ value: o.value, text: o.textContent.trim() })));
      const [first, ...rest] = options;
      if (!first || first.value !== '') failures.push(`${tag} first host society option must have an empty value`);
      if (rest.length < 2) failures.push(`${tag} only ${rest.length} societies in the select`);
      for (const o of rest) {
        if (o.value === o.text || o.value.length < 4) failures.push(`${tag} option "${o.text}" has value "${o.value}" (not an id)`);
      }
      const names = rest.map((o) => o.text);
      if (names.join('|') !== [...names].sort((a, b) => a.localeCompare(b)).join('|')) failures.push(`${tag} societies are not sorted by name`);
    }
    const text = await page.locator('main').innerText();
    if (/Sanity|document ID|Host society ID/i.test(text)) failures.push(`${tag} page text mentions Sanity / a document ID`);

    const btn = page.locator('form button[type=submit]');
    const bb = await btn.boundingBox();
    const accent = await page.evaluate(() => { const s = document.createElement('span'); s.style.color = 'var(--accent)'; document.body.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; });
    const bg = await btn.evaluate((n) => getComputedStyle(n).backgroundColor);
    if (bg !== accent) failures.push(`${tag} submit background is ${bg}, want --accent ${accent} (the Join a society CTA and ContactForm token)`);
    if (!bb || bb.height < 44) failures.push(`${tag} submit button is ${bb ? bb.height.toFixed(1) : 'missing'}px tall, want >=44`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) failures.push(`${tag} horizontal overflow of ${overflow}px`);
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.stop();
}
finish('f6-submit-rendered', failures);
