import { Cormorant_Garamond, Jost } from 'next/font/google';
import Link from 'next/link';

import { Logo } from '@/components/nos/Logo';

import './nos-theme.css';

// F1: NOS-only fonts, scoped via CSS variables so nothing outside `.nos-theme`
// picks them up. Cormorant Garamond carries display/headline elegance (400–500
// only — see design grammar); Jost carries UI/labels/body and eyebrow tracking.
const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-nos-cormorant',
  display: 'swap',
});

const jost = Jost({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-nos-jost',
  display: 'swap',
});

// F1: the `.nos-theme` scope element redeclares the SAOC site's own semantic
// custom-property names (--bg, --fg, --accent, etc. — see nos-theme.css) with
// NOS values. Because app/globals.css's Tailwind `@theme` block only indirects
// through those semantic names, and custom properties resolve at the element
// that uses them, every descendant already using Tailwind utilities like
// `bg-parchment` or `text-ink` re-skins automatically — with zero edits to
// app/globals.css, components/chrome/*, or any page under national-show/.
// F21: the full lockup (emblem + wordmark) is a signature, so it belongs in a
// masthead and a colophon — not in a hero, where it competed with the `<h1>` for
// the same job. It lives HERE and not in `components/chrome/Header.tsx` or
// `components/chrome/Footer.tsx`: those render on every SAOC page, and the show
// lockup on `/societies` or `/judging` is a show signature leaking onto pages
// that are not the show's.
//
// `<header>`/`<footer>` rather than `<div>`: this layout renders inside the
// marketing layout's `<main>`, and per HTML-AAM a `<header>`/`<footer>`
// descended from `main` maps to `generic`, not `banner`/`contentinfo`. So these
// group correctly without minting a second set of page landmarks alongside the
// global chrome's.
//
// `data-nos-masthead` / `data-nos-colophon` are the M7 checker's handles — the
// contract has to tell "lockup in the chrome bands" from "lockup in the hero"
// and cannot do that from class names alone.
export default function NationalShowLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`nos-theme ${cormorantGaramond.variable} ${jost.variable}`}>
      <header
        data-nos-masthead=""
        className="border-b-[length:var(--border-hairline)] border-[var(--rule)] bg-parchment"
      >
        <div className="mx-auto max-w-[1280px] px-8 py-6">
          {/* Links to the show's own landing page. The lockup's wordmark text is
              the link's accessible name, so it needs no extra label. The
              colophon's copy of the lockup is deliberately NOT a link: a second
              self-referential link with the identical name is noise for a screen
              reader, and a colophon signature is not a navigation control. */}
          <Link
            href="/national-show"
            className="inline-block"
          >
            <Logo orientation="responsive" tone="light" />
          </Link>
        </div>
      </header>
      {children}
      {/* Colophon on the flat night ground — the one ground `Logo`'s on-dark
          subtitle tint is cleared for (10.4:1); it is not cleared over
          photography, which is why this band is a flat fill and not an image. */}
      <footer data-nos-colophon="" className="bg-[var(--night)]">
        <div className="mx-auto max-w-[1280px] px-8 py-12">
          <Logo orientation="vertical" tone="on-dark" />
        </div>
      </footer>
    </div>
  );
}
