// =============================================================
// SAOC — e2e/utils/collect-nav-hrefs.ts
// Mission menu-system-layout4 M2/F fix-round (Codex cross-model review,
// 2026-09-10) — lifted out of e2e/nav-links-200.spec.ts so it has exactly one
// definition. Before this file existed, nav-links-200.spec.ts owned the only
// copy, e2e/nav-rendered-reachability.spec.ts had its own independent (wider)
// collectAllNavHrefs, and e2e/mobile-nav-reaches-every-section.spec.ts had a
// THIRD, hand-copied list (GROUPS/FLAT_DESTINATIONS) that could drift from
// nav-config.ts undetected — exactly this mission's own audited defect class.
// mobile-nav-reaches-every-section.spec.ts now derives its label+href groups
// directly from NAV (new logic — nothing before it grouped by label, so
// there was nothing to reuse there) and cross-checks the result against this
// collectHrefs() as a consistency proof. See that spec's own comments.
import type { NavItem } from '@/components/chrome/nav-config';

export function collectHrefs(items: readonly NavItem[]): string[] {
  const hrefs: string[] = [];
  for (const item of items) {
    if (item.type === 'link') {
      hrefs.push(item.href);
    } else {
      hrefs.push(item.href);
      if (item.lead) {
        hrefs.push(item.lead.leadHref);
        // item.lead.theShow is itself a NavColumn — it carries its own
        // headingHref, rendered as a <Link> by MegaMenu/MobileMenu whenever
        // non-null, exactly like the headingHref on item.columns below. Null
        // today (never set on the real nav), but must not stay invisible to
        // this collector the way item.columns[].headingHref no longer is.
        if (item.lead.theShow.headingHref) {
          hrefs.push(item.lead.theShow.headingHref);
        }
        for (const link of item.lead.theShow.links) {
          hrefs.push(link.href);
        }
      }
      for (const column of item.columns) {
        if (column.headingHref) {
          hrefs.push(column.headingHref);
        }
        for (const link of column.links) {
          hrefs.push(link.href);
        }
      }
      if (item.featureRail) {
        hrefs.push(item.featureRail.ctaHref);
      }
    }
  }
  // De-duplicate — a href could in principle appear in more than one of these
  // places (e.g. Tickets is both a lead.theShow link and the feature rail CTA
  // today, and lead.leadHref happens to equal the mega's own item.href today —
  // it doesn't need to stay that way for the test to hold).
  return Array.from(new Set(hrefs));
}
