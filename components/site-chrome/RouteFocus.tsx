'use client';

// =============================================================
// components/site-chrome/RouteFocus.tsx
// NAV-1: moves focus to the new page's <h1> after a client-side navigation, on both hosts. Mounted
// once per host frame after the header, so on a mobile-menu navigation its effect runs after the
// menu's focus trap has handed focus back to the hamburger, and the heading wins. Renders nothing.
// =============================================================

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

import {
  type RouteFocusDocument,
  ROUTE_FOCUS_MAIN_SELECTOR,
  ROUTE_FOCUS_WAIT_MS,
  focusRouteTarget,
  shouldMoveRouteFocus,
} from '@/lib/route-focus';

// The core is written against a structural subset of the DOM so it can be unit-tested with fakes;
// the real document is adapted here (only HTMLElements can take focus).
const domDocument: RouteFocusDocument = {
  get activeElement() {
    return document.activeElement instanceof HTMLElement ? document.activeElement : null;
  },
  querySelector: (selector) => document.querySelector<HTMLElement>(selector),
};

export function RouteFocus() {
  const pathname = usePathname();
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    const previous = previousPath.current;
    previousPath.current = pathname;
    if (!shouldMoveRouteFocus({ previousPath: previous, nextPath: pathname, hash: window.location.hash })) {
      return;
    }
    if (focusRouteTarget(domDocument) !== 'main') return;

    // The page's <h1> has not streamed in yet: keep looking until it does, or the wait runs out.
    const main = document.querySelector(ROUTE_FOCUS_MAIN_SELECTOR);
    if (!main) return;
    const observer = new MutationObserver(() => {
      if (focusRouteTarget(domDocument) !== 'main') observer.disconnect();
    });
    observer.observe(main, { childList: true, subtree: true });
    const timer = window.setTimeout(() => observer.disconnect(), ROUTE_FOCUS_WAIT_MS);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
