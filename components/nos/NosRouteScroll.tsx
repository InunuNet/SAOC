'use client';

// =============================================================
// NOS — components/nos/NosRouteScroll.tsx
// Client Component, mounted once in NosFrame. Next's layout-router scrolls a navigation to the
// first non-skipped node of the changed segment and does nothing when that node is already in
// view; on pages whose first such node is the in-page index nav, a reader scrolled to the bottom
// keeps the old offset (clamped). So a push navigation without a hash is reset to the top here,
// instantly. A hash navigation is left to Next (anchors carry a scroll-margin-top in
// nos-structure.css). Back/forward restore the offset recorded for that history entry, because
// Next does not restore it on these routes. No animated scrolling, no view transitions.
// =============================================================

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const ENTRY_KEY = '__nosScrollId';
const STORE_KEY = 'nos-scroll-offsets';
const RESTORE_INTERVAL_MS = 50;
const RESTORE_MAX_TRIES = 30;
const RESTORE_TOLERANCE_PX = 2;
const FREEZE_MS = 2000;

type Offsets = Record<string, number>;

function readOffsets(): Offsets {
  try {
    const raw = window.sessionStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Offsets) : {};
  } catch {
    return {};
  }
}

function writeOffset(id: string, y: number): void {
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify({ ...readOffsets(), [id]: y }));
  } catch {
    // Storage unavailable (private mode, quota): back/forward falls back to the browser.
  }
}

function currentEntryId(): string | null {
  const state: unknown = window.history.state;
  if (state && typeof state === 'object' && ENTRY_KEY in state) {
    const id = (state as Record<string, unknown>)[ENTRY_KEY];
    return typeof id === 'string' ? id : null;
  }
  return null;
}

/** Tag the current history entry with an id, merging into (never replacing) Next's own state. */
function ensureEntryId(): void {
  if (currentEntryId()) return;
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const state: unknown = window.history.state;
  const base = state && typeof state === 'object' ? (state as Record<string, unknown>) : {};
  window.history.replaceState({ ...base, [ENTRY_KEY]: id }, '');
}

export function NosRouteScroll() {
  const pathname = usePathname();
  const popTarget = useRef<number | null | undefined>(undefined);
  const mounted = useRef(false);
  const frozenId = useRef<string | null>(null);

  useEffect(() => {
    let freezeTimer = 0;
    const freeze = (id: string | null) => {
      frozenId.current = id;
      window.clearTimeout(freezeTimer);
      freezeTimer = window.setTimeout(() => {
        frozenId.current = null;
      }, FREEZE_MS);
    };
    // Back/forward: read the recorded offset now, before Next's own scroll overwrites it, and keep
    // that entry's record frozen while the restore runs.
    const onPop = () => {
      const id = currentEntryId();
      popTarget.current = id ? (readOffsets()[id] ?? null) : null;
      freeze(id);
    };
    // Next scrolls to its own target (and the browser clamps) before the new history entry exists,
    // so that scroll would be recorded against the page being left. Snapshot the offset when a
    // link to another path is activated and freeze that entry until the navigation settles.
    const onClick = (event: MouseEvent) => {
      const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
      if (event.button !== 0 || modified) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      const id = currentEntryId();
      if (!anchor || !id || (anchor.getAttribute('target') ?? '_self') !== '_self') return;
      const url = new URL((anchor as HTMLAnchorElement).href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      popTarget.current = undefined;
      writeOffset(id, window.scrollY);
      freeze(id);
    };
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const id = currentEntryId();
        if (id && id !== frozenId.current) writeOffset(id, window.scrollY);
      });
    };
    window.addEventListener('popstate', onPop);
    document.addEventListener('click', onClick, true);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('click', onClick, true);
      window.clearTimeout(freezeTimer);
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      ensureEntryId();
      return;
    }
    if (popTarget.current !== undefined) {
      const target = popTarget.current;
      popTarget.current = undefined;
      if (target === null) return;
      // The restored page may still be a short loader shell: retry until the document is tall enough.
      let tries = 0;
      const timer = window.setInterval(() => {
        window.scrollTo({ top: target, left: 0, behavior: 'instant' });
        tries += 1;
        if (Math.abs(window.scrollY - target) <= RESTORE_TOLERANCE_PX || tries >= RESTORE_MAX_TRIES) {
          window.clearInterval(timer);
        }
      }, RESTORE_INTERVAL_MS);
      return () => window.clearInterval(timer);
    }
    ensureEntryId();
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
