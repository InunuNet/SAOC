#!/usr/bin/env node
// F24-A11 / A12 (live, V2): /national-show/workshops sessions note. Arg "public" reads PUBLIC_URL (SITE_PUBLIC_LAUNCH=true build): the first
// sentence is withheld (no "sellable", no "Individual session times" anywhere in text or HTML), the chip and the foot survive inside the
// gold disclosure, with the foot in [data-status-foot] and no empty or stray [data-status-list]. Arg "preview" reads BASE_URL (preview build):
// both sentences render as on main.
// Usage: PUBLIC_URL=http://localhost:3624 node contracts/checks/launch-weekend/f24/check-h-workshops-note.mjs public
//        BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f24/check-h-workshops-note.mjs preview
import { PUBLIC_BASE, BASE, VIEWPORTS, launch, newPage, report, loadGolden } from './_meta.mjs';

const mode = process.argv[2];
if (mode !== 'public' && mode !== 'preview') { console.error('usage: check-h-workshops-note.mjs public|preview'); process.exit(2); }
const V = loadGolden('copy-deletions.json').V2;
const base = mode === 'public' ? PUBLIC_BASE : BASE;
const problems = [];
const browser = await launch();
const { ctx, page } = await newPage(browser, VIEWPORTS[1]);
const res = await page.goto(`${base}/national-show/workshops`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((e) => { console.error(`INFRA: ${e.message}`); process.exit(2); });
if (!res || res.status() >= 400) { console.error(`INFRA: HTTP ${res ? res.status() : 'none'}`); process.exit(2); }
const html = await page.content();
const n = await page.evaluate(() => {
  const note = document.querySelector('.nk-sessions-note');
  const q = (s) => (note ? [...note.querySelectorAll(s)].map((e) => e.textContent.replace(/\s+/g, ' ').trim()) : []);
  return { text: document.body.innerText, noteText: note ? note.innerText.replace(/\s+/g, ' ').trim() : null, disclosure: note ? note.querySelectorAll('[data-status-disclosure]').length : 0, list: q('[data-status-list]'), foot: q('[data-status-foot]') };
});
const first = V.withheldPublic;
if (n.noteText === null) problems.push('.nk-sessions-note is missing');
if (!n.foot.includes(V.keptBoth)) problems.push(`the foot "${V.keptBoth}" is not in a [data-status-foot] inside .nk-sessions-note (got ${JSON.stringify(n.foot)})`);
if (n.noteText && !n.noteText.includes(V.chip)) problems.push(`the chip "${V.chip}" is gone from the note`);
if (mode === 'public') {
  if (/sellable/i.test(n.text) || /sellable/i.test(html)) problems.push('"sellable" is still on the public page (text or HTML payload)');
  if (/Individual session times/i.test(n.text) || /Individual session times/i.test(html)) problems.push('"Individual session times" is still on the public page');
  if (n.disclosure !== 1) problems.push(`want one gold [data-status-disclosure] around the chip and the foot, found ${n.disclosure}`);
  if (n.list.length) problems.push(`a [data-status-list] paragraph remains: ${JSON.stringify(n.list)}`);
} else {
  const body = first.replace(/\.$/, '') + '.';
  if (!n.list.includes(body)) problems.push(`preview [data-status-list] is ${JSON.stringify(n.list)}, want ["${body}"]`);
  if (n.disclosure !== 1) problems.push(`want one [data-status-disclosure] on preview, found ${n.disclosure}`);
}
await ctx.close(); await browser.close();
report(problems, `${mode}: sessions note renders as voted (${mode === 'public' ? 'first sentence withheld, chip and foot kept' : 'both sentences shown'})`);
