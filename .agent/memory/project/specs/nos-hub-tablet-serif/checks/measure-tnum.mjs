// Records which branch of ruling (a) applies: does the shipped display face (Fraunces, app/fonts/fraunces) carry a working `tnum`?
// Measured, not guessed: advance widths of the digits 0-9 at the countdown's own settings (42px, weight 300, opsz 72), with the
// tnum feature forced off and forced on. Branch "tnum" = the on-widths are all equal; branch "ch-min-width" = they are not.
// Writes evidence/tnum-branch.json and prints the branch. Pure function digitSpread() is selftested.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ROOT, EVIDENCE_DIR, launchChromium } from './_lib.mjs';

export const DIGITS = '0123456789'.split('');
export function digitSpread(widths) {
  const v = Object.values(widths);
  return Math.max(...v) - Math.min(...v);
}
// Measures the digit advances of the shipped face with tnum forced off and on, in the given browser.
export async function measureDigits(browser) {
  const font = readFileSync(`${ROOT}/app/fonts/fraunces/Fraunces-latin-normal.woff2`).toString('base64');
  const page = await browser.newPage();
  await page.setContent(`<style>@font-face{font-family:F;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}
    span{font:300 42px F;font-variation-settings:'opsz' 72;white-space:pre;position:absolute}</style><body></body>`);
  await page.evaluate(() => document.fonts.load('300 42px F'));
  const res = await page.evaluate((digits) => {
    const out = {};
    for (const [name, feat] of [['off', "'tnum' 0"], ['on', "'tnum' 1"]]) {
      out[name] = {};
      for (const d of digits) {
        const s = document.createElement('span');
        s.style.fontFeatureSettings = feat; s.textContent = d; document.body.append(s);
        out[name][d] = s.getBoundingClientRect().width;
      }
    }
    return out;
  }, DIGITS);
  await page.close();
  const offSpread = digitSpread(res.off), onSpread = digitSpread(res.on);
  const branch = onSpread <= 0.01 ? 'tnum' : 'ch-min-width';
  return { face: 'Fraunces-latin-normal.woff2', size: '42px', weight: 300, opsz: 72, offSpread, onSpread, branch, widthsOn: res.on, widthsOff: res.off };
}

export function selftest() {
  const bad = [];
  if (digitSpread({ 0: 20, 1: 20, 2: 20 }) !== 0) bad.push('equal widths must give spread 0');
  if (digitSpread({ 0: 20, 1: 14, 2: 21 }) !== 7) bad.push('unequal widths must give the max-min spread');
  return bad;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await launchChromium();
  const rec = await measureDigits(browser);
  await browser.close();
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(`${EVIDENCE_DIR}/tnum-branch.json`, JSON.stringify(rec, null, 2));
  console.log(JSON.stringify({ offSpread: rec.offSpread, onSpread: rec.onSpread, branch: rec.branch }));
}
