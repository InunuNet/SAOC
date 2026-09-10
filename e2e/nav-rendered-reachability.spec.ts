// =============================================================
// SAOC — e2e/nav-rendered-reachability.spec.ts
// Mission menu-system-layout4 M2 — closes the "measures the data file, not the
// rendered page" gap. Both e2e/nav-links-200.spec.ts and F1's
// contracts/checks/menu-system-layout4-f1/check-nav-hrefs-golden.mjs prove an
// href exists in the NAV *data export* (components/chrome/nav-config.ts). Neither
// ever opens the flyout or the drawer and looks at what a real user can click.
// This spec does exactly that, closing this repo's own audited defect class
// ("assertion satisfiable by something that isn't the real property").
//
// PROPERTY (mission section 6, properties 1 & 2): every href present in NAV's
// data is a real, clickable <a href> inside the rendered flyout (desktop) and
// drawer (mobile) — reachable FROM THE HEADER, not merely present somewhere in
// the page, and not merely present in nav-config.ts.
//
// This spec is written against a concrete, already-confirmed defect (verified by
// reading components/chrome/MegaMenu.tsx and MobileMenu.tsx directly on
// 2026-09-10): both components gate their only rendered CTA on `item.ctaLabel`,
// a top-level NavItem field nav-config.ts never sets on the National Show mega —
// `item.lead` and `item.featureRail` are read by NEITHER component. Net effect:
// /national-show itself, and both Tickets hrefs (lead.theShow's and
// featureRail's), have no rendered anchor anywhere in the site today. This spec
// MUST fail against today's tree, naming those hrefs. Do not "fix" this spec to
// pass by loosening its scope (e.g. searching the whole page instead of the
// header/drawer, or dropping lead/featureRail from the required set) — F2/F3 are
// what wire item.lead/item.featureRail into the real render path; that is what
// must change, not this spec's definition of "reachable".
import { expect, test } from '@playwright/test';

import { NAV, type NavItem } from '@/components/chrome/nav-config';

// Every href that must be a real, clickable anchor somewhere in NAV's rendered
// surface — deliberately wider than e2e/nav-links-200.spec.ts's collectHrefs,
// which only walks `item.href` + `columns[].links[].href` and would itself
// silently miss lead.leadHref, lead.theShow's links, and featureRail.ctaHref.
function collectAllNavHrefs(items: readonly NavItem[]): string[] {
  const hrefs: string[] = [];
  for (const item of items) {
    if (item.type === 'link') {
      hrefs.push(item.href);
      continue;
    }
    hrefs.push(item.href);
    if (item.lead) {
      hrefs.push(item.lead.leadHref);
      for (const link of item.lead.theShow.links) hrefs.push(link.href);
    }
    for (const column of item.columns) {
      if (column.headingHref) hrefs.push(column.headingHref);
      for (const link of column.links) hrefs.push(link.href);
    }
    if (item.featureRail) hrefs.push(item.featureRail.ctaHref);
  }
  return Array.from(new Set(hrefs));
}

const ALL_NAV_HREFS = collectAllNavHrefs(NAV);

async function renderedAnchorHrefs(scope: import('@playwright/test').Locator): Promise<string[]> {
  return scope
    .locator('a[href]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('href')).filter((h): h is string => h !== null));
}

test.describe('nav hrefs are reachable from the rendered header (not just present in NAV data)', () => {
  test('NAV data is non-empty (sanity)', () => {
    expect(ALL_NAV_HREFS.length).toBeGreaterThan(0);
  });

  // Desktop scope: MegaMenu's panel is a DOM descendant of the nav item, itself
  // inside <header> — so collecting from `header` after opening every mega
  // proves reachability without assuming anything about where in the tree the
  // panel portal-renders (it doesn't portal; this stays a direct check either way).
  test('desktop: every NAV href is a real anchor inside the header, flyout open', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const header = page.locator('header');
    const rendered = new Set<string>();
    for (const href of await renderedAnchorHrefs(header)) rendered.add(href);

    for (const item of NAV) {
      if (item.type !== 'mega') continue;
      const trigger = header.getByRole('button', { name: item.label, exact: true });
      await trigger.click();
      const panel = header.getByRole('menu', { name: item.label });
      await expect(panel).toBeVisible();
      for (const href of await renderedAnchorHrefs(header)) rendered.add(href);
      await trigger.click(); // close before opening the next mega
    }

    const missing = ALL_NAV_HREFS.filter((href) => !rendered.has(href));
    expect(
      missing,
      `these NAV hrefs exist in nav-config.ts but are NOT a real <a href> anywhere inside the ` +
        `rendered, opened desktop header: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  // Mobile scope: MobileMenu renders as a DOM sibling of <header>, not a
  // descendant — "reachable from the header" is proven by the fact that opening
  // it requires the header's own "Open menu" hamburger button, not by DOM
  // nesting, so anchors are collected from the drawer's role="dialog" instead.
  test('mobile: every NAV href is a real anchor inside the drawer, drawer open', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await page.getByRole('button', { name: 'Open menu' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const rendered = new Set<string>();
    for (const href of await renderedAnchorHrefs(dialog)) rendered.add(href);

    for (const item of NAV) {
      if (item.type !== 'mega') continue;
      const trigger = dialog.getByRole('button', { name: item.label, exact: true });
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      for (const href of await renderedAnchorHrefs(dialog)) rendered.add(href);
    }

    const missing = ALL_NAV_HREFS.filter((href) => !rendered.has(href));
    expect(
      missing,
      `these NAV hrefs exist in nav-config.ts but are NOT a real <a href> anywhere inside the ` +
        `rendered, opened mobile drawer: ${missing.join(', ')}`,
    ).toEqual([]);
  });
});
