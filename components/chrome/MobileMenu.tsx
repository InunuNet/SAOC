'use client';

// =============================================================
// SAOC — components/chrome/MobileMenu.tsx
// Full-screen overlay with right-sliding panel.
// Rendered by Header; receives the same NAV array.
// =============================================================

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, X } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import { navAriaCurrent } from '@/lib/nav-current';
import { CONTACT_LINK, type NavLinkItem } from './nav-config';

export const MOBILE_MENU_ID = 'mobile-menu';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  /** Opens the search dialog; the drawer's first row (below the full breakpoint, where the header has no search icon). */
  onSearch: () => void;
  nav: ReadonlyArray<NavLinkItem>;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export function MobileMenu({ open, onClose, onSearch, nav, triggerRef }: MobileMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Marks every other <body> child (header, main, footer, the SearchOverlay root, etc.)
  // inert while the drawer is open, so background content is unreachable by keyboard/screen
  // reader — not just visually covered. `aria-hidden` is set alongside `inert` as a fallback
  // for environments without inert support. Declared before useFocusTrap so its cleanup
  // (clearing `inert`) runs before the trap's cleanup tries to focus the trigger button —
  // otherwise the trigger can live inside a still-inert <header> and silently refuse focus.
  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;

    const hidden: HTMLElement[] = [];
    for (const child of Array.from(document.body.children)) {
      if (child === container || !(child instanceof HTMLElement)) continue;
      child.setAttribute('inert', '');
      child.setAttribute('aria-hidden', 'true');
      hidden.push(child);
    }

    return () => {
      for (const el of hidden) {
        el.removeAttribute('inert');
        el.removeAttribute('aria-hidden');
      }
    };
  }, [open]);

  useFocusTrap({
    active: open,
    containerRef,
    onEscape: onClose,
    returnFocusRef: triggerRef,
  });

  // Closed: keep an empty, hidden element so the hamburger's aria-controls always resolves.
  if (!open) return <div id={MOBILE_MENU_ID} hidden />;

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      ref={containerRef}
      id={MOBILE_MENU_ID}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/45"
      onClick={handleBackdrop}
    >
      <aside
        className="ml-auto h-full w-full max-w-[360px] overflow-y-auto bg-parchment p-6"
        style={{ animation: 'slideInFromRight 250ms cubic-bezier(0.4,0,0.2,1) both' }}
      >
        {/* Top row: lockup + close. Reverted to the raster combined lockup
            (saoc-lockup-horizontal-full-name.png, wordmark W2) at a
            fixed 210px wide, height from the PNG's true aspect — see
            Header.tsx's Zone 1 comment. Fixed size here (not responsive)
            because this drawer stays ≤360px wide regardless of the actual
            window width. */}
        <div className="flex items-center justify-between mb-8">
          <Image
            src="/images/saoc-lockup-horizontal-full-name.png"
            alt="South African Orchid Council"
            width={3757}
            height={493}
            className="h-auto w-[210px] min-w-0"
          />
          <button
            type="button"
            aria-label="Close menu"
            className="rounded-sm p-2 text-ink hover:text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
            onClick={onClose}
          >
            <X size={22} strokeWidth={1.5} />
          </button>
        </div>

        {/* Nav links */}
        <nav aria-label="Mobile primary">
          <ul className="flex flex-col gap-1">
            <li className="min-[1384px]:hidden">
              <button
                data-hd="drawer-search"
                type="button"
                className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 font-sans text-[15px] text-ink transition-colors duration-150 hover:bg-bone hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
                onClick={() => {
                  onClose();
                  onSearch();
                }}
              >
                <Search size={18} strokeWidth={1.5} aria-hidden="true" />
                Search SAOC
              </button>
            </li>
            {nav.map((n) => {
              if (n.disabled) {
                return (
                  <li key={n.id}>
                    <span
                      aria-disabled="true"
                      className="flex items-center justify-between px-3 py-3 font-sans text-[15px] text-muted/60 cursor-not-allowed"
                    >
                      {n.label}
                      <span className="rounded-full bg-bone px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
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
                    onClick={onClose}
                    aria-current={navAriaCurrent(pathname, n.href, { crossSite: n.crossSite })}
                    className={[
                      'group flex items-center px-3 py-3 font-sans text-[15px] rounded-sm transition-colors duration-150 hover:text-primary hover:bg-bone focus-visible:text-primary focus-visible:outline-none aria-[current=page]:text-primary',
                      n.quiet ? 'text-muted' : 'text-ink',
                    ].join(' ')}
                  >
                    <span className="group-focus-visible:underline group-focus-visible:decoration-2! group-focus-visible:underline-offset-4 group-aria-[current=page]:underline group-aria-[current=page]:decoration-1 group-aria-[current=page]:underline-offset-4 forced-colors:group-focus-visible:decoration-[color:Highlight]">
                      {n.label}
                    </span>
                  </NavLink>
                </li>
              );
            })}
            <li>
              <Link
                href={CONTACT_LINK.href}
                onClick={onClose}
                aria-current={navAriaCurrent(pathname, CONTACT_LINK.href)}
                className="group flex items-center px-3 py-3 font-sans text-[15px] text-ink hover:text-primary hover:bg-bone rounded-sm transition-colors duration-150 focus-visible:text-primary focus-visible:outline-none aria-[current=page]:text-primary"
              >
                <span className="group-focus-visible:underline group-focus-visible:decoration-2! group-focus-visible:underline-offset-4 group-aria-[current=page]:underline group-aria-[current=page]:decoration-1 group-aria-[current=page]:underline-offset-4 forced-colors:group-focus-visible:decoration-[color:Highlight]">
                  {CONTACT_LINK.label}
                </span>
              </Link>
            </li>
          </ul>
        </nav>

        {/* Footer meta */}
        <div className="mt-8 pt-6 border-t border-rule flex flex-col gap-1">
          <a
            href="mailto:info@saoc.co.za"
            className="font-mono text-[12px] text-muted hover:text-primary transition-colors duration-150 focus-visible:text-primary focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 forced-colors:focus-visible:decoration-[color:Highlight]"
          >
            info@saoc.co.za
          </a>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted/55">
            Est. 1968
          </span>
        </div>
      </aside>

      <style>{`
        @keyframes slideInFromRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
