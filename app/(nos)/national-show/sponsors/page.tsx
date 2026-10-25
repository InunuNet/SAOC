import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/nos/Button';
import { heroFactsFromShow, NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { loadShowFacts } from '@/lib/data/show-facts';
import { nosPath } from '@/lib/nos-paths';
import { buildPageMetadata } from '@/lib/seo';
import { sanityFetch } from '@/sanity/lib/fetch';
import { urlFor } from '@/sanity/lib/image';
import { showSponsorsQuery } from '@/sanity/queries';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// NOS Design golden SP-1 (comms.md, 2026-10-25): hero, a 7/5 body with one sticky contact card, a
// photo strip, then the sponsor wall. Own data scope: showSponsor, never the site-level `sponsor`
// type (F14, national-show-ia-alignment M4: the two lists must be able to diverge).
//
// Every string is sourced (R7): the lede is the page's own; the standfirst is What to Expect v1.0;
// the theme heading and prose are About v1.2; the reach rows are the nav labels with What to Expect
// sentences; the two questions are FAQ v1.0 Q80 and Q81 as written, including Q81's missing full
// stop; the contact is Lee-Ann's FAQ address (D-SP1). No tier names and no package text until the
// prospectus is supplied (D-SP2).
export const revalidate = 60;

const NO_SPONSORS_YET = 'No Show sponsors have been confirmed for 2027 yet.';
const SPONSORSHIP_EMAIL = '2027national@gmail.com';
const SPONSORSHIP_MAILTO = `mailto:${SPONSORSHIP_EMAIL}`;
const CTA_LABEL = 'Talk to us about sponsorship';
const FACTS_LABELS = ['Dates', 'Venue', 'Host'] as const;

const LEDE = 'Recognising the headline and supporting sponsors and donors of The National Orchid Show.';
const STANDFIRST =
  'The 2027 National Show is made possible through the generous support of our headline sponsors, donors and partners, whose commitment to horticulture, conservation, education and scientific advancement enables the South African Orchid Council to present a truly world-class event.';
const THEME_HEADING = 'From Wild Origins to Cultivated Excellence: The Future of Orchids';
const THEME_PROSE =
  'The National Orchid Show will showcase a spectacular display of all the orchids that are submitted for judging and display. There will be specialist plant sales by local and international vendors, educational exhibits, a comprehensive symposium and conference, practical workshops and opportunities to engage with local and international experts.';
const WALL_THANKS =
  'The South African Orchid Council is deeply grateful to its headline sponsors and donors, whose generous support has made it possible to present a National Show of this scale and significance.';
const CARD_SENTENCE =
  'The sponsorship prospectus, packages, benefits and contact details can be sent via email.';

const REACH = [
  {
    href: '/national-show/symposium',
    title: 'SAOC Symposium',
    text: 'The National Show Symposium will feature an outstanding programme of presentations by respected local and international speakers covering orchid cultivation, breeding, conservation, taxonomy, judging, sustainability and emerging scientific research.',
  },
  {
    href: '/national-show/wosa-conference',
    title: 'WOSA Conference',
    text: 'A Conference held by Wild Orchids Southern Africa (WOSA) will highlight the ecology and conservation of indigenous orchids, illustrating how research undertaken in natural habitats continues to influence cultivation practices, breeding programmes and the long-term future of orchids.',
  },
  {
    href: '/national-show/vendors',
    title: 'Exhibitors and vendors',
    text: 'Browse the extensive plant sales area, where specialist nurseries from across South Africa will be joined by selected international orchid vendors, offering an exceptional range of orchid species, hybrids, companion plants, growing media and specialist supplies.',
  },
] as const;

// The photo strip: three originals at the golden's object-positions (the signed-off crops ship in
// the .ihero step).
const STRIP = [
  { src: '/images/orchid-dark.jpg', position: '12% 48%' },
  { src: '/images/orchid-yellow.jpg', position: '40% 45%' },
  { src: '/images/orchid-violet.jpg', position: '8% 30%' },
] as const;

// Sponsorship levels, highest first (showSponsor.tier options). An unlisted level sorts after.
const TIER_ORDER = ['Title', 'Gold', 'Silver', 'Supporting'] as const;
const HEADLINE_TIER = TIER_ORDER[0];
const NO_TIER_LABEL = 'Sponsors';

interface WallSponsor {
  _id: string;
  name: string;
  tier?: string | null;
  logo?: { asset?: { _ref?: string } } | null;
  website?: string | null;
}

interface TierGroup {
  tier: string;
  sponsors: WallSponsor[];
}

function tierRank(tier: string): number {
  const rank = (TIER_ORDER as readonly string[]).indexOf(tier);
  return rank === -1 ? TIER_ORDER.length : rank;
}

function groupByTier(sponsors: readonly WallSponsor[]): TierGroup[] {
  const groups = new Map<string, WallSponsor[]>();
  for (const sponsor of sponsors) {
    const tier = sponsor.tier || NO_TIER_LABEL;
    groups.set(tier, [...(groups.get(tier) ?? []), sponsor]);
  }
  return [...groups.entries()]
    .map(([tier, members]) => ({ tier, sponsors: members }))
    .sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function SponsorTile({ sponsor, large }: { sponsor: WallSponsor; large: boolean }) {
  const logoUrl = sponsor.logo?.asset ? urlFor(sponsor.logo).width(480).url() : null;
  const body = (
    <>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Sanity CDN, sized by the tile
        <img src={logoUrl} alt="" className="nos-sp-tile-logo" />
      ) : null}
      <span className="nos-sp-tile-name">{sponsor.name}</span>
    </>
  );
  const className = `nos-sp-tile${large ? ' nos-sp-tile-large' : ''}`;
  return sponsor.website ? (
    <a href={sponsor.website} rel="noopener" className={className}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}

// The description is under 70 chars. While there are no sponsors the page's only sentence is
// NO_SPONSORS_YET, so that is the lede it is cut back to; once sponsors are listed it is not.
export async function generateMetadata(): Promise<Metadata> {
  const sponsors = await sanityFetch<WallSponsor[]>({
    query: showSponsorsQuery,
    tags: ['showSponsor', 'sanity'],
  });

  return buildPageMetadata({
    title: 'Sponsors',
    image: nosOgImage('Sponsors — National Orchid Show'),
    description: "The National Orchid Show's own sponsors.",
    lede: (sponsors ?? []).length === 0 ? NO_SPONSORS_YET : undefined,
    path: '/national-show/sponsors',
  });
}

export default async function ShowSponsorsPage() {
  const [sponsors, showFacts] = await Promise.all([
    sanityFetch<WallSponsor[]>({ query: showSponsorsQuery, tags: ['showSponsor', 'sanity'] }),
    loadShowFacts(),
  ]);
  const groups = groupByTier(sponsors ?? []);

  return (
    <>
      <NosHero
        route="/national-show/sponsors"
        title="Sponsors"
        lede={LEDE}
        facts={heroFactsFromShow(showFacts, FACTS_LABELS)}
        actions={
          <Button as="a" href={SPONSORSHIP_MAILTO} variant="on-dark" className="nos-sp-hero-cta">
            {CTA_LABEL}
            <Arrow />
          </Button>
        }
        priority
      />

      <DocumentLayout
        aside={
          <div data-sp-card="" className="nos-sp-card">
            <h2 className="nos-sp-card-title">{CTA_LABEL}</h2>
            <p>{CARD_SENTENCE}</p>
            <div className="nos-sp-who">
              <span>Lee-Ann, organising committee</span>
              <a href={SPONSORSHIP_MAILTO} className="nos-sp-mail">
                {SPONSORSHIP_EMAIL}
              </a>
            </div>
            <Button as="a" href={SPONSORSHIP_MAILTO} className="nos-sp-card-cta">
              {CTA_LABEL}
              <Arrow />
            </Button>
          </div>
        }
      >
        <div className="doc-prose nos-sp-main">
          <p className="doc-standfirst">{STANDFIRST}</p>

          <section className="doc-section" aria-labelledby="sp-theme">
            <h2 id="sp-theme" className="doc-h2">
              {THEME_HEADING}
            </h2>
            <p>{THEME_PROSE}</p>
            <ul className="nos-sp-reach">
              {REACH.map(({ href, title, text }) => (
                <li key={href}>
                  <Link href={nosPath(href)}>
                    <h3>{title}</h3>
                    <p>{text}</p>
                    <span className="nos-sp-go" aria-hidden="true">
                      <Arrow />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="doc-section" aria-labelledby="sp-become">
            <h2 id="sp-become" className="doc-h2">
              Become a sponsor
            </h2>
            <div className="nos-sp-qa">
              <div>
                <h3>How can a business sponsor the Show?</h3>
                <p>
                  Businesses interested in supporting the National Orchid Show should contact the
                  organising committee for sponsorship opportunities. The sponsorship prospectus,
                  packages, benefits and contact details can be sent via email. Contact Lee-Ann at{' '}
                  <a href={SPONSORSHIP_MAILTO}>{SPONSORSHIP_EMAIL}</a>.
                </p>
              </div>
              <div>
                <h3>Can a company donate money or products?</h3>
                <p>
                  Yes, sponsorship and donations can be explored with the organising committee.
                  Email Lee-Ann at <a href={SPONSORSHIP_MAILTO}>{SPONSORSHIP_EMAIL}</a>
                </p>
              </div>
            </div>
          </section>
        </div>
      </DocumentLayout>

      <div className="nos-sp-strip" aria-hidden="true">
        <div data-nos-wrap="">
          <ul>
            {STRIP.map(({ src, position }) => (
              <li key={src}>
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 40vw, 100vw"
                  style={{ objectPosition: position }}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <NosSection tone="gold" aria-labelledby="sp-wall-title">
        <div className="nos-sp-wall-head">
          <h2 id="sp-wall-title" className="doc-h2">
            Show sponsors
          </h2>
          <p>{WALL_THANKS}</p>
        </div>
        {groups.length === 0 ? (
          <div className="nos-sp-empty" data-nos-empty-state="sponsors">
            <Image src="/images/Eulophia-speciosa-emblem.png" alt="" width={88} height={88} />
            <p>{NO_SPONSORS_YET}</p>
            <Button as="a" href={SPONSORSHIP_MAILTO}>
              {CTA_LABEL}
              <Arrow />
            </Button>
          </div>
        ) : (
          groups.map(({ tier, sponsors: members }) => (
            <div key={tier} className="nos-sp-tier">
              <h3>{tier}</h3>
              <ul data-sp-tier={tier === HEADLINE_TIER ? 'headline' : 'level'}>
                {members.map((sponsor) => (
                  <li key={sponsor._id}>
                    <SponsorTile sponsor={sponsor} large={tier === HEADLINE_TIER} />
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </NosSection>
      <NosShowIndex current="/national-show/sponsors" />
    </>
  );
}
