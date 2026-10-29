// =============================================================
// SAOC — components/ui/CTASection.tsx
// Server Component — shared closing call-to-action band for interior
// pages. Mirrors the dark on-dark treatment already used by the home
// page's ShowBand content panel (bg-primary-800, eyebrow--light,
// accent primary button + outlined secondary button).
// =============================================================

import Link from 'next/link';

import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';

export interface CTALink {
  href: string;
  label: string;
}

export interface CTASectionProps {
  eyebrow: string;
  heading: string;
  /** Omitted when the only sentence available states a fact the Council has not supplied. */
  body?: string;
  /** Beta preview: the body states a fact the Council has not supplied, so it is marked. */
  marked?: boolean;
  primaryCta: CTALink;
  secondaryCta?: CTALink;
}

export function CTASection({ eyebrow, heading, body, marked = false, primaryCta, secondaryCta }: CTASectionProps) {
  return (
    <section className="bg-primary-800">
      <div className="on-dark saoc-container py-20 text-center">
        <span className="eyebrow eyebrow--light">{eyebrow}</span>
        <h2 className="mt-6 font-serif font-normal min-[889px]:font-light text-[clamp(30px,3.6vw,46px)] leading-[1.1] tracking-[-0.015em] text-ivory">
          {heading}
        </h2>
        {body ? (
          <div
            data-placeholder={marked ? 'true' : undefined}
            className="mx-auto mt-5 flex max-w-2xl flex-col items-center gap-2"
          >
            <p className="font-sans text-[16px] leading-[1.55] text-ivory/80">{body}</p>
            {marked ? <PlaceholderMarker tone="dark" /> : null}
          </div>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href={primaryCta.href}
            className="font-sans text-[14px] font-medium bg-accent text-ink px-6 py-3 hover:bg-accent-soft transition-colors duration-150 outline-ivory focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ivory focus-visible:outline-offset-[3px]"
          >
            {primaryCta.label}
          </Link>
          {secondaryCta ? (
            <Link
              href={secondaryCta.href}
              className="font-sans text-[14px] font-medium border border-ivory/30 text-ivory px-6 py-3 hover:bg-ivory/10 transition-colors duration-150 outline-ivory focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ivory focus-visible:outline-offset-[3px]"
            >
              {secondaryCta.label}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
