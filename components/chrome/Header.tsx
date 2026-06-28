'use client';

// =============================================================
// SAOC — components/chrome/Header.tsx
// Sticky parchment header. Three zones: logo lockup, primary nav,
// actions (search / sign in / contact / hamburger).
// Becomes elevated (shadow + hairline) on scroll > 4px.
// Below 1180px: nav + Sign in hide, hamburger appears.
// =============================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { MobileMenu } from './MobileMenu';
import { SearchOverlay } from './SearchOverlay';

const NAV: ReadonlyArray<{ id: string; label: string; href: string; disabled?: boolean }> = [
  { id: 'about', label: 'About', href: '/about' },
  { id: 'societies', label: 'Societies', href: '/societies' },
  { id: 'judging', label: 'Judging', href: '/judging' },
  { id: 'show', label: 'National Show', href: '/national-show' },
  { id: 'events', label: 'Events', href: '/events' },
  { id: 'learn', label: 'Learn', href: '#', disabled: true },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
          {/* Zone 1 — logo lockup */}
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="South African Orchid Council — home"
          >
            <Image src="/images/saoc-logo-ink-paper.png" alt="" width={48} height={48} priority />
            <span className="hidden sm:flex flex-col leading-tight">
              <span className="font-serif text-[22px] font-medium text-ink">
                SA Orchid Council
              </span>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted">
                Making a difference since 1968
              </span>
            </span>
          </Link>

          {/* Zone 2 — primary nav */}
          <nav aria-label="Primary" className="hidden min-[1180px]:flex items-center gap-7">
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
              return (
                <Link
                  key={n.id}
                  href={n.href}
                  className={[
                    'relative font-sans text-[14px] text-ink transition-colors duration-150 hover:text-primary',
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
                </Link>
              );
            })}
          </nav>

          {/* Zone 3 — actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open search"
              className="p-2 text-ink hover:text-primary transition-colors duration-150"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={18} strokeWidth={1.5} />
            </button>

            <Link
              href="/signin"
              className="hidden min-[1180px]:inline-block font-sans text-[14px] text-ink hover:text-primary transition-colors duration-150"
            >
              Sign in
            </Link>

            <Link
              href="/contact"
              className="hidden sm:inline-block rounded-sm bg-primary px-4 py-2 font-sans text-[14px] font-medium text-ivory hover:bg-primary-800 transition-colors duration-150"
            >
              Contact
            </Link>

            <button
              type="button"
              aria-label="Open menu"
              className="p-2 text-ink min-[1180px]:hidden hover:text-primary transition-colors duration-150"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={22} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} nav={NAV} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
