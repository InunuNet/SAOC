// =============================================================
// SAOC — components/ui/CTASection.tsx
// Server Component — shared closing call-to-action band for interior
// pages. Mirrors the dark on-dark treatment already used by the home
// page's ShowBand content panel (bg-primary-800, eyebrow--light,
// accent primary button + outlined secondary button).
// =============================================================

import Link from 'next/link';

export interface CTALink {
  href: string;
  label: string;
}

export interface CTASectionProps {
  eyebrow: string;
  heading: string;
  body: string;
  primaryCta: CTALink;
  secondaryCta?: CTALink;
}

export function CTASection({ eyebrow, heading, body, primaryCta, secondaryCta }: CTASectionProps) {
  return (
    <section className="bg-primary-800">
      <div className="on-dark mx-auto max-w-[1280px] px-8 py-20 text-center md:px-16">
        <span className="eyebrow eyebrow--light">{eyebrow}</span>
        <h2 className="mt-6 font-serif text-[clamp(30px,3.6vw,46px)] font-medium leading-[1.1] tracking-[-0.01em] text-ivory">
          {heading}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl font-sans text-[16px] leading-relaxed text-ivory/80">
          {body}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href={primaryCta.href}
            className="font-sans text-[14px] font-medium bg-accent text-ivory px-6 py-3 hover:bg-accent-soft transition-colors duration-150"
          >
            {primaryCta.label}
          </Link>
          {secondaryCta ? (
            <Link
              href={secondaryCta.href}
              className="font-sans text-[14px] font-medium border border-ivory/30 text-ivory px-6 py-3 hover:bg-ivory/10 transition-colors duration-150"
            >
              {secondaryCta.label}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
