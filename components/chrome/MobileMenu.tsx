'use client';

// =============================================================
// SAOC — components/chrome/MobileMenu.tsx
// Full-screen overlay with right-sliding panel.
// Rendered by Header; receives the same NAV array.
// =============================================================

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, X } from 'lucide-react';

import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import type { NavItem } from './nav-config';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  nav: ReadonlyArray<NavItem>;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export function MobileMenu({ open, onClose, nav, triggerRef }: MobileMenuProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  if (!open) return null;

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/45"
      onClick={handleBackdrop}
    >
      <aside
        className="ml-auto h-full w-full max-w-[360px] bg-parchment p-6"
        style={{ animation: 'slideInFromRight 250ms cubic-bezier(0.4,0,0.2,1) both' }}
      >
        {/* Top row: wordmark + close */}
        <div className="flex items-center justify-between mb-8">
          <span className="flex items-center gap-2">
            <Image src="/images/saoc-logo-ink-paper.png" alt="" width={36} height={36} />
            <span className="font-serif text-[16px] font-medium text-ink leading-tight">
              SA Orchid Council
            </span>
          </span>
          <button
            type="button"
            aria-label="Close menu"
            className="rounded-sm p-2 text-ink hover:text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
            onClick={onClose}
          >
            <X size={22} strokeWidth={1.5} />
          </button>
        </div>

        {/* Nav links */}
        <nav aria-label="Mobile primary">
          <ul className="flex flex-col gap-1">
            {nav.map((n) => {
              if (n.type === 'mega') {
                const isExpanded = expandedId === n.id;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedId(isExpanded ? null : n.id)}
                      className="flex w-full items-center justify-between px-3 py-3 font-sans text-[15px] text-ink hover:text-primary hover:bg-bone rounded-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
                    >
                      {n.label}
                      <ChevronDown
                        size={16}
                        strokeWidth={1.5}
                        className={isExpanded ? 'rotate-180 transition-transform' : 'transition-transform'}
                      />
                    </button>
                    {isExpanded && (
                      <div className="pl-3 pb-2">
                        <Link
                          href={n.href}
                          onClick={onClose}
                          className="block px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-primary hover:text-primary-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
                        >
                          Visit National Show &rarr;
                        </Link>
                        {n.columns.map((column) => (
                          <div key={column.id} className="mt-2">
                            {column.headingHref ? (
                              <Link
                                href={column.headingHref}
                                onClick={onClose}
                                className="block px-3 py-2 font-serif text-[14px] font-medium text-ink hover:text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
                              >
                                {column.heading}
                              </Link>
                            ) : (
                              <span className="block px-3 py-2 font-serif text-[14px] font-medium text-ink">
                                {column.heading}
                              </span>
                            )}
                            <ul className="flex flex-col gap-1">
                              {column.links.map((link) => (
                                <li key={link.id}>
                                  <Link
                                    href={link.href}
                                    onClick={onClose}
                                    className="block px-6 py-2 font-sans text-[14px] text-ink/80 hover:text-primary hover:bg-bone rounded-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
                                  >
                                    {link.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              }
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
              return (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={onClose}
                    className="flex items-center px-3 py-3 font-sans text-[15px] text-ink hover:text-primary hover:bg-bone rounded-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
                  >
                    {n.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <Link
                href="/contact"
                onClick={onClose}
                className="flex items-center px-3 py-3 font-sans text-[15px] text-ink hover:text-primary hover:bg-bone rounded-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
              >
                Contact
              </Link>
            </li>
          </ul>
        </nav>

        {/* Footer meta */}
        <div className="mt-8 pt-6 border-t border-rule flex flex-col gap-1">
          <a
            href="mailto:council@saoc.co.za"
            className="font-mono text-[12px] text-muted hover:text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
          >
            council@saoc.co.za
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
