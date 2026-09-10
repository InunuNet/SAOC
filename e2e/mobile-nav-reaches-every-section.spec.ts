// =============================================================
// SAOC — e2e/mobile-nav-reaches-every-section.spec.ts
// Mission ticketing-complete M3/F6 — mobile is not a lesser-tested surface. A
// dropdown-heavy desktop menu (Visit / Programme / Exhibit & Trade / Tickets /
// Past Editions) is exactly the shape that degrades badly at small widths, and
// this repo treats mobile-first as a standing rule, not an aspiration.
//
// Opens components/chrome/MobileMenu.tsx at 390px and 320px and click-navigates
// through the same six Lee-Ann SAOC destinations contract-f6.yaml's A3 requires
// in the desktop nav-config.ts, plus Tickets (the conversion path), AND — per
// the 2026-09-08 Codex finding — at least one real destination BEHIND EACH of
// the three group triggers (Visit, Programme, Exhibit). The file's own name is
// "reaches every section"; a suite that only exercises the flat top-level links
// and never expands a group or navigates to anything inside one does not live
// up to that name, even though the flat links alone would pass. Each
// destination — flat or grouped — is proven reachable with its own real
// Playwright navigation assertion (waitForURL + toHaveURL) — never a
// text-presence check, which would pass even for a hidden, unreachable element,
// or for a group trigger that expands but whose panel opens off-screen or
// clipped by the drawer.
//
// Group destinations that are still pending NOS routes (see
// goldens/fixtures/f6-pending-nos-routes.json, the single source of truth also
// used by e2e/nav-links-200.spec.ts) are explicitly test.skip'd with a named
// reason — an auditable gap, not a silent omission — rather than asserted 200/
// navigated-to before the route exists. Every group has at least one
// NON-pending destination actually exercised.
import { expect, test } from '@playwright/test';

import pendingNosRoutes from '../.agent/memory/project/specs/ticketing-complete/goldens/fixtures/f6-pending-nos-routes.json';

const VIEWPORT_HEIGHT = 800;
const PENDING_ROUTES = new Set<string>(pendingNosRoutes.pendingRoutes);

interface FlatDestination {
  label: string;
  hrefPattern: RegExp;
}

interface GroupDestination {
  label: string;
  href: string;
}

interface Group {
  trigger: string;
  destinations: GroupDestination[];
}

// Mirrors components/chrome/nav-config.ts's flat top-level `link` items.
const FLAT_DESTINATIONS: FlatDestination[] = [
  { label: 'About', hrefPattern: /\/about$/ },
  { label: 'Societies', hrefPattern: /\/societies$/ },
  { label: 'Judging', hrefPattern: /\/judging$/ },
  { label: 'Events', hrefPattern: /\/events$/ },
  { label: 'Members Portal', hrefPattern: /\/members$/ },
  { label: 'Tickets', hrefPattern: /\/tickets$/ },
];

// Mirrors nav-config.ts's three `mega` groups — trigger label plus every leaf
// destination reachable once the group is expanded in the mobile drawer
// (including the column's own headingHref link, which is a real clickable
// destination, not just a label).
const GROUPS: Group[] = [
  {
    trigger: 'Visit',
    destinations: [
      { label: 'About the Show', href: '/national-show/about' },
      { label: 'What to Expect', href: '/national-show/what-to-expect' },
      { label: 'Plan Your Visit', href: '/national-show/plan-your-visit' },
      { label: 'FAQ', href: '/national-show/faq' },
    ],
  },
  {
    trigger: 'Programme',
    destinations: [
      { label: 'Programme of Events', href: '/national-show/programme' },
      { label: 'Workshops & Field Trips', href: '/national-show/workshops' },
      { label: 'SAOC Symposium', href: '/national-show/symposium' },
      { label: 'WOSA Conference', href: '/national-show/wosa-conference' },
    ],
  },
  {
    trigger: 'Exhibit',
    destinations: [
      { label: 'South African Exhibitors', href: '/national-show/exhibitors' },
      { label: 'International Exhibitors', href: '/national-show/exhibitors/international' },
      { label: 'Vendors', href: '/national-show/vendors' },
    ],
  },
];

async function openMobileMenuAndClick(page: import('@playwright/test').Page, label: string) {
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('link', { name: label, exact: true }).click();
}

async function openGroupAndClick(
  page: import('@playwright/test').Page,
  trigger: string,
  destinationLabel: string,
) {
  await page.getByRole('button', { name: 'Open menu' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const groupTrigger = dialog.getByRole('button', { name: trigger, exact: true });
  await expect(groupTrigger).toBeVisible();
  await expect(groupTrigger).toHaveAttribute('aria-expanded', 'false');
  await groupTrigger.click();
  await expect(groupTrigger).toHaveAttribute('aria-expanded', 'true');

  // Real reachability, not a text-presence check — Playwright's click()
  // auto-scrolls the drawer to bring the target into view and fails outright
  // if it's actually clipped (e.g. by a non-scrolling overflow:hidden
  // ancestor), so this proves the destination is genuinely reachable inside
  // the drawer at this viewport, not merely present somewhere in the DOM.
  const destination = dialog.getByRole('link', { name: destinationLabel, exact: true });
  await expect(destination).toBeVisible();
  await destination.click();
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
      if (PENDING_ROUTES.has(dest.href)) {
        test.skip(
          `mobile nav "${group.trigger}" reaches "${dest.label}" at ${width}px (pending NOS route — see f6-pending-nos-routes.json)`,
          async ({ page }) => {
            await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
            await page.goto('/');
            await openGroupAndClick(page, group.trigger, dest.label);
            const hrefPattern = new RegExp(`${dest.href.replace(/\//g, '\\/')}$`);
            await page.waitForURL(hrefPattern);
            await expect(page).toHaveURL(hrefPattern);
          },
        );
        continue;
      }

      test(`mobile nav "${group.trigger}" reaches "${dest.label}" at ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
        await page.goto('/');

        await openGroupAndClick(page, group.trigger, dest.label);

        const hrefPattern = new RegExp(`${dest.href.replace(/\//g, '\\/')}$`);
        await page.waitForURL(hrefPattern);
        await expect(page).toHaveURL(hrefPattern);
      });
    }
  }
}
