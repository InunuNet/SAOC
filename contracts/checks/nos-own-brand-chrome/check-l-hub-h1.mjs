// Hub hero: h1 text equals nav-config lead.leadLabel (HANDOFF "Hub hero": h1 exactly "19th SAOC National Orchid Show",
// "No lockup in the hero"), the hero keeps exactly the CTAs "Plan your visit" and "Find your society" (H:229) and has
// no "Register interest" / "Book tickets" (the header Tickets CTA is the one ticket action, H:144-151), and no lockup img / picture renders inside the hero, at 1280 and 390.
import { NAV } from '../../../components/chrome/nav-config.ts';
import { HUB, VP_DESKTOP, VP_PHONE, main, openPage, withBrowser } from './_lib.mjs';

const planHref = NAV.find((n) => n.type === 'mega').columns.flatMap((c) => c.links).find((l) => l.id === 'plan-your-visit').href;
const label = NAV.find((n) => n.type === 'mega').lead.leadLabel;

await main('L hub-h1', async (r) => {
  await withBrowser(async (browser) => {
    for (const [name, vp] of [['1280', VP_DESKTOP], ['390', VP_PHONE]]) {
      const { ctx, page } = await openPage(browser, vp, HUB);
      const h1s = await page.locator('main h1').evaluateAll((els) => els.map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()));
      if (h1s.length !== 1) r.fail(`@${name}: want exactly one <h1> in main, found ${h1s.length}`);
      else if (h1s[0] !== label) r.fail(`@${name}: h1 is "${h1s[0]}", want nav-config lead.leadLabel "${label}"`);
      const lockups = await page.evaluate(() => {
        const h1 = document.querySelector('main h1');
        const hero = h1?.closest('section, header') ?? h1?.parentElement;
        if (!hero) return ['no hero container'];
        const re = /lockup|logo|nos-20|nos-(full|reversed)/i;
        const out = [];
        for (const el of hero.querySelectorAll('img, picture, source, svg[role="img"], svg[aria-label]')) {
          const img = el.tagName === 'PICTURE' ? el.querySelector('img') : el;
          const probe = [el.getAttribute('src'), el.getAttribute('srcset'), el.currentSrc, el.getAttribute('alt'), el.getAttribute('aria-label'), img?.getAttribute('src'), img?.getAttribute('alt')].join(' ');
          if (re.test(decodeURIComponent(probe.replace(/%(?![0-9A-F]{2})/gi, '')))) out.push(el.tagName.toLowerCase());
        }
        if (h1?.querySelector('img, picture, svg')) out.push('media inside h1');
        return out;
      });
      if (lockups.length) r.fail(`@${name}: hero renders lockup artwork: ${lockups.join(', ')}`);
      const cta = await page.evaluate(() => {
        const h1 = document.querySelector('main h1');
        const hero = h1?.closest('section, header') ?? h1?.parentElement;
        if (!hero) return null;
        const norm = (t) => (t ?? '').replace(/\s+/g, ' ').trim();
        return { buttons: [...hero.querySelectorAll('[data-nos-hero-button]')].map((a) => ({ text: norm(a.textContent), href: a.getAttribute('href') })), links: [...hero.querySelectorAll('a')].map((a) => ({ text: norm(a.textContent), href: a.getAttribute('href') })), text: norm(hero.textContent) };
      });
      if (!cta) r.fail(`@${name}: no hero container`);
      else {
        if (/register interest/i.test(cta.text)) r.fail(`@${name}: hero still contains "Register interest"`);
        for (const l of cta.links) if (/book tickets/i.test(l.text)) r.fail(`@${name}: hero still has a "Book tickets" link: ${JSON.stringify(l)}`);
        const plan = cta.links.filter((l) => /^plan your visit\b/i.test(l.text));
        if (plan.length !== 1 || plan[0].href !== planHref) r.fail(`@${name}: hero needs one "Plan your visit" link to ${planHref}; found ${JSON.stringify(plan)}`);
        const b = cta.buttons.map((x) => x.text);
        if (b.length !== 2) r.fail(`@${name}: hero must have exactly 2 CTAs ([data-nos-hero-button]); found ${b.length}: ${JSON.stringify(b)}`);
        else if (!/^plan your visit\b/i.test(b[0]) || !/^find your society\b/i.test(b[1])) r.fail(`@${name}: CTA order must be "Plan your visit" then "Find your society"; found ${JSON.stringify(b)}`);
        const soc = cta.links.filter((l) => /^find your society\b/i.test(l.text));
        if (soc.length !== 1 || soc[0].href !== '/societies') r.fail(`@${name}: hero needs one "Find your society" link to /societies; found ${JSON.stringify(soc)}`);
      }
      await ctx.close();
    }
  });
});
