'use client';

// =============================================================
// SAOC — components/chrome/Header.tsx
// Sticky parchment header. Three zones: logo lockup, primary nav,
// actions (search / tickets CTA / hamburger). Contact is the last nav item.
// Becomes elevated (shadow + hairline) on scroll > 4px.
// Below 1240px: nav + Sign in hide, hamburger appears.
// =============================================================

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { MobileMenu, MOBILE_MENU_ID } from './MobileMenu';
import { SearchOverlay } from './SearchOverlay';
import { CONTACT_LINK, NAV } from './nav-config';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // Close the mobile menu when the route changes. Adjusted during render
  // (rather than in an effect) per https://react.dev/learn/you-might-not-need-an-effect
  // — avoids the extra commit a setState-in-effect would otherwise trigger.
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Global keyboard: Cmd+K / Ctrl+K / "/" opens search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === '/' && !isInput && !searchOpen) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen]);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href));

  return (
    <>
      <header
        className={[
          'sticky top-0 z-40 bg-parchment transition-shadow duration-150',
          scrolled ? 'shadow-float border-b border-rule' : '',
        ].join(' ')}
      >
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-6 px-8 py-3">
          {/* Zone 1 — logo lockup. Raster combined lockup
              (saoc-lockup-horizontal-full-name.png, 3757×493 source),
              exported from Brad's lockup explorer at wordmark W2 ('South
              African Orchid Council', WM:1) by scripts/export-saoc-lockup.mjs
              — Lee-Ann's 2026-10-15 instruction to use the full name. Kept
              as a raster rather than the live SaocLockup (which remains in
              use for the footer only): the live version widened this zone
              enough to squeeze the primary nav into two-line wraps at
              1280px ("Judging & Awards", "National Show"), and W2 is ~1.6x
              wider again. Display width by tier: 190px below `sm` (640px;
              the link may shrink so 360px viewports never overflow), 460px
              in hamburger mode (640-1239px), 340px once the inline nav
              shows (1240-1279px) and 380px from 1280px, so the nav does
              not wrap. Height follows the
              true aspect via h-auto. */}
          <Link
            href="/"
            className="min-w-0 shrink rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
            aria-label="South African Orchid Council — Making a difference since 1968"
          >
            <Image
              src="/images/saoc-lockup-horizontal-full-name.png"
              alt=""
              width={3757}
              height={493}
              priority
              className="h-auto w-[190px] max-w-full sm:max-[1239px]:w-[460px] min-[1240px]:w-[340px] min-[1280px]:w-[380px]"
            />
          </Link>

          {/* Zone 2 — primary nav */}
          <nav aria-label="Primary" className="hidden min-[1240px]:flex shrink-0 items-center gap-4 whitespace-nowrap">
            {NAV.map((n) => {
              const active = !n.disabled && isActive(n.href);
              if (n.disabled) {
                return (
                  <span
                    key={n.id}
                    aria-disabled="true"
                    className="inline-flex items-center gap-2 font-sans text-[14px] text-muted/60 cursor-not-allowed"
                  >
                    {n.label}
                    <span className="rounded-pill bg-bone px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                      Soon
                    </span>
                  </span>
                );
              }
              // National Show leaves this site for the NOS one: a plain anchor, same tab, no arrow.
              const NavLink = n.crossSite ? 'a' : Link;
              return (
                <NavLink
                  key={n.id}
                  href={n.href}
                  className={[
                    'relative inline-flex min-h-6 items-center rounded-sm font-sans text-[14px] transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-parchment',
                    n.quiet ? 'text-muted' : 'text-ink',
                    active ? 'text-primary' : '',
                  ].join(' ')}
                >
                  {n.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 right-0 -bottom-1 h-px bg-primary"
                    />
                  )}
                </NavLink>
              );
            })}
            <Link
              href={CONTACT_LINK.href}
              className={[
                'relative inline-flex min-h-6 items-center rounded-sm font-sans text-[14px] transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-parchment',
                isActive(CONTACT_LINK.href) ? 'text-primary' : 'text-ink',
              ].join(' ')}
            >
              {CONTACT_LINK.label}
              {isActive(CONTACT_LINK.href) && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 right-0 -bottom-1 h-px bg-primary"
                />
              )}
            </Link>
          </nav>

          {/* Zone 3 — actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open search"
              className="rounded-sm p-2 text-ink hover:text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={18} strokeWidth={1.5} />
            </button>

            <button
              ref={hamburgerRef}
              type="button"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              aria-controls={MOBILE_MENU_ID}
              className="rounded-sm p-2 text-ink min-[1240px]:hidden hover:text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={22} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      <MobileMenu
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        nav={NAV}
        triggerRef={hamburgerRef}
      />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
