// =============================================================
// NOS — components/nos-chrome/nos-footer-data.ts
// The National Orchid Show footer's own link lists (mission nos-site-split F3, NOS Design R2).
// Column labels and order for "Explore" come from the show nav (nos-nav.ts), so the footer never
// retypes a label. Shared footer copy (bulletin, WOSA, REG, copyright) stays in
// components/chrome/footer-data.ts. Hrefs here are the internal show paths; the footer renders
// them through nosPath() (lib/nos-paths.ts). The Constitution is the SAOC's, so NosFooter renders it
// itself as an absolute SAOC URL.
// =============================================================

import type { NavItem } from '@/components/chrome/nav-config';

import { NOS_NAV } from './nos-nav';

/** Footer "Explore" order (R2.3), by nos-nav leaf id. */
const EXPLORE_LEAF_IDS = [
  'tickets',
  'programme',
  'plan-your-visit',
  'vendors',
  'show-sponsors',
  'faq',
] as const;

export interface NosFooterLink {
  id: string;
  label: string;
  /** Internal show path; render through nosPath. */
  href: string;
}

function navLeaves(nav: readonly NavItem[]): NosFooterLink[] {
  const leaves: NosFooterLink[] = [];
  for (const item of nav) {
    if (item.type !== 'mega') continue;
    for (const link of item.lead?.theShow.links ?? []) leaves.push(link);
    for (const column of item.columns) for (const link of column.links) leaves.push(link);
  }
  return leaves;
}

/** The "Explore" list, resolved from the show nav so labels and hrefs are never retyped. */
export const NOS_FOOTER_EXPLORE: readonly NosFooterLink[] = (() => {
  const leaves = navLeaves(NOS_NAV);
  return EXPLORE_LEAF_IDS.map((id) => {
    const leaf = leaves.find((l) => l.id === id);
    if (!leaf) throw new Error(`NOS footer: nav leaf "${id}" not found in NOS_NAV`);
    return { id: leaf.id, label: leaf.label, href: leaf.href };
  });
})();

/** The legal row's pages served on the NOS site (R2.5). Media kit joins in F4, once its NOS page exists. */
export const NOS_FOOTER_LEGAL: readonly NosFooterLink[] = [
  { id: 'privacy', label: 'Privacy', href: '/privacy' },
  { id: 'terms', label: 'Terms', href: '/terms' },
  { id: 'refunds', label: 'Refunds', href: '/refunds' },
];
