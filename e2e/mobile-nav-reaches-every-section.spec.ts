// =============================================================
// SAOC — e2e/mobile-nav-reaches-every-section.spec.ts
// Mission menu-system-layout4 M2/F3 — rewritten for Layout 4's single
// "National Show" mega (see contract-f3.yaml's A6). The pre-Layout-4 shape
// (three separate top-level mega triggers — Visit / Programme / Exhibit,
// each its own accordion) is superseded: there is now one drawer trigger,
// "National Show", and the four groups underneath it (The Show, Visit,
// Programme, Exhibit & Trade) render as flat headed lists once it's
// expanded — no per-group sub-accordion.
//
// Reads goldens/fixtures/f1-pending-nos-routes.json — the single current
// source of truth for which NOS-lane routes don't exist yet (contract-f1.yaml's
// A9), not the stale, superseded
// .agent/memory/project/specs/ticketing-complete/goldens/fixtures/f6-pending-nos-routes.json.
// Pending destinations are explicitly test.skip'd with a named reason — an
// auditable gap, not a silent omission — rather than asserted reachable before
// the route exists. Every group has at least one non-pending destination
// actually exercised.
//
// Mobile is not a lesser-tested surface: this opens the drawer at 390px and
// 320px and click-navigates through every flat top-level SAOC destination plus
// every leaf inside every one of the mega's four groups, each with its own
// real Playwright navigation assertion (waitForURL + toHaveURL) — never a
// text-presence check, which would pass even for a hidden, unreachable
// element.
import { expect, test } from '@playwright/test';

import pendingNosRoutes from '../.agent/memory/project/specs/menu-system-layout4/goldens/fixtures/f1-pending-nos-routes.json';

const VIEWPORT_HEIGHT = 800;
const PENDING_ROUTES = new Set<string>(pendingNosRoutes.pendingRoutes);
const NATIONAL_SHOW_TRIGGER = 'National Show';

interface FlatDestination {
  label: string;
  hrefPattern: RegExp;
}

interface GroupDestination {
  label: string;
  href: string;
}

interface Group {
  heading: string;
  destinations: GroupDestination[];
}

// Mirrors components/chrome/nav-config.ts's flat top-level `link` items —
// everything except the single `National Show` mega, which is exercised via
// GROUPS below.
const FLAT_DESTINATIONS: FlatDestination[] = [
  { label: 'About', hrefPattern: /\/about$/ },
  { label: 'Societies', hrefPattern: /\/societies$/ },
  { label: 'Judging & Awards', hrefPattern: /\/judging$/ },
  { label: 'Events', hrefPattern: /\/events$/ },
  { label: 'Members', hrefPattern: /\/members$/ },
  { label: 'Sponsors', hrefPattern: /\/sponsors$/ },
];

// Mirrors nav-config.ts's National Show mega: the "The Show" group folded off
// item.lead, plus the three group columns — all four render as flat headed
// lists once the single "National Show" trigger is expanded.
const GROUPS: Group[] = [
  {
    heading: 'The Show',
    destinations: [
      { label: 'Tickets', href: '/national-show/tickets' },
      { label: 'Show Sponsors', href: '/national-show/sponsors' },
      { label: 'Past Shows', href: '/national-show/archive' },
    ],
  },
  {
    heading: 'Visit',
    destinations: [
      { label: 'About the Show', href: '/national-show/about' },
      { label: 'What to Expect', href: '/national-show/what-to-expect' },
      { label: 'Plan Your Visit', href: '/national-show/plan-your-visit' },
      { label: 'FAQ', href: '/national-show/faq' },
    ],
  },
  {
    heading: 'Programme',
    destinations: [
      { label: 'Programme', href: '/national-show/programme' },
      { label: 'Workshops', href: '/national-show/workshops' },
      { label: 'SAOC Symposium', href: '/national-show/symposium' },
      { label: 'WOSA Conference', href: '/national-show/wosa-conference' },
      { label: 'Conference Registration', href: '/national-show/conferences' },
    ],
  },
  {
    heading: 'Exhibit & Trade',
    destinations: [
      { label: 'South African Exhibitors', href: '/national-show/sa-exhibitors' },
      { label: 'International Guests', href: '/national-show/international-guests' },
      { label: 'Exhibitor Entry Guide', href: '/national-show/exhibitors' },
      { label: 'Trade Vendors', href: '/national-show/vendors' },
    ],
  },
];

async function openMobileMenuAndClick(page: import('@playwright/test').Page, label: string) {
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('link', { name: label, exact: true }).click();
}

async function openNationalShow(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Open menu' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const trigger = dialog.getByRole('button', { name: NATIONAL_SHOW_TRIGGER, exact: true });
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  return dialog;
}

for (const width of [390, 320] as const) {
  test(`mobile nav flat links reach every SAOC section at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto('/');

    for (const { label, hrefPattern } of FLAT_DESTINATIONS) {
      await openMobileMenuAndClick(page, label);
      await page.waitForURL(hrefPattern);
      await expect(page).toHaveURL(hrefPattern);
      await page.goto('/');
    }
  });

  for (const group of GROUPS) {
    for (const dest of group.destinations) {
      const testName = `mobile nav National Show "${group.heading}" reaches "${dest.label}" at ${width}px`;

      if (PENDING_ROUTES.has(dest.href)) {
        test.skip(
          `${testName} (pending NOS route — see f1-pending-nos-routes.json)`,
          async ({ page }) => {
            await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
            await page.goto('/');
            const dialog = await openNationalShow(page);
            const destination = dialog.getByRole('link', { name: dest.label, exact: true });
            await expect(destination).toBeVisible();
            await destination.click();
            const hrefPattern = new RegExp(`${dest.href.replace(/\//g, '\\/')}$`);
            await page.waitForURL(hrefPattern);
            await expect(page).toHaveURL(hrefPattern);
          },
        );
        continue;
      }

      test(testName, async ({ page }) => {
        await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
        await page.goto('/');

        const dialog = await openNationalShow(page);

        // Real reachability, not a text-presence check — Playwright's click()
        // auto-scrolls the drawer to bring the target into view and fails
        // outright if it's actually clipped, so this proves the destination is
        // genuinely reachable inside the drawer at this viewport.
        const destination = dialog.getByRole('link', { name: dest.label, exact: true });
        await expect(destination).toBeVisible();
        await destination.click();

        const hrefPattern = new RegExp(`${dest.href.replace(/\//g, '\\/')}$`);
        await page.waitForURL(hrefPattern);
        await expect(page).toHaveURL(hrefPattern);
      });
    }
  }
}
