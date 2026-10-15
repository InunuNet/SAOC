// F2-C (NOS Design ruling 2026-10-16): /archive/[year] moves the editionLabel out of the hero eyebrow into the current breadcrumb crumb
// "Show history - {editionLabel}": "Show history" is a link to /national-show/archive, the label is the unlinked aria-current="page" crumb
// in Karla at breadcrumb size (>=12px), the label text stays verbatim from editionLabel ("Edition XVIII · 2024", or the bare year) and does not repeat
// in the h1 or the standfirst, and the hero has no eyebrow. Asserted on every archive year the archive index links (real routes), 1280 and 390.
import { BASE, main, openPage, withBrowser, VP_DESKTOP, VP_PHONE, isKarla, FAMILY_BAD } from './_f2lib.mjs';

const LABEL = /^(Edition [IVXLCDM]+(?:st|nd|rd|th)? · )?\d{4}$/;

await main('F2-C archive-crumb', async (r) => {
  await withBrowser(async (browser) => {
    const probe = await openPage(browser, VP_DESKTOP, '/national-show/archive');
    const years = await probe.page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="/national-show/archive/"]')].map((a) => a.getAttribute('href')))]);
    await probe.ctx.close();
    if (!years.length) { r.fail('/national-show/archive links no year routes to test'); return; }
    for (const route of years) {
      for (const [name, vp] of [['1280', VP_DESKTOP], ['390', VP_PHONE]]) {
        const { ctx, page, status } = await openPage(browser, vp, route);
        const tag = route + ' @' + name;
        if (status !== 200) { r.fail(tag + ': HTTP ' + status); await ctx.close(); continue; }
        const m = await page.evaluate(() => {
          const norm = (t) => (t ?? '').replace(/\s+/g, ' ').trim();
          const navs = [...document.querySelectorAll('nav')].filter((n) => /breadcrumb/i.test(n.getAttribute('aria-label') ?? '') && !n.closest('#nh, #nd, #nf'));
          const nav = navs[0] ?? null;
          const cur = nav?.querySelector('[aria-current="page"]') ?? null;
          const link = nav ? [...nav.querySelectorAll('a')].find((a) => /^show history$/i.test(norm(a.textContent))) : null;
          const cs = cur ? getComputedStyle(cur) : null;
          const h1 = document.querySelector('main h1');
          const lede = document.querySelector('[data-nos-hero-lede]');
          return {
            navCount: navs.length,
            navText: nav ? norm(nav.textContent) : null,
            cur: cur ? { text: norm(cur.textContent), tag: cur.tagName.toLowerCase(), linked: !!cur.closest('a') || cur.tagName === 'A', family: cs.fontFamily, size: parseFloat(cs.fontSize) } : null,
            link: link ? { href: link.getAttribute('href'), current: link.hasAttribute('aria-current') } : null,
            h1: norm(h1?.textContent),
            lede: norm(lede?.textContent),
            eyebrows: document.querySelectorAll('[data-nos-hero-eyebrow]').length,
          };
        });
        if (m.navCount < 1) { r.fail(tag + ': no nav[aria-label="Breadcrumb"] on the page'); await ctx.close(); continue; }
        if (!m.link) r.fail(tag + ': breadcrumb has no "Show history" link');
        else if (m.link.href !== '/national-show/archive') r.fail(tag + ': "Show history" links to ' + m.link.href + ', want /national-show/archive');
        if (!m.cur) { r.fail(tag + ': breadcrumb has no aria-current="page" crumb'); await ctx.close(); continue; }
        if (m.cur.linked) r.fail(tag + ': the current crumb must be unlinked');
        if (!LABEL.test(m.cur.text) || !m.cur.text.endsWith(route.split('/').pop())) r.fail(tag + ': current crumb text "' + m.cur.text + '" is not the editionLabel ("Edition <roman> · <year>" or the bare year ending ' + route.split('/').pop() + ')');
        if (!/show history\s*[—–-]\s*/i.test(m.navText ?? '') && !(m.navText ?? '').includes('Show history')) r.fail(tag + ': breadcrumb text "' + m.navText + '" lacks "Show history"');
        if (!isKarla({ family: m.cur.family }) || FAMILY_BAD.test(m.cur.family)) r.fail(tag + ': current crumb font ' + m.cur.family.slice(0, 40) + ', want Karla');
        if (m.cur.size < 12 - 0.01) r.fail(tag + ': current crumb ' + m.cur.size + 'px, floor is 12px');
        if (m.h1.includes(m.cur.text)) r.fail(tag + ': h1 repeats the editionLabel "' + m.cur.text + '"');
        if (m.lede.includes(m.cur.text)) r.fail(tag + ': standfirst repeats the editionLabel "' + m.cur.text + '"');
        if (m.eyebrows) r.fail(tag + ': hero still has an eyebrow');
        await ctx.close();
      }
    }
  });
});
