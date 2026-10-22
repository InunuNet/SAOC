'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

import { FOCUS_RING } from '@/components/admin/tokens';
import { useFocusTrap } from '@/components/admin/useFocusTrap';

// The design handoff's mobile-menu scrim.
const SCRIM_CLASS = 'bg-[rgba(34,40,31,.55)]';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/** Left drawer below the 62px header, 280px or 85vw, below 1024. Traps focus, closes on Esc and scrim click, and
 *  locks body scroll while open. Rendered only while open. */
export function MobileDrawer({ open, onClose, children }: MobileDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, panelRef);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-[62px] z-50 lg:hidden">
      <div className={`absolute inset-0 ${SCRIM_CLASS}`} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Admin menu"
        tabIndex={-1}
        className="absolute inset-y-0 left-0 flex w-[min(280px,85vw)] flex-col bg-parchment shadow-sheet"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className={`absolute right-1 top-1 z-10 flex h-11 w-11 items-center justify-center text-ink ${FOCUS_RING}`}
        >
          <X size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
        {children}
      </div>
    </div>
  );
}
