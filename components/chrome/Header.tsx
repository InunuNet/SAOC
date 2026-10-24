'use client';

// =============================================================
// SAOC — components/chrome/Header.tsx
// Sticky parchment header, the same structure and sizes as the National Show header (HD-1): logo
// lockup, primary nav, search, the "Join a society" CTA and, below the full breakpoint, a labelled
// MENU button. Contact is the last nav item. Becomes elevated (shadow) on scroll > 4px; the 1px
// bottom rule is permanent.
// Shared breakpoints (components/nos-chrome/nos-chrome.css uses the same two): inline nav and
// search from 1384px, lockup + CTA + MENU from 780px, lockup on its own row below that.
// The data-hd attributes are the hooks both headers share so one script can measure either.
// =============================================================

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { MobileMenu, MOBILE_MENU_ID } from './MobileMenu';
import { SearchOverlay } from './SearchOverlay';
import { navAriaCurrent } from '@/lib/nav-current';
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


  return (
    <>
      <header
        className={[
          'sticky top-0 z-40 border-b border-rule bg-parchment transition-shadow duration-150 max-[780px]:relative',
          scrolled ? 'shadow-float' : '',
        ].join(' ')}
      >
        <div
          data-hd="bar"
          className="saoc-container flex items-center gap-3 py-[13px] max-[780px]:grid max-[780px]:grid-cols-[auto_1fr_auto] max-[780px]:pb-3 max-[780px]:pt-4"
        >
          {/* Zone 1 — logo lockup. Raster combined lockup
              (saoc-lockup-horizontal-full-name.png, 3757×493 source),
              exported from Brad's lockup explorer at wordmark W2 ('South
              African Orchid Council', WM:1) by scripts/export-saoc-lockup.mjs
              — Lee-Ann's 2026-10-15 instruction to use the full name. Kept
              as a raster rather than the live SaocLockup (which remains in
              use for the footer only). HD-1: the link is the NOS lockup's
              footprint, min(container, 405px) wide and 405:70 (the NOS ink
              box), so both headers have the same lockup width and the same
              first-row height at every width; the full-name PNG is scaled
              only (uncropped, unfiltered) and centred in that box. */}
          <Link
            href="/"
            data-hd="brand"
            aria-current={navAriaCurrent(pathname, '/')}
            className="mr-3 flex aspect-[405/70] w-[min(100%,405px)] shrink-0 items-center rounded-sm max-[780px]:col-span-full max-[780px]:mr-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
            aria-label="South African Orchid Council — Making a difference since 1968"
          >
            <Image
              src="/images/saoc-lockup-horizontal-full-name.png"
              alt=""
              width={3757}
              height={493}
              sizes="(min-width: 780px) 405px, calc(100vw - 32px)"
              priority
              className="h-auto w-full"
            />
          </Link>

          {/* Zone 2 — primary nav, inline from 1384px */}
          <nav data-hd="nav" aria-label="Primary" className="ml-auto hidden min-[1384px]:block">
            <ul className="flex items-center gap-0.5 whitespace-nowrap">
              {NAV.map((n) => {
                if (n.disabled) {
                  return (
                    <li key={n.id}>
                      <span
                        aria-disabled="true"
                        className="inline-flex min-h-11 items-center gap-2 px-[9px] font-sans text-[14.5px] font-semibold leading-none text-muted/60 cursor-not-allowed"
                      >
                        {n.label}
                        <span className="rounded-pill bg-bone px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                          Soon
                        </span>
                      </span>
                    </li>
                  );
                }
                // National Show leaves this site for the NOS one: a plain anchor, same tab, no arrow.
                const NavLink = n.crossSite ? 'a' : Link;
                return (
                  <li key={n.id}>
                    <NavLink
                      href={n.href}
                      data-hd="item"
                      aria-current={navAriaCurrent(pathname, n.href, { crossSite: n.crossSite })}
                      className={[
                        'group relative inline-flex min-h-11 items-center px-[9px] font-sans text-[14.5px] font-semibold leading-none transition-colors duration-150 hover:text-primary focus-visible:text-primary focus-visible:outline-none aria-[current=page]:text-primary',
                        n.quiet ? 'text-muted' : 'text-ink',
                      ].join(' ')}
                    >
                      <span
                        data-hd="label"
                        className="relative after:absolute after:-bottom-2 after:left-0 after:right-0 after:h-0 after:bg-primary after:content-[''] group-hover:after:h-0.5 group-focus-visible:after:h-0.5 group-aria-[current=page]:after:h-0.5 forced-colors:group-focus-visible:underline forced-colors:group-focus-visible:decoration-2 forced-colors:group-focus-visible:underline-offset-4 forced-colors:group-aria-[current=page]:underline"
                      >
                        {n.label}
                      </span>
                    </NavLink>
                  </li>
                );
              })}
              <li>
                <Link
                  href={CONTACT_LINK.href}
                  data-hd="item"
                  aria-current={navAriaCurrent(pathname, CONTACT_LINK.href)}
                  className="group relative inline-flex min-h-11 items-center px-[9px] font-sans text-[14.5px] font-semibold leading-none text-ink transition-colors duration-150 hover:text-primary focus-visible:text-primary focus-visible:outline-none aria-[current=page]:text-primary"
                >
                  <span
                    data-hd="label"
                    className="relative after:absolute after:-bottom-2 after:left-0 after:right-0 after:h-0 after:bg-primary after:content-[''] group-hover:after:h-0.5 group-focus-visible:after:h-0.5 group-aria-[current=page]:after:h-0.5 forced-colors:group-focus-visible:underline forced-colors:group-focus-visible:decoration-2 forced-colors:group-focus-visible:underline-offset-4 forced-colors:group-aria-[current=page]:underline"
                  >
                    {CONTACT_LINK.label}
                  </span>
                </Link>
              </li>
            </ul>
          </nav>

          {/* Zone 3 — actions. Search is inline from 1384px (below that it is the drawer's first
              row); the CTA is the last item of the full row and the MENU button takes its place below. */}
          <button
            data-hd="search"
            type="button"
            aria-label="Open search"
            className="hidden size-11 items-center justify-center rounded-sm text-ink transition-colors duration-150 hover:text-primary min-[1384px]:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
            onClick={() => setSearchOpen(true)}
          >
            <Search size={18} strokeWidth={1.5} />
          </button>

          <Link
            href="/societies"
            data-hd="cta"
            aria-current={navAriaCurrent(pathname, '/societies')}
            className="ml-auto inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[10px] bg-accent px-6 py-[10px] font-sans text-[13px] font-bold uppercase leading-none tracking-[0.12em] text-ink transition-colors duration-150 hover:bg-accent-soft max-[780px]:col-start-1 max-[780px]:ml-0 min-[1384px]:ml-0 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 forced-colors:focus-visible:decoration-[color:Highlight]"
          >
            Join a society
          </Link>

          <button
            ref={hamburgerRef}
            data-hd="menu"
            type="button"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls={MOBILE_MENU_ID}
            className="inline-flex min-h-11 min-w-[104px] items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-[color:var(--nh-control-border)] px-3 font-sans text-[13px] font-bold uppercase leading-none tracking-[0.12em] text-ink transition-colors duration-150 hover:text-primary max-[780px]:col-start-3 max-[780px]:justify-self-end min-[1384px]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
            Menu
          </button>
        </div>
      </header>

      <MobileMenu
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onSearch={() => setSearchOpen(true)}
        nav={NAV}
        triggerRef={hamburgerRef}
      />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
