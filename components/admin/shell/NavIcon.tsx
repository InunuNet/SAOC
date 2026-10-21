import {
  ClipboardList,
  LayoutDashboard,
  Mail,
  ScanLine,
  Settings,
  Store,
  Ticket,
  type LucideIcon,
} from 'lucide-react';

import type { AdminNavIcon } from '@/lib/admin-nav-config';

const ICONS: Record<AdminNavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  tickets: Ticket,
  door: ScanLine,
  applications: ClipboardList,
  vendors: Store,
  newsletter: Mail,
  settings: Settings,
};

const NAV_ICON_SIZE = 18;

export function NavIcon({ name }: { name: AdminNavIcon }) {
  const Icon = ICONS[name];
  return <Icon size={NAV_ICON_SIZE} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />;
}
