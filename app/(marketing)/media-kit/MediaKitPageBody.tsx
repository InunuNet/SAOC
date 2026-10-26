import Link from 'next/link';
import type { ReactNode } from 'react';

import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { DuotonePicker } from '@/components/media-kit/DuotonePicker';
import { KitCard } from '@/components/media-kit/KitCard';
import { KitSection, ZipLink } from '@/components/media-kit/KitSection';
import { MediaKitJumpNav } from '@/components/media-kit/MediaKitJumpNav';
import { LockupPicker } from '@/components/media-kit/LockupPicker';
import { OptionPicker } from '@/components/media-kit/OptionPicker';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { PageHero } from '@/components/ui/PageHero';
import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';
import {
  buildMediaKit,
  itemMeta,
  INKS,
  type Ground,
  type MediaKit,
  type InkId,
  type MediaKitItem,
} from '@/lib/data/media-kit';
import { heroImages } from '@/lib/data/heroImages';
import manifest from '@/lib/data/media-kit-manifest.json';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';

import { UsageSection } from './UsageSection';

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

// Mark only: one option per colourway, in the manifest's own wording (rendition_label / ink_label).
// `stem` is the file-name stem shared by the option's mark(s), light chip and dark chip.
const MARK_OPTIONS = [
  { id: 'colour', label: 'Full colour', stem: 'colour' },
  { id: 'greyscale', label: 'Greyscale', stem: 'greyscale' },
  { id: 'indigo', label: '01 Indigo', stem: 'duotone-indigo' },
  { id: 'prussian', label: '02 Prussian', stem: 'duotone-prussian' },
  { id: 'viridian', label: '03 Viridian', stem: 'duotone-viridian' },
  { id: 'violet', label: '04 Violet', stem: 'duotone-violet' },
  { id: 'teal', label: '05 Teal', stem: 'duotone-teal' },
  { id: 'plum', label: '06 Plum', stem: 'duotone-plum' },
] as const;

// National Show 2027: one option per colourway (variant_label), horizontal card then vertical card.
const NOS_OPTIONS = [
  { id: 'full-colour', label: 'Full colour' },
  { id: 'full-colour-reversed', label: 'Full colour reversed' },
  { id: 'grayscale', label: 'Grayscale' },
  { id: 'ink-olive', label: 'Ink olive' },
  { id: 'ink-purple', label: 'Ink purple' },
  { id: 'ink-violet', label: 'Ink violet' },
  { id: 'reversed-gold', label: 'Reversed gold' },
  { id: 'reversed-white', label: 'Reversed white' },
] as const;

const MARK_FILE_TAIL = /^(-reversed)?\.png$/;
const CHIP_FILE_TAIL = /^(-reversed)?-on-(light|dark)\.png$/;

/** True when the file is this colourway's mark (kind 'mark') or chip (kind 'chip'). */
function hasStem(item: MediaKitItem, kind: 'mark' | 'chip', stem: string): boolean {
  const file = item.path.split('/').pop() ?? '';
  const base = `saoc-mark-${stem}`;
  if (!file.startsWith(base)) return false;
  return (kind === 'mark' ? MARK_FILE_TAIL : CHIP_FILE_TAIL).test(file.slice(base.length));
}

function hasNosColourway(item: MediaKitItem, id: string): boolean {
  const file = item.path.split('/').pop() ?? '';
  return new RegExp(`^NOS-2027-logo-${id}-(horizontal|vertical)\\.png$`).test(file);
}

function MarkPanel({ kit, stem }: { kit: MediaKit; stem: string }) {
  return (
    <>
      {kit.marks
        .filter((mark) => hasStem(mark, 'mark', stem))
        .map((mark) => (
          <KitCard key={mark.path} item={mark} ground={markGround(mark)} />
        ))}
      {(['light', 'dark'] as const).flatMap((ground) =>
        kit.chips[ground]
          .filter((chip) => hasStem(chip, 'chip', stem))
          .map((chip) => (
            <KitCard
              key={chip.path}
              item={chip}
              ground={ground}
              layout="chip"
              title={chip.label}
            />
          )),
      )}
    </>
  );
}

// The merged Full colour · Greyscale picker: the two family names are the two existing section headings.
const LOCKUPS_LABEL = 'Full colour · Greyscale';
const LOCKUP_FAMILIES = [
  { id: 'full-colour', label: 'Full colour' },
  { id: 'greyscale', label: 'Greyscale' },
] as const;
const LOCKUP_VARIANT_IDS = [
  'horizontal-on-light',
  'horizontal-on-dark',
  'vertical-on-light',
  'vertical-on-dark',
] as const;

const HERO_IMAGE_NAME = 'orchid-violet';

function LockupCards({ items }: { items: MediaKitItem[] }) {
  return items.map((item, index) => (
    <KitCard key={item.path} item={item} ground={LOCKUP_GROUNDS[index]} />
  ));
}

export function MediaKitPageBody() {
  const withhold = withholdPlaceholderProse();
  // Every file offered for download comes from the generated manifest; nothing is linked by hand.
  const kit = buildMediaKit(manifest.items);
  const hero = heroImages.find((image) => image.name === HERO_IMAGE_NAME);
  if (!hero) throw new Error(`hero image ${HERO_IMAGE_NAME} is not in heroImages`);
  const duotonePanels = Object.fromEntries(
    INKS.map((ink) => [ink.id, <LockupCards key={ink.id} items={kit.duotone[ink.id]} />]),
  ) as Record<InkId, ReactNode>; // keyed by exactly the InkId union via INKS

  // Variant labels are the manifest's own lockup_label strings, in LOCKUP_ORDER.
  const lockupVariants = LOCKUP_VARIANT_IDS.map((id, index) => ({
    id,
    label: kit.fullColour[index].lockup_label ?? kit.fullColour[index].label,
  }));
  const lockupFamilyItems: ReadonlyArray<readonly [string, MediaKitItem[]]> = [
    ['full-colour', kit.fullColour],
    ['greyscale', kit.greyscale],
  ];
  const lockupPanels = Object.fromEntries(
    lockupFamilyItems.flatMap(([family, items]) =>
      items.map((item, index) => [
        `${family}/${LOCKUP_VARIANT_IDS[index]}`,
        <KitCard key={item.path} item={item} ground={LOCKUP_GROUNDS[index]} />,
      ]),
    ),
  );
  const lockupZips = {
    'full-colour': {
      href: kit.sectionZips['full-colour'].href,
      meta: itemMeta(kit.sectionZips['full-colour']),
    },
    greyscale: { href: kit.sectionZips.greyscale.href, meta: itemMeta(kit.sectionZips.greyscale) },
  };
  const markPanels = Object.fromEntries(
    MARK_OPTIONS.map((option) => [option.id, <MarkPanel key={option.id} kit={kit} stem={option.stem} />]),
  );
  const nosPanels = Object.fromEntries(
    NOS_OPTIONS.map((option) => [
      option.id,
      kit.nationalShowLogos
        .filter((logo) => hasNosColourway(logo, option.id))
        .sort((a, c) => Number(c.path.includes('horizontal')) - Number(a.path.includes('horizontal')))
        .map((logo) => <KitCard key={logo.path} item={logo} ground={nosGround(logo)} />),
    ]),
  );

  return (
    <>
      <Breadcrumb items={[{ label: 'Media Kit' }]} />
      <PageHero
        image={hero.path}
        eyebrow="Press"
        heading="Media Kit"
        lede="Resources and information for journalists, photographers and media partners."
      />

      <DocumentLayout>
      <div className="space-y-[var(--section-y)]">
        <MediaKitJumpNav items={JUMP_ITEMS} />

        <KitSection id="quick-start" heading="Quick start">
          <div className="max-w-[640px]">
            <KitCard item={kit.quickStart} ground="light" eager />
            <div className="mt-4">
              <ZipLink item={kit.everythingZip} />
            </div>
          </div>
        </KitSection>

        <KitSection id="lockups" heading="Full colour · Greyscale">
          {/* Zero-size anchors: the "On this page" links (#full-colour, #greyscale) land here with that family preselected. */}
          <span id="full-colour" className="block scroll-mt-52" />
          <span id="greyscale" className="block scroll-mt-52" />
          <LockupPicker
            familyLabel={LOCKUPS_LABEL}
            familyName="lockup-family"
            variantName="lockup-variant"
            families={LOCKUP_FAMILIES}
            variants={lockupVariants}
            panels={lockupPanels}
            zips={lockupZips}
          />
        </KitSection>

        <KitSection id="duotone" heading="Duotone" zip={kit.sectionZips.duotone}>
          <DuotonePicker panels={duotonePanels} />
        </KitSection>

        <KitSection id="mark-only" heading="Mark only" zip={kit.sectionZips['mark-only']}>
          <OptionPicker
            label="Mark only"
            name="mark-only-colourway"
            hashPrefix="mark-only"
            defaultId="colour"
            options={MARK_OPTIONS}
            panels={markPanels}
            panelClassName={CARD_GRID}
          />
          <p className="mt-6 max-w-[600px] font-sans text-[16px] leading-[1.55] text-ink/70">
            Vector masters (SVG/EPS) are not yet available for the SAOC marks and lockups — the PNG
            files above are print-usable at their native resolution. Contact us if you need a size
            or format not listed here.
          </p>
        </KitSection>

        <section id="usage" aria-labelledby="usage-heading" className="scroll-mt-32">
          <h2 id="usage-heading" className="doc-h2">
            Clear space and minimum size
          </h2>
          <UsageSection illustrations={manifest.usage} />
        </section>

        <KitSection
          id="national-show"
          heading="National Show 2027"
          zip={kit.sectionZips['national-show']}
        >
          <OptionPicker
            label="National Show 2027"
            name="national-show-colourway"
            hashPrefix="national-show"
            defaultId="full-colour"
            options={NOS_OPTIONS}
            panels={nosPanels}
            panelClassName={LOCKUP_GRID}
          />
          <div className="mt-6 max-w-[640px]">
            <KitCard
              item={kit.nationalShowEmblem.png}
              alsoAs={[kit.nationalShowEmblem.svg]}
              ground="light"
            />
          </div>
        </KitSection>

        {/* Quick facts */}
        <section>
          <h2 className="doc-h2">Quick facts</h2>
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
          <h2 className="doc-h2">About SAOC</h2>
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
          <h2 className="doc-h2">Press enquiries</h2>
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
      </DocumentLayout>
    </>
  );
}
