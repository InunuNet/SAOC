// F3-R27 vendors (NOS Design ruling R27). Case determination is MEASURED here, never assumed (goldens/f3/vendors-cta.json records the evidence
// and the decision; this check fails if the golden's case no longer matches what the server does):
//   LIVE  = the register route answers 200 with the code-entry form (input[name=codeId]) AND the verify-code API validates (POST {} -> 400 JSON,
//           no Firestore write) AND the CTA target answers 200.
//   Case LIVE  -> the vendors hero's single primary CTA is the apply page h1 "Vendor Application" per vendors-cta.json (gold: bg --gold, label royal) to golden.cta.href.
//   Case NOT LIVE -> no CTA and no link to the dead route; the R11 chip "To be confirmed by the show committee" plus one real sentence.
// Either case: the "announced soon" dead end is gone from /national-show/vendors, and the empty state (no nurseries yet) is a designed block with a
// next-step link to a live route. The verbatim sentence is the page's own existing copy (VendorEmptyState.tsx), not new copy.
import { BASE, GOLD_RGB, ROYAL_RGB, readGolden, main, openPage, withBrowser, VP_DESKTOP, VP_PHONE, rgbOf, rgbNear } from './_f3lib.mjs';

const CHIP = 'To be confirmed by the show committee';

await main('F3-R27 vendors', async (r) => {
  const golden = readGolden('vendors-cta.json');
  const get = async (path) => { const res = await fetch(`${BASE}${path}`, { redirect: 'manual' }); return { status: res.status, html: res.status === 200 ? await res.text() : '' }; };
  const reg = await get(golden.registerRoute);
  const hasForm = /name="codeId"/.test(reg.html);
  const api = await fetch(`${BASE}/api/vendors/register/verify-code`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  const apiJson = await api.json().catch(() => null);
  const apiOk = api.status === 400 && typeof apiJson?.error === 'string';
  const target = await get(golden.cta.href);
  const live = reg.status === 200 && hasForm && apiOk && target.status === 200;
  r.note(`register ${reg.status} form=${hasForm}; verify-code ${api.status}; cta target ${golden.cta.href} ${target.status} => ${live ? 'LIVE' : 'NOT LIVE'}`);
  if (live !== (golden.case === 'live')) r.fail(`golden vendors-cta.json says case "${golden.case}" but the server measures ${live ? 'live' : 'not live'}; update the golden`);

  await withBrowser(async (browser) => {
    for (const [name, vp] of [['1280', VP_DESKTOP], ['390', VP_PHONE]]) {
      const { ctx, page, status } = await openPage(browser, vp, '/national-show/vendors');
      const tag = `/national-show/vendors @${name}`;
      if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
      const m = await page.evaluate(() => {
        const hero = document.querySelector('[data-nos-hero]');
        const norm = (t) => (t ?? '').replace(/\s+/g, ' ').trim();
        const links = hero ? [...hero.querySelectorAll('a[href], button')] : [];
        const btns = hero ? [...hero.querySelectorAll('[data-nos-hero-button]')] : [];
        const first = btns[0];
        const s = first ? getComputedStyle(first) : null;
        const empty = document.querySelector('[data-nos-empty-state]');
        const emptyLinks = empty ? [...empty.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')) : [];
        const body = norm(document.body.innerText);
        return {
          heroLinks: links.map((a) => ({ text: norm(a.textContent), href: a.getAttribute('href') })),
          buttons: btns.map((b) => ({ text: norm(b.textContent), href: b.getAttribute('href') })),
          bg: s?.backgroundColor, color: s?.color,
          chipInHero: hero ? norm(hero.textContent).includes('To be confirmed by the show committee') : false,
          heroText: hero ? norm(hero.textContent) : '',
          deadEnd: /announced soon|check back/i.test(body),
          hasEmpty: !!empty,
          emptyText: empty ? norm(empty.textContent) : '',
          emptyLinks,
          hasGrid: !!document.querySelector('[data-vendor-card], [data-nos-vendor-card]'),
          registerLinksAnywhere: [...document.querySelectorAll('main a[href]')].map((a) => a.getAttribute('href')).filter((h) => h?.includes('/vendors/register')),
        };
      });
      if (m.deadEnd) r.fail(`${tag}: page still shows an "announced soon" / "check back" dead end`);
      if (live) {
        if (m.buttons.length !== 1) r.fail(`${tag}: want exactly one primary CTA in the vendors hero, found ${m.buttons.length}`);
        else {
          const b = m.buttons[0];
          if (b.text !== golden.cta.label) r.fail(`${tag}: hero CTA "${b.text}", want "${golden.cta.label}"`);
          if (b.href !== golden.cta.href) r.fail(`${tag}: hero CTA href ${b.href}, want ${golden.cta.href}`);
          if (!rgbNear(rgbOf(m.bg ?? ''), GOLD_RGB, 1.5) || !rgbNear(rgbOf(m.color ?? ''), ROYAL_RGB, 1.5)) r.fail(`${tag}: hero CTA is ${m.bg} / ${m.color}, want gold rgb(243, 242, 214) with royal label`);
        }
        if (m.chipInHero) r.fail(`${tag}: the R11 chip must not show while the registration is live`);
      } else {
        if (m.buttons.length || m.heroLinks.length) r.fail(`${tag}: registration is not live, so the hero carries no CTA or link (found ${JSON.stringify(m.heroLinks)})`);
        if (!m.chipInHero) r.fail(`${tag}: registration is not live: the hero needs the R11 chip "${CHIP}"`);
        if (m.registerLinksAnywhere.length) r.fail(`${tag}: link(s) to the dead route ${m.registerLinksAnywhere.join(', ')}`);
      }
      if (!m.hasGrid) {
        if (!m.hasEmpty) r.fail(`${tag}: no nurseries listed and no [data-nos-empty-state] block`);
        else {
          if (!m.emptyText.includes(golden.emptySentence)) r.fail(`${tag}: empty state lacks the page's own sentence "${golden.emptySentence}" (got "${m.emptyText.slice(0, 120)}")`);
          if (!m.emptyLinks.length) r.fail(`${tag}: empty state has no next-step link`);
          for (const href of m.emptyLinks) { const t = await get(href.startsWith('http') ? new URL(href).pathname : href); if (t.status !== 200) r.fail(`${tag}: empty-state link ${href} answers ${t.status}`); }
        }
      }
      await ctx.close();
    }
  });
});
