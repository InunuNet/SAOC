// F2-K1 (NOS Design R25, item 2): label-styled group heads are real headings, not <p>. Any visible uppercase <=14px element that
// directly precedes a list (ul/ol/dl, or the FAQ details list) inside <main> must be an h2-h6 (h2, or h3 under a page h2), and /faq must
// have one such heading per category. No heading level may skip (h2 -> h4) anywhere in <main>. Chrome (#nh, #nd, #nf) excluded.
import { NOS_ROUTES, VP_DESKTOP, main, openPage, withBrowser } from './_f2lib.mjs';

const probe = () => {
  const vis = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const label = (e) => { const cs = getComputedStyle(e); return cs.textTransform === 'uppercase' && parseFloat(cs.fontSize) <= 14.01 && (e.textContent ?? '').trim().length > 0; };
  const mainEl = document.querySelector('main') ?? document.body;
  const bad = [];
  const lists = [...mainEl.querySelectorAll('ul, ol, dl')].filter((l) => vis(l) && !l.closest('#nh, #nd, #nf, nav'));
  let heads = 0;
  for (const l of lists) {
    let prev = l.previousElementSibling;
    while (prev && !vis(prev)) prev = prev.previousElementSibling;
    if (!prev || !label(prev)) continue;
    const txt = (prev.textContent ?? '').trim();
    // Lead-in captions are not group heads: a status marker ("※To be confirmed...") or the "Each entry will show" caption. Making them headings is allowed, not required.
    if (/^[^\p{L}\p{N}]/u.test(txt) || /^each entry will show/i.test(txt)) continue;
    heads++;
    const tag = prev.tagName.toLowerCase();
    if (!/^h[2-6]$/.test(tag)) bad.push({ kind: 'not-heading', tag, text: (prev.textContent ?? '').trim().slice(0, 40) });
  }
  const levels = [...mainEl.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter((h) => vis(h) && !h.closest('#nh, #nd, #nf')).map((h) => ({ n: Number(h.tagName[1]), text: (h.textContent ?? '').trim().slice(0, 30) }));
  for (let i = 1; i < levels.length; i++) if (levels[i].n > levels[i - 1].n + 1) bad.push({ kind: 'level-skip', tag: 'h' + levels[i].n, text: `${levels[i].text} (after h${levels[i - 1].n})` });
  return { bad, heads };
};

await main('F2-K1 headings', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of NOS_ROUTES) {
      const { ctx, page } = await openPage(browser, VP_DESKTOP, route);
      const m = await page.evaluate(probe);
      for (const b of m.bad) r.fail(`${route}: ${b.kind === 'not-heading' ? `label-styled group head is <${b.tag}> "${b.text}", must be h2-h6` : `heading ${b.tag} "${b.text}" skips a level`}`);
      if (route.endsWith('/faq') && m.heads < 2) r.fail(`${route}: found ${m.heads} label-styled category heads before FAQ lists, want >= 2 (each category head must be a real heading)`);
      await ctx.close();
    }
  });
});
