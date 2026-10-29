'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Menu } from 'lucide-react';

import { FOCUS_RING } from '@/components/admin/tokens';

// The public site header's frame: sticky parchment, no border, the same
// lockup file at the same widths, 62px tall and 74px from 1280. The public nav and search are
// dropped; the only control is the menu toggle below 1024. The lockup is left-anchored so it
// lines up with the sidebar item text. Sidebar and table offsets in AdminShell/AdminTable use
// the same 62px / 74px heights.
const LOCKUP_LABEL = 'South African Orchid Council — Making a difference since 1968';

interface AdminHeaderProps {
  menuOpen: boolean;
  onToggleMenu: () => void;
}

export function AdminHeader({ menuOpen, onToggleMenu }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-[62px] items-center gap-3 bg-parchment pl-4 pr-2 min-[1280px]:h-[74px] lg:pl-[27px]">
      <Link
        href="/admin"
        aria-label={LOCKUP_LABEL}
        className="min-w-0 shrink rounded-sm focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px]"
      >
        <Image
          src="/images/saoc-lockup-horizontal-full-name.png"
          alt=""
          width={3757}
          height={493}
          priority
          className="h-auto w-[190px] max-w-full sm:w-[340px] min-[1280px]:w-[380px]"
        />
      </Link>
      <span aria-hidden="true" className="h-6 w-px shrink-0 bg-rule" />
      <p className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Admin</p>
      <button
        type="button"
        onClick={onToggleMenu}
        aria-label="Open menu"
        aria-expanded={menuOpen}
        className={`ml-auto flex h-11 w-11 shrink-0 items-center justify-center text-ink lg:hidden ${FOCUS_RING}`}
      >
        <Menu size={22} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </header>
  );
}
