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

import { NAV, type NavItem } from '@/components/chrome/nav-config';
import pendingNosRoutes from '../.agent/memory/project/specs/menu-system-layout4/goldens/fixtures/f1-pending-nos-routes.json';
import { collectHrefs } from './utils/collect-nav-hrefs';

const VIEWPORT_HEIGHT = 800;
const PENDING_ROUTES = new Set<string>(pendingNosRoutes.pendingRoutes);
const NATIONAL_SHOW_TRIGGER = 'National Show';

interface FlatDestination {
  label: string;
  href: string;
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Codex cross-model review, 2026-09-10: FLAT_DESTINATIONS and GROUPS used to be
// a hand-copied second (really third, alongside nav-links-200.spec.ts's
// collectHrefs and nav-rendered-reachability.spec.ts's collectAllNavHrefs)
// transcription of nav-config.ts's NAV export. A hand-copied list can drift —
// add a mobile-visible leaf, rename a route — while this suite stays green,
// which is exactly the defect this whole mission started from (see this
// file's own original header comment). Both are now DERIVED from NAV, so a
// changed or added leaf is picked up automatically. This derivation logic is
// new (nothing before it grouped destinations by heading+label the way the
// mobile drawer renders them); collectHrefs, the flat-href collector already
// shared with nav-links-200.spec.ts, is reused below as an independent
// consistency cross-check rather than re-implemented a third time.

// Mirrors nav-config.ts's flat top-level `link` items — everything except the
// single `National Show` mega, which is exercised via GROUPS below.
function deriveFlatDestinations(items: readonly NavItem[]): FlatDestination[] {
  return items
    .filter((item): item is Extract<NavItem, { type: 'link' }> => item.type === 'link' && !item.disabled)
    .map((item) => ({
      label: item.label,
      href: item.href,
      hrefPattern: new RegExp(`${escapeRegExp(item.href)}$`),
    }));
}

// Mirrors nav-config.ts's National Show mega, in MobileMenu.tsx's own render
// order: the "The Show" group folded off item.lead, then the group columns —
// all four render as flat headed lists once the single "National Show"
// trigger is expanded (see MobileMenu.tsx: `[n.lead?.theShow, ...n.columns]`).
function deriveGroups(item: Extract<NavItem, { type: 'mega' }>): Group[] {
  const groups: Group[] = [];
  if (item.lead) {
    groups.push({
      heading: item.lead.theShow.heading,
      destinations: item.lead.theShow.links.map((link) => ({ label: link.label, href: link.href })),
    });
  }
  for (const column of item.columns) {
    groups.push({
      heading: column.heading,
      destinations: column.links.map((link) => ({ label: link.label, href: link.href })),
    });
  }
  return groups;
}

const NATIONAL_SHOW_ITEM = NAV.find(
  (item): item is Extract<NavItem, { type: 'mega' }> =>
    item.type === 'mega' && item.label === NATIONAL_SHOW_TRIGGER,
);
if (!NATIONAL_SHOW_ITEM) {
  throw new Error(`nav-config.ts has no mega item labelled "${NATIONAL_SHOW_TRIGGER}"`);
}

const FLAT_DESTINATIONS: FlatDestination[] = deriveFlatDestinations(NAV);
const GROUPS: Group[] = deriveGroups(NATIONAL_SHOW_ITEM);

// Consistency proof, not test coverage of its own: every href this spec is
// about to exercise must also appear in collectHrefs(NAV) (minus hrefs
// already known-pending), and vice versa for the National Show mega's own
// hrefs — otherwise the two collectors have silently diverged.
{
  const allCollected = new Set(collectHrefs(NAV));
  const derivedHrefs = new Set<string>([
    ...FLAT_DESTINATIONS.map((d) => d.href),
    ...GROUPS.flatMap((g) => g.destinations.map((d) => d.href)),
  ]);
  for (const href of derivedHrefs) {
    if (!allCollected.has(href)) {
      throw new Error(
        `derived destination ${href} is not present in collectHrefs(NAV) — the two NAV collectors ` +
          `have diverged`,
      );
    }
  }
}

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
