'use client';

// =============================================================
// NOS — components/nos/NosSubNav.tsx
// Client Component (one tiny effect). The R27 group sub-nav that sits directly under every
// inner hero: one row of the current page's group (Visit / Programme / Exhibit & Trade /
// The Show), items supplied by the server wrapper from nav-config. Not sticky; it scrolls
// away with the page. Geometry and type live in nos-theme.css (`.nos-subnav`), cited there
// to the NOS Design ruling.
//
// The effect does two things the ruling asks for at <=700px, where the row scrolls:
// it brings the current item fully into view, and it raises `data-overflowing` while the
// row is wider than its box, which is the only time the 8px edge fade shows. Without
// JavaScript the row simply scrolls with no fade, which is safe.
// =============================================================

import Link from 'next/link';
import { useEffect, useRef } from 'react';

import type { NosSubNavItem } from './nos-subnav-groups';

export interface NosSubNavProps {
  label: string;
  items: NosSubNavItem[];
  currentHref: string;
  exact: boolean;
}

export function NosSubNav({ label, items, currentHref, exact }: NosSubNavProps) {
  const navRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    const row = rowRef.current;
    if (!nav || !row) return;

    const sync = () => {
      const overflowing = row.scrollWidth > row.clientWidth + 1;
      nav.toggleAttribute('data-overflowing', overflowing);
    };
    const current = row.querySelector<HTMLElement>('[aria-current]');
    if (current && row.scrollWidth > row.clientWidth + 1) {
      const target = current.offsetLeft - (row.clientWidth - current.offsetWidth) / 2;
      row.scrollLeft = Math.max(0, Math.min(target, row.scrollWidth - row.clientWidth));
    }
    sync();

    window.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('resize', sync);
    };
  }, []);

  return (
    <nav ref={navRef} aria-label={label} className="nos-subnav">
      <div data-nos-wrap="">
        <ul ref={rowRef} className="nos-subnav-row">
          {items.map((item) => {
            const isCurrent = item.href === currentHref;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isCurrent ? (exact ? 'page' : 'true') : undefined}
                  className="nos-subnav-link"
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <span aria-hidden="true" data-nos-subnav-fade="" className="nos-subnav-fade" />
      </div>
    </nav>
  );
}
