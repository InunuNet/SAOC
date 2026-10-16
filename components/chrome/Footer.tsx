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
import { SaocLockup } from './SaocLockup';
import {
  FOOTER_BRAND_TEXT,
  FOOTER_BULLETIN,
  FOOTER_COPYRIGHT_TAIL,
  FOOTER_HEADINGS,
  FOOTER_LEGAL_LINKS,
  FOOTER_NAV,
  FOOTER_REG,
  FOOTER_WOSA,
} from './footer-data';

export function Footer() {
  return (
    <footer className="bg-primary-800 text-ivory">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 py-16 px-8 max-w-[1280px] mx-auto">
        {/* Col 1 — lockup + mission. Live HTML/CSS lockup (SaocLockup,
            orientation="vertical" tone="dark"): only the emblem (E4 Lapis
            monotone) is an image, the wordmark/rule/tagline are real text
            sized off the artifact's own metrics(). No background box — it
            sits directly on this footer's own dark-sage background, per
            Brad's instruction (the earlier raster export baked a navy box
            behind it, which was wrong). See SaocLockup.tsx's own header
            comment for the full metrics() derivation. */}
        <div className="flex flex-col gap-4">
          <div className="mb-4 flex justify-center">
            <SaocLockup orientation="vertical" tone="dark" />
          </div>
          <p className="font-sans text-[13.5px] leading-relaxed text-ivory/65">
            {FOOTER_BRAND_TEXT}
          </p>
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ivory/65">
            {FOOTER_REG}
          </span>
        </div>

        {/* Col 2 — Explore */}
        <div className="flex flex-col gap-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ivory/55 mb-1">
            {FOOTER_HEADINGS.explore}
          </div>
          <ul className="flex flex-col gap-2">
            {FOOTER_NAV.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href}
                  className="inline-flex min-h-6 items-center font-sans text-[14px] text-ivory/80 hover:text-ivory transition-colors duration-150"
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 3 — Partners */}
        <div className="flex flex-col gap-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ivory/55 mb-1">
            {FOOTER_HEADINGS.partners}
          </div>
          <ul className="flex flex-col gap-2">
            {partners.map((p) => (
              <li key={p.name}>
                <span className="font-sans text-[14px] text-ivory/80">{p.name}</span>
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
          <form className="flex gap-0" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              aria-label={FOOTER_BULLETIN.emailLabel}
              placeholder={FOOTER_BULLETIN.placeholder}
              required
              className="min-w-0 flex-1 bg-ivory/10 border border-ivory/20 text-ivory placeholder:text-ivory/40 font-sans text-[13px] px-3 py-2 focus:outline-none focus:border-ivory/40"
            />
            <button
              type="submit"
              className="bg-primary text-ivory font-sans text-[13px] font-medium px-4 py-2 hover:bg-primary-800 transition-colors duration-150 shrink-0"
            >
              {FOOTER_BULLETIN.submitLabel}
            </button>
          </form>
          <div className="mt-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ivory/55 mb-2">
              {FOOTER_WOSA.heading}
            </div>
            <a
              href={FOOTER_WOSA.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-6 items-center font-sans text-[14px] text-ivory/80 hover:text-ivory transition-colors duration-150"
            >
              {FOOTER_WOSA.linkLabel}
            </a>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-ivory/10">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-8 py-4 flex-wrap">
          <span className="font-sans text-[13px] text-ivory/65">
            &copy; {new Date().getFullYear()}
            {FOOTER_COPYRIGHT_TAIL}
          </span>
          <div className="flex items-center gap-4 flex-wrap">
            {FOOTER_LEGAL_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="inline-flex min-h-6 items-center font-sans text-[13px] text-ivory/65 hover:text-ivory transition-colors duration-150"
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
