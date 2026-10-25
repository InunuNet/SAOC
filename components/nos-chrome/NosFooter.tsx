// =============================================================
// NOS — components/nos-chrome/NosFooter.tsx
// The National Orchid Show's own footer (mission nos-site-split F3, NOS Design R2), on the NOS royal
// ground: the supplied gold vertical lockup (links the NOS home), an "Explore" list from the show
// nav, the SAOC credit (one link to the SAOC site: the organising body, its mark, name and
// registration), the bulletin sign-up and the WOSA pointer, then the copyright and the legal row.
// A server component: the credit's label placeholder is decided on the server
// (withholdPlaceholderProse) and passed in.
// r20 F3 (Codi): the footer follows the SAOC footer's layout (FOOTER_LAYOUT, shared with Footer.tsx).
// ONE <picture> holds a width srcset of that one file, fetched lazily (the footer is below the
// fold); the custom image loader maps it to its pre-built WebP candidates.
// =============================================================

import { Fragment } from 'react';

import { getImageProps } from 'next/image';
import Link from 'next/link';

import {
  FOOTER_BULLETIN,
  FOOTER_COPYRIGHT_TAIL,
  FOOTER_HEADINGS,
  FOOTER_LAYOUT,
  FOOTER_NEW_TAB_CUE,
  FOOTER_REG,
  FOOTER_RHYTHM,
  FOOTER_WOSA,
} from '@/components/chrome/footer-data';
import { SaocLockup } from '@/components/chrome/SaocLockup';
import { CONTACT_LINK } from '@/components/chrome/nav-config';
import { ExternalArrow } from '@/components/chrome/ExternalArrow';
import { MediaKitFooterLink } from '@/components/chrome/MediaKitFooterLink';
import { NewsletterSignup } from '@/components/newsletter/NewsletterSignup';
import { NOS_CONTACT_PATH, nosPath } from '@/lib/nos-paths';
import { SHOW_TITLE_EXPANDED } from '@/lib/show-title';
import { saocUrl } from '@/lib/site-hosts';

import { nosChromeFontClass } from './fonts';
import { NOS_FOOTER_EXPLORE, NOS_FOOTER_LEGAL, NOS_FOOTER_MEDIA_KIT } from './nos-footer-data';
import './nos-chrome.css';

const HUB_HREF = '/';
const LOCKUP_ALT = SHOW_TITLE_EXPANDED;
const LOCKUP_SRC = '/images/NOS-2027-logo-reversed-gold-vertical.png';
const LOCKUP_WIDTH = 3272;
const LOCKUP_HEIGHT = 2876;
// The lockup's rendered box is 248px wide (nos-chrome.css). A width with no `sizes` gives a
// pixel-density list that stops at twice the box, which under-serves a 3x screen. The `sizes` below
// gives a width srcset over the whole variant ladder, so a 3x screen picks a wide enough one (LG-1).
const LOCKUP_BOX = 248;
interface NosFooterProps {
  /** True on the beta preview, where an unsupplied fact shows as a visible marker. */
  showPlaceholders: boolean;
}

export function NosFooter({ showPlaceholders }: NosFooterProps) {
  const { props: lockup } = getImageProps({
    src: LOCKUP_SRC,
    alt: LOCKUP_ALT,
    width: LOCKUP_BOX,
    height: Math.round((LOCKUP_BOX * LOCKUP_HEIGHT) / LOCKUP_WIDTH),
    sizes: `${LOCKUP_BOX}px`,
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
        </div>

        <div className="nf-col">
          <div className="nf-head">{FOOTER_HEADINGS.explore}</div>
          <ul className={`nf-list ${FOOTER_RHYTHM.list}`}>
            {NOS_FOOTER_EXPLORE.map((n) => (
              <li key={n.id}>
                <Link className={FOOTER_RHYTHM.row} href={nosPath(n.href)}>
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link className={FOOTER_RHYTHM.row} href={nosPath(NOS_CONTACT_PATH)}>
                {CONTACT_LINK.label}
              </Link>
            </li>
          </ul>
        </div>

        <div className="nf-col">
          {/* The organising body: one link to the SAOC site, a plain anchor, same tab, no arrow. */}
          <div className="nf-saoc-credit">
            <SaocLockup
              orientation="vertical"
              tone="dark"
              variant="official-mono"
              href={saocUrl('/')}
              testId="nf-saoc-lockup"
            />
            <span className="nf-credit-reg">
              {FOOTER_REG.split(/\s{2,}/).map((part, i) => (
                <Fragment key={part}>
                  {i > 0 && ' '}
                  <span className="nf-reg-item">{part}</span>
                </Fragment>
              ))}
            </span>
          </div>
          {/* WOSA appears once in this footer: a Partner link under the credit (NOS Design FT4). */}
          <ul className={`nf-list ${FOOTER_RHYTHM.list}`}>
            <li>
              <a
                className={`${FOOTER_RHYTHM.row} gap-1`}
                href={FOOTER_WOSA.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {FOOTER_WOSA.label}
                <ExternalArrow />
                <span className="sr-only">{FOOTER_NEW_TAB_CUE}</span>
              </a>
            </li>
          </ul>
        </div>

        <div className="nf-col nf-col-touch">
          <div className="nf-head">{FOOTER_HEADINGS.touch}</div>
          <p className="nf-text">{FOOTER_BULLETIN.blurb}</p>
          <NewsletterSignup
            site="nos"
            showCopyGap={showPlaceholders}
            source="nos-footer"
            inputId="nf-email"
            formId="nf-signup"
            emailLabel={FOOTER_BULLETIN.emailLabel}
            placeholder={FOOTER_BULLETIN.placeholder}
            submitLabel={FOOTER_BULLETIN.submitLabel}
            fieldsClassName="nf-form"
            labelClassName="sr-only"
            statusClassName="nf-text nf-signup-status"
            errorClassName="nf-text"
          />
        </div>
      </div>

      <div data-footer-bar className="nf-base">
        <div className={FOOTER_LAYOUT.bar}>
          <span>
            &copy; {new Date().getFullYear()}
            {FOOTER_COPYRIGHT_TAIL}
          </span>
          <div className={`nf-legal ${FOOTER_LAYOUT.legal}`}>
            {NOS_FOOTER_LEGAL.map((l) => (
              <Link key={l.id} href={nosPath(l.href)}>
                {l.label}
              </Link>
            ))}
            <MediaKitFooterLink href={nosPath(NOS_FOOTER_MEDIA_KIT.href)} label={NOS_FOOTER_MEDIA_KIT.label} />
            {/* The Constitution is the Council's: a plain anchor to the SAOC site, same tab. */}
            <a href={saocUrl('/constitution')}>Constitution</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
