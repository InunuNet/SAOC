// lib/route-focus.ts
// NAV-1: after a client-side navigation focus moves to the new page's <h1> (else <main>), so a
// clicked nav link never keeps focus and the next keypress cannot draw a ring on an idle page.
// Pure: no DOM globals, the document is passed in, so the unit check runs it against fakes.

export const ROUTE_FOCUS_ATTRIBUTE = 'data-route-focus';
/** How long RouteFocus waits for a streamed page's <h1> before leaving focus on <main>. */
export const ROUTE_FOCUS_WAIT_MS = 1000;
export const ROUTE_FOCUS_MAIN_SELECTOR = '#main-content';

const HEADING_SELECTOR = `${ROUTE_FOCUS_MAIN_SELECTOR} h1`;

export type RouteFocusResult = 'h1' | 'main' | 'kept' | 'none';

export interface RouteFocusElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  focus(options?: { preventScroll?: boolean }): void;
  contains(other: object | null): boolean;
  addEventListener(type: 'blur', listener: () => void, options?: { once?: boolean }): void;
}

export interface RouteFocusDocument {
  activeElement: object | null;
  querySelector(selector: string): RouteFocusElement | null;
}

interface RouteChange {
  previousPath: string | null | undefined;
  nextPath: string | null | undefined;
  hash: string;
}

/**
 * True only for a real path change: not the first render, not a query-only change (the pathname
 * is unchanged), and not a hash navigation (`/tickets#ticket-day` is left to the browser).
 */
export function shouldMoveRouteFocus({ previousPath, nextPath, hash }: RouteChange): boolean {
  if (!previousPath || !nextPath) return false;
  return previousPath !== nextPath && hash === '';
}

export function focusRouteTarget(doc: RouteFocusDocument): RouteFocusResult {
  const main = doc.querySelector(ROUTE_FOCUS_MAIN_SELECTOR);
  if (!main) return 'none';

  // Focus already inside <main> (an autofocused field, a user who moved on) is never stolen.
  // Focus on <main> itself is the fallback landing, which the <h1> may still take over.
  const active = doc.activeElement;
  if (active && active !== main && main.contains(active)) return 'kept';

  const heading = doc.querySelector(HEADING_SELECTOR);
  const target = heading ?? main;
  if (target.getAttribute('tabindex') === null) target.setAttribute('tabindex', '-1');
  target.setAttribute(ROUTE_FOCUS_ATTRIBUTE, '');
  target.addEventListener('blur', () => target.removeAttribute(ROUTE_FOCUS_ATTRIBUTE), {
    once: true,
  });
  // The route change owns scroll (Next, NosRouteScroll), so focusing must not scroll.
  target.focus({ preventScroll: true });
  return heading ? 'h1' : 'main';
}
