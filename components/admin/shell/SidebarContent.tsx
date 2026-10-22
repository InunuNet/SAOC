'use client';

import Link from 'next/link';

import { FOCUS_RING } from '@/components/admin/tokens';
import { useAdminSignOut } from '@/components/admin/useAdminSignOut';
import { isNavItemActive, type AdminNavGroup } from '@/lib/admin-nav-config';
import { NavIcon } from './NavIcon';

interface SidebarContentProps {
  groups: AdminNavGroup[];
  pathname: string;
  email: string;
  pendingCount: number | null;
  onNavigate?: () => void;
}

// View site and Sign out live in the drawer foot below 1024; from 1024 the floating pill holds them.
const FOOT_ROW_CLASS =
  'flex min-h-[44px] items-center font-sans text-[14px] font-medium text-ink hover:text-primary';

export function SidebarContent({
  groups,
  pathname,
  email,
  pendingCount,
  onNavigate,
}: SidebarContentProps) {
  const signOut = useAdminSignOut();

  return (
    <div className="flex h-full flex-col">
      <nav aria-label="Admin" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2">
        {groups.map((group) => (
          <div key={group.id} className="mt-5 first:mt-2">
            <p className="px-3 pb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
              {group.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isNavItemActive(item, pathname);
                const showBadge =
                  item.showPendingBadge === true && pendingCount !== null && pendingCount > 0;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      onClick={onNavigate}
                      className={[
                        'flex min-h-[44px] items-center gap-3 border-l-[3px] px-3 font-sans text-[14px] font-medium text-ink transition-colors lg:min-h-[40px]',
                        active
                          ? 'border-accent bg-bone text-primary'
                          : 'border-transparent hover:bg-bone/60',
                        FOCUS_RING,
                      ].join(' ')}
                    >
                      <NavIcon name={item.icon} />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {showBadge ? (
                        <span
                          data-pending-badge
                          aria-label={`${pendingCount} pending`}
                          className="rounded-full bg-primary px-2 py-0.5 font-mono text-[11px] leading-none text-ivory"
                        >
                          {pendingCount}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-rule px-5 py-4">
        <p className="truncate font-sans text-[13px] text-muted" title={email}>
          {email}
        </p>
        <div className="mt-2 flex flex-col lg:hidden">
          <Link href="/" onClick={onNavigate} className={`${FOOT_ROW_CLASS} ${FOCUS_RING}`}>
            View site ↗
          </Link>
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              void signOut();
            }}
            className={`${FOOT_ROW_CLASS} text-left ${FOCUS_RING}`}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
