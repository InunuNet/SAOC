import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { DuotonePicker } from '@/components/media-kit/DuotonePicker';
import { KitCard } from '@/components/media-kit/KitCard';
import { KitSection, ZipLink } from '@/components/media-kit/KitSection';
import { MediaKitJumpNav } from '@/components/media-kit/MediaKitJumpNav';
import { PageHero } from '@/components/ui/PageHero';
import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';
import {
  buildMediaKit,
  INKS,
  type Ground,
  type InkId,
  type MediaKitItem,
} from '@/lib/data/media-kit';
import { heroImages } from '@/lib/data/heroImages';
import manifest from '@/lib/data/media-kit-manifest.json';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { requireMediaKitAccess } from '@/lib/media-kit-gate';

import { UsageSection } from './UsageSection';

export const metadata: Metadata = {
  title: 'Media Kit',
  description: 'Media resources and press information for the South African Orchid Council.',
};

// Only the founding year is in the Council's copy; Lee-Ann asked for the other figures to be left out
// (24 Oct 2026).
const QUICK_FACTS = [{ value: '1968', label: 'Founding Year' }] as const;

const JUMP_ITEMS = [
  { href: '#quick-start', label: 'Quick start' },
  { href: '#full-colour', label: 'Full colour' },
  { href: '#greyscale', label: 'Greyscale' },
  { href: '#duotone', label: 'Duotone' },
  { href: '#mark-only', label: 'Mark only' },
  { href: '#usage', label: 'Clear space and minimum size' },
  { href: '#national-show', label: 'National Show 2027' },
];

const LOCKUP_GRID = 'grid grid-cols-1 gap-6 md:grid-cols-2';
const CHIP_GRID = 'grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8';
const CARD_GRID = 'grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3';

// Lockup grids are ordered horizontal light, horizontal dark, vertical light, vertical dark.
const LOCKUP_GROUNDS: Ground[] = ['light', 'dark', 'light', 'dark'];

const REMIT =
  'Our remit is orchids in cultivation: the show bench, the greenhouse, and the community. For indigenous species in the wild, our sibling organisation Wild Orchids of Southern Africa leads that work.';

/** Only the greyscale mark reversed for sage is made for a dark ground. */
function markGround(item: MediaKitItem): Ground {
  return item.path.includes('greyscale-reversed') ? 'dark' : 'light';
}

/** The reversed National Show logos are made for a dark ground. */
function nosGround(item: MediaKitItem): Ground {
  return /reversed/i.test(item.variant_label ?? '') ? 'dark' : 'light';
}

const HERO_IMAGE_NAME = 'orchid-violet';

function LockupCards({ items }: { items: MediaKitItem[] }) {
  return items.map((item, index) => (
    <KitCard key={item.path} item={item} ground={LOCKUP_GROUNDS[index]} />
  ));
}

export default async function MediaKitPage() {
  await requireMediaKitAccess('/media-kit');
  const withhold = withholdPlaceholderProse();
  // Every file offered for download comes from the generated manifest; nothing is linked by hand.
  const kit = buildMediaKit(manifest.items);
  const hero = heroImages.find((image) => image.name === HERO_IMAGE_NAME);
  if (!hero) throw new Error(`hero image ${HERO_IMAGE_NAME} is not in heroImages`);
  const duotonePanels = Object.fromEntries(
    INKS.map((ink) => [ink.id, <LockupCards key={ink.id} items={kit.duotone[ink.id]} />]),
  ) as Record<InkId, ReactNode>; // keyed by exactly the InkId union via INKS

  return (
    <>
      <PageHero
        image={hero.path}
        eyebrow="Press"
        heading="Media Kit"
        lede="Resources and information for journalists, photographers and media partners."
      />

      <div className="saoc-container py-16 space-y-16">
        <MediaKitJumpNav items={JUMP_ITEMS} />

        <KitSection id="quick-start" heading="Quick start">
          <div className="max-w-[640px]">
            <KitCard item={kit.quickStart} ground="light" eager />
            <div className="mt-4">
              <ZipLink item={kit.everythingZip} />
            </div>
          </div>
        </KitSection>

        <KitSection id="full-colour" heading="Full colour" zip={kit.sectionZips['full-colour']}>
          <div className={LOCKUP_GRID}>
            <LockupCards items={kit.fullColour} />
          </div>
        </KitSection>

        <KitSection id="greyscale" heading="Greyscale" zip={kit.sectionZips.greyscale}>
          <div className={LOCKUP_GRID}>
            <LockupCards items={kit.greyscale} />
          </div>
        </KitSection>

        <KitSection id="duotone" heading="Duotone" zip={kit.sectionZips.duotone}>
          <DuotonePicker panels={duotonePanels} />
        </KitSection>

        <KitSection id="mark-only" heading="Mark only" zip={kit.sectionZips['mark-only']}>
          <div className="space-y-6">
            {(['light', 'dark'] as const).map((ground) => (
              <div key={ground} className={CHIP_GRID}>
                {kit.chips[ground].map((chip) => (
                  <KitCard
                    key={chip.path}
                    item={chip}
                    ground={ground}
                    layout="chip"
                    title={chip.ink_label ?? chip.rendition_label}
                  />
                ))}
              </div>
            ))}
            <div className={CARD_GRID}>
              {kit.marks.map((mark) => (
                <KitCard key={mark.path} item={mark} ground={markGround(mark)} />
              ))}
            </div>
          </div>
          <p className="mt-6 max-w-[600px] font-sans text-[16px] leading-[1.55] text-ink/70">
            Vector masters (SVG/EPS) are not yet available for the SAOC marks and lockups — the PNG
            files above are print-usable at their native resolution. Contact us if you need a size
            or format not listed here.
          </p>
        </KitSection>

        <section id="usage" aria-labelledby="usage-heading" className="scroll-mt-32">
          <h2
            id="usage-heading"
            className="mb-6 font-serif tracking-[-0.015em] font-light text-[32px] leading-[1.15] text-ink"
          >
            Clear space and minimum size
          </h2>
          <UsageSection illustrations={manifest.usage} />
        </section>

        <KitSection
          id="national-show"
          heading="National Show 2027"
          zip={kit.sectionZips['national-show']}
        >
          <div className={CARD_GRID}>
            {kit.nationalShowLogos.map((logo) => (
              <KitCard key={logo.path} item={logo} ground={nosGround(logo)} />
            ))}
            <KitCard
              item={kit.nationalShowEmblem.png}
              alsoAs={[kit.nationalShowEmblem.svg]}
              ground="light"
            />
          </div>
        </KitSection>

        {/* Quick facts */}
        <section>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted mb-6">
            Quick facts
          </p>
          <div className="flex flex-col items-start gap-4">
            <dl className="grid w-full grid-cols-2 gap-8 border-y border-rule py-10 sm:grid-cols-4">
              {QUICK_FACTS.map((stat) => (
                <div key={stat.label}>
                  <dt className="font-serif tracking-[-0.015em] font-light text-[32px] text-ink">{stat.value}</dt>
                  <dd className="mt-1 font-mono text-[11px] tracking-[0.16em] text-muted">
                    {stat.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* About SAOC */}
        <section className="max-w-[720px]">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted mb-6">
            About SAOC
          </p>
          <p className="font-serif font-normal text-[20px] leading-[1.55] text-ink">
            The South African Orchid Council (SAOC) is the national coordinating body for
            affiliated orchid societies across South Africa.
          </p>
          <p className="mt-4 font-sans text-[16px] leading-[1.55] text-ink/80">
            {withhold ? null : (
              <span data-placeholder="true">
                Founded in 1968, SAOC exists to promote the culture, hybridisation and
                appreciation of orchids in cultivation — through a federated network of 21
                societies, a nationally accredited judging system first standardised in 1990, and
                our annual publication <em>Orchids South Africa</em>
                <PlaceholderMarker />
              </span>
            )}
            {withhold ? REMIT : `. ${REMIT}`}
          </p>
        </section>

        {/* Press contact */}
        <section className="max-w-[720px] border-t border-rule pt-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted mb-6">
            Press enquiries
          </p>
          <p className="font-sans text-[16px] leading-[1.55] text-ink/80">
            For press enquiries, interview requests, or image permissions, email us at{' '}
            <a
              href="mailto:info@saoc.co.za"
              className="text-ink underline underline-offset-2"
            >
              info@saoc.co.za
            </a>{' '}
            or use our{' '}
            <Link href="/contact" className="text-ink underline underline-offset-2">
              contact form
            </Link>
            .
          </p>
        </section>

        <p className="font-mono text-[11px] tracking-[0.16em] text-muted pt-4 border-t border-rule">
          Last updated: October 2026
        </p>
      </div>
    </>
  );
}
