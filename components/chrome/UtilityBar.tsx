// =============================================================
// SAOC — components/chrome/UtilityBar.tsx
// Server Component — no interactivity needed.
// Dark sage bar above the main header: email left, tagline centre,
// CTA pills right.
//
// F7: the show pill renders on EVERY page, and it carried the edition and the show
// month/year as literals — so a Studio edit to either left every page on the site
// stale. Both now come from the nationalShow singleton, fetched in
// app/(marketing)/layout.tsx. See show-identity-surfaces.golden.md.
// =============================================================

import Link from 'next/link';

import { formatShowShortMonthYear, showLabelWithEdition } from '@/lib/show-identity';
import type { ShowIdentity } from '@/types';

export interface UtilityBarProps {
  show?: ShowIdentity | null;
  /**
   * `saoc` (default) is the bar every SAOC page carries. `nos` is the same bar on the National
   * Show's own-brand pages (Brad, 2026-10-16): the show pill becomes a pill home to saoc.co.za,
   * visible at every width, and below 480px the email collapses to its icon so the row fits.
   */
  variant?: 'saoc' | 'nos';
}

const SHOW_PILL_CLASS =
  'border border-ivory/30 text-ivory rounded-full px-3 py-1 text-[13px] font-sans hover:border-ivory/60 transition-colors duration-150';
const SAOC_PILL_LABEL = 'saoc.co.za';
const CONTACT_EMAIL = 'info@saoc.co.za';

export function UtilityBar({ show, variant = 'saoc' }: UtilityBarProps) {
  const isNos = variant === 'nos';
  // Brad chrome decision #2 (2026-10-15): the SAOC utility bar is left off NOS pages, at every width.
  if (isNos) return null;
  const monthYear = formatShowShortMonthYear(show?.showDate);
  const showPillLabel = [showLabelWithEdition(show?.edition), monthYear]
    .filter((part): part is string => Boolean(part))
    .join(' · ');

  return (
    <div role="region" aria-label="Utility bar" className="bg-primary-800 text-ivory">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-8 py-2">
        {/* Left: contact email */}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          aria-label={isNos ? `Email ${CONTACT_EMAIL}` : undefined}
          className={`flex min-h-6 items-center gap-1.5 font-mono text-[14px] text-ivory opacity-90 hover:opacity-100 transition-colors duration-150${isNos ? ' max-[480px]:min-w-6' : ''}`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
          {isNos ? (
            // The aria-label above names the link, so below 480px the address text leaves layout
            // entirely (sr-only alone still lays the text out at its full width).
            <span className="max-[480px]:sr-only max-[480px]:hidden">{CONTACT_EMAIL}</span>
          ) : (
            CONTACT_EMAIL
          )}
        </a>

        {/* Right: action pills */}
        <div className="flex items-center gap-2">
          {isNos ? (
            <Link href="/" className={`inline-block ${SHOW_PILL_CLASS}`}>
              {SAOC_PILL_LABEL}
            </Link>
          ) : (
            <Link
              href="/national-show"
              className={`hidden min-[900px]:inline-block ${SHOW_PILL_CLASS}`}
            >
              {showPillLabel}
            </Link>
          )}
          <Link
            href="/societies"
            className="bg-accent text-ink rounded-full px-3 py-1 text-[13px] font-sans font-medium hover:bg-accent-soft transition-colors duration-150"
          >
            Join a society
          </Link>
        </div>
      </div>
    </div>
  );
}
