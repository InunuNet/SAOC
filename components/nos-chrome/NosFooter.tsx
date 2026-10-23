// =============================================================
// NOS — components/nos-chrome/NosFooter.tsx
// The National Orchid Show's own footer (mission nos-site-split F3, NOS Design R2), on the NOS royal
// ground: the supplied gold vertical lockup (links the NOS home), an "Explore" list from the show
// nav, the SAOC credit (one link to the SAOC site: the organising body, its mark, name and
// registration), the bulletin sign-up and the WOSA pointer, then the copyright and the legal row.
// A server component: the credit's label placeholder is decided on the server
// (withholdPlaceholderProse) and passed in.
// r20 F3 (Codi): the footer follows the SAOC footer's layout (FOOTER_LAYOUT, shared with Footer.tsx).
// ONE <picture> holds a 1x/2x density set of that one file, fetched lazily (the footer is below the
// fold); the custom image loader maps it to its pre-built WebP candidates.
// =============================================================

import { getImageProps } from 'next/image';
import Link from 'next/link';

import {
  FOOTER_BULLETIN,
  FOOTER_COPYRIGHT_TAIL,
  FOOTER_HEADINGS,
  FOOTER_LAYOUT,
  FOOTER_NEW_TAB_CUE,
  FOOTER_ORG_NAME,
  FOOTER_REG,
  FOOTER_RHYTHM,
  FOOTER_WOSA,
} from '@/components/chrome/footer-data';
import { ExternalArrow } from '@/components/chrome/ExternalArrow';
import { MediaKitFooterLink } from '@/components/chrome/MediaKitFooterLink';
import { NewsletterSignup } from '@/components/newsletter/NewsletterSignup';
import { nosPath } from '@/lib/nos-paths';
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
// The lockup's rendered box is 248px wide (nos-chrome.css). A width with no `sizes` gives a 1x/2x
// density srcset, so a high-density screen never fetches more than twice the box.
const LOCKUP_BOX = 248;
// The SAOC mark: the supplied full-colour original, uncropped and not recoloured, 56px tall.
const SAOC_MARK_SRC = '/images/saoc-logo-original.png';
const SAOC_MARK_WIDTH = 767;
const SAOC_MARK_HEIGHT = 700;
const SAOC_MARK_BOX_HEIGHT = 56;
// COPY GAP: the credit's label ("Organised by" or the Council's own wording) is not supplied. It
// shows as this existing marker string on the preview only and is omitted in public.
const CREDIT_LABEL_PLACEHOLDER = 'To be confirmed';

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
  });
  const { props: mark } = getImageProps({
    src: SAOC_MARK_SRC,
    alt: '',
    width: Math.round((SAOC_MARK_BOX_HEIGHT * SAOC_MARK_WIDTH) / SAOC_MARK_HEIGHT),
    height: SAOC_MARK_BOX_HEIGHT,
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
          </ul>
        </div>

        <div className="nf-col">
          {/* The organising body: one link to the SAOC site, a plain anchor, same tab, no arrow. */}
          <a className="nf-credit" href={saocUrl('/')}>
            {showPlaceholders && (
              <span className="nf-credit-label" data-placeholder-marker>
                {CREDIT_LABEL_PLACEHOLDER}
              </span>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative mark via getImageProps, like the lockup */}
            <img {...mark} alt="" loading="lazy" decoding="async" />
            <span className="nf-credit-name">{FOOTER_ORG_NAME}</span>
            <span className="nf-credit-reg">{FOOTER_REG}</span>
          </a>
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
