import Image from 'next/image';
import Link from 'next/link';

import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';

// F19 (vote 1C): nothing in this band is in the Council's Drive, so the page renders it only on the
// beta preview, where the whole band is marked. The page count, ISSN and editor are removed (24 Oct 2026).
export function YearbookStrip() {
  return (
    <section data-home-section="yearbook" data-placeholder="true" className="py-24 bg-bone">
      <div className="saoc-container grid grid-cols-1 min-[1100px]:grid-cols-2 gap-12 min-[1100px]:gap-20 items-start">
        <div data-yearbook-content className="flex flex-col justify-start gap-8 self-start">
          <div>
            <div className="mb-5">
              <span className="eyebrow eyebrow--on-tint">In print</span>
            </div>
            <h2 className="font-serif font-light text-[clamp(34px,4.4vw,54px)] leading-[1.08] tracking-[-0.015em] text-primary mb-6 text-balance">
              <em className="whitespace-nowrap">Orchids South Africa</em>
              &nbsp;· 2025 yearbook
            </h2>
            <p
              data-yearbook-copy
              className="font-sans text-[16px] leading-[1.55] text-ink max-w-[520px]"
            >
              Our annual record of award-winning plants, hybridisation notes, society reports and
              judges&apos; commentary. Available to members or via direct subscription.
            </p>
            <div className="mt-4">
              <PlaceholderMarker />
            </div>
          </div>
          <div>
            <div className="flex flex-wrap gap-3 border-t border-rule pt-6">
              <Link
                href="/contact"
                data-yearbook-cta="primary"
                className="inline-flex items-center justify-center px-[22px] py-[14px] text-[14px] font-medium tracking-[0.01em] rounded-[2px] border transition-[translate,background-color,border-color,color] duration-150 ease-(--ease) hover:-translate-y-px focus-visible:-translate-y-px active:translate-y-0 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px] motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0 border-transparent bg-primary text-ivory hover:bg-primary-800 focus-visible:bg-primary-800"
              >
                Subscribe
              </Link>
              <Link
                href="/contact"
                data-yearbook-cta="secondary"
                className="inline-flex items-center justify-center px-[22px] py-[14px] text-[14px] font-medium tracking-[0.01em] rounded-[2px] border transition-[translate,background-color,border-color,color] duration-150 ease-(--ease) hover:-translate-y-px focus-visible:-translate-y-px active:translate-y-0 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px] motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0 border-primary text-primary hover:bg-primary hover:text-ivory"
              >
                Past editions
              </Link>
            </div>
          </div>
        </div>
        <div data-yearbook-image className="relative aspect-[4/3] min-[1100px]:aspect-[4/5] overflow-hidden">
          <span className="absolute top-5 left-5 z-10 font-mono text-[10.5px] uppercase tracking-[0.2em] text-ink bg-ivory px-[14px] py-2">
            EST. 1968
          </span>
          <Image
            src="/images/orchid-purple.jpg"
            alt="Orchids South Africa 2025 yearbook"
            fill
            className="object-cover"
            sizes="(min-width: 1100px) 50vw, 100vw"
          />
        </div>
      </div>
    </section>
  );
}
