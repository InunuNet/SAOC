import type { Metadata } from 'next';
import Link from 'next/link';

import type { NavLeaf } from '@/components/chrome/nav-config';
import { NOS_NAV } from '@/components/nos-chrome/nos-nav';
import { heroFactsFromShow, NosHero } from '@/components/nos/NosHero';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { loadShowFacts } from '@/lib/data/show-facts';
import { nosPath } from '@/lib/nos-paths';
import { buildPageMetadata } from '@/lib/seo';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// AB-G1 (NOS Design, comms.md 2026-10-25): Lee-Ann's About text (Drive: National Show / About, v1.2),
// published as she wrote it (straight quotes and hyphens included). Do not paraphrase or tighten this
// copy: docs/rules/no-invention.md. The h1 is the nav label (NL-1) and the theme follows it in quotation
// marks; paragraph 1 is the standfirst, 2 to 6 the body and 7 the closing line. Her heading line
// "2027 South African National Orchid Show" is not drawn: the h1 and the theme carry the page. The aside
// is the gateway the brief asks for: nav labels only, read from the show nav.
// Bound CDN staleness to 60s, matching every other CMS-backed route on the site (the facts read Sanity).
export const revalidate = 60;

const PAGE_TITLE = 'About the show';
// The theme, as her second paragraph quotes it, set off in the hero.
const THEME = '\u201cFrom Wild Origins to Cultivated Excellence: The Future of Orchids\u201d';
// Dates and Venue only: S3a turns bright from mid-frame, and a third cell would land on white petal.
const FACTS_LABELS = ['Dates', 'Venue'] as const;
const GATEWAY_IDS = [
  'what-to-expect',
  'plan-your-visit',
  'tickets',
  'symposium',
  'wosa-conference',
  'show-sponsors',
] as const;

const PARAGRAPHS = [
  "The National Orchid Show - Western Cape 2027 is the South African Orchid Council's premier triennial event, bringing together orchid enthusiasts, growers, researchers, conservationists, judges, horticultural professionals and members of the public to celebrate one of the world's most remarkable plant families.",
  "Guided by the theme \"From Wild Origins to Cultivated Excellence: The Future of Orchids,\" the National Show explores the relationship between orchids in their natural habitats and the future of responsible cultivation. As pressures on natural ecosystems continue to increase, understanding how orchids grow, adapt and interact within their environments has never been more important. The knowledge gained through conservation and scientific research provides the foundation for sustainable cultivation, ethical breeding programmes and the long-term future of orchid growing worldwide.",
  "The National Orchid Show will showcase a spectacular display of all the orchids that are submitted for judging and display. There will be specialist plant sales by local and international vendors, educational exhibits, a comprehensive symposium and conference, practical workshops and opportunities to engage with local and international experts.",
  "An important feature of the 2027 programme will be the participation of Wild Orchids of Southern Africa (WOSA). They will hold their annual conference as part of the National Orchid Show. Their involvement reflects the National Orchid Show's commitment to connecting conservation science with horticultural excellence, demonstrating how knowledge gained from orchids in the wild continues to shape responsible cultivation and the future sustainability of the orchid community.",
  "The exhibition will also welcome leading national and international orchid vendors, giving visitors the opportunity to purchase exceptional plants, discover new hybrids and species, and engage directly with some of the world's most respected growers.",
  "The South African Orchid Council is deeply grateful to its headline sponsors and donors, whose generous support has made it possible to present a National Show of this scale and significance.",
  "Whether you are an experienced orchid grower, a passionate gardener, a researcher, or simply discovering orchids for the first time, the National Orchid Show - Western Cape 2027 offers an inspiring opportunity to experience the extraordinary beauty, diversity and future potential of orchids.",
];

export const metadata: Metadata = buildPageMetadata({
  title: 'About the Show',
  description:
    "The National Orchid Show - Western Cape 2027 is the South African Orchid Council's premier " +
    'triennial event.',
  path: '/national-show/about',
  image: nosOgImage('About the National Show'),
});

// Every leaf in the nav tree by id (a leaf is any {id, label, href} node).
function collectLeaves(node: unknown, into: Map<string, NavLeaf>): void {
  if (!node || typeof node !== 'object') return;
  // Narrowing an arbitrary nav node to a string-keyed record; the typeof checks below guard every read.
  const record = node as Record<string, unknown>;
  if (
    typeof record.id === 'string' &&
    typeof record.label === 'string' &&
    typeof record.href === 'string' &&
    !into.has(record.id)
  ) {
    into.set(record.id, { id: record.id, label: record.label, href: record.href });
  }
  for (const value of Object.values(record)) collectLeaves(value, into);
}

const GATEWAY: readonly NavLeaf[] = (() => {
  const leaves = new Map<string, NavLeaf>();
  collectLeaves(NOS_NAV, leaves);
  return GATEWAY_IDS.map((id) => {
    const leaf = leaves.get(id);
    if (!leaf) throw new Error(`About: the show nav has no leaf "${id}"`);
    return leaf;
  });
})();

const [STANDFIRST, ...REST] = PARAGRAPHS;
const BODY = REST.slice(0, -1);
const CLOSING = REST[REST.length - 1];

export default async function NationalShowAboutPage() {
  const showFacts = await loadShowFacts();

  return (
    <>
      <NosHero
        route="/national-show/about"
        title={PAGE_TITLE}
        crumbLabel={PAGE_TITLE}
        lede={THEME}
        ledeKind="theme"
        facts={heroFactsFromShow(showFacts, FACTS_LABELS)}
        className="nos-hero-about"
        priority
      />

      <DocumentLayout
        asideBare
        aside={
          <nav aria-label="Around the show" className="nos-ab-gateway">
            <ul>
              {GATEWAY.map((leaf) => (
                <li key={leaf.id}>
                  <Link href={nosPath(leaf.href)}>
                    {leaf.label}
                    <span aria-hidden="true">&rarr;</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        }
      >
        <div className="doc-prose nos-ab-main">
          <p className="doc-standfirst">{STANDFIRST}</p>
          {BODY.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <p className="nos-ab-closing">{CLOSING}</p>
        </div>
      </DocumentLayout>
      <NosShowIndex current="/national-show/about" />
    </>
  );
}
