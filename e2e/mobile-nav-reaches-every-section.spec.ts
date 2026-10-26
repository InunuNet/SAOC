// =============================================================
// SAOC — e2e/mobile-nav-reaches-every-section.spec.ts
// Mission menu-system-layout4 M2/F3, rewritten for the two-site split (mission nos-site-split F3).
//
// The SAOC site's drawer is a flat list of SAOC sections plus one absolute link to the National
// Orchid Show site; the show's own menu panel (NOS host, NOS Design R1.4) holds the three
// disclosure groups, Show sponsors, Past shows and Contact. Mobile is not a lesser-tested surface:
// this opens each menu at 390px and 320px and click-navigates through every destination, each with
// its own real Playwright navigation assertion (waitForURL + toHaveURL) — never a text-presence
// check, which would pass even for a hidden, unreachable element. A link that leaves the site (the
// SAOC drawer's National Show, either menu's Contact) is asserted by href instead of followed.
//
// Both lists are DERIVED from the nav data (NAV, NOS_NAV), so a changed or added leaf is picked up
// automatically. Reads goldens/fixtures/f1-pending-nos-routes.json — the single current source of
// truth for which NOS-lane routes don't exist yet; pending destinations are test.skip'd with a
// named reason, an auditable gap rather than a silent omission.
//
// The Past shows route is withheld in a public build until Sanity holds a past show (r64): the
// panel then has no such link at all, and the spec asserts exactly that rather than following it.
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { NAV } from '@/components/chrome/nav-config';
import pendingNosRoutes from '../.agent/memory/project/specs/menu-system-layout4/goldens/fixtures/f1-pending-nos-routes.json';
import { collectHrefs } from './utils/collect-nav-hrefs';
import {
  NOS_GROUPS,
  NOS_PAST_SHOWS_PATH,
  NOS_PLAIN_LEAVES,
  NOS_TICKETS,
  cleanHref,
} from './utils/nos-nav-hrefs';
import { isAbsolute, nosBase } from './utils/site-urls';

const VIEWPORT_HEIGHT = 800;
const PENDING_ROUTES = new Set<string>(pendingNosRoutes.pendingRoutes);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// A destination's accessible name is its label, so match the label at the start of the name.
function labelMatcher(label: string): RegExp {
  return new RegExp(`^${escapeRegExp(label)}\\b`);
}

function urlPattern(path: string): RegExp {
  return new RegExp(`${escapeRegExp(path)}$`);
}

// ---------------------------------------------------------------
// SAOC drawer
// ---------------------------------------------------------------
const SAOC_LINKS = NAV.filter((item) => !item.disabled).map((item) => ({
  label: item.label,
  href: item.href,
}));
const SAOC_PAGES = SAOC_LINKS.filter((l) => !isAbsolute(l.href));
const SAOC_CROSS_SITE = SAOC_LINKS.filter((l) => isAbsolute(l.href));

// Consistency proof, not test coverage of its own: every href the SAOC drawer is about to exercise
// must be one collectHrefs(NAV) finds, and the other way round.
{
  const collected = new Set(collectHrefs(NAV));
  const derived = new Set(SAOC_LINKS.map((l) => l.href));
  const missingFromDerived = [...collected].filter((href) => !derived.has(href));
  const missingFromCollected = [...derived].filter((href) => !collected.has(href));
  if (missingFromDerived.length > 0 || missingFromCollected.length > 0) {
    throw new Error(
      'NAV collectors have diverged — ' +
        `collectHrefs(NAV) found hrefs this spec misses: [${missingFromDerived.join(', ')}]; ` +
        `this spec has hrefs collectHrefs(NAV) doesn't find: [${missingFromCollected.join(', ')}]`,
    );
  }
}

async function openSaocDrawer(page: Page) {
  await page.getByRole('button', { name: 'Open menu' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

// ---------------------------------------------------------------
// NOS menu panel
// ---------------------------------------------------------------
async function openNosPanel(page: Page, baseURL: string) {
  await page.goto(`${nosBase(baseURL)}/`);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const panel = page.getByRole('navigation', { name: 'Main menu' });
  await expect(panel).toBeVisible();
  return panel;
}

async function expandGroup(panel: import('@playwright/test').Locator, heading: string) {
  const trigger = panel.getByRole('button', { name: heading, exact: true });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
}

for (const width of [390, 320] as const) {
  test.describe(`mobile menus at ${width}px`, () => {
    test.use({ viewport: { width, height: VIEWPORT_HEIGHT } });

    for (const { label, href } of SAOC_PAGES) {
      test(`SAOC drawer reaches "${label}"`, async ({ page }) => {
        await page.goto('/');
        const dialog = await openSaocDrawer(page);
        await dialog.getByRole('link', { name: label, exact: true }).click();
        await page.waitForURL(urlPattern(href));
        await expect(page).toHaveURL(urlPattern(href));
      });
    }

    for (const { label, href } of SAOC_CROSS_SITE) {
      test(`SAOC drawer links "${label}" to the NOS site (asserted by href, not followed)`, async ({
        page,
      }) => {
        await page.goto('/');
        const dialog = await openSaocDrawer(page);
        const link = dialog.getByRole('link', { name: label, exact: true });
        await expect(link).toHaveAttribute('href', href);
        await expect(link).not.toHaveAttribute('target', /.+/);
      });
    }

    for (const group of NOS_GROUPS) {
      for (const leaf of group.links) {
        const path = cleanHref(leaf);
        const testName = `NOS menu "${group.heading}" reaches "${leaf.label}"`;

        if (PENDING_ROUTES.has(leaf.href)) {
          test.skip(`${testName} (pending NOS route — see f1-pending-nos-routes.json)`, () => {});
          continue;
        }

        test(testName, async ({ page, baseURL }) => {
          const panel = await openNosPanel(page, baseURL!);
          await expandGroup(panel, group.heading);

          // Real reachability: Playwright's click() auto-scrolls the panel to bring the target
          // into view and fails outright if it is clipped.
          const destination = panel.getByRole('link', { name: labelMatcher(leaf.label) }).first();
          await expect(destination).toBeVisible();
          await destination.click();

          await page.waitForURL(urlPattern(path));
          await expect(page).toHaveURL(urlPattern(path));
        });
      }
    }

    for (const leaf of NOS_PLAIN_LEAVES) {
      const path = cleanHref(leaf);
      const isPastShows = path === NOS_PAST_SHOWS_PATH;

      test(`NOS menu reaches "${leaf.label}"${isPastShows ? ' (withheld in public, r64)' : ''}`, async ({
        page,
        baseURL,
      }) => {
        const panel = await openNosPanel(page, baseURL!);
        const destination = panel.getByRole('link', { name: leaf.label, exact: true });

        if (isPastShows) {
          const probe = await page.request.get(`${nosBase(baseURL!)}${path}`);
          if (probe.status() === 404) {
            await expect(destination).toHaveCount(0);
            return;
          }
        }

        await expect(destination).toBeVisible();
        await destination.click();
        await page.waitForURL(urlPattern(path));
        await expect(page).toHaveURL(urlPattern(path));
      });
    }

    test('NOS header keeps the Tickets call to action at this width and it reaches Tickets', async ({
      page,
      baseURL,
    }) => {
      await page.goto(`${nosBase(baseURL!)}/`);
      const cta = page.locator('header#nh').getByRole('link', { name: NOS_TICKETS.label, exact: true });
      await expect(cta).toBeVisible();
      await cta.click();
      await page.waitForURL(urlPattern(cleanHref(NOS_TICKETS)));
    });

    test('NOS menu links Contact to the show contact page and ends with the SAOC credit', async ({
      page,
      baseURL,
    }) => {
      const panel = await openNosPanel(page, baseURL!);
      const contact = panel.getByRole('link', { name: 'Contact', exact: true });
      const href = (await contact.getAttribute('href')) ?? '';
      expect(isAbsolute(href), `Contact must stay on the NOS site, got ${href}`).toBe(false);
      expect(href).toBe('/contact');

      const credit = panel.locator('.nd-credit a');
      await expect(credit).toHaveText('South African Orchid Council');
      expect(new URL((await credit.getAttribute('href')) ?? '').pathname).toBe('/');
    });
  });
}
