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
    // Hrefs match main's nav-config (/tickets/...); the /buy router mission is unsanctioned and not on main.
    const railHeading = panel.getByRole('heading', { level: 4, name: 'Tickets' });
    return railHeading.locator(
      'xpath=ancestor::div[.//a[@href="/national-show/tickets#ticket-day"]][1]'
    );
  }

  // ---------------------------------------------------------------
  // R66 (launch-weekend F11) — lead block is the show title, not the logo
  // ---------------------------------------------------------------

  test('lead block: the show title is a text link to the hub, and no lockup image renders', async ({
    page,
  }) => {
    const panel = await openNationalShowMenu(page);

    const title = panel.getByRole('link', { name: '19th National Orchid Show', exact: true });
    await expect(title).toBeVisible();
    await expect(title).toHaveAttribute('href', '/national-show');
    await expect(panel.getByRole('img')).toHaveCount(0);
  });

  // AMENDED (contract-f8.yaml A3, 2026-09-21) after Codex found this test
  // vacuous — the original built a `leadTrack` locator and never used it
  // except to silence an unused-var lint; the only real assertion was that
  // "The Show" heading sits below the logo, which never located leadMeta at
  // all (deleting leadMeta from MegaMenu.tsx entirely would have left it
  // green). Runs UNCONDITIONALLY, not count-guarded — the current dataset's
  // venue name is real and non-null (MegaMenu.tsx:89, project memory
  // project_national_show_venue), so an empty/missing leadMeta here is a
  // real regression, not an expected absence.
  test('lead block: venue/date meta line still renders below the title', async ({ page }) => {
    const panel = await openNationalShowMenu(page);
    const title = panel.getByRole('link', { name: '19th National Orchid Show', exact: true });
    await expect(title).toBeVisible();

    const leadMeta = panel.getByTestId('mega-menu-lead-meta');
    await expect(leadMeta).toBeVisible();
    const metaText = ((await leadMeta.textContent()) ?? '').trim();
    expect(metaText.length).toBeGreaterThan(0);

    // "The Show" group heading (always renders — F1/F7 golden) must sit
    // below the title's bottom edge, proving nothing was removed from the
    // lead track's vertical flow.
    const theShowHeading = panel.getByRole('heading', { level: 3, name: 'The show' });
    const titleBox = await title.boundingBox();
    const metaBox = await leadMeta.boundingBox();
    const headingBox = await theShowHeading.boundingBox();
    expect(titleBox).not.toBeNull();
    expect(metaBox).not.toBeNull();
    expect(headingBox).not.toBeNull();

    // leadMeta itself sits between the title's bottom edge and the heading's
    // top edge — 1px slop for sub-pixel rendering/rounding.
    expect(metaBox!.y).toBeGreaterThanOrEqual(titleBox!.y + titleBox!.height - 1);
    expect(metaBox!.y + metaBox!.height).toBeLessThanOrEqual(headingBox!.y + 1);
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

    // Codex finding (2026-09-21): the title says "exactly three" but nothing
    // below measured a count — three named links with the right hrefs stays
    // green even with a fourth destination added. Assert the count first,
    // scoped to the rail (not the panel — the lead block's own "The Show" >
    // "Tickets" leaf, per the getRail() comment above, shares the same
    // accessible name and href but is a different element and out of scope
    // here), so a count mismatch fails with the clearer message before the
    // per-link assertions run.
    await expect(rail.getByRole('link')).toHaveCount(3);

    const ticketsLink = rail.getByRole('link', { name: 'Tickets', exact: true });
    const dayVisitorLink = rail.getByRole('link', { name: 'Day Visitor', exact: true });
    const weekendPassLink = rail.getByRole('link', { name: 'Weekend Pass', exact: true });

    await expect(ticketsLink).toHaveAttribute('href', '/national-show/tickets');
    await expect(dayVisitorLink).toHaveAttribute('href', '/national-show/tickets#ticket-day');
    await expect(weekendPassLink).toHaveAttribute(
      'href',
      '/national-show/tickets#ticket-weekend'
    );

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

  // AMENDED / SPLIT (contract-f8.yaml A7, 2026-09-21) after Codex found the
  // meta-line half of this test vacuous — it selected `rail.locator('span')`
  // (any span, not the meta line specifically) guarded by `if (count > 0)`,
  // and the rail's only other content (`<a>` destination links) render their
  // label text directly with no `<span>`, so `metaCount` was always 0 and the
  // olive-700 assertion never actually ran. That half moves to A21 below,
  // with an honest runtime skip instead of a silent guard. This test now
  // covers only what genuinely runs unconditionally: the rail's own
  // background, and the shared structural border-left every non-lead track
  // carries (F7), unchanged by F8's colour exception.
  test('tickets rail: rail background is NOS pale-gold, structural border-left stays SAOC rule-soft', async ({
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
  });

  // A21 (contract-f8.yaml, split off A7 above). CONDITIONAL, but honestly:
  // featureRailMeta is computed at render time from the nationalShow
  // singleton (MegaMenu.tsx:84-93, formatShowDateRange(show?.showDate,
  // show?.showEndDate)) — whether it renders depends on live data this test
  // file does not control and must not assume either way. The contract's own
  // ruling was written against a snapshot where both fields read null; a
  // live instrumented run on 2026-09-21 found them populated instead (the
  // rail meta rendered "16–19 September 2027"), which is exactly why this
  // guards at RUNTIME rather than asserting a fixed "is/isn't null" fact in
  // a comment — a dataset snapshot written into source goes stale silently,
  // with nothing to catch it, which is the whole defect this fix closes.
  // Uses Playwright's runtime test.skip(condition, reason) rather than an
  // if-guard specifically so a reader auditing a green run sees this
  // reported as SKIPPED, with a printed reason, instead of a false pass
  // indistinguishable from a real one — whichever way the data happens to
  // read when the suite runs.
  test('tickets rail: meta line resolves NOS olive-700', async ({ page }) => {
    const panel = await openNationalShowMenu(page);
    const rail = getRail(panel);
    const meta = rail.getByTestId('feature-rail-meta');
    const metaCount = await meta.count();

    test.skip(
      metaCount === 0,
      'featureRailMeta reads null for the current run (show.showDate/showEndDate both null, ' +
        'MegaMenu.tsx:84-93) — the meta line does not render this time. See ' +
        'contract-f8.yaml A21 scopeRuling: seeding real show dates would make this run ' +
        'unconditionally, but seeding/purging Sanity content is tracked as separate backlog ' +
        'work, not this feature\'s scope.',
    );

    const metaColor = await meta.evaluate((el) => getComputedStyle(el).color);
    expect(metaColor).toBe(NOS_OLIVE_700);
  });

  // ---------------------------------------------------------------
  // Scope boundary — everything else in the header/menu stays SAOC
  // ---------------------------------------------------------------

  // AMENDED (contract-f8.yaml A8, 2026-09-21) after Codex found this test's
  // coverage didn't match its own title — it checked exactly three
  // hand-picked elements (trigger, lead link, and a count-guarded "Visit"
  // heading) against exactly one of the four NOS colours (royal-purple). The
  // other three registered tokens (pale-gold, olive-700, purple-700) were
  // never checked outside the rail at all. Corrected: walk EVERY element
  // inside the open panel that is not a descendant of the rail (per
  // getRail), plus the trigger button, and check background-color, color,
  // and every border-*-color against all four NOS constants. The "Visit"
  // heading's count-guard is removed — nav-config.ts:167 confirms
  // `heading: 'Visit'` is a static string literal, not conditional/data-driven,
  // so it unconditionally exists every time the panel opens.
  test('scope boundary: no NOS colour appears anywhere outside the tickets rail', async ({
    page,
  }) => {
    const NOS_COLORS = [NOS_ROYAL_PURPLE, NOS_PURPLE_700, NOS_PALE_GOLD, NOS_OLIVE_700];
    const COLOR_PROPS = [
      'backgroundColor',
      'color',
      'borderTopColor',
      'borderRightColor',
      'borderBottomColor',
      'borderLeftColor',
    ] as const;

    const header = page.getByRole('banner');
    const trigger = header.getByRole('button', { name: 'National Show', exact: true });
    await expect(trigger).toBeVisible();

    const triggerStyles = await trigger.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        backgroundColor: cs.backgroundColor,
        color: cs.color,
        borderTopColor: cs.borderTopColor,
        borderRightColor: cs.borderRightColor,
        borderBottomColor: cs.borderBottomColor,
        borderLeftColor: cs.borderLeftColor,
      };
    });
    for (const prop of COLOR_PROPS) {
      expect(
        NOS_COLORS,
        `trigger.${prop} = ${triggerStyles[prop]} matches a NOS colour`,
      ).not.toContain(triggerStyles[prop]);
    }

    const panel = await openNationalShowMenu(page);
    const rail = getRail(panel);
    const railHandle = await rail.elementHandle();
    if (!railHandle) {
      throw new Error('Could not resolve the tickets rail element');
    }

    // Walk every element in the panel outside the rail's own subtree, in the
    // browser (one round trip, not one per element), and collect any that
    // resolve a colour property to one of the four NOS tokens.
    const violations = await panel.evaluate(
      (panelEl, railEl) => {
        const nosColors = [
          'rgb(33, 26, 87)', // NOS_ROYAL_PURPLE
          'rgb(51, 41, 111)', // NOS_PURPLE_700
          'rgb(243, 242, 214)', // NOS_PALE_GOLD
          'rgb(106, 104, 41)', // NOS_OLIVE_700
        ];
        const colorProps = [
          'backgroundColor',
          'color',
          'borderTopColor',
          'borderRightColor',
          'borderBottomColor',
          'borderLeftColor',
        ] as const;
        const found: string[] = [];
        panelEl.querySelectorAll('*').forEach((el) => {
          if (railEl.contains(el)) return; // rail's own subtree is F8's exception, not scope here
          const cs = getComputedStyle(el);
          for (const prop of colorProps) {
            const value = cs[prop];
            if (nosColors.includes(value)) {
              found.push(`<${el.tagName.toLowerCase()} class="${el.className}"> ${prop}=${value}`);
            }
          }
        });
        return found;
      },
      railHandle,
    );

    expect(violations, `NOS colour(s) leaked outside the rail:\n${violations.join('\n')}`).toEqual(
      [],
    );
  });
});
