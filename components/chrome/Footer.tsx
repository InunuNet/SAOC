// =============================================================
// SAOC — components/chrome/Footer.tsx
// Server Component — dark sage footer with four columns.
// Col 1: logo + mission + reg numbers
// Col 2: Explore nav links
// Col 3: Partners list
// Col 4: Contact info
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
        {/* Col 1 — logo + mission */}
        <div className="flex flex-col gap-4">
          <Image
            src="/images/saoc-logo-flat-paper.png"
            alt="South African Orchid Council"
            width={64}
            height={64}
          />
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

        {/* Col 4 — Contact */}
        <div className="flex flex-col gap-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ivory/55 mb-1">
            Contact
          </div>
          <p className="font-sans text-[13.5px] leading-relaxed text-ivory/65">
            Questions about membership, shows, or judging? We&apos;d love to hear from you.
          </p>
          <Link
            href="/contact"
            className="inline-block font-sans text-[14px] font-medium text-accent hover:text-accent-soft transition-colors duration-150"
          >
            Get in touch →
          </Link>
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
              href="/terms"
              className="font-sans text-[13px] text-ivory/45 hover:text-ivory/70 transition-colors duration-150"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
