'use client';

import { useEffect } from 'react';

export interface UseFocusTrapOptions {
  active: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  onEscape: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * useFocusTrap
 *
 * While `active`, moves focus into `containerRef`'s first focusable element, cycles
 * Tab/Shift+Tab only within the container's current focusable set (wrapping at both
 * ends), calls `onEscape` on Escape, and returns focus to `returnFocusRef` (or the
 * previously focused element) once deactivated/unmounted.
 */
export function useFocusTrap({
  active,
  containerRef,
  onEscape,
  returnFocusRef,
}: UseFocusTrapOptions): void {
  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const returnTarget = returnFocusRef?.current ?? previouslyFocused;

    const focusables = getFocusableElements(container);
    (focusables[0] ?? container).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== 'Tab') return;

      const currentFocusables = getFocusableElements(container);
      if (currentFocusables.length === 0) {
        e.preventDefault();
        return;
      }

      const first = currentFocusables[0];
      const last = currentFocusables[currentFocusables.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (activeEl === first || !activeEl || !container.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (activeEl === last || !activeEl || !container.contains(activeEl)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      returnTarget?.focus();
    };
  }, [active, containerRef, onEscape, returnFocusRef]);
}
