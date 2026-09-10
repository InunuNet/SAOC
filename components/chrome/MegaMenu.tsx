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
    'block rounded-sm py-2 font-sans text-[14px] font-semibold leading-[1.3] text-ink transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment';
  const leafDescriptorClassName = 'mt-[2px] block pb-2 font-sans text-[12px] text-muted';
  // .dd-head typography (groupHeadings + leadEyebrow, F7 round 2 golden) — mono
  // 10px uppercase caps in --accent, reset to zero UA margin then mb-3 (--s3).
  const groupHeadingClassName =
    'm-0 mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-accent';
  const groupHeadingLinkClassName =
    'rounded-sm font-mono text-[10px] uppercase tracking-[0.18em] text-accent transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment';

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
          className="absolute inset-x-0 top-full z-50 border-t border-rule bg-parchment shadow-sheet"
        >
          <div className="mx-auto max-w-[1280px] px-8">
            <div className="grid grid-cols-[1.05fr_1fr_1fr_1fr_.9fr] gap-x-0 pt-8 pb-6">
              {/* Track 1 — lead block: eyebrow, serif lead linking the hub, meta
                line, "The Show" group folded in underneath. */}
              {item.lead && (
                <div className="flex flex-col pr-6">
                  <p className={groupHeadingClassName}>{item.lead.eyebrow}</p>
                  <Link
                    href={item.lead.leadHref}
                    onClick={close}
                    className="mb-[6px] block w-fit rounded-sm font-serif text-[23px] font-semibold leading-[1.12] text-ink transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
                  >
                    {item.lead.leadLabel}
                  </Link>
                  {leadMeta && (
                    <span className="mb-4 block max-w-[32ch] text-[12.5px] text-muted">
                      {leadMeta}
                    </span>
                  )}

                  <div>
                    {item.lead.theShow.headingHref ? (
                      <h3 className="m-0 mb-3" style={{ marginTop: '20px' }}>
                        <Link
                          href={item.lead.theShow.headingHref}
                          onClick={close}
                          className={groupHeadingLinkClassName}
                        >
                          {item.lead.theShow.heading}
                        </Link>
                      </h3>
                    ) : (
                      <h3 className={groupHeadingClassName} style={{ marginTop: '20px' }}>
                        {item.lead.theShow.heading}
                      </h3>
                    )}
                    <ul className="mt-3 flex flex-col">
                      {item.lead.theShow.links.map((link, i) => (
                        <li
                          key={link.id}
                          className={
                            i < item.lead!.theShow.links.length - 1
                              ? 'border-b border-rule-soft'
                              : ''
                          }
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
                <div key={column.id} className="border-l border-rule-soft px-6">
                  {column.headingHref ? (
                    <h3 className="m-0 mb-3">
                      <Link
                        href={column.headingHref}
                        onClick={close}
                        className={groupHeadingLinkClassName}
                      >
                        {column.heading}
                      </Link>
                    </h3>
                  ) : (
                    <h3 className={groupHeadingClassName}>{column.heading}</h3>
                  )}
                  <ul className="mt-3 flex flex-col">
                    {column.links.map((link, i) => (
                      <li
                        key={link.id}
                        className={i < column.links.length - 1 ? 'border-b border-rule-soft' : ''}
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
              ))}

              {/* Track 5 — feature rail: bone panel, mono date meta, serif
                heading, blurb, primary CTA — natural top-to-bottom flow (not
                flex+justify-between), per the approved Layout 4 artifact's
                .dd4__feature rule. featureRail.blurb is sourced verbatim from
                the artifact's own mockup markup — see
                goldens/f7-featurerail-blurb.json. */}
              {item.featureRail && (
                <div className="border-l border-rule-soft bg-bone p-6">
                  {featureRailMeta && (
                    <span className="mb-3 block font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                      {featureRailMeta}
                    </span>
                  )}
                  <h4 className="mb-[6px] font-serif text-[18px] font-semibold leading-[1.15] text-ink">
                    {item.featureRail.heading}
                  </h4>
                  {item.featureRail.blurb && (
                    <p className="mb-4 font-sans text-[12px] leading-[1.45] text-muted">
                      {item.featureRail.blurb}
                    </p>
                  )}
                  <Link
                    href={item.featureRail.ctaHref}
                    onClick={close}
                    className="inline-flex w-fit items-center justify-center rounded-[2px] bg-primary px-[18px] py-[10px] font-sans text-[13.5px] font-medium tracking-[0.01em] text-ivory transition-colors duration-150 hover:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
                  >
                    {item.featureRail.ctaLabel}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
