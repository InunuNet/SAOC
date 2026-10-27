'use client';

// =============================================================
// SAOC — components/chrome/Footer.tsx
// Client Component — dark sage footer with three columns.
// Col 1: stacked logo lockup + reg numbers + WOSA link
// Col 2: Explore nav links
// Col 3: Stay in touch (newsletter form)
// All copy and link lists live in ./footer-data (shared with the NOS footer).
// =============================================================

import Link from 'next/link';
import { NewsletterSignup } from '@/components/newsletter/NewsletterSignup';
import { SaocLockup } from './SaocLockup';
import { ExternalArrow } from './ExternalArrow';
import { MediaKitFooterLink } from './MediaKitFooterLink';
import {
  FOOTER_BULLETIN,
  FOOTER_COPYRIGHT_TAIL,
  FOOTER_HEADINGS,
  FOOTER_LAYOUT,
  FOOTER_LEGAL_LINKS,
  FOOTER_MEDIA_KIT,
  FOOTER_NAV,
  FOOTER_NEW_TAB_CUE,
  FOOTER_REG,
  FOOTER_RHYTHM,
  FOOTER_WOSA,
} from './footer-data';

export function Footer({ showCopyGap }: { showCopyGap: boolean }) {
  return (
    <footer className="bg-primary-800 text-ivory">
      <div className={FOOTER_LAYOUT.gridSaoc}>
        {/* Col 1 — lockup + registration line. Live HTML/CSS lockup (SaocLockup,
            orientation="vertical" tone="dark"): only the emblem (E4 Lapis
            monotone) is an image, the wordmark/rule/tagline are real text
            sized off the artifact's own metrics(). No background box — it
            sits directly on this footer's own dark-sage background, per
            Brad's instruction (the earlier raster export baked a navy box
            behind it, which was wrong). See SaocLockup.tsx's own header
            comment for the full metrics() derivation. */}
        <div className={FOOTER_LAYOUT.brandColumn}>
          {/* The lockup is sized by its container, so the auto track needs a definite width to hug.
              -mt-[30px] cancels the emblem PNG's transparent top (116px of 618 at the 160px box), so the
              artwork's top sits on the column headings' top line (NOS Design). */}
          <div className={`${FOOTER_LAYOUT.brandMark} -mt-[30px] w-[280px]`}>
            <SaocLockup orientation="vertical" tone="dark" />
          </div>
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ivory/65">
            {FOOTER_REG}
          </span>
          {/* HD-1: moved here from the retired utility bar, directly under the registration line. */}
          <a
            href="mailto:info@saoc.co.za"
            className={`${FOOTER_RHYTHM.row} font-mono text-ivory/80 hover:text-ivory transition-colors duration-150 focus-visible:text-ivory focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 forced-colors:focus-visible:decoration-[color:Highlight]`}
          >
            info@saoc.co.za
          </a>
          {/* WOSA appears once in this footer, under the registration line (as in NosFooter). */}
          <ul className={FOOTER_RHYTHM.list}>
            <li>
              <a
                href={FOOTER_WOSA.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${FOOTER_RHYTHM.row} gap-1 font-sans text-ivory/80 hover:text-ivory transition-colors duration-150 focus-visible:text-ivory focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 forced-colors:focus-visible:decoration-[color:Highlight]`}
              >
                {FOOTER_WOSA.label}
                <ExternalArrow />
                <span className="sr-only">{FOOTER_NEW_TAB_CUE}</span>
              </a>
            </li>
          </ul>
        </div>

        {/* Col 2 — Explore */}
        <div className="flex flex-col gap-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ivory/55 mb-1">
            {FOOTER_HEADINGS.explore}
          </div>
          <ul className={FOOTER_RHYTHM.list}>
            {FOOTER_NAV.map((n) => {
              const NavLink = n.crossSite ? 'a' : Link;
              return (
                <li key={n.id}>
                  <NavLink
                    href={n.href}
                    className={`${FOOTER_RHYTHM.row} min-w-11 font-sans text-ivory/80 hover:text-ivory transition-colors duration-150 focus-visible:text-ivory focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 forced-colors:focus-visible:decoration-[color:Highlight]`}
                  >
                    {n.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Col 3 — Stay in touch */}
        <div className="flex flex-col gap-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ivory/55 mb-1">
            {FOOTER_HEADINGS.touch}
          </div>
          <p className="font-sans text-[13.5px] leading-relaxed text-ivory/65">
            {FOOTER_BULLETIN.blurb}
          </p>
          <NewsletterSignup
            site="saoc"
            showCopyGap={showCopyGap}
            source="saoc-footer"
            inputId="footer-newsletter-email"
            emailLabel={FOOTER_BULLETIN.emailLabel}
            placeholder={FOOTER_BULLETIN.placeholder}
            submitLabel={FOOTER_BULLETIN.submitLabel}
            fieldsClassName="flex flex-wrap items-end gap-0"
            labelClassName="sr-only"
            inputClassName="min-h-11 min-w-0 flex-1 bg-ivory/10 border border-ivory/20 text-ivory placeholder:text-ivory/40 font-sans text-[16px] px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ivory"
            buttonClassName="min-h-11 min-w-11 bg-accent text-primary-800 font-sans text-[13px] font-medium px-4 py-2 hover:bg-accent-soft transition-colors duration-150 shrink-0 disabled:opacity-60"
            statusClassName="mt-2 font-sans text-[13px] text-ivory/80 empty:hidden"
            errorClassName="mt-2 font-sans text-[13px] text-ivory"
            unsubscribeLinkClassName="inline-flex min-h-11 items-center font-sans text-[13px] text-ivory/65 hover:text-ivory transition-colors duration-150"
          />
        </div>
      </div>

      {/* Bottom bar */}
      <div data-footer-bar className="border-t border-ivory/10">
        <div className={FOOTER_LAYOUT.bar}>
          <span className="font-sans text-[13px] text-ivory/65">
            &copy; {new Date().getFullYear()}
            {FOOTER_COPYRIGHT_TAIL}
          </span>
          <div className={FOOTER_LAYOUT.legal}>
            {FOOTER_LEGAL_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="inline-flex min-h-11 items-center font-sans text-[13px] text-ivory/65 hover:text-ivory transition-colors duration-150 focus-visible:text-ivory focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 forced-colors:focus-visible:decoration-[color:Highlight]"
              >
                {l.label}
              </Link>
            ))}
            <MediaKitFooterLink
              {...FOOTER_MEDIA_KIT}
              className="inline-flex min-h-11 items-center font-sans text-[13px] text-ivory/65 hover:text-ivory transition-colors duration-150 focus-visible:text-ivory focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 forced-colors:focus-visible:decoration-[color:Highlight]"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
