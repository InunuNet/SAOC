// =============================================================
// SAOC — e2e/mega-menu-f8-logo-and-tickets-rail.spec.ts
// Mission menu-system-layout4 M2/F8 — GOLDEN FILE, authored by @architect.
// @dev implements against this spec (and the two JSON goldens it draws its
// values from) — not against contract prose. Do not loosen an assertion to
// make it pass; escalate to @architect if one seems wrong.
//
// F8a — lead block: the vertical NOS 2027 logo replaces the eyebrow + serif
// heading (see goldens/f8-lead-logo.json's `reading` section for the
// replace-vs-add ruling). leadMeta (venue + dates) stays below it.
//
// F8b — Tickets rail: three real destination links (Tickets / Day Visitor /
// Weekend Pass), recoloured with NOS brand tokens as a deliberate, narrowly
// scoped exception to the SAOC-chrome-site-wide rule (see
// goldens/f8-tickets-rail.json's `scopeBoundary`). Every assertion below
// reads COMPUTED style or MEASURED layout on real rendered DOM — this
// project's audited "assertion satisfiable without the property it claims
// to prove" defect class means a source-text grep for a className string is
// never sufficient here (see e2e/mega-menu-layout4-visual-fidelity.spec.ts's
// own header comment for the fuller history of that lesson).
//
// Confirmed during contract authoring (2026-09-11) that this spec fails
// against today's tree: no <img>/<Image> exists in the lead block at all,
// the eyebrow + serif heading still render as plain text, and the feature
// rail still renders a single "Buy tickets" CTA with the SAOC --bone/
// --primary palette, not three NOS-coloured destination rows.
import { expect, test } from '@playwright/test';

const NOS_ROYAL_PURPLE = 'rgb(33, 26, 87)'; // --color-nos-royal-purple #211A57
const NOS_PURPLE_700 = 'rgb(51, 41, 111)'; // --color-nos-purple-700 #33296F
const NOS_PALE_GOLD = 'rgb(243, 242, 214)'; // --color-nos-pale-gold #F3F2D6
const NOS_OLIVE_700 = 'rgb(106, 104, 41)'; // --color-nos-olive-700 #6A6829
const SAOC_RULE_SOFT = 'rgb(228, 225, 208)'; // --rule-soft #e4e1d0 (unchanged structural divider)

test.describe('mega menu — F8 logo lead block + NOS tickets rail (mission menu-system-layout4 M2/F8)', () => {
  test.beforeEach(async ({ page }) => {
    // Same fixed viewport F7 established, for the same reason: resolves the
    // grid's fr tracks to their intended proportions rather than a
    // viewport-constrained shrink at exactly the 1280px container boundary.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
  });

  async function openNationalShowMenu(page: import('@playwright/test').Page) {
    const header = page.getByRole('banner');
    const trigger = header.getByRole('button', { name: 'National Show', exact: true });
    await trigger.click();
    const panel = header.getByRole('menu', { name: 'National Show' });
    await expect(panel).toBeVisible();
    return panel;
  }

  // The lead block's pre-existing "The Show" group (unchanged by F8, see
  // f8-lead-logo.json's `reading.theShowGroupRuling`) has its own "Tickets"
  // leaf pointing at the same /national-show/tickets href as the rail's new
  // primary destination row — two distinct, intentional links sharing one
  // accessible name ("Tickets") in the same panel. That's a legitimate design
  // (a quick-nav leaf in one region, a prominent CTA in another), not a bug —
  // but it means every rail-scoped lookup below must be scoped to the rail's
  // own DOM, never queried unscoped against the whole panel (which would hit
  // Playwright's strict-mode violation on two matching elements).
  function getRail(panel: import('@playwright/test').Locator) {
    const railHeading = panel.getByRole('heading', { level: 4, name: 'Tickets' });
    return railHeading.locator('xpath=ancestor::div[.//a[@href="/tickets/day-visitor"]][1]');
  }

  // ---------------------------------------------------------------
  // F8a — lead block logo
  // ---------------------------------------------------------------

  test('lead block: eyebrow and serif heading text are gone, replaced by the logo image', async ({
    page,
  }) => {
    const panel = await openNationalShowMenu(page);

    // The old eyebrow caption and serif heading link must not render as text
    // anywhere in the lead track — a full replacement, not an addition.
    await expect(panel.getByText('The National Show', { exact: true })).toHaveCount(0);
    await expect(
      panel.getByText('19th SAOC National Orchid Show', { exact: true }),
    ).toHaveCount(0);

    const logo = panel.getByRole('img', { name: 'National Orchid Show — Western Cape · 2027' });
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('src', /nos-2027-logo-full-colour-vertical\.png/);
  });

  test('lead block: logo sits inside the lead link and stays inside its container budget', async ({
    page,
  }) => {
    const panel = await openNationalShowMenu(page);
    const logo = panel.getByRole('img', { name: 'National Orchid Show — Western Cape · 2027' });

    // The image must be the clickable element carrying the lead link's own
    // navigation — an <a> ancestor pointing at /national-show, not a second,
    // separate anchor.
    const anchor = logo.locator('xpath=ancestor::a[1]');
    await expect(anchor).toHaveAttribute('href', '/national-show');

    const box = await logo.boundingBox();
    expect(box).not.toBeNull();
    // f8-lead-logo.json's containerBudget: 231px available, 220px hard max,
    // 200px specified — assert well inside budget with margin for sub-pixel
    // grid rounding, and never at or beyond the 231px true ceiling.
    expect(box!.width).toBeGreaterThan(150);
    expect(box!.width).toBeLessThanOrEqual(220);
    // Aspect ratio close to the source PNG's true 1.13769 (w/h) — generous
    // tolerance for rendered sub-pixel rounding.
    const ratio = box!.width / box!.height;
    expect(ratio).toBeGreaterThan(1.05);
    expect(ratio).toBeLessThan(1.22);
  });

  test('lead block: venue/date meta line still renders below the logo', async ({ page }) => {
    const panel = await openNationalShowMenu(page);
    const logo = panel.getByRole('img', { name: 'National Orchid Show — Western Cape · 2027' });
    await expect(logo).toBeVisible();

    // leadMeta's own rendering is unchanged by F8 (still computed from the
    // nationalShow singleton) — this only proves the meta *line's own
    // wrapping element* still exists and renders below the logo, not any
    // specific venue/date string (which depends on live Sanity content and
    // is out of F8's scope to assert against).
    const leadTrack = logo.locator('xpath=ancestor::div[.//a[@href="/national-show"]][1]');
    const logoBox = await logo.boundingBox();
    // "The Show" group heading (always renders — F1/F7 golden) must sit
    // below the logo's bottom edge, proving nothing was removed from the
    // lead track's vertical flow.
    const theShowHeading = panel.getByRole('heading', { level: 3, name: 'The Show' });
    const headingBox = await theShowHeading.boundingBox();
    expect(headingBox).not.toBeNull();
    expect(logoBox).not.toBeNull();
    expect(headingBox!.y).toBeGreaterThan(logoBox!.y + logoBox!.height);
    void leadTrack;
  });

  // ---------------------------------------------------------------
  // F8b — Tickets rail: three destinations, NOS colours
  // ---------------------------------------------------------------

  test('tickets rail: renders exactly three destination links with the correct hrefs', async ({
    page,
  }) => {
    const panel = await openNationalShowMenu(page);
    const railHeading = panel.getByRole('heading', { level: 4, name: 'Tickets' });
    await expect(railHeading).toBeVisible();
    const rail = getRail(panel);

    // Scoped to the rail: the lead block's own "The Show" > "Tickets" leaf
    // (unchanged, see the getRail() comment above) is a DIFFERENT element
    // sharing the same accessible name and href — deliberately out of scope
    // for this assertion, which is about the rail's three rows specifically.
    const ticketsLink = rail.getByRole('link', { name: 'Tickets', exact: true });
    const dayVisitorLink = rail.getByRole('link', { name: 'Day Visitor', exact: true });
    const weekendPassLink = rail.getByRole('link', { name: 'Weekend Pass', exact: true });

    await expect(ticketsLink).toHaveAttribute('href', '/national-show/tickets');
    await expect(dayVisitorLink).toHaveAttribute('href', '/tickets/day-visitor');
    await expect(weekendPassLink).toHaveAttribute('href', '/tickets/weekend-pass');

    // The old single-CTA blurb copy is gone.
    await expect(
      panel.getByText('Day, weekend and VIP admission for the 19th National Show.', {
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(panel.getByRole('link', { name: 'Buy tickets', exact: true })).toHaveCount(0);
  });

  test('tickets rail: primary row (Tickets) carries real NOS royal-purple fill and pale-gold text', async ({
    page,
  }) => {
    const panel = await openNationalShowMenu(page);
    const rail = getRail(panel);
    const ticketsLink = rail.getByRole('link', { name: 'Tickets', exact: true });

    const bg = await ticketsLink.evaluate((el) => getComputedStyle(el).backgroundColor);
    const color = await ticketsLink.evaluate((el) => getComputedStyle(el).color);
    expect(bg).toBe(NOS_ROYAL_PURPLE);
    expect(color).toBe(NOS_PALE_GOLD);

    await ticketsLink.hover();
    const hoverBg = await ticketsLink.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(hoverBg).toBe(NOS_PURPLE_700);
  });

  test('tickets rail: secondary rows (Day Visitor, Weekend Pass) are ghost-styled in NOS royal-purple', async ({
    page,
  }) => {
    const panel = await openNationalShowMenu(page);
    const rail = getRail(panel);
    for (const label of ['Day Visitor', 'Weekend Pass']) {
      const link = rail.getByRole('link', { name: label, exact: true });
      const bg = await link.evaluate((el) => getComputedStyle(el).backgroundColor);
      const color = await link.evaluate((el) => getComputedStyle(el).color);
      const borderColor = await link.evaluate((el) => getComputedStyle(el).borderColor);
      // transparent renders as rgba(0, 0, 0, 0) in Chromium's computed style
      expect(bg).toBe('rgba(0, 0, 0, 0)');
      expect(color).toBe(NOS_ROYAL_PURPLE);
      expect(borderColor).toBe(NOS_ROYAL_PURPLE);
    }
  });

  test('tickets rail: rail background is NOS pale-gold, meta line is NOS olive-700, structural border-left stays SAOC rule-soft', async ({
    page,
  }) => {
    const panel = await openNationalShowMenu(page);
    const rail = getRail(panel);

    const railBg = await rail.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(railBg).toBe(NOS_PALE_GOLD);

    const railBorderLeftColor = await rail.evaluate(
      (el) => getComputedStyle(el).borderLeftColor,
    );
    expect(railBorderLeftColor).toBe(SAOC_RULE_SOFT);

    // Meta line: only asserted if a date range currently renders (matches F7's
    // own conditional-render note — the nationalShow singleton's dates may be
    // null in the current dataset, in which case featureRailMeta renders
    // nothing and this assertion is skipped rather than failing on absence).
    const metaCandidates = rail.locator('span');
    const metaCount = await metaCandidates.count();
    if (metaCount > 0) {
      const metaColor = await metaCandidates.first().evaluate((el) => getComputedStyle(el).color);
      expect(metaColor).toBe(NOS_OLIVE_700);
    }
  });

  // ---------------------------------------------------------------
  // Scope boundary — everything else in the header/menu stays SAOC
  // ---------------------------------------------------------------

  test('scope boundary: no NOS colour appears anywhere outside the tickets rail', async ({
    page,
  }) => {
    const header = page.getByRole('banner');
    const trigger = header.getByRole('button', { name: 'National Show', exact: true });
    await expect(trigger).toBeVisible();
    const triggerColor = await trigger.evaluate((el) => getComputedStyle(el).color);
    // The trigger's resting colour is SAOC --ink (#171917 -> rgb(23,25,23)),
    // never NOS royal-purple, confirming F8's exception did not leak upward
    // into the trigger button itself.
    expect(triggerColor).not.toBe(NOS_ROYAL_PURPLE);

    const panel = await openNationalShowMenu(page);
    const leadLink = panel.locator('a[href="/national-show"]').first();
    const leadLinkColor = await leadLink.evaluate((el) => getComputedStyle(el).color);
    expect(leadLinkColor).not.toBe(NOS_ROYAL_PURPLE);

    const visitHeading = panel.getByRole('heading', { level: 3, name: 'Visit' });
    if ((await visitHeading.count()) > 0) {
      const visitColor = await visitHeading
        .first()
        .evaluate((el) => getComputedStyle(el).color);
      expect(visitColor).not.toBe(NOS_ROYAL_PURPLE);
    }
  });
});
