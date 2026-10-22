import type { Metadata } from 'next';

import { KitCard } from '@/components/media-kit/KitCard';
import { KitSection } from '@/components/media-kit/KitSection';
import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { buildMediaKit, type Ground, type MediaKitItem } from '@/lib/data/media-kit';
import manifest from '@/lib/data/media-kit-manifest.json';
import { requireMediaKitAccess } from '@/lib/media-kit-gate';
import { buildPageMetadata } from '@/lib/seo';

// Mission nos-site-split F4 — the National Show's own media kit: the National Show 2027 logos and
// emblem the SAOC kit already carries, served on the NOS site. Admin-only until a members system
// exists (lib/media-kit-gate.ts); the files come from the generated manifest, nothing is linked by hand.
const ROUTE = '/national-show/media-kit';
const PUBLIC_PATH = '/media-kit';

export const metadata: Metadata = buildPageMetadata({
  title: 'Media Kit',
  description: 'National Orchid Show 2027 logos and emblem for press and media partners.',
  path: ROUTE,
  noIndex: true,
});

const CARD_GRID = 'grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3';

/** The reversed National Show logos are made for a dark ground. */
function nosGround(item: MediaKitItem): Ground {
  return /reversed/i.test(item.variant_label ?? '') ? 'dark' : 'light';
}

export default async function NosMediaKitPage() {
  await requireMediaKitAccess(PUBLIC_PATH);
  const kit = buildMediaKit(manifest.items);

  return (
    <>
      <NosHero
        route={ROUTE}
        title="Media Kit"
        lede="National Orchid Show 2027 logos and emblem for press and media partners."
      />
      <NosSection>
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
      </NosSection>
    </>
  );
}
