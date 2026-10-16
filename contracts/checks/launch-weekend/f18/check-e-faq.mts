// F18-A5 (R77 #2, R76): the /faq list. Fixture rows are rendered by the real ShowFaqList (renderToStaticMarkup) and injected into the live /faq page so the real built CSS measures them.
//   public (hideUnanswered)  -> a question with no answer renders no row at all (no question, no chip, no empty disclosure); answered rows render
//   beta (default)           -> every row renders, unanswered ones keep the labelled chip
//   geometry at 1280 and 390 -> [data-faq-summary] is a >=44px-high row spanning the list width; the icon [data-faq-icon] is 20px (+-0.5), centred on the row (+-2px) and does not
//                               wrap; the chip sits inline in the question block, after the question text, <=12px; clicking the right end of the row (not the icon) toggles the disclosure
//   hook contract            -> native <details>/<summary> kept; the answer stays in the DOM while collapsed
// Run: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 pnpm exec tsx contracts/checks/launch-weekend/f18/check-e-faq.mts   (cwd = implementation worktree)
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ShowFaqList } from '../../../../components/show/ShowFaqList';
import { BASE, T, withBrowser, openPage } from './_lib.mjs';

const F = T.faq;
const problems: string[] = [];
const fail = (m: string) => problems.push(m);
const pt = (t: string) => [{ _type: 'block', _key: 'a', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 'b', text: t, marks: [] }] }];
const faqs = [
  { _id: 'f1', question: 'Where is the venue?', category: 'getting-there', status: 'pending', answer: pt('The Hangar, Stellenbosch.') },
  { _id: 'f2', question: 'Is there parking at the venue for visitors and exhibitors alike this year?', category: 'getting-there', status: 'pending', answer: [] },
  { _id: 'f3', question: 'Can I pay by card?', category: 'tickets', status: 'confirmed', answer: pt('Yes, at checkout.') },
];
const props = { pendingLabel: 'To be confirmed by the show committee', researchLabel: 'Needs checking' };
const list = (extra: Record<string, unknown>) => renderToStaticMarkup(createElement(ShowFaqList as never, { faqs, ...props, ...extra }));

const pub = list({ hideUnanswered: true });
if (pub.includes('Is there parking')) fail('hideUnanswered: the unanswered question still renders');
if (!pub.includes('Where is the venue?') || !pub.includes('Can I pay by card?')) fail('hideUnanswered removed answered rows');
const beta = list({});
if (!beta.includes('Is there parking')) fail('default (beta) render dropped the unanswered question');
if ((beta.match(/data-confirmation-badge/g) ?? []).length < 2) fail('default (beta) render lost the chips on pending rows');
if (!/<details/.test(pub) || !/<summary/.test(pub)) fail('the disclosure is no longer native <details>/<summary>');
if (!pub.includes('The Hangar, Stellenbosch.')) fail('a collapsed answer is no longer in the DOM');
for (const hook of ['data-faq-summary', 'data-faq-icon']) if (!beta.includes(hook)) fail(`missing test hook ${hook}`);

await withBrowser(async (browser) => {
  for (const [w, h] of [[1280, 800], [390, 844]] as const) {
    const { ctx, page, status } = await openPage(browser, { width: w, height: h }, F.route);
    if (status !== 200) { fail(`${F.route} @${w}: HTTP ${status}`); await ctx.close(); continue; }
    await page.evaluate((html) => { const m = document.querySelector('main'); if (m) m.innerHTML = `<div style="padding:16px">${html}</div>`; }, beta);
    const m = await page.evaluate((FQ) => {
      const sums = [...document.querySelectorAll('[data-faq-summary]')] as HTMLElement[];
      return sums.map((s) => {
        const r = s.getBoundingClientRect();
        const icon = s.querySelector('[data-faq-icon]') as HTMLElement | null;
        const ir = icon?.getBoundingClientRect();
        const q = s.querySelector('[data-faq-question]') ?? s.firstElementChild;
        const chip = s.querySelector('[data-confirmation-badge]') as HTMLElement | null;
        const cr = chip?.getBoundingClientRect();
        const qr = q?.getBoundingClientRect();
        const list = s.closest('ul')?.getBoundingClientRect();
        return {
          h: r.height, w: r.width, listW: list?.width ?? 0,
          icon: ir ? { w: ir.width, h: ir.height, cy: ir.top + ir.height / 2 } : null, rowCy: r.top + r.height / 2,
          chip: cr ? { top: cr.top, fs: parseFloat(getComputedStyle(chip!).fontSize) } : null, qBottom: qr ? qr.bottom : 0,
          qText: (q?.textContent ?? '').trim().slice(0, 30), FQ,
        };
      });
    }, F);
    if (m.length !== 3) { fail(`@${w}: want 3 [data-faq-summary] rows, got ${m.length}`); await ctx.close(); continue; }
    m.forEach((r, i) => {
      const tag = `@${w} row ${i + 1} (${r.qText})`;
      if (r.h < F.rowMinPx - 0.5) fail(`${tag}: row is ${r.h.toFixed(1)}px high, want >= ${F.rowMinPx}`);
      if (r.w < r.listW - 1) fail(`${tag}: row ${r.w.toFixed(0)}px does not span the list (${r.listW.toFixed(0)}px)`);
      if (!r.icon) { fail(`${tag}: no icon`); return; }
      if (Math.abs(r.icon.w - F.iconPx) > F.iconTolerance || Math.abs(r.icon.h - F.iconPx) > F.iconTolerance) fail(`${tag}: icon ${r.icon.w.toFixed(1)}x${r.icon.h.toFixed(1)}, want ${F.iconPx}px`);
      if (Math.abs(r.icon.cy - r.rowCy) > F.iconCentreTolerancePx) fail(`${tag}: icon centre is ${(r.icon.cy - r.rowCy).toFixed(1)}px off the row centre`);
      if (r.chip) {
        if (r.chip.fs > F.chipMaxPx + 0.01) fail(`${tag}: chip ${r.chip.fs}px, want <= ${F.chipMaxPx}`);
        if (r.chip.top < r.qBottom - 40) fail(`${tag}: chip sits above the question text`);
      }
    });
    // whole row is the button: click the far right of row 1 away from the icon centre, expect it to open
    const first = page.locator('[data-faq-summary]').first();
    const box = await first.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width * 0.6, box.y + box.height / 2);
      const open = await first.evaluate((s) => (s.closest('details') as HTMLDetailsElement).open);
      if (!open) fail(`@${w}: clicking the middle of the row did not toggle the disclosure`);
    }
    await ctx.close();
  }
});
if (problems.length) { console.error(`FAIL F18-A5 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS F18-A5 faq rows, icon, chip, public hide');
