'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';

import { studioEditHref } from '@/lib/studio-links';
import { ADMIN_PILL_DOT_CLASS, FOCUS_RING_ON_DARK } from './tokens';
import { signOutAdmin } from './useAdminSignOut';

// Floating admin shortcut for signed-in admins, on public pages and inside the admin shell.
// On public pages it asks /api/admin/whoami; the admin shell has already verified the session
// server-side, so it passes verifiedAdmin and the pill starts visible with no fetch. In the
// admin context it shows from 1024 up only (below that the drawer holds View site and Sign out)
// and its items are View site, then sign out (which lands on /admin/login); there is
// no Edit this page. Never shown on /admin/login. Fixed bottom-right and never repositionable by pointer (WCAG 2.5.7). It lifts above a sticky CTA through
// --sticky-cta-offset (set that variable on a sticky bottom bar, default 0), hides in print,
// and is mounted after <main> so it comes last in reading order.
const WHOAMI_URL = '/api/admin/whoami';
const NOT_ADMIN_CACHE_KEY = 'saoc-admin-pill-not-admin';
const NOT_ADMIN_CACHE_MS = 10 * 60 * 1000;
const WHOAMI_TIMEOUT_MS = 5000;

const PILL_SURFACE = 'bg-primary-800/92 text-ivory backdrop-blur-sm shadow-sheet print:hidden';
const ITEM_CLASS = `flex min-h-[44px] items-center px-3 font-sans text-[14px] font-medium text-ivory hover:text-accent-soft ${FOCUS_RING_ON_DARK}`;

function readNotAdminCache(): boolean {
  try {
    const stored = window.sessionStorage.getItem(NOT_ADMIN_CACHE_KEY);
    return stored !== null && Date.now() - Number(stored) < NOT_ADMIN_CACHE_MS;
  } catch {
    return false;
  }
}

function writeNotAdminCache(): void {
  try {
    window.sessionStorage.setItem(NOT_ADMIN_CACHE_KEY, String(Date.now()));
  } catch {
    // Storage blocked: the pill just asks again on the next page.
  }
}

const LOGIN_PATH = '/admin/login';

interface AdminPillProps {
  // Set by the admin shell, which has already verified the session server-side.
  verifiedAdmin?: boolean;
}

export function AdminPill({ verifiedAdmin = false }: AdminPillProps) {
  const pathname = usePathname();
  const onLogin = pathname.startsWith(LOGIN_PATH);
  const [isAdmin, setIsAdmin] = useState(verifiedAdmin);
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (verifiedAdmin || onLogin || readNotAdminCache()) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), WHOAMI_TIMEOUT_MS);
    fetch(WHOAMI_URL, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async (res) => {
        // Drain the body: a response nobody reads keeps the request open, which stalls the
        // page's network-idle state (and the e2e specs that wait on it).
        await res.arrayBuffer();
        if (cancelled) return;
        if (res.ok) {
          setIsAdmin(true);
        } else {
          writeNotAdminCache();
        }
      })
      .catch(() => undefined)
      .finally(() => window.clearTimeout(timeout));
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [verifiedAdmin, onLogin]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setMenuOpen(false); // EventTarget → Node: contains() needs it
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen]);

  if (onLogin || !isAdmin) return null;

  const editHref = verifiedAdmin ? null : studioEditHref(pathname);

  async function handleSignOut() {
    await signOutAdmin();
    setIsAdmin(false);
    if (verifiedAdmin) {
      window.location.assign(LOGIN_PATH);
    } else {
      window.location.reload();
    }
  }

  const items = (
    <>
      {verifiedAdmin ? (
        <Link href="/" className={ITEM_CLASS}>
          View site ↗
        </Link>
      ) : (
        <Link href="/admin" className={ITEM_CLASS}>
          Dashboard
        </Link>
      )}
      {editHref ? (
        <a href={editHref} className={ITEM_CLASS}>
          Edit this page ↗
        </a>
      ) : null}
      <button
        type="button"
        onClick={() => void handleSignOut()}
        aria-label="Sign out"
        title="Sign out"
        className={`${ITEM_CLASS} min-w-[44px] justify-center`}
      >
        <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </>
  );

  return (
    <div
      ref={containerRef}
      className={`fixed right-4 z-40 bottom-[calc(1rem+var(--sticky-cta-offset,0px)+env(safe-area-inset-bottom,0px))] print:hidden ${verifiedAdmin ? 'hidden lg:block' : ''}`}
    >
      <div
        className={`hidden h-11 items-center gap-1 rounded-full pl-4 pr-1 ${verifiedAdmin ? 'lg:flex' : 'sm:flex'} ${PILL_SURFACE}`}
      >
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em]">
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${ADMIN_PILL_DOT_CLASS}`} />
          Admin
        </span>
        {items}
      </div>

      {verifiedAdmin ? null : (
        <div className="sm:hidden">
          {menuOpen ? (
            <div
              className={`absolute bottom-full right-0 mb-2 flex min-w-[200px] flex-col rounded-[2px] py-1 ${PILL_SURFACE}`}
            >
              {items}
            </div>
          ) : null}
          <button
            type="button"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className={`flex h-11 items-center gap-2 rounded-full px-4 font-mono text-[11px] uppercase tracking-[0.12em] ${FOCUS_RING_ON_DARK} ${PILL_SURFACE}`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${ADMIN_PILL_DOT_CLASS}`}
            />
            Admin
          </button>
        </div>
      )}
    </div>
  );
}
