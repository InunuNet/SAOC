'use client';

// =============================================================
// NOS — components/nos-chrome/NosFooter.tsx
// The NOS own-brand footer for /national-show/*: the SAOC footer's content
// (components/chrome/footer-data.ts, shared verbatim) on the NOS royal ground.
// r17 F2 (Codi): the brand slot is the supplied gold vertical lockup with only REG/NPO beneath it.
// r20 F3 (Codi): the footer follows the SAOC footer's layout (FOOTER_LAYOUT, shared with Footer.tsx). ONE <picture> holds a 1x/2x density set of that one file, fetched
// lazily (the footer is below the fold); the custom image loader maps it to its pre-built WebP
// candidates.
// =============================================================

import { getImageProps } from 'next/image';
import Link from 'next/link';

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
} from '@/components/chrome/footer-data';
import { NewsletterSignup } from '@/components/newsletter/NewsletterSignup';
import { partners } from '@/lib/data';

import { nosChromeFontClass } from './fonts';
import './nos-chrome.css';

const HUB_HREF = '/national-show';
const LOCKUP_ALT = 'National Orchid Show, Western Cape 2027';
const LOCKUP_SRC = '/images/NOS-2027-logo-reversed-gold-vertical.png';
const LOCKUP_WIDTH = 3272;
const LOCKUP_HEIGHT = 2876;
// The lockup's rendered box is 248px wide (nos-chrome.css). A width with no `sizes` gives a 1x/2x
// density srcset, so a high-density screen never fetches more than twice the box.
const LOCKUP_BOX = 248;

export function NosFooter() {
  const { props: lockup } = getImageProps({
    src: LOCKUP_SRC,
    alt: LOCKUP_ALT,
    width: LOCKUP_BOX,
    height: Math.round((LOCKUP_BOX * LOCKUP_HEIGHT) / LOCKUP_WIDTH),
  });

  return (
    <footer id="nf" className={`nf ${nosChromeFontClass}`}>
      <div className={FOOTER_LAYOUT.grid}>
        <div className={`nf-brand ${FOOTER_LAYOUT.brandColumn}`}>
          <div className={FOOTER_LAYOUT.brandMark}>
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
          </div>
          <span className="nf-head nf-reg">{FOOTER_REG}</span>
        </div>

        <div className="nf-col">
          <div className="nf-head">{FOOTER_HEADINGS.explore}</div>
          <ul className={`nf-list ${FOOTER_RHYTHM.list}`}>
            {FOOTER_NAV.map((n) => (
              <li key={n.id}>
                <Link className={FOOTER_RHYTHM.row} href={n.href}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="nf-col">
          <div className="nf-head">{FOOTER_HEADINGS.partners}</div>
          <ul className={`nf-list ${FOOTER_RHYTHM.list}`}>
            {partners.map((p) => (
              <li key={p.name}>
                <span className={FOOTER_RHYTHM.row}>{p.name}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="nf-col nf-col-touch">
          <div className="nf-head">{FOOTER_HEADINGS.touch}</div>
          <p className="nf-text">{FOOTER_BULLETIN.blurb}</p>
          <NewsletterSignup
            source="nos-footer"
            inputId="nf-email"
            formId="nf-signup"
            emailLabel={FOOTER_BULLETIN.emailLabel}
            placeholder={FOOTER_BULLETIN.placeholder}
            submitLabel={FOOTER_BULLETIN.submitLabel}
            fieldsClassName="nf-form"
            labelClassName="nf-head"
            statusClassName="nf-text nf-signup-status"
            errorClassName="nf-text"
          />
          <div className="nf-wild">
            <div className="nf-head">{FOOTER_WOSA.heading}</div>
            <a className={FOOTER_RHYTHM.row} href={FOOTER_WOSA.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {FOOTER_WOSA.linkLabel}
            </a>
          </div>
        </div>
      </div>

      <div className="nf-base">
        <div className={FOOTER_LAYOUT.bar}>
          <span>
            &copy; {new Date().getFullYear()}
            {FOOTER_COPYRIGHT_TAIL}
          </span>
          <div className={`nf-legal ${FOOTER_LAYOUT.legal}`}>
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
