'use client';

import { useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';

import { FOCUS_RING } from '@/components/admin/tokens';
import { pageNameForPath, visibleNavGroups } from '@/lib/admin-nav-config';
import { MobileDrawer } from './MobileDrawer';
import { SidebarContent } from './SidebarContent';

interface AdminShellProps {
  email: string;
  canReviewVendors: boolean;
  canManagePaymentSettings: boolean;
  pendingCount: number | null;
  /** Used only by the flag-gated fixture route (app/admin-fixtures), which is not mounted
   *  under /admin and so cannot derive the active page from the URL. */
  pathnameOverride?: string;
  children: React.ReactNode;
}

const DOOR_PATH = '/admin/door';

export function AdminShell({
  email,
  canReviewVendors,
  canManagePaymentSettings,
  pendingCount,
  pathnameOverride,
  children,
}: AdminShellProps) {
  const livePathname = usePathname();
  const pathname = pathnameOverride ?? livePathname;
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const groups = visibleNavGroups({ canReviewVendors, canManagePaymentSettings });
  const isDoor = pathname === DOOR_PATH;
  const sidebar = (onNavigate?: () => void) => (
    <SidebarContent
      groups={groups}
      pathname={pathname}
      email={email}
      pendingCount={pendingCount}
      onNavigate={onNavigate}
    />
  );

  return (
    <div className="min-h-dvh bg-bone">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-rule bg-parchment lg:block">
        {sidebar()}
      </aside>

      <header
        className={`sticky top-0 z-30 flex items-center gap-1 border-b border-rule bg-parchment px-1 lg:hidden ${
          isDoor ? 'h-12 sm:h-14' : 'h-14'
        }`}
      >
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          className={`flex h-11 w-11 items-center justify-center text-ink ${FOCUS_RING}`}
        >
          <Menu size={22} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <p className="font-sans text-[15px] font-medium text-ink">
          Admin · {pageNameForPath(pathname)}
        </p>
      </header>

      <MobileDrawer open={menuOpen} onClose={closeMenu}>
        {sidebar(closeMenu)}
      </MobileDrawer>

      <main id="admin-main" tabIndex={-1} className="lg:pl-[248px]">
        {children}
      </main>
    </div>
  );
}
