'use client';

// =============================================================
// NOS — components/nos-chrome/NosFooter.tsx
// The NOS own-brand footer for /national-show/*: the SAOC footer's content
// (components/chrome/footer-data.ts, shared verbatim) on the NOS royal ground.
// r17 F2 (Codi): the brand slot is the supplied gold vertical lockup, centred, at every width,
// with only REG/NPO beneath it. ONE <picture> holds a 1x/2x density set of that one file, fetched
// lazily (the footer is below the fold); the custom image loader maps it to its pre-built WebP
// candidates.
// =============================================================

import { getImageProps } from 'next/image';
import Link from 'next/link';

import {
  FOOTER_BULLETIN,
  FOOTER_COPYRIGHT_TAIL,
  FOOTER_HEADINGS,
  FOOTER_LEGAL_LINKS,
  FOOTER_NAV,
  FOOTER_REG,
  FOOTER_WOSA,
} from '@/components/chrome/footer-data';
import { partners } from '@/lib/data';

import { nosChromeFontClass } from './fonts';
import './nos-chrome.css';

const HUB_HREF = '/national-show';
const LOCKUP_ALT = 'National Orchid Show, Western Cape 2027';
const LOCKUP_SRC = '/images/NOS-2027-logo-reversed-gold-vertical.png';
const LOCKUP_WIDTH = 3272;
const LOCKUP_HEIGHT = 2876;
// The largest rendered box is 360px wide (nos-chrome.css). A width with no `sizes` gives a 1x/2x
// density srcset, so a high-density screen never fetches more than twice the box.
const LOCKUP_BOX = 360;

export function NosFooter() {
  const { props: lockup } = getImageProps({
    src: LOCKUP_SRC,
    alt: LOCKUP_ALT,
    width: LOCKUP_BOX,
    height: Math.round((LOCKUP_BOX * LOCKUP_HEIGHT) / LOCKUP_WIDTH),
  });

  return (
    <footer id="nf" className={`nf ${nosChromeFontClass}`}>
      <div className="nf-wrap">
        <div className="nf-grid">
          <div className="nf-brand">
            <Link className="nf-lockup" href={HUB_HREF}>
              <picture>
                <img
                  {...lockup}
                  alt={LOCKUP_ALT}
                  width={LOCKUP_WIDTH}
                  height={LOCKUP_HEIGHT}
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </Link>
            <span className="nf-head nf-reg">{FOOTER_REG}</span>
          </div>

          <div className="nf-col">
            <div className="nf-head">{FOOTER_HEADINGS.explore}</div>
            <ul className="nf-list">
              {FOOTER_NAV.map((n) => (
                <li key={n.id}>
                  <Link href={n.href}>{n.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="nf-col">
            <div className="nf-head">{FOOTER_HEADINGS.partners}</div>
            <ul className="nf-list">
              {partners.map((p) => (
                <li key={p.name}>
                  <span>{p.name}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="nf-col nf-col-touch">
            <div className="nf-head">{FOOTER_HEADINGS.touch}</div>
            <p className="nf-text">{FOOTER_BULLETIN.blurb}</p>
            <form id="nf-form" className="nf-form" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                aria-label={FOOTER_BULLETIN.emailLabel}
                placeholder={FOOTER_BULLETIN.placeholder}
                required
              />
              <button type="submit">{FOOTER_BULLETIN.submitLabel}</button>
            </form>
            <div className="nf-wild">
              <div className="nf-head">{FOOTER_WOSA.heading}</div>
              <a href={FOOTER_WOSA.href} target="_blank" rel="noopener noreferrer">
                {FOOTER_WOSA.linkLabel}
              </a>
            </div>
          </div>
        </div>

        <div className="nf-base">
          <span>
            &copy; {new Date().getFullYear()}
            {FOOTER_COPYRIGHT_TAIL}
          </span>
          <div className="nf-legal">
            {FOOTER_LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
