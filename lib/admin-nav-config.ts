// Data-driven admin navigation (mission admin-redesign F1). Presentation only: the shell
// receives the two capability booleans as props from a server layout that resolved them with
// hasCapability(); nothing here makes an authorisation decision.
//
// Newsletter is `available: false` until the newsletter branch lands. Flip that one flag (and
// wire the subscriber count in lib/admin-dashboard.ts) and both the nav row and the dashboard
// card appear — no filesystem probing, nothing hidden by accident.

export type AdminNavIcon =
  | 'dashboard'
  | 'tickets'
  | 'door'
  | 'applications'
  | 'vendors'
  | 'newsletter'
  | 'settings';

export type AdminNavCapability = 'review-vendor-applications' | 'manage-payment-settings';

export interface AdminNavItem {
  id: string;
  label: string;
  href: string;
  icon: AdminNavIcon;
  available: boolean;
  capability?: AdminNavCapability;
  showPendingBadge?: boolean;
}

export interface AdminNavGroup {
  id: string;
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'show',
    label: 'SHOW',
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/admin', icon: 'dashboard', available: true },
      { id: 'tickets', label: 'Tickets', href: '/admin/tickets', icon: 'tickets', available: true },
      { id: 'door', label: 'Door scanner', href: '/admin/door', icon: 'door', available: true },
    ],
  },
  {
    id: 'vendors',
    label: 'VENDORS',
    items: [
      {
        id: 'applications',
        label: 'Applications',
        href: '/admin/vendors/applications',
        icon: 'applications',
        available: true,
        capability: 'review-vendor-applications',
        showPendingBadge: true,
      },
      {
        id: 'vendors',
        label: 'Vendors',
        href: '/admin/vendors',
        icon: 'vendors',
        available: true,
        capability: 'review-vendor-applications',
      },
    ],
  },
  {
    id: 'communications',
    label: 'COMMUNICATIONS',
    items: [
      {
        id: 'newsletter',
        label: 'Newsletter',
        available: false,
        href: '/admin/newsletter',
        icon: 'newsletter',
      },
    ],
  },
  {
    id: 'system',
    label: 'SYSTEM',
    items: [
      {
        id: 'settings',
        label: 'Settings',
        href: '/admin/settings',
        icon: 'settings',
        available: true,
        capability: 'manage-payment-settings',
      },
    ],
  },
];

export interface AdminNavCapabilities {
  canReviewVendors: boolean;
  canManagePaymentSettings: boolean;
}

function isItemVisible(item: AdminNavItem, caps: AdminNavCapabilities): boolean {
  if (!item.available) return false;
  if (item.capability === 'review-vendor-applications') return caps.canReviewVendors;
  if (item.capability === 'manage-payment-settings') return caps.canManagePaymentSettings;
  return true;
}

/** Groups with their capability-hidden and unavailable items removed; empty groups dropped. */
export function visibleNavGroups(caps: AdminNavCapabilities): AdminNavGroup[] {
  return ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => isItemVisible(item, caps)),
  })).filter((group) => group.items.length > 0);
}

export function isNewsletterAvailable(): boolean {
  return ADMIN_NAV_GROUPS.some((group) =>
    group.items.some((item) => item.id === 'newsletter' && item.available),
  );
}

/** Exact match for every item: /admin/vendors must not light up on /admin/vendors/applications. */
export function isNavItemActive(item: AdminNavItem, pathname: string): boolean {
  return pathname === item.href;
}

export function pageNameForPath(pathname: string): string {
  for (const group of ADMIN_NAV_GROUPS) {
    for (const item of group.items) {
      if (item.href === pathname) return item.label;
    }
  }
  return 'Admin';
}
