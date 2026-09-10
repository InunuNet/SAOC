'use client';

// =============================================================
// SAOC — components/chrome/MobileMenu.tsx
// Full-screen overlay with right-sliding panel.
// Rendered by Header; receives the same NAV array.
// =============================================================

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, X } from 'lucide-react';

import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import type { NavColumn, NavItem } from './nav-config';
import { formatShowDateRange } from '@/lib/show-identity';
import type { ShowIdentity } from '@/types';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  nav: ReadonlyArray<NavItem>;
  triggerRef?: React.RefObject<HTMLElement | null>;
  /**
   * The nationalShow Sanity singleton — same source UtilityBar already reads,
   * threaded down from app/(marketing)/layout.tsx via Header. Never hardcode
   * a venue or a date here; this prop is the only source. Optional because
   * Header also renders on surfaces (e.g. /admin) that don't fetch it.
   */
  show?: ShowIdentity | null;
}

export function MobileMenu({ open, onClose, nav, triggerRef, show }: MobileMenuProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Marks every other <body> child (header, main, footer, the SearchOverlay root, etc.)
  // inert while the drawer is open, so background content is unreachable by keyboard/screen
  // reader — not just visually covered. `aria-hidden` is set alongside `inert` as a fallback
  // for environments without inert support. Declared before useFocusTrap so its cleanup
  // (clearing `inert`) runs before the trap's cleanup tries to focus the trigger button —
  // otherwise the trigger can live inside a still-inert <header> and silently refuse focus.
  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;

    const hidden: HTMLElement[] = [];
    for (const child of Array.from(document.body.children)) {
      if (child === container || !(child instanceof HTMLElement)) continue;
      child.setAttribute('inert', '');
      child.setAttribute('aria-hidden', 'true');
      hidden.push(child);
    }

    return () => {
      for (const el of hidden) {
        el.removeAttribute('inert');
        el.removeAttribute('aria-hidden');
      }
    };
  }, [open]);

  useFocusTrap({
    active: open,
    containerRef,
    onEscape: onClose,
    returnFocusRef: triggerRef,
  });

  if (!open) return null;

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Meta lines: computed at render time from the nationalShow singleton, never
  // authored as literal copy in nav-config.ts. As of 2026-09-10 the singleton's
  // showDate/showEndDate are both null, so formatShowDateRange returns null —
  // the lead line renders venue-only with no dangling separator, and the
  // feature rail's date-only meta renders nothing (cleanly omitted). Both pick
  // up real values with no code change once Studio has real dates.
  const venueName = show?.venue?.name ?? null;
  const dateRange = formatShowDateRange(show?.showDate, show?.showEndDate);
  const leadMeta =
    [venueName, dateRange].filter((part): part is string => Boolean(part)).join(' · ') || null;
  const featureRailMeta = dateRange;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/45"
      onClick={handleBackdrop}
    >
      <aside
        className="ml-auto h-full w-full max-w-[360px] overflow-y-auto bg-parchment p-6"
        style={{ animation: 'slideInFromRight 250ms cubic-bezier(0.4,0,0.2,1) both' }}
      >
        {/* Top row: wordmark + close */}
        <div className="flex items-center justify-between mb-8">
          <span className="flex items-center gap-2">
            <Image src="/images/saoc-logo-ink-paper.png" alt="" width={36} height={36} />
            <span className="font-serif text-[16px] font-medium text-ink leading-tight">
              SA Orchid Council
            </span>
          </span>
          <button
            type="button"
            aria-label="Close menu"
            className="rounded-sm p-2 text-ink hover:text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
            onClick={onClose}
          >
            <X size={22} strokeWidth={1.5} />
          </button>
        </div>

        {/* Nav links */}
        <nav aria-label="Mobile primary">
          <ul className="flex flex-col gap-1">
            {nav.map((n) => {
              if (n.type === 'mega') {
                const isExpanded = expandedId === n.id;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedId(isExpanded ? null : n.id)}
                      className="flex w-full items-center justify-between px-3 py-3 font-sans text-[15px] text-ink hover:text-primary hover:bg-bone rounded-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
                    >
                      {n.label}
                      <ChevronDown
                        size={16}
                        strokeWidth={1.5}
                        className={isExpanded ? 'rotate-180 transition-transform' : 'transition-transform'}
                      />
                    </button>
                    {isExpanded && (
                      <div className="pl-3 pb-4">
                        {/* Feature block — sits at the top of the expanded
                            section, per mission section 1/3 F3. */}
                        {n.featureRail && (
                          <div className="mt-2 rounded-sm bg-bone p-4">
                            {featureRailMeta && (
                              <span className="font-mono text-[12px] text-muted">
                                {featureRailMeta}
                              </span>
                            )}
                            <p className="mt-1 font-serif text-[16px] font-medium text-ink">
                              {n.featureRail.heading}
                            </p>
                            {n.featureRail.blurb && (
                              <p className="mt-1 font-sans text-[14px] text-ink/80">
                                {n.featureRail.blurb}
                              </p>
                            )}
                            <Link
                              href={n.featureRail.ctaHref}
                              onClick={onClose}
                              className="mt-3 inline-flex w-fit items-center justify-center rounded-sm bg-primary px-4 py-2 font-sans text-[14px] font-medium text-ivory transition-colors duration-150 hover:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
                            >
                              {n.featureRail.ctaLabel}
                            </Link>
                          </div>
                        )}

                        {/* Lead — eyebrow, serif lead linking the hub, meta line. */}
                        {n.lead && (
                          <div className="mt-4 px-3">
                            <span className="inline-flex w-fit items-center rounded-pill bg-bone px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
                              {n.lead.eyebrow}
                            </span>
                            <Link
                              href={n.lead.leadHref}
                              onClick={onClose}
                              className="mt-2 block w-fit rounded-sm font-serif text-[16px] font-medium text-ink transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
                            >
                              {n.lead.leadLabel}
                            </Link>
                            {leadMeta && (
                              <span className="mt-1 block font-mono text-[12px] text-muted">
                                {leadMeta}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Four groups as headed lists with descriptors — The
                            Show (folded into lead on desktop, its own group
                            here since mobile has no column-width constraint),
                            Visit, Programme, Exhibit & Trade. */}
                        {(
                          [n.lead?.theShow, ...n.columns].filter(
                            (column): column is NavColumn => Boolean(column),
                          )
                        ).map((column) => (
                          <div key={column.id} className="mt-4">
                            {column.headingHref ? (
                              <Link
                                href={column.headingHref}
                                onClick={onClose}
                                className="block px-3 py-2 font-serif text-[14px] font-medium text-ink hover:text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
                              >
                                {column.heading}
                              </Link>
                            ) : (
                              <span className="block px-3 py-2 font-serif text-[14px] font-medium text-ink">
                                {column.heading}
                              </span>
                            )}
                            <ul className="flex flex-col">
                              {/* The descriptor sits OUTSIDE the anchor: an <a> wrapping
                                  both the name and the descriptor gives the link an
                                  accessible name that's the concatenation of both, which
                                  breaks exact link-name lookups (e2e/mobile-nav-reaches-
                                  every-section.spec.ts) and hands screen-reader users a
                                  noisier link name than the visible "bold name over a
                                  muted descriptor" leaf pattern implies. The row's
                                  hover/press affordance stays on the wrapping div, not
                                  the anchor, so the whole leaf still highlights as one
                                  touch target even though only the name is a link. */}
                              {column.links.map((link) => (
                                <li key={link.id}>
                                  <div className="rounded-sm px-6 py-2 transition-colors duration-150 hover:bg-bone">
                                    <Link
                                      href={link.href}
                                      onClick={onClose}
                                      className="block font-sans text-[14px] font-bold text-ink transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
                                    >
                                      {link.label}
                                    </Link>
                                    {link.descriptor && (
                                      <span className="mt-0.5 block font-sans text-[12px] text-muted">
                                        {link.descriptor}
                                      </span>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              }
              if (n.disabled) {
                return (
                  <li key={n.id}>
                    <span
                      aria-disabled="true"
                      className="flex items-center justify-between px-3 py-3 font-sans text-[15px] text-muted/60 cursor-not-allowed"
                    >
                      {n.label}
                      <span className="rounded-full bg-bone px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                        Soon
                      </span>
                    </span>
                  </li>
                );
              }
              return (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={onClose}
                    className={[
                      'flex items-center px-3 py-3 font-sans text-[15px] rounded-sm transition-colors duration-150 hover:text-primary hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment',
                      n.quiet ? 'text-muted' : 'text-ink',
                    ].join(' ')}
                  >
                    {n.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <Link
                href="/contact"
                onClick={onClose}
                className="flex items-center px-3 py-3 font-sans text-[15px] text-ink hover:text-primary hover:bg-bone rounded-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
              >
                Contact
              </Link>
            </li>
          </ul>
        </nav>

        {/* Footer meta */}
        <div className="mt-8 pt-6 border-t border-rule flex flex-col gap-1">
          <a
            href="mailto:council@saoc.co.za"
            className="font-mono text-[12px] text-muted hover:text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
          >
            council@saoc.co.za
          </a>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted/55">
            Est. 1968
          </span>
        </div>
      </aside>

      <style>{`
        @keyframes slideInFromRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
