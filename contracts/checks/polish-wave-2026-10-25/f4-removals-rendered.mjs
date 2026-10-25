// F4 rendered at 390@3, 768@1, 1280@1 and 1440@2 against `next start` (public build: placeholder
// prose withheld, so the sponsors body paragraph is covered by f4-removals-static.mjs instead).
//   /judging    no "Log in through" text; the paragraph reads exactly as pinned in the static check
//   /programme  one h1, and no h2 whose text equals it; the programme section keeps its name via
//               aria-label; the page still has other h2s (non-vacuous)
//   /sponsors   no element whose text is "Our sponsors"; the h1 is still "Sponsors"
//   all three   no horizontal overflow (document wider than the viewport)
// Run as: node contracts/checks/polish-wave-2026-10-25/f4-removals-rendered.mjs   (needs a current build)
import { finish } from './_lib.mjs';
import { buildProblem, require, startServer } from './_server.mjs';

const failures = [];
const stale = buildProblem(['components/judging/JudgesDirectory.tsx', 'app/(marketing)/sponsors/page.tsx', 'components/tickets/keepsake/TicketSection.tsx']);
if (stale.length) finish('f4-removals-rendered', stale);

const { chromium } = require('playwright');
const VIEWPORTS = [
  { width: 390, height: 844, dpr: 3 },
  { width: 768, height: 1024, dpr: 1 },
  { width: 1280, height: 800, dpr: 1 },
  { width: 1440, height: 900, dpr: 2 },
];
const WANT_JUDGES = 'The full accredited judges directory is available to SAOC members. Get in touch with the council directly.';

const srv = await startServer();
const browser = await chromium.launch();
try {
  for (const vp of VIEWPORTS) {
    const tag = `${vp.width}@${vp.dpr}`;
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr });
    const page = await ctx.newPage();
    const open = async (host, path) => {
      const r = await page.goto(`http://${host}:${srv.port}${path}`, { waitUntil: 'load', timeout: 30000 });
      if (!r || r.status() !== 200) failures.push(`${tag} ${path}: HTTP ${r ? r.status() : 'none'}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) failures.push(`${tag} ${path}: horizontal overflow of ${overflow}px`);
    };

    await open('localhost', '/judging');
    const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    if (/Log in through/i.test(text)) failures.push(`${tag} /judging: still says "Log in through your affiliated society"`);
    if (!text.includes(WANT_JUDGES)) failures.push(`${tag} /judging: paragraph is not exactly "${WANT_JUDGES}"`);

    await open('nos.localhost', '/programme');
    const h1s = await page.locator('h1').allInnerTexts();
    const h2s = await page.locator('h2').allInnerTexts();
    if (h1s.length !== 1) failures.push(`${tag} /programme: ${h1s.length} h1 elements, want 1`);
    const dupes = h2s.filter((t) => t.trim().toLowerCase() === (h1s[0] ?? '').trim().toLowerCase());
    if (dupes.length) failures.push(`${tag} /programme: ${dupes.length} h2 duplicate the h1 "${h1s[0]}"`);
    if (h2s.length < 2) failures.push(`${tag} /programme: only ${h2s.length} h2 left (over-removal or empty page)`);
    if ((await page.locator('section[aria-label="Programme"]').count()) !== 1) failures.push(`${tag} /programme: no section named "Programme" via aria-label`);

    await open('localhost', '/sponsors');
    const eyebrow = await page.getByText('Our sponsors', { exact: true }).count();
    if (eyebrow > 0) failures.push(`${tag} /sponsors: the "Our sponsors" eyebrow is still rendered (${eyebrow}x)`);
    const h1 = (await page.locator('h1').first().innerText()).trim();
    if (h1 !== 'Sponsors') failures.push(`${tag} /sponsors: h1 is "${h1}", want "Sponsors"`);
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.stop();
}
finish('f4-removals-rendered', failures);
