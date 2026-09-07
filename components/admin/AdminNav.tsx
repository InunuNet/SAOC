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

// F14 — `/admin` matches only exactly (every other admin route also starts with `/admin`, so
// a plain prefix check would light up Overview everywhere). Every other section link matches
// its own route AND any nested route beneath it (e.g. `/admin/visitors/tickets` still lights
// up `Visitors`), so a Level 2 sub-nav page still shows which Level 1 section it belongs to.
function isLinkActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface AdminNavProps {
  variant: AdminNavVariant;
  canReviewVendors: boolean;
  canManagePaymentSettings: boolean;
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

// F14 (nos-design-system M5) — audience-first route tree, replacing the old flat
// Dashboard/Vendors/Door Scanner/Settings set. Order fixed by
// goldens/m5-admin-ia.golden.md §2: Overview · Visitors · Vendors · Exhibitors · Door ·
// Settings. Overview, Visitors, Exhibitors and Door stay unconditional — no route gates on
// those today, and hiding a reachable link is worse than showing one (same reasoning the
// original Dashboard/Door Scanner links already relied on). Vendors and Settings remain the
// only two links actually conditioned on a capability, unchanged from before this feature.
function buildLinks(canReviewVendors: boolean, canManagePaymentSettings: boolean): NavLink[] {
  const links: NavLink[] = [
    { id: 'overview', label: 'Overview', href: '/admin' },
    { id: 'visitors', label: 'Visitors', href: '/admin/visitors' },
  ];
  if (canReviewVendors) {
    links.push({ id: 'vendors', label: 'Vendors', href: '/admin/vendors' });
  }
  links.push(
    { id: 'exhibitors', label: 'Exhibitors', href: '/admin/exhibitors' },
    { id: 'door', label: 'Door', href: '/admin/door' },
  );
  if (canManagePaymentSettings) {
    links.push({ id: 'settings', label: 'Settings', href: '/admin/settings' });
  }
  return links;
}

export function AdminNav({ variant, canReviewVendors, canManagePaymentSettings }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const links = buildLinks(canReviewVendors, canManagePaymentSettings);

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
          const active = isLinkActive(link.href, pathname);
          return (
            <li key={link.id}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
                className={[
                  'block rounded-sm px-3 py-2 font-sans text-[14px] text-ink transition-colors duration-150 hover:text-primary min-[1240px]:px-0 min-[1240px]:py-0',
                  active ? 'bg-primary-100 font-semibold text-primary' : '',
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
              'flex h-10 w-auto items-center justify-center gap-1.5 rounded-sm border border-rule bg-ivory px-3 text-ink transition-colors hover:bg-bone',
              FOCUS_RING,
            ].join(' ')}
          >
            {open ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
            <span className="font-sans text-[14px]">Admin</span>
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
            'flex h-10 w-auto items-center justify-center gap-1.5 rounded-sm border border-rule bg-ivory px-3 text-ink transition-colors hover:bg-bone min-[1240px]:hidden',
            FOCUS_RING,
          ].join(' ')}
        >
          {open ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
          <span className="font-sans text-[14px]">Admin</span>
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
