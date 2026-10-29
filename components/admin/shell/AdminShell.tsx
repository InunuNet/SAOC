'use client';

import { useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';

import { visibleNavGroups } from '@/lib/admin-nav-config';
import { AdminHeader } from './AdminHeader';
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
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:bg-parchment focus:px-4 focus:py-3 focus:font-sans focus:text-[14px] focus:font-semibold focus:text-ink focus:outline-2 focus:outline-solid focus:outline-primary focus:outline-offset-[3px]"
      >
        Skip to content
      </a>
      <AdminHeader menuOpen={menuOpen} onToggleMenu={() => setMenuOpen(true)} />
      <aside className="fixed bottom-0 left-0 top-[62px] z-30 hidden w-[248px] border-r border-rule bg-parchment min-[1280px]:top-[74px] lg:block">
        {sidebar()}
      </aside>

      <MobileDrawer open={menuOpen} onClose={closeMenu}>
        {sidebar(closeMenu)}
      </MobileDrawer>

      <main id="admin-main" tabIndex={-1} className="pb-20 lg:pl-[248px]">
        {children}
      </main>
    </div>
  );
}
