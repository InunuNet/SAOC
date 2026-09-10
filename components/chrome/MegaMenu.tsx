'use client';

// =============================================================
// SAOC — components/chrome/MegaMenu.tsx
// Desktop-only trigger + dropdown for a `mega` NavItem (National Show).
// Follows the aria-expanded/aria-haspopup disclosure pattern already used
// by components/admin/AdminNav.tsx — opens on click or Enter/Space while
// focused, closes on Escape (returning focus to the trigger) or on an
// outside click. That disclosure logic is unchanged by mission
// menu-system-layout4 M2/F2 — only the panel's contents and sizing change.
//
// Rebuilt (M2/F2, Brad's approved Layout 4) from a narrow anchored panel into
// the full-width sheet in five tracks: lead block, Visit, Programme,
// Exhibit & Trade, feature rail (see mission section 1's track table). The
// panel is `absolute inset-x-0 top-full`, deliberately NOT wrapped in a
// `relative` container of its own — its containing block is <header>
// (position: sticky counts as positioned for this purpose), so it spans the
// full header width regardless of where the trigger itself sits, without any
// JS measurement.
//
// item.lead and item.featureRail are now read and rendered — the defect an
// architect audit found in the pre-F2 file (2026-09-10): the only rendered
// CTA was gated on `item.ctaLabel`, a field nav-config.ts never sets on the
// National Show mega, so /national-show and both Tickets hrefs had no
// rendered anchor anywhere on desktop. See e2e/nav-rendered-reachability.spec.ts.
// =============================================================

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import type { NavItem } from './nav-config';
import { formatShowDateRange } from '@/lib/show-identity';
import type { ShowIdentity } from '@/types';

interface MegaMenuProps {
  item: Extract<NavItem, { type: 'mega' }>;
  /**
   * The nationalShow Sanity singleton, fetched once in app/(marketing)/layout.tsx
   * and threaded down — same source UtilityBar already reads. Never hardcode a
   * venue or a date here; this prop is the only source. Optional because Header
   * also renders on surfaces (e.g. /admin) that don't fetch it.
   */
  show?: ShowIdentity | null;
}

export function MegaMenu({ item, show }: MegaMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  function onBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  }

  const close = () => setOpen(false);

  // Meta lines: computed at render time from the nationalShow singleton, never
  // authored as literal copy in nav-config.ts (see its own NavMegaLead.meta /
  // NavMegaFeatureRail.meta comments). As of 2026-09-10 the singleton's
  // showDate/showEndDate are both null, so formatShowDateRange returns null —
  // the lead line renders venue-only with no dangling separator, and the
  // feature rail's date-only meta renders nothing (cleanly omitted). Both pick
  // up real values with no code change once Studio has real dates.
  const venueName = show?.venue?.name ?? null;
  const dateRange = formatShowDateRange(show?.showDate, show?.showEndDate);
  const leadMeta =
    [venueName, dateRange].filter((part): part is string => Boolean(part)).join(' · ') || null;
  const featureRailMeta = dateRange;

  // The descriptor sits OUTSIDE the anchor, not inside it — an <a> wrapping
  // both the name and the descriptor gives the link an accessible name that's
  // the concatenation of both (its full text content), which breaks exact
  // link-name lookups (e2e/mobile-nav-reaches-every-section.spec.ts) and gives
  // screen-reader users a noisier link name than the visible "bold name" leaf
  // pattern implies. The anchor wraps only the name; the descriptor is a
  // plain, non-interactive sibling directly under it.
  const leafLinkClassName =
    'block rounded-sm py-2 font-sans text-[14px] font-bold text-ink transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment';
  const leafDescriptorClassName = '-mt-1.5 block pb-2 font-sans text-[12px] text-muted';
  const groupHeadingClassName = 'font-serif text-[16px] font-medium text-ink';
  const groupHeadingLinkClassName =
    'rounded-sm font-serif text-[16px] font-medium text-ink transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment';

  return (
    <div ref={containerRef} onBlur={onBlur}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-sm font-sans text-[14px] text-ink transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
      >
        {item.label}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={item.label}
          className="absolute inset-x-0 top-full z-50 border-t border-rule bg-parchment shadow-float"
        >
          <div className="mx-auto grid max-w-[1280px] grid-cols-[2fr_1fr_1fr_1fr_2fr] gap-10 px-8 py-10">
            {/* Track 1 — lead block: eyebrow, serif lead linking the hub, meta
                line, "The Show" group folded in underneath. */}
            {item.lead && (
              <div className="flex flex-col">
                <span className="inline-flex w-fit items-center rounded-pill bg-bone px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
                  {item.lead.eyebrow}
                </span>
                <Link
                  href={item.lead.leadHref}
                  onClick={close}
                  className="mt-4 w-fit rounded-sm font-serif text-[20px] font-medium text-ink transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
                >
                  {item.lead.leadLabel}
                </Link>
                {leadMeta && <span className="mt-2 font-mono text-[12px] text-muted">{leadMeta}</span>}

                <div className="mt-6">
                  {item.lead.theShow.headingHref ? (
                    <Link
                      href={item.lead.theShow.headingHref}
                      onClick={close}
                      className={groupHeadingLinkClassName}
                    >
                      {item.lead.theShow.heading}
                    </Link>
                  ) : (
                    <span className={groupHeadingClassName}>{item.lead.theShow.heading}</span>
                  )}
                  <ul className="mt-3 flex flex-col">
                    {item.lead.theShow.links.map((link, i) => (
                      <li
                        key={link.id}
                        className={i < item.lead!.theShow.links.length - 1 ? 'border-b border-rule' : ''}
                      >
                        <Link href={link.href} onClick={close} className={leafLinkClassName}>
                          {link.label}
                        </Link>
                        {link.descriptor && (
                          <span className={leafDescriptorClassName}>{link.descriptor}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Tracks 2-4 — Visit / Programme / Exhibit & Trade group columns. */}
            {item.columns.map((column) => (
              <div key={column.id}>
                {column.headingHref ? (
                  <Link href={column.headingHref} onClick={close} className={groupHeadingLinkClassName}>
                    {column.heading}
                  </Link>
                ) : (
                  <span className={groupHeadingClassName}>{column.heading}</span>
                )}
                <ul className="mt-3 flex flex-col">
                  {column.links.map((link, i) => (
                    <li key={link.id} className={i < column.links.length - 1 ? 'border-b border-rule' : ''}>
                      <Link href={link.href} onClick={close} className={leafLinkClassName}>
                        {link.label}
                      </Link>
                      {link.descriptor && (
                        <span className={leafDescriptorClassName}>{link.descriptor}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Track 5 — feature rail: bone panel, mono date meta, serif
                heading, primary CTA. featureRail.blurb has no source anywhere
                (see goldens/f1-gaps.json) and stays omitted — never invented. */}
            {item.featureRail && (
              <div className="flex flex-col justify-between rounded-sm bg-bone p-6">
                <div>
                  {featureRailMeta && (
                    <span className="font-mono text-[12px] text-muted">{featureRailMeta}</span>
                  )}
                  <p className="mt-2 font-serif text-[20px] font-medium text-ink">
                    {item.featureRail.heading}
                  </p>
                  {item.featureRail.blurb && (
                    <p className="mt-2 font-sans text-[14px] text-ink/80">{item.featureRail.blurb}</p>
                  )}
                </div>
                <Link
                  href={item.featureRail.ctaHref}
                  onClick={close}
                  className="mt-6 inline-flex w-fit items-center justify-center rounded-sm bg-primary px-4 py-2 font-sans text-[14px] font-medium text-ivory transition-colors duration-150 hover:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
                >
                  {item.featureRail.ctaLabel}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
