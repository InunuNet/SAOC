'use client';

// =============================================================
// NOS — components/nos/NosSubNav.tsx
// Client Component (one tiny effect). The R27 group sub-nav that sits directly under every
// inner hero: one row of the current page's group (Visit / Programme / Exhibit & Trade /
// The Show), items supplied by the server wrapper from nav-config. Not sticky; it scrolls
// away with the page. Geometry and type live in nos-theme.css (`.nos-subnav`), cited there
// to the NOS Design ruling.
//
// Below 768px the row scrolls. The effect sets the row's scrollLeft so the current item is
// fully in view with a lead equal to the row gutter (directly, not with scrollIntoView, which
// can also scroll the page vertically past the hero), and keeps two flags, data-fade-start and
// data-fade-end, that say which edge hides items; the 40px mask fade shows only there.
// Without JavaScript the row simply scrolls with no fade, which is safe.
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

const OVERFLOW_SLACK_PX = 1;

export function NosSubNav({ label, items, currentHref, exact }: NosSubNavProps) {
  const rowRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const syncFade = () => {
      row.toggleAttribute('data-fade-start', row.scrollLeft > OVERFLOW_SLACK_PX);
      row.toggleAttribute(
        'data-fade-end',
        row.scrollLeft + row.clientWidth < row.scrollWidth - OVERFLOW_SLACK_PX
      );
    };

    const isOverflowing = () => row.scrollWidth > row.clientWidth + OVERFLOW_SLACK_PX;

    const isCurrentVisible = () => {
      const current = row.querySelector<HTMLElement>('[aria-current]');
      if (!current) return true;
      const style = getComputedStyle(row);
      const start = row.scrollLeft + parseFloat(style.paddingLeft);
      const end = row.scrollLeft + row.clientWidth - parseFloat(style.paddingRight);
      return current.offsetLeft >= start && current.offsetLeft + current.offsetWidth <= end;
    };

    const alignCurrent = () => {
      const current = row.querySelector<HTMLElement>('[aria-current]');
      if (!current || !isOverflowing()) return;
      // The lead is the row's own gutter, the same as its scroll-padding-inline in nos-structure.css.
      const lead = parseFloat(getComputedStyle(row).paddingLeft);
      const target = current.offsetLeft - lead;
      row.scrollLeft = Math.max(0, Math.min(target, row.scrollWidth - row.clientWidth));
    };

    let wasOverflowing = isOverflowing();
    alignCurrent();
    syncFade();

    // On a resize the current item is aligned again when the row starts to overflow, or when it
    // has been pushed outside the row's visible box (no smooth scrolling).
    const onResize = () => {
      const nowOverflowing = isOverflowing();
      if (nowOverflowing && (!wasOverflowing || !isCurrentVisible())) alignCurrent();
      wasOverflowing = nowOverflowing;
      syncFade();
    };

    row.addEventListener('scroll', syncFade, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      row.removeEventListener('scroll', syncFade);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <nav aria-label={label} className="nos-subnav">
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
      </div>
    </nav>
  );
}
