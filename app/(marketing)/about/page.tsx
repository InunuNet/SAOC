import type { Metadata } from 'next';

import { PageHero } from '@/components/ui/PageHero';
import { PhotoBand } from '@/components/ui/PhotoBand';
import { CTASection } from '@/components/ui/CTASection';
import { BoardGrid } from '@/components/about';
import type { SanityBoardMember } from '@/components/about';
import { sanityFetch } from '@/sanity/lib/fetch';
import { aboutPageQuery, boardMembersQuery } from '@/sanity/queries';
import { boardMembers as staticBoard } from '@/lib/data/board';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

export const metadata: Metadata = { title: 'About SAOC' };

interface AboutPageData {
  boardIntroText?: string | null;
}

interface BoardMemberData {
  _id: string;
  name: string;
  role: string | null;
  email: string | null;
  order: number | null;
  placeholder: boolean | null;
}

// Founding facts stated verbatim in content.md (Lee-Ann's official About
// copy, synced from Drive — see
// .agent/memory/project/specs/saoc-about-page/goldens/f1-about-page-leeann-copy.golden.md
// §4). Every value here traces to a sentence in that document; nothing is
// invented. The pre-mission stats band (judging-standardisation year, shows
// hosted, affiliated-society counts) is NOT in content.md and has been
// removed.
const HERITAGE_STATS = [
  { value: '1968', label: 'Founded' },
  { value: '28 July 1968', label: 'Founding date, Bloemfontein' },
  { value: '4', label: 'Founding societies' },
  { value: '15', label: 'Accredited SAOC Judges, Sept 1968' },
] as const;

export default async function AboutPage() {
  const [about, board] = await Promise.all([
    sanityFetch<AboutPageData>({
      query: aboutPageQuery,
      tags: ['aboutPage', 'sanity'],
    }),
    sanityFetch<BoardMemberData[]>({
      query: boardMembersQuery,
      tags: ['boardMember', 'sanity'],
    }),
  ]);

  const sanityBoard = board ?? [];
  const boardForGrid: SanityBoardMember[] =
    sanityBoard.length > 0
      ? sanityBoard.map((m) => ({
          _id: m._id,
          name: m.name,
          role: m.role,
          email: m.email,
          order: m.order,
          placeholder: m.placeholder ?? false,
        }))
      : staticBoard.map((m, i) => ({
          _id: `static-${i}`,
          name: m.name,
          role: m.role,
          email: null,
          order: i,
          placeholder: true,
        }));

  return (
    <>
      <PageHero
        image="/images/orchid-violet.jpg"
        eyebrow="Our heritage"
        heading={<strong>About the South African Orchid Council</strong>}
      />

      {/*
        Lee-Ann's official About copy (council-supplied), rendered verbatim —
        title + 7 paragraphs, 8 bold spans as <strong> — from
        content/drive-source/SAOC /2. About/About page - South African
        Orchid Council/v1.0/content.md. Do not edit, trim, or paraphrase this
        text. See the golden's §1/§4 for provenance and the per-slot
        decisions that replaced the previous invented copy here.
      */}
      <section className="bg-parchment px-8 py-24 md:px-16">
        <div className="mx-auto max-w-[760px] space-y-6 font-sans text-[16px] leading-relaxed text-ink/90">
          <p>
            The <strong>South African Orchid Council (SAOC)</strong> is the national coordinating
            body for orchid societies and orchid enthusiasts in South Africa. Established in{' '}
            <strong>1968</strong>, the Council has played a central role for more than half a
            century in promoting the cultivation, hybridisation, conservation and appreciation of
            orchids, while fostering the exchange of knowledge and expertise within the South
            African orchid community.
          </p>
          <p>
            The origins of the SAOC can be traced to <strong>28 July 1968</strong>, when
            representatives of the{' '}
            <strong>
              Cape Orchid Society, Natal Orchid Society, Transvaal Orchid Society and Orchid
              Society of the Northern Transvaal
            </strong>{' '}
            met in Bloemfontein. Recognising the need for cooperation and common standards, the
            societies agreed to establish a national council to promote and coordinate the
            activities and interests of orchid societies throughout South Africa.
          </p>
          <p>
            From its earliest days, the SAOC placed particular emphasis on maintaining high
            standards in orchid judging and exhibition. In September 1968, the first SAOC Award
            Judging by-laws were drafted and{' '}
            <strong>15 people were registered as Accredited SAOC Judges</strong>. A uniform
            national judging system was regarded as important from the outset, providing a
            consistent standard for the assessment and recognition of outstanding orchid plants.
          </p>
          <p>
            Over the decades, the Council has developed into a national network supporting
            orchid societies, growers, exhibitors, breeders, judges and conservationists. Its
            activities encompass{' '}
            <strong>
              education, judging, exhibitions, hybridisation, conservation and the dissemination
              of orchid knowledge
            </strong>
            . The SAOC also provides a national forum through which affiliated societies can
            collaborate and share expertise.
          </p>
          <p>
            The Council&apos;s work is particularly significant in a country with an exceptionally
            diverse indigenous orchid flora. South Africa is home to a remarkable range of
            terrestrial and epiphytic orchids, many of which have specialised habitats and face
            increasing pressures from habitat loss and environmental change. The SAOC therefore
            recognises that the future of orchids depends not only on their successful
            cultivation, but also on understanding, protecting and conserving their natural
            heritage.
          </p>
          <p>
            Through its affiliated societies, national shows, judging programmes, publications,
            educational initiatives and partnerships with orchid enthusiasts and conservation
            organisations, the SAOC continues to promote a deeper understanding and appreciation
            of orchids.
          </p>
          <p>
            Today, the South African Orchid Council remains committed to the principles upon
            which it was founded in 1968:{' '}
            <strong>
              bringing orchid enthusiasts together, sharing knowledge, encouraging excellence in
              cultivation and exhibition, and ensuring that South Africa&apos;s extraordinary
              orchid heritage is valued and conserved for future generations.
            </strong>
          </p>
        </div>
      </section>

      {/* Heritage stats — 4 facts stated in content.md, see golden §4 */}
      <section className="bg-bone px-8 py-16 md:px-16">
        <dl className="mx-auto grid max-w-[1280px] grid-cols-2 gap-x-8 gap-y-8 border-y border-rule py-10 sm:grid-cols-4">
          {HERITAGE_STATS.map((stat) => (
            <div key={stat.label}>
              <dt className="font-serif text-[clamp(24px,2.6vw,38px)] font-medium leading-none text-primary">
                {stat.value}
              </dt>
              <dd className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                {stat.label}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <PhotoBand
        image="/images/orchid-pink.jpg"
        alt="Pink orchid in bloom"
        caption="Est. 1968 · Bloemfontein"
        minHeight="320px"
      />

      {/* Board */}
      <section className="bg-bone px-8 py-24 md:px-16">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-10">
            <div className="mb-3">
              <span className="eyebrow">Our committee</span>
            </div>
            <h2 className="font-serif text-[clamp(30px,3.6vw,44px)] font-medium leading-[1.1] tracking-[-0.01em] text-primary">
              The national committee
            </h2>
          </div>
          {about?.boardIntroText ? (
            <p className="mb-8 max-w-3xl font-sans text-[16px] leading-relaxed text-ink/80">
              {about.boardIntroText}
            </p>
          ) : (
            <p className="mb-8 max-w-3xl font-sans text-[16px] leading-relaxed text-ink/80">
              SAOC is run by a national committee elected from its affiliated societies,
              overseeing judging, shows, publications and the council&apos;s day-to-day affairs.
            </p>
          )}
          <BoardGrid members={boardForGrid} />
        </div>
      </section>

      {/* WOSA partnership note — static, no schema field */}
      <section className="bg-parchment px-8 py-16 md:px-16">
        <div className="mx-auto max-w-[1280px] border-t border-rule pt-10">
          <p className="max-w-3xl font-sans text-[15px] leading-relaxed text-ink/70">
            SAOC focuses on orchids in cultivation. For wild orchid identification, habitat,
            and conservation, visit our partner organisation{' '}
            <a
              href="https://wildorchids.co.za"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-link"
            >
              Wild Orchids of Southern Africa (WOSA)
            </a>
            .
          </p>
        </div>
      </section>

      <CTASection
        eyebrow="Get involved"
        heading="Find your society, join the council's work"
        body="SAOC is a federation of 21 independent orchid societies. Find one near you, or get in touch with the national committee directly."
        primaryCta={{ href: '/societies', label: 'Find a society' }}
        secondaryCta={{ href: '/contact', label: 'Contact SAOC' }}
      />
    </>
  );
}
