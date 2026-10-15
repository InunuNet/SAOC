'use client';

// =============================================================
// NOS — components/nos-chrome/NosFooter.tsx
// The NOS own-brand footer for /national-show/*: the SAOC footer's content
// (components/chrome/footer-data.ts, shared verbatim) on the NOS royal ground,
// with the supplied reversed lockups in the brand slot. Two plain <img> and CSS
// pick the horizontal file above 700px and the vertical (mono) file at or below
// it; both load eagerly and the inactive one is display:none.
// =============================================================

import Link from 'next/link';

import {
  FOOTER_BRAND_TEXT,
  FOOTER_BULLETIN,
  FOOTER_COPYRIGHT_TAIL,
  FOOTER_HEADINGS,
  FOOTER_LEGAL_LINKS,
  FOOTER_NAV,
  FOOTER_ORG_NAME,
  FOOTER_REG,
  FOOTER_WOSA,
} from '@/components/chrome/footer-data';
import { partners } from '@/lib/data';

import { nosChromeFontClass } from './fonts';
import './nos-chrome.css';

const HUB_HREF = '/national-show';
const LOCKUP_ALT = 'National Orchid Show, Western Cape 2027';
const HORIZONTAL_SRC = '/images/nos/nos-reversed-horizontal-1200.png';
const HORIZONTAL_WIDTH = 1200;
const HORIZONTAL_HEIGHT = 294;
const VERTICAL_SRC = '/images/nos/nos-reversed-white-vertical-900.png';
const VERTICAL_WIDTH = 900;
const VERTICAL_HEIGHT = 791;

export function NosFooter() {
  return (
    <footer id="nf" className={`nf ${nosChromeFontClass}`}>
      <div className="nf-wrap">
        <div className="nf-grid">
          <div className="nf-brand">
            <Link className="nf-lockup" href={HUB_HREF}>
              {/* eslint-disable-next-line @next/next/no-img-element -- the supplied lockups ship byte-for-byte; next/image would re-encode them */}
              <img
                className="nf-h"
                src={HORIZONTAL_SRC}
                alt={LOCKUP_ALT}
                width={HORIZONTAL_WIDTH}
                height={HORIZONTAL_HEIGHT}
                loading="eager"
              />
              {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
              <img
                className="nf-v"
                src={VERTICAL_SRC}
                alt={LOCKUP_ALT}
                width={VERTICAL_WIDTH}
                height={VERTICAL_HEIGHT}
                loading="eager"
              />
            </Link>
            <div className="nf-org">
              <div className="nf-head">{FOOTER_ORG_NAME}</div>
              <p className="nf-text">{FOOTER_BRAND_TEXT}</p>
              <span className="nf-reg">{FOOTER_REG}</span>
            </div>
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
