'use client';

// =============================================================
// SAOC — components/chrome/MegaMenu.tsx
// Desktop-only trigger + dropdown for a `mega` NavItem (National Show).
// Follows the aria-expanded/aria-haspopup disclosure pattern already used
// by components/admin/AdminNav.tsx — opens on click or Enter/Space while
// focused, closes on Escape (returning focus to the trigger) or on an
// outside click.
// =============================================================

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import type { NavItem } from './nav-config';

interface MegaMenuProps {
  item: Extract<NavItem, { type: 'mega' }>;
}

export function MegaMenu({ item }: MegaMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  function onBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative" onBlur={onBlur}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-sm font-sans text-[14px] text-ink transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
      >
        {item.label}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={item.label}
          className="absolute left-0 top-full z-50 mt-3 min-w-[280px] rounded-sm border border-rule bg-parchment p-6 shadow-float sm:min-w-[520px]"
        >
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:gap-10">
              {item.columns.map((column) => (
                <div key={column.id}>
                  {column.headingHref ? (
                    <Link
                      href={column.headingHref}
                      onClick={() => setOpen(false)}
                      className="rounded-sm font-serif text-[16px] font-medium text-ink hover:text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
                    >
                      {column.heading}
                    </Link>
                  ) : (
                    <span className="font-serif text-[16px] font-medium text-ink">
                      {column.heading}
                    </span>
                  )}
                  <ul className="mt-3 flex flex-col gap-2">
                    {column.links.map((link) => (
                      <li key={link.id}>
                        <Link
                          href={link.href}
                          onClick={() => setOpen(false)}
                          className="rounded-sm font-sans text-[14px] text-ink/80 hover:text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <Link
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-sm font-mono text-[11px] uppercase tracking-[0.18em] text-primary hover:text-primary-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
            >
              Visit National Show &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
