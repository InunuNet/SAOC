// =============================================================
// NOS — components/nos/nos-subnav-groups.ts
// Resolves which nav-config group (Visit / Programme / Exhibit & Trade / The Show) a NOS
// route belongs to, and which of its leaves is the current location. Labels and hrefs are
// read from components/chrome/nav-config.ts verbatim and never retyped here (R27).
//
// A sub-route (/archive/2024, /vendors/apply) belongs to the longest leaf href that is a
// path prefix of it; that leaf is `aria-current="true"` (an exact leaf match is "page").
// =============================================================

import { NAV } from '@/components/chrome/nav-config';

export interface NosSubNavItem {
  label: string;
  href: string;
}

export interface NosSubNavGroup {
  heading: string;
  items: NosSubNavItem[];
  currentHref: string;
  exact: boolean;
}

const MEGA = NAV.find((item) => item.type === 'mega');
const GROUPS: readonly { heading: string; items: NosSubNavItem[] }[] =
  MEGA && MEGA.type === 'mega' && MEGA.lead
    ? [MEGA.lead.theShow, ...MEGA.columns].map((column) => ({
        heading: column.heading,
        items: column.links.map((link) => ({ label: link.label, href: link.href })),
      }))
    : [];

export function subNavGroupFor(route: string): NosSubNavGroup | null {
  let best: NosSubNavGroup | null = null;
  for (const group of GROUPS) {
    for (const item of group.items) {
      const matches = route === item.href || route.startsWith(`${item.href}/`);
      if (matches && (!best || item.href.length > best.currentHref.length)) {
        best = {
          heading: group.heading,
          items: group.items,
          currentHref: item.href,
          exact: route === item.href,
        };
      }
    }
  }
  return best;
}
