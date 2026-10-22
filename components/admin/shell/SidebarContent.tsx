'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LogOut } from 'lucide-react';

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

const EMBLEM_SIZE = 28;

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
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        <Image
          src="/images/Eulophia-speciosa-emblem.png"
          alt=""
          width={EMBLEM_SIZE}
          height={EMBLEM_SIZE}
          className="shrink-0"
        />
        <div className="min-w-0">
          <p className="font-mono text-[11px] leading-none text-muted">Admin</p>
          <p className="mt-1 font-serif text-[18px] font-semibold leading-tight text-ink">
            South African Orchid Council
          </p>
        </div>
      </div>

      <nav aria-label="Admin" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
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
        <div className="mt-2 flex flex-col">
          <Link
            href="/"
            onClick={onNavigate}
            className={`flex min-h-[44px] items-center font-sans text-[14px] font-medium text-ink hover:text-primary lg:min-h-[40px] ${FOCUS_RING}`}
          >
            View site ↗
          </Link>
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              void signOut();
            }}
            className={`flex min-h-[44px] items-center gap-2 text-left font-sans text-[14px] font-medium text-ink hover:text-primary lg:min-h-[40px] ${FOCUS_RING}`}
          >
            <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
