// E: NOS mega-menu at 1280. Hover does nothing; click opens (aria-expanded=true); Escape closes and
// returns focus to the trigger; mousedown outside closes; labels / descriptors / hrefs are nav-config's
// verbatim ("Exhibitors and Vendors", never "Trade Vendors"); meta lines equal what the SAOC mega renders
// from the same Sanity singleton; the rail holds exactly the two nav-config text links.
import { NAV } from '../../../components/chrome/nav-config.ts';
import { VP_DESKTOP, main, openPage, withBrowser } from './_lib.mjs';

const mega = NAV.find((n) => n.type === 'mega');
const squash = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
const expanded = (page) => page.locator('#nh-show-trigger').getAttribute('aria-expanded');

await main('E mega-menu', async (r) => {
  await withBrowser(async (browser) => {
    // Reference meta from the SAOC chrome (same singleton, same formatter).
    const ref = await openPage(browser, VP_DESKTOP, '/about');
    await ref.page.locator('nav[aria-label="Primary"] button', { hasText: 'National Show' }).click();
    const refLead = squash(await ref.page.locator('[data-testid="mega-menu-lead-meta"]').first().textContent().catch(() => null));
    const refRail = squash(await ref.page.locator('[data-testid="feature-rail-meta"]').first().textContent().catch(() => null));
    await ref.ctx.close();

    const { ctx, page } = await openPage(browser, VP_DESKTOP, '/national-show/about');
    const trigger = page.locator('#nh-show-trigger');
    if (!(await trigger.count())) return r.fail('#nh-show-trigger not found');
    if ((await trigger.getAttribute('aria-controls')) !== 'nh-mega') r.fail('trigger aria-controls must be "nh-mega"');
    if ((await expanded(page)) !== 'false') r.fail('trigger must start aria-expanded="false"');
    if (await page.locator('#nh-mega').isVisible()) r.fail('mega-menu visible before any interaction');

    await trigger.hover();
    await page.waitForTimeout(700);
    if ((await expanded(page)) !== 'false' || (await page.locator('#nh-mega').isVisible())) r.fail('hovering the trigger opened the mega-menu (click-only, R12)');

    await trigger.click();
    if ((await expanded(page)) !== 'true') r.fail('click did not set aria-expanded="true"');
    if (!(await page.locator('#nh-mega').isVisible())) r.fail('click did not show #nh-mega');

    const text = squash(await page.locator('#nh-mega').textContent());
    const leaves = [...mega.lead.theShow.links, ...mega.columns.flatMap((c) => c.links)];
    const headings = [mega.lead.theShow.heading, ...mega.columns.map((c) => c.heading)];
    if (!text.includes(mega.lead.leadLabel)) r.fail(`lead label "${mega.lead.leadLabel}" missing`);
    if ((await page.locator(`#nh-mega a[href="${mega.lead.leadHref}"]`, { hasText: mega.lead.leadLabel }).count()) < 1) r.fail('lead link must go to the hub');
    for (const h of headings) if (!text.toLowerCase().includes(h.toLowerCase())) r.fail(`group heading "${h}" missing`);
    for (const l of leaves) {
      if (!text.includes(l.label)) r.fail(`leaf label "${l.label}" missing`);
      if (l.descriptor && !text.includes(squash(l.descriptor))) r.fail(`descriptor of "${l.label}" missing or altered`);
      if (!(await page.locator(`#nh-mega a[href="${l.href}"]`).count())) r.fail(`no link to ${l.href} ("${l.label}") in the mega-menu`);
    }
    if (!/Exhibitors and vendors/i.test(text)) r.fail('"Exhibitors and Vendors" label missing');
    if (/Trade Vendors/i.test(text)) r.fail('"Trade Vendors" present: the handoff text is overridden by nav-config');

    const leadMeta = squash(await page.locator('#nh-mega .nh-mega-lead .nh-mega-meta').first().textContent().catch(() => null));
    const railMeta = squash(await page.locator('#nh-mega .nh-mega-rail .nh-mega-meta').first().textContent().catch(() => null));
    if (leadMeta !== refLead) r.fail(`lead meta "${leadMeta}" != SAOC mega "${refLead}"`);
    if (railMeta !== refRail) r.fail(`rail meta "${railMeta}" != SAOC mega "${refRail}"`);

    const rail = await page.locator('#nh-mega .nh-mega-rail a').evaluateAll((as) => as.map((a) => [a.getAttribute('href'), (a.textContent ?? '').replace(/\s+/g, ' ').trim()]));
    const wantRail = mega.featureRail.destinations.filter((d) => d.variant === 'secondary').map((d) => [d.href, d.label]);
    if (JSON.stringify(rail) !== JSON.stringify(wantRail)) r.fail(`rail links ${JSON.stringify(rail)} != ${JSON.stringify(wantRail)}`);
    if (await page.locator('#nh-mega .nh-mega-rail button').count()) r.fail('rail must have no buttons');

    await page.keyboard.press('Escape');
    if ((await expanded(page)) !== 'false') r.fail('Escape did not close the mega-menu');
    if (await page.locator('#nh-mega').isVisible()) r.fail('#nh-mega still visible after Escape');
    if (!(await page.evaluate(() => document.activeElement?.id === 'nh-show-trigger'))) r.fail('focus did not return to the trigger after Escape');

    await page.keyboard.press('Enter');
    if ((await expanded(page)) !== 'true') r.fail('Enter on the focused trigger did not open the mega-menu');
    await page.mouse.click(5, 600);
    if ((await expanded(page)) !== 'false') r.fail('mousedown outside did not close the mega-menu');

    if (await page.locator('#nh a', { hasText: /^\s*Search\s*$/ }).count() || await page.locator('#nh [aria-label*="search" i]').count()) r.fail('Search must not be in the NOS header');
    await ctx.close();
  });
});
