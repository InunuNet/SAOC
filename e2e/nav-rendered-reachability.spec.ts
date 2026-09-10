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
      // item.lead.theShow is itself a NavColumn — MegaMenu/MobileMenu render
      // its headingHref as a <Link> whenever non-null, same as any other
      // column's headingHref below. Null today, but must be collected so a
      // future non-null value can't go unreachable here undetected.
      if (item.lead.theShow.headingHref) hrefs.push(item.lead.theShow.headingHref);
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

// Visible is not the same as reachable (Codex cross-model review, 2026-09-10):
// an anchor with `pointer-events: none`, or covered by a positioned overlay, is
// visible under Playwright's own toBeVisible() — display/visibility/size/hidden
// all check out — while a real user still cannot click it. For every href that
// is currently present in `scope`, run a TRIAL click (`click({ trial: true })`),
// which performs Playwright's full actionability wait — attached, visible,
// stable, receives pointer events at its own hit-target point, AND enabled —
// without actually navigating. That is the correct instrument for "a user can
// click this", not a hand-rolled getComputedStyle check, and not toBeVisible()
// alone. Called once per DOM state (initial load, and after each mega/drawer
// panel opens) so every href is checked while its own panel is the one open.
async function assertPresentAnchorsActionable(
  scope: import('@playwright/test').Locator,
  hrefs: readonly string[],
): Promise<void> {
  for (const href of hrefs) {
    const anchor = scope.locator(`a[href="${href}"]`).first();
    if ((await anchor.count()) === 0) continue;
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
    await assertPresentAnchorsActionable(header, ALL_NAV_HREFS);

    for (const item of NAV) {
      if (item.type !== 'mega') continue;
      const trigger = header.getByRole('button', { name: item.label, exact: true });
      await trigger.click();
      const panel = header.getByRole('menu', { name: item.label });
      await expect(panel).toBeVisible();
      for (const href of await renderedAnchorHrefs(header)) rendered.add(href);
      await assertPresentAnchorsActionable(header, ALL_NAV_HREFS);
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
    await assertPresentAnchorsActionable(dialog, ALL_NAV_HREFS);

    for (const item of NAV) {
      if (item.type !== 'mega') continue;
      const trigger = dialog.getByRole('button', { name: item.label, exact: true });
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      for (const href of await renderedAnchorHrefs(dialog)) rendered.add(href);
      await assertPresentAnchorsActionable(dialog, ALL_NAV_HREFS);
    }

    const missing = ALL_NAV_HREFS.filter((href) => !rendered.has(href));
    expect(
      missing,
      `these NAV hrefs exist in nav-config.ts but are NOT a real <a href> anywhere inside the ` +
        `rendered, opened mobile drawer: ${missing.join(', ')}`,
    ).toEqual([]);
  });
});
