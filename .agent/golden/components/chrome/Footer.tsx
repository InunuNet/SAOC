'use client';

// =============================================================
// SAOC — components/chrome/Footer.tsx
// Client Component — dark sage footer with four columns.
// Col 1: stacked logo lockup + mission + reg numbers
// Col 2: Explore nav links
// Col 3: Partners list
// Col 4: Stay in touch (newsletter form + WOSA link)
// =============================================================

import Image from 'next/image';
import Link from 'next/link';
import { partners } from '@/lib/data';

const FOOTER_NAV = [
  { id: 'about', label: 'About', href: '/about' },
  { id: 'societies', label: 'Societies', href: '/societies' },
  { id: 'judging', label: 'Judging', href: '/judging' },
  { id: 'show', label: 'National Show', href: '/national-show' },
  { id: 'events', label: 'Events', href: '/events' },
];

export function Footer() {
  return (
    <footer className="bg-primary-800 text-ivory">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 py-16 px-8 max-w-[1280px] mx-auto">
        {/* Col 1 — logo lockup + mission */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3 mb-4">
            <Image
              src="/images/saoc-logo-flat-paper.png"
              alt="South African Orchid Council"
              width={64}
              height={64}
            />
            <div className="text-center">
              <div className="font-serif text-[22px] font-semibold tracking-[0.005em] text-ivory leading-tight">
                SA Orchid Council
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ivory/65 mt-2">
                Making a difference since 1968
              </div>
            </div>
          </div>
          <p className="font-sans text-[13.5px] leading-relaxed text-ivory/65">
            A national coordinating body for affiliated orchid societies across South Africa —
            promoting culture, hybridisation and appreciation of orchids in cultivation since 1968.
          </p>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[11px] text-ivory/45">Reg# 1978/004040/08</span>
            <span className="font-mono text-[11px] text-ivory/45">NPO 043-901</span>
          </div>
        </div>

        {/* Col 2 — Explore */}
        <div className="flex flex-col gap-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ivory/55 mb-1">
            Explore
          </div>
          <ul className="flex flex-col gap-2">
            {FOOTER_NAV.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href}
                  className="font-sans text-[14px] text-ivory/80 hover:text-ivory transition-colors duration-150"
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
            Partners
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
            Stay in touch
          </div>
          <p className="font-sans text-[13.5px] leading-relaxed text-ivory/65">
            Quarterly bulletin — show dates, judging results and yearbook news.
          </p>
          <form className="flex gap-0" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              aria-label="Email address"
              placeholder="your@email.co.za"
              required
              className="flex-1 bg-ivory/10 border border-ivory/20 text-ivory placeholder:text-ivory/40 font-sans text-[13px] px-3 py-2 focus:outline-none focus:border-ivory/40"
            />
            <button
              type="submit"
              className="bg-primary text-ivory font-sans text-[13px] font-medium px-4 py-2 hover:bg-primary-800 transition-colors duration-150 shrink-0"
            >
              Subscribe
            </button>
          </form>
          <div className="mt-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ivory/55 mb-2">
              Looking for wild orchids?
            </div>
            <a
              href="https://wosa.org.za"
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans text-[14px] text-ivory/80 hover:text-ivory transition-colors duration-150"
            >
              Visit Wild Orchids of Southern Africa →
            </a>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-ivory/10">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-8 py-4 flex-wrap">
          <span className="font-sans text-[13px] text-ivory/45">
            &copy; {new Date().getFullYear()} South African Orchid Council. All rights reserved.
          </span>
          <div className="flex items-center gap-4">
            <Link
              href="/privacy"
              className="font-sans text-[13px] text-ivory/45 hover:text-ivory/70 transition-colors duration-150"
            >
              Privacy
            </Link>
            <Link
              href="/constitution"
              className="font-sans text-[13px] text-ivory/45 hover:text-ivory/70 transition-colors duration-150"
            >
              Constitution
            </Link>
            <Link
              href="/media-kit"
              className="font-sans text-[13px] text-ivory/45 hover:text-ivory/70 transition-colors duration-150"
            >
              Media kit
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
