'use client';

// One hero-fan ticket is a link to the same product's full card further down the page, so there
// is one booking flow. A plain click scrolls to that card (clear of the sticky header) and moves
// focus to its name; with no script, or a modified click, the anchor works on its own.

import type { MouseEvent, ReactNode } from 'react';

const JUMP_GAP_PX = 24;
const NAME_SELECTOR = '[data-ticket-name]';

export interface FanLinkProps {
  targetId: string;
  label: string;
  children: ReactNode;
}

export function FanLink({ targetId, label, children }: FanLinkProps) {
  function jumpToCard(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = document.getElementById(targetId);
    if (!target) return;
    event.preventDefault();
    const header = document.querySelector('header');
    const headerHeight = header ? header.getBoundingClientRect().height : 0;
    const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - JUMP_GAP_PX;
    const smooth = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
    window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
    window.history.replaceState(null, '', `#${targetId}`);
    const heading = target.querySelector<HTMLElement>(NAME_SELECTOR);
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }

  return (
    <a
      data-fan-link=""
      className="nk-fan-link"
      href={`#${targetId}`}
      aria-label={label}
      onClick={jumpToCard}
    >
      {children}
    </a>
  );
}
