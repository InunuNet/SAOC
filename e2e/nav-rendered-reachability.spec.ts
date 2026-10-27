// =============================================================
// SAOC — e2e/nav-rendered-reachability.spec.ts
// Mission menu-system-layout4 M2 — closes the "measures the data file, not the
// rendered page" gap. Both e2e/nav-links-200.spec.ts and F1's
// contracts/checks/menu-system-layout4-f1/check-nav-hrefs-golden.mjs prove an
// href exists in the NAV *data export*. Neither ever opens a menu and looks at what a real user
// can click. This spec does exactly that, closing this repo's own audited defect class
// ("assertion satisfiable by something that isn't the real property").
//
// PROPERTY (mission section 6, properties 1 & 2): every href present in the nav data is a real,
// clickable <a href> inside the rendered header (desktop) and drawer (mobile) — reachable FROM THE
// HEADER, not merely present somewhere in the page, and not merely present in the nav data.
//
// Mission nos-site-split F3: two sites, two navs. The SAOC header (components/chrome/Header.tsx)
// renders NAV (SAOC pages and one absolute link to the NOS home) plus Contact; the National Orchid
// Show header (components/nos-chrome/NosHeader.tsx) renders its own groups from NOS_NAV on the NOS
// host, at clean paths, plus Contact as an absolute SAOC URL. Neither header has a mega menu.
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { CONTACT_LINK, NAV } from '@/components/chrome/nav-config';
import { collectHrefs } from './utils/collect-nav-hrefs';
import { NOS_GROUPS, NOS_REQUIRED_HEADER_HREFS } from './utils/nos-nav-hrefs';
import { nosBase } from './utils/site-urls';

const SAOC_NAV_HREFS = Array.from(new Set([...collectHrefs(NAV), CONTACT_LINK.href]));

// The dev server resolves the SAOC origin from its own environment, which this process does not
// share, so an absolute SAOC link is matched on its path and on not being a NOS-host link.
function isSaocLink(href: string, pathname: string): boolean {
  const url = new URL(href, 'http://relative.invalid');
  return url.hostname !== 'relative.invalid' && !url.hostname.startsWith('nos.') && url.pathname === pathname;
}

// Only anchors a user can see count: the NOS panels keep their links in the DOM while closed
// (`hidden`), and a closed panel's links are not reachable.
async function renderedAnchorHrefs(scope: Locator): Promise<string[]> {
  return scope.locator('a[href]').evaluateAll((els) =>
    els
      .filter((el) => el.checkVisibility())
      .map((el) => el.getAttribute('href'))
      .filter((h): h is string => h !== null),
  );
}

// Visible is not the same as reachable (Codex cross-model review, 2026-09-10): an anchor with
// `pointer-events: none`, or covered by a positioned overlay, is visible under Playwright's own
// toBeVisible() while a real user still cannot click it. For every href currently present in
// `scope`, run a TRIAL click (`click({ trial: true })`), which performs Playwright's full
// actionability wait without actually navigating.
async function assertPresentAnchorsActionable(
  scope: Locator,
  hrefs: readonly string[],
): Promise<void> {
  for (const href of hrefs) {
    const anchor = scope.locator(`a[href="${href}"]`).first();
    if ((await anchor.count()) === 0 || !(await anchor.isVisible())) continue;
    try {
      await anchor.click({ trial: true, timeout: 5000 });
    } catch (err) {
      throw new Error(
        `nav href is present in the DOM but not actionable by a real user (Playwright's ` +
          `actionability check failed — commonly pointer-events:none or an overlay sitting on ` +
          `top of it): ${href}\n${(err as Error).message}`,
      );
    }
  }
}

function assertNoneMissing(required: readonly string[], rendered: Set<string>, where: string) {
  const missing = required.filter((href) => !rendered.has(href));
  expect(
    missing,
    `these nav hrefs exist in the nav data but are NOT a real <a href> anywhere inside the ` +
      `rendered ${where}: ${missing.join(', ')}`,
  ).toEqual([]);
}

test.describe('SAOC nav hrefs are reachable from the rendered header', () => {
  test('nav data is non-empty (sanity)', () => {
    expect(SAOC_NAV_HREFS.length).toBeGreaterThan(0);
  });

  // The inline nav shows from the shared full breakpoint (1384px, HD-1); below it the same links are
  // in the drawer, which the mobile test and the menu-band test below cover.
  test('desktop: every SAOC NAV href is a real anchor inside the header', async ({ page }) => {
    await page.setViewportSize({ width: 1384, height: 900 });
    await page.goto('/');

    const header = page.locator('header');
    assertNoneMissing(SAOC_NAV_HREFS, new Set(await renderedAnchorHrefs(header)), 'desktop header');
    await assertPresentAnchorsActionable(header, SAOC_NAV_HREFS);
  });

  // SA-1 (NOS Design confirmed): from 1280 to 1383 five items are inline (Sponsors and Contact live in the drawer) beside an icon-only
  // Menu button; the drawer carries every SAOC NAV href.
  for (const width of [1280, 1383]) {
    test(`menu band (${width}px): 5 inline items and every SAOC NAV href is in the drawer`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      await expect(page.locator('header [data-hd="nav"]')).toBeVisible();
      await expect(page.locator('header [data-hd="nav"] [data-hd="item"]')).toHaveCount(5);
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      assertNoneMissing(SAOC_NAV_HREFS, new Set(await renderedAnchorHrefs(dialog)), `menu-band drawer @${width}`);
      await assertPresentAnchorsActionable(dialog, SAOC_NAV_HREFS);
    });
  }

  // MobileMenu renders as a DOM sibling of <header>, not a descendant — "reachable from the header"
  // is proven by the fact that opening it requires the header's own "Menu" button.
  test('mobile: every SAOC NAV href is a real anchor inside the drawer, drawer open', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    assertNoneMissing(SAOC_NAV_HREFS, new Set(await renderedAnchorHrefs(dialog)), 'mobile drawer');
    await assertPresentAnchorsActionable(dialog, SAOC_NAV_HREFS);
  });
});

test.describe('NOS nav hrefs are reachable from the rendered NOS header', () => {
  test('nav data is non-empty (sanity)', () => {
    expect(NOS_REQUIRED_HEADER_HREFS.length).toBeGreaterThan(0);
  });

  // Each group's links live in a disclosure panel that only exists as visible once its trigger is
  // clicked, so the panels are opened one by one and the rendered anchors collected from each state.
  test('desktop: every NOS nav href is a real anchor inside the header, each group opened', async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${nosBase(baseURL!)}/`);

    const header = page.locator('header#nh');
    const rendered = new Set<string>(await renderedAnchorHrefs(header));

    for (const group of NOS_GROUPS) {
      const trigger = header.getByRole('button', { name: group.heading, exact: true });
      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      for (const href of await renderedAnchorHrefs(header)) rendered.add(href);
      await assertPresentAnchorsActionable(header, NOS_REQUIRED_HEADER_HREFS);
      await trigger.click(); // close before opening the next group
    }

    assertNoneMissing(NOS_REQUIRED_HEADER_HREFS, rendered, 'desktop NOS header');
    expect(
      [...rendered].some((href) => href === CONTACT_LINK.href),
      'the NOS header has no NOS /contact link',
    ).toBe(true);
  });

  test('mobile: every NOS nav href is a real anchor inside the menu panel, each group opened', async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${nosBase(baseURL!)}/`);

    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const panel = page.getByRole('navigation', { name: 'Main menu' });
    await expect(panel).toBeVisible();

    const rendered = new Set<string>(await renderedAnchorHrefs(panel));
    for (const group of NOS_GROUPS) {
      const trigger = panel.getByRole('button', { name: group.heading, exact: true });
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      for (const href of await renderedAnchorHrefs(panel)) rendered.add(href);
      await assertPresentAnchorsActionable(panel, NOS_REQUIRED_HEADER_HREFS);
    }

    // The drawer has no logo link and no Tickets button of its own: the header keeps the Tickets
    // call to action at every width, and the logo links home.
    const header = page.locator('header#nh');
    for (const href of await renderedAnchorHrefs(header)) rendered.add(href);
    assertNoneMissing(NOS_REQUIRED_HEADER_HREFS, rendered, 'mobile NOS header and menu');
    expect(
      [...rendered].some((href) => href === CONTACT_LINK.href),
      'the NOS menu panel has no NOS /contact link',
    ).toBe(true);
  });

  test('the SAOC credit sits at the end of the mobile menu panel as a link to the SAOC site', async ({
    page,
    baseURL,
  }: {
    page: Page;
    baseURL: string | undefined;
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${nosBase(baseURL!)}/`);

    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const credit = page.getByRole('navigation', { name: 'Main menu' }).locator('.nd-credit a');

    expect(isSaocLink((await credit.getAttribute('href')) ?? '', '/')).toBe(true);
    await expect(credit).toHaveText('South African Orchid Council');
  });
});
