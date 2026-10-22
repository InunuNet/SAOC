'use client';

// =============================================================
// SAOC — components/chrome/Footer.tsx
// Client Component — dark sage footer with four columns.
// Col 1: stacked logo lockup + mission + reg numbers
// Col 2: Explore nav links
// Col 3: Partners list
// Col 4: Stay in touch (newsletter form + WOSA link)
// All copy and link lists live in ./footer-data (shared with the NOS footer).
// =============================================================

import Link from 'next/link';
import { partners } from '@/lib/data';
import { NewsletterSignup } from '@/components/newsletter/NewsletterSignup';
import { SaocLockup } from './SaocLockup';
import {
  FOOTER_BULLETIN,
  FOOTER_COPYRIGHT_TAIL,
  FOOTER_HEADINGS,
  FOOTER_LAYOUT,
  FOOTER_LEGAL_LINKS,
  FOOTER_NAV,
  FOOTER_REG,
  FOOTER_RHYTHM,
  FOOTER_WOSA,
} from './footer-data';

export function Footer() {
  return (
    <footer className="bg-primary-800 text-ivory">
      <div className={FOOTER_LAYOUT.grid}>
        {/* Col 1 — lockup + registration line. Live HTML/CSS lockup (SaocLockup,
            orientation="vertical" tone="dark"): only the emblem (E4 Lapis
            monotone) is an image, the wordmark/rule/tagline are real text
            sized off the artifact's own metrics(). No background box — it
            sits directly on this footer's own dark-sage background, per
            Brad's instruction (the earlier raster export baked a navy box
            behind it, which was wrong). See SaocLockup.tsx's own header
            comment for the full metrics() derivation. */}
        <div className={FOOTER_LAYOUT.brandColumn}>
          <div className={FOOTER_LAYOUT.brandMark}>
            <SaocLockup orientation="vertical" tone="dark" />
          </div>
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ivory/65">
            {FOOTER_REG}
          </span>
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
                    className={`${FOOTER_RHYTHM.row} min-w-11 font-sans text-ivory/80 hover:text-ivory transition-colors duration-150`}
                  >
                    {n.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Col 3 — Partners */}
        <div className="flex flex-col gap-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ivory/55 mb-1">
            {FOOTER_HEADINGS.partners}
          </div>
          <ul className={FOOTER_RHYTHM.list}>
            {partners.map((p) => (
              <li key={p.name}>
                <span className={`${FOOTER_RHYTHM.row} font-sans text-ivory/80`}>{p.name}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 4 — Stay in touch */}
        <div className="flex flex-col gap-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ivory/55 mb-1">
            {FOOTER_HEADINGS.touch}
          </div>
          <p className="font-sans text-[13.5px] leading-relaxed text-ivory/65">
            {FOOTER_BULLETIN.blurb}
          </p>
          <NewsletterSignup
            source="saoc-footer"
            inputId="footer-newsletter-email"
            emailLabel={FOOTER_BULLETIN.emailLabel}
            placeholder={FOOTER_BULLETIN.placeholder}
            submitLabel={FOOTER_BULLETIN.submitLabel}
            fieldsClassName="flex flex-wrap items-end gap-0"
            labelClassName="mb-1.5 block w-full font-mono text-[11px] tracking-[0.16em] text-ivory/65"
            inputClassName="min-h-11 min-w-0 flex-1 bg-ivory/10 border border-ivory/20 text-ivory placeholder:text-ivory/40 font-sans text-[16px] px-3 py-2 focus:outline-none focus:border-ivory/40"
            buttonClassName="min-h-11 min-w-11 bg-accent text-primary-800 font-sans text-[13px] font-medium px-4 py-2 hover:bg-accent-soft transition-colors duration-150 shrink-0 disabled:opacity-60"
            statusClassName="mt-2 font-sans text-[13px] text-ivory/80 empty:hidden"
            errorClassName="mt-2 font-sans text-[13px] text-ivory"
          />
          <div className="mt-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ivory/55 mb-2">
              {FOOTER_WOSA.heading}
            </div>
            <a
              href={FOOTER_WOSA.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${FOOTER_RHYTHM.row} min-w-11 font-sans text-ivory/80 hover:text-ivory transition-colors duration-150`}
            >
              {FOOTER_WOSA.linkLabel}
            </a>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-ivory/10">
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
                className="inline-flex min-h-11 min-w-11 items-center font-sans text-[13px] text-ivory/65 hover:text-ivory transition-colors duration-150"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
