'use client';

import { useEffect, useRef } from 'react';
import { ArrowLeft, X } from 'lucide-react';

import { FOCUS_RING } from './tokens';
import { useFocusTrap } from './useFocusTrap';

const MOBILE_QUERY = '(max-width: 1023px)';

interface DetailDrawerProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** Sticky footer: the record's actions. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Record detail. From 1024 it is a 520px right-hand panel with no scrim, so the list stays
 * visible and readable beside it; below 1024 it is a full-page view with a back link. Focus is
 * trapped and Esc closes in both modes; body scroll is locked only in the full-page mode.
 */
export function DetailDrawer({ open, title, subtitle, onClose, footer, children }: DetailDrawerProps) {
  const panelRef = useRef<HTMLElement>(null);
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
    const mobile = window.matchMedia(MOBILE_QUERY);
    if (!mobile.matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <section
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      className="fixed inset-0 z-40 flex flex-col bg-parchment lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[520px] lg:border-l lg:border-rule lg:shadow-sheet"
    >
      <div className="flex items-start gap-2 border-b border-rule px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onClose}
          className={`flex min-h-[44px] items-center gap-2 pr-3 font-sans text-[14px] font-medium text-ink lg:hidden ${FOCUS_RING}`}
        >
          <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          Back
        </button>
        <div className="min-w-0 flex-1 py-1">
          <h2 className="break-words font-serif text-[22px] font-semibold leading-tight text-ink">
            {title}
          </h2>
          {subtitle ? <p className="mt-0.5 break-words font-sans text-[13px] text-muted">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={`hidden h-11 w-11 shrink-0 items-center justify-center text-ink lg:flex ${FOCUS_RING}`}
        >
          <X size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>

      {footer ? (
        <div className="sticky bottom-0 border-t border-rule bg-parchment px-4 py-3 sm:px-6">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

interface DetailSectionProps {
  title: string;
  items: { label: string; value: React.ReactNode }[];
}

/** One grouped definition list inside the drawer: Business, Contact, Stand, Permits, Payment, Photos. */
export function DetailSection({ title, items }: DetailSectionProps) {
  return (
    <section className="mb-6 last:mb-0">
      <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{title}</h3>
      <dl className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)] gap-x-4 gap-y-2 border-t border-rule-soft pt-3">
        {items.map((item) => (
          <div key={item.label} className="contents">
            <dt className="font-sans text-[13px] text-muted">{item.label}</dt>
            <dd className="min-w-0 break-words font-sans text-[14px] text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
