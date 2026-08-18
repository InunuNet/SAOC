'use client';

// =============================================================
// SAOC — components/admin/AdminNav.tsx
// Presentation-only admin navigation. Never derives its own authorization decision —
// every caller resolves `canReviewVendors` server-side and passes it in as a prop. See
// .agent/memory/project/specs/admin-nav-menu/goldens/f1-admin-nav-menu.golden.md, "The
// nav is presentation, not authorization."
//
// Two variants:
//   - "bar": persistent horizontal bar on /admin and /admin/vendors.
//     Collapses to a hamburger below the same 1240px breakpoint
//     components/chrome/Header.tsx already uses.
//   - "minimal": /admin/door only. A single fixed-position ~40x40 icon
//     trigger that opens an overlay with the same links — never a
//     persistent bar, which would obstruct one-handed camera scanning
//     (see app/admin/door/page.tsx's own comment on why).
// =============================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { getAuth, signOut } from 'firebase/auth';

import { getFirebaseApp } from '@/lib/firebase';

export type AdminNavVariant = 'bar' | 'minimal';

interface AdminNavProps {
  variant: AdminNavVariant;
  canReviewVendors: boolean;
}

interface NavLink {
  id: string;
  label: string;
  href: string;
}

// Existing focus-visible ring token, already used on the dashboard's
// "Download CSV" link — no new focus-style vocabulary invented.
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2';

function buildLinks(canReviewVendors: boolean): NavLink[] {
  // Dashboard and Door Scanner are unconditional — they mirror what
  // app/admin/page.tsx and app/admin/door/layout.tsx actually gate on today
  // (an ok admin session, nothing more). Vendors is the one destination
  // that is genuinely capability-gated at its route, so it's the only link
  // conditioned here. Deliberately not gated on the two dashboard/scanner
  // capabilities defined in lib/admin-roles.ts — no route checks either of
  // those yet, so gating the nav on them would hide a reachable link.
  const links: NavLink[] = [
    { id: 'dashboard', label: 'Dashboard', href: '/admin' },
    { id: 'door', label: 'Door Scanner', href: '/admin/door' },
  ];
  if (canReviewVendors) {
    links.push({ id: 'vendors', label: 'Vendors', href: '/admin/vendors' });
  }
  return links;
}

export function AdminNav({ variant, canReviewVendors }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const links = buildLinks(canReviewVendors);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // The server-side cookie clear must run even if the Firebase client call
  // throws — try/finally, not a bare sequential await.
  async function handleSignOut(): Promise<void> {
    try {
      await signOut(getAuth(getFirebaseApp()));
    } catch (error) {
      console.error('AdminNav sign-out: Firebase signOut() failed', {
        operation: 'admin sign-out',
        exceptionType: error instanceof Error ? error.name : typeof error,
      });
    } finally {
      await fetch('/api/admin/session', { method: 'DELETE' }).catch(() => undefined);
      router.push('/admin/login');
    }
  }

  function renderLinkList(onNavigate?: () => void) {
    return (
      <ul className="flex flex-col gap-1 min-[1240px]:flex-row min-[1240px]:items-center min-[1240px]:gap-6">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <li key={link.id}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
                className={[
                  'block rounded-sm px-3 py-2 font-sans text-[14px] text-ink transition-colors duration-150 hover:text-primary min-[1240px]:px-0 min-[1240px]:py-0',
                  active ? 'text-primary' : '',
                  FOCUS_RING,
                ].join(' ')}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  function renderSignOutButton(onNavigate?: () => void) {
    return (
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          void handleSignOut();
        }}
        className={[
          'rounded-sm border border-rule bg-ivory px-3 py-2 font-sans text-[14px] font-medium text-ink transition-colors hover:bg-bone',
          FOCUS_RING,
        ].join(' ')}
      >
        Sign out
      </button>
    );
  }

  if (variant === 'minimal') {
    return (
      <>
        <div className="fixed right-3 top-3 z-50">
          <button
            type="button"
            aria-label="Admin menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={[
              'flex h-10 w-10 items-center justify-center rounded-sm border border-rule bg-ivory text-ink transition-colors hover:bg-bone',
              FOCUS_RING,
            ].join(' ')}
          >
            {open ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
          </button>
        </div>

        {open && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Admin menu"
            className="fixed inset-0 z-40 bg-black/45"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div className="ml-auto flex h-full w-full max-w-[280px] flex-col gap-6 bg-parchment p-6">
              <nav aria-label="Admin">{renderLinkList(() => setOpen(false))}</nav>
              {renderSignOutButton(() => setOpen(false))}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <nav aria-label="Admin" className="border-b border-rule bg-parchment">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <div className="hidden min-[1240px]:flex min-[1240px]:items-center min-[1240px]:gap-6">
          {renderLinkList()}
        </div>
        <div className="hidden min-[1240px]:block">{renderSignOutButton()}</div>

        <button
          type="button"
          aria-label="Admin menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={[
            'flex h-10 w-10 items-center justify-center rounded-sm border border-rule bg-ivory text-ink transition-colors hover:bg-bone min-[1240px]:hidden',
            FOCUS_RING,
          ].join(' ')}
        >
          {open ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
        </button>
      </div>

      {open && (
        <div className="min-[1240px]:hidden border-t border-rule bg-parchment px-4 py-4 sm:px-8">
          {renderLinkList(() => setOpen(false))}
          <div className="mt-4">{renderSignOutButton(() => setOpen(false))}</div>
        </div>
      )}
    </nav>
  );
}
