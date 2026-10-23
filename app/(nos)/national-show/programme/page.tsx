import type { Metadata } from 'next';
import Link from 'next/link';

import { ShowContentState } from '@/components/show/nos/ShowContentState';
import { TicketCard, TicketSection } from '@/components/tickets/keepsake';
import { loadTicketCardViewModels } from '@/lib/data/admission-availability';
import { loadShowFacts } from '@/lib/data/show-facts';
import { loadShowPageOrFallback, withholdPlaceholderProse } from '@/lib/data/show-pages';
import { buildSectionLedes } from '@/lib/data/ticket-section-ledes';
import { PROGRAMME_PRODUCTS, TICKET_COPY, TICKET_PRODUCTS, partnerNameOf } from '@/lib/data/ticket-presentation';
import { buildPageMetadata } from '@/lib/seo';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';
import { NosShowIndex } from '@/components/nos/NosShowIndex';

// F12 (national-show-ia-alignment, M4) — created route. Placeholder copy under an R11
// disclosure until the Council supplies the finished programme; see
// .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/route-manifest.golden.md.
//
// F24 (M4) — replaces the hard 404 guard with loadShowPageOrFallback()/
// <ShowContentState>, so an absent document renders a disclosed shell instead of a 404.
// See goldens/m4/never-404-fallback.golden.md.
export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: 'Programme',
  image: nosOgImage('Programme — National Orchid Show'),
  description: 'The overall schedule of sessions across the four days of the National Show.',
  path: '/national-show/programme',
});

const PROGRAMME_PURPOSE = 'The overall schedule of sessions across the four show days.';

export default async function ProgrammePage() {
  const [result, facts, { cards }] = await Promise.all([
    loadShowPageOrFallback('11-programme', {
      label: 'Programme',
      purpose: PROGRAMME_PURPOSE,
    }),
    loadShowFacts(),
    loadTicketCardViewModels(),
  ]);
  // r16 F1 (Codi): the tickets hub's own Programme section, from the same components and data,
  // so the cards, lede and links here can never differ from the hub's.
  const showProvisional = !withholdPlaceholderProse();
  const ledes = buildSectionLedes({
    showDate: null,
    showEndDate: null,
    has: {
      vip: Boolean(cards.vip),
      sunset: Boolean(cards.sunset),
      symposium: Boolean(cards.symposium),
      wosa: Boolean(cards.wosa),
      workshops: Boolean(cards.workshops),
    },
    names: {
      symposium: cards.symposium?.name ?? null,
      wosa: cards.wosa?.name ?? null,
      workshops: cards.workshops?.name ?? TICKET_PRODUCTS.workshops.name,
    },
  });
  const hasProgramme = PROGRAMME_PRODUCTS.some((id) => cards[id]);

  return (
    <>
      <ShowContentState
        result={result}
        route="/national-show/programme"
        layout="prose"
        holding={{ facts, statement: PROGRAMME_PURPOSE }}
        afterProse={
          <p
            data-nos-programme-links
            className="flex max-w-[60ch] flex-wrap gap-x-6 gap-y-2 border-t border-rule pt-6 font-sans text-[15px] leading-relaxed"
          >
            <Link href="/symposium" className="inline-link">
              National Orchid Show Symposium
            </Link>
            <Link href="/workshops" className="inline-link">
              Workshops
            </Link>
          </p>
        }
      />
      {hasProgramme ? (
        <TicketSection
          id="programme"
          title={TICKET_COPY.sections.programme}
          lede={ledes.programme}
          columns={3}
        >
          {PROGRAMME_PRODUCTS.map((id) => {
            const vm = cards[id];
            return vm ? (
              <div key={id} className="nk-wrap">
                <TicketCard
                  productId={id}
                  vm={vm}
                  name={vm.name}
                  partnerName={partnerNameOf(id, cards)}
                  showProvisional={showProvisional}
                />
              </div>
            ) : null;
          })}
        </TicketSection>
      ) : null}
      <NosShowIndex current="/national-show/programme" />
    </>
  );
}
