// Chrome probe: at each width, lands on the first doc heading of /faq and /plan-your-visit and asserts
//  (1) the header renders --nos-header-h (+/-1px) wherever it is pinned (>=768),
//  (2) html scroll-padding-top computes 0px (NOS host),
//  (3) where the doc-index bar is sticky it sits at or below the header bottom (never under it), and the heading lands at or below the bar bottom (no overlap).
// Prints one row per path and width. Usage: NOS_BASE_URL=http://nos.localhost:<port> node probe-chrome.mjs   (read-only; exit 0 pass, 1 fail, 2 setup error)
import { chromium } from 'playwright';
const ORIGIN = (process.env.NOS_BASE_URL ?? '').replace(/\/+$/, '');
if (!ORIGIN) { console.error('NOS_BASE_URL is required'); process.exit(2); }
const PATHS = ['/national-show/faq', '/national-show/plan-your-visit'];
const WIDTHS = [[390, 844], [767, 1024], [768, 1024], [779, 1024], [780, 1024], [1023, 768], [1024, 768], [1440, 900], [2056, 1200]];
const browser = await chromium.launch();
let failures = 0;
console.log('path width headerH token headerPos indexTop indexBottom headingTop spt verdict');
for (const [w, h] of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  for (const path of PATHS) {
    const page = await ctx.newPage();
    await page.goto(`${ORIGIN}${path}`, { waitUntil: 'networkidle' });
    const id = await page.evaluate(() => document.querySelector('.doc-layout [data-doc-main] .doc-h2[id]')?.id ?? null);
    if (!id) { console.log(`${path} ${w} NO-DOC-H2`); failures++; await page.close(); continue; }
    await page.goto(`${ORIGIN}${path}#${id}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const m = await page.evaluate((hid) => {
      const hd = document.getElementById('nh'); const hr = hd?.getBoundingClientRect();
      const ix = document.querySelector('[data-doc-aside-kind="index"]'); const ir = ix?.getBoundingClientRect();
      const probe = document.createElement('div'); probe.style.height = 'var(--nos-header-h)'; probe.style.position = 'absolute'; document.body.appendChild(probe);
      const token = probe.getBoundingClientRect().height; probe.remove();
      return { hH: hr?.height ?? 0, hB: hr?.bottom ?? 0, hP: hd ? getComputedStyle(hd).position : '-', iT: ir?.top, iB: ir?.bottom, iP: ix ? getComputedStyle(ix).position : '-',
        t: document.getElementById(hid).getBoundingClientRect().top, token, spt: getComputedStyle(document.documentElement).scrollPaddingTop };
    }, id);
    const problems = [];
    const headerPinned = m.hP === 'sticky' || m.hP === 'fixed';
    if (headerPinned && Math.abs(m.hH - m.token) > 1) problems.push(`header ${m.hH.toFixed(1)} != token ${m.token}`);
    if (m.spt !== '0px') problems.push(`scroll-padding-top ${m.spt}`);
    const barPinned = m.iP === 'sticky' && m.iT !== undefined && m.iB !== undefined && (m.iB - m.iT) < 100;
    if (barPinned && headerPinned && m.iT < m.hB - 0.5) problems.push(`index bar top ${m.iT.toFixed(1)} under header bottom ${m.hB.toFixed(1)}`);
    if (barPinned && m.t < m.iB - 0.5) problems.push(`heading ${m.t.toFixed(1)} under index bar bottom ${m.iB.toFixed(1)}`);
    if (headerPinned && m.t < m.hB - 0.5) problems.push(`heading ${m.t.toFixed(1)} under header bottom ${m.hB.toFixed(1)}`);
    const f = (n) => (n === undefined ? '-' : Number(n).toFixed(1));
    console.log(`${path} ${w} ${f(m.hH)} ${f(m.token)} ${m.hP} ${f(m.iT)} ${f(m.iB)} ${f(m.t)} ${m.spt} ${problems.length ? 'FAIL: ' + problems.join('; ') : 'ok'}`);
    if (problems.length) failures++;
    await page.close();
  }
  await ctx.close();
}
await browser.close();
process.exit(failures ? 1 : 0);
