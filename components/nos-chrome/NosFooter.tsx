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
  FOOTER_ORG_NAME,
  FOOTER_REG,
  FOOTER_RHYTHM,
  FOOTER_WOSA,
} from '@/components/chrome/footer-data';
import { NewsletterSignup } from '@/components/newsletter/NewsletterSignup';
import { nosPath } from '@/lib/nos-paths';
import { saocUrl } from '@/lib/site-hosts';

import { nosChromeFontClass } from './fonts';
import { NOS_FOOTER_EXPLORE, NOS_FOOTER_LEGAL } from './nos-footer-data';
import './nos-chrome.css';

const HUB_HREF = '/';
const LOCKUP_ALT = 'National Orchid Show, Western Cape 2027';
const LOCKUP_SRC = '/images/NOS-2027-logo-reversed-gold-vertical.png';
const LOCKUP_WIDTH = 3272;
const LOCKUP_HEIGHT = 2876;
// The lockup's rendered box is 248px wide (nos-chrome.css). A width with no `sizes` gives a 1x/2x
// density srcset, so a high-density screen never fetches more than twice the box.
const LOCKUP_BOX = 248;
// The SAOC mark: the cream flat silhouette, shown uncropped at about 48px tall.
const SAOC_MARK_SRC = '/images/saoc-logo-flat-paper.png';
const SAOC_MARK_WIDTH = 767;
const SAOC_MARK_HEIGHT = 700;
const SAOC_MARK_BOX_HEIGHT = 48;
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
            <a
              className={FOOTER_RHYTHM.row}
              href={FOOTER_WOSA.href}
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
            {NOS_FOOTER_LEGAL.map((l) => (
              <Link key={l.id} href={nosPath(l.href)}>
                {l.label}
              </Link>
            ))}
            {/* The Constitution is the Council's: a plain anchor to the SAOC site, same tab. */}
            <a href={saocUrl('/constitution')}>Constitution</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
