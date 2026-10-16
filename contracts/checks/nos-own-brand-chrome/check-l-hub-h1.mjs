// Hub hero: h1 text equals nav-config lead.leadLabel (HANDOFF "Hub hero": h1 exactly "19th SAOC National Orchid Show",
// "No lockup in the hero"), and the hero keeps exactly two CTAs in the F3 order (C-1, R67, superseding the F1 order): PRIMARY "Tickets" (nav-config label and href) then
// SECONDARY "Plan your visit"; "Find your society" has left the hero. No "Register interest" / "Book tickets" text, and no lockup img / picture renders inside the hero, at 1280 and 390.
import { NAV } from '../../../components/chrome/nav-config.ts';
import { HUB, VP_DESKTOP, VP_PHONE, main, openPage, withBrowser } from './_lib.mjs';

const planHref = NAV.find((n) => n.type === 'mega').columns.flatMap((c) => c.links).find((l) => l.id === 'plan-your-visit').href;
const findLink = (node, id) => { if (!node || typeof node !== 'object') return null; if (node.id === id && node.href) return node; for (const v of Object.values(node)) { const f = findLink(v, id); if (f) return f; } return null; };
const tickets = findLink(NAV, 'tickets');
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
        if (!tickets) r.fail('nav-config has no tickets link to take the primary CTA from');
        const b = cta.buttons;
        if (b.length !== 2) r.fail(`@${name}: hero must have exactly 2 CTAs ([data-nos-hero-button]); found ${b.length}: ${JSON.stringify(b.map((x) => x.text))}`);
        else {
          if (tickets && (b[0].text.toLowerCase() !== tickets.label.toLowerCase() || b[0].href !== tickets.href)) r.fail(`@${name}: primary CTA must be "${tickets?.label}" -> ${tickets?.href}; found ${JSON.stringify(b[0])}`);
          if (!/^plan your visit\b/i.test(b[1].text) || b[1].href !== planHref) r.fail(`@${name}: secondary CTA must be "Plan your visit" -> ${planHref}; found ${JSON.stringify(b[1])}`);
        }
        if (cta.links.some((l) => /^find your society\b/i.test(l.text))) r.fail(`@${name}: "Find your society" is still in the hero (it moved to the exhibitor band)`);
      }
      await ctx.close();
    }
  });
});
