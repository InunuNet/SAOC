import type { Metadata } from 'next';
import Link from 'next/link';

import type { NavLeaf } from '@/components/chrome/nav-config';
import { NOS_NAV } from '@/components/nos-chrome/nos-nav';
import { heroFactsFromShow, NosHero } from '@/components/nos/NosHero';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { loadShowFacts } from '@/lib/data/show-facts';
import { NOS_CONTACT_PATH, nosPath } from '@/lib/nos-paths';
import { buildPageMetadata } from '@/lib/seo';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// Bound CDN staleness to 60s, matching every other CMS-backed route on the site.
export const revalidate = 60;

// EX-G1 (NOS Design, comms.md): the exhibitor entry guide is Lee-Ann's FAQ section 4 (Orchid displays,
// judging and awards), published as she wrote it, typos included (docs/rules/no-invention.md): the
// answer to FAQ 26 is the standfirst and FAQ 25, 27, 28 and 30 follow as four questions in her order.
// FAQ 29 (photography) lives on What to expect. Her own entry guide (schedule, classes, entry form)
// is still owed (owner item iiii); the Sanity showExhibitorInfo and showExhibitorStep schemas stay
// in place for when it arrives. The gateway beside the text is nav labels only.
const PAGE_TITLE = 'Plant Entry/Registration';
const FACTS_LABELS = ['Dates', 'Venue'] as const;
const GATEWAY_LABEL = 'More for exhibitors';
const GATEWAY_IDS = ['programme', 'vendors', 'international-guests', 'faq'] as const;
const CONTACT_LABEL = 'Contact';

const STANDFIRST = [
  'All South African Orchid Council members who’s subscriptions are valid may enter orchids for judging. If you are unsure, please check with your society.',
];

const QUESTIONS = [
  {
    question: 'Will the orchids be judged?',
    paragraphs: [
      'Yes. Judging and awards form part of the National Orchid Show, recognising outstanding orchids and exhibitors.',
    ],
  },
  {
    question: 'Can orchid societies create their own displays?',
    paragraphs: [
      'All submitted orchids will be placed in the Show display. Regional Societies may also have their own displays by booking a stand. They will also be able to sell society plants on behalf of their members.',
    ],
  },
  {
    question: 'When can exhibitors set up their displays?',
    paragraphs: [
      'The venue access period currently planned for the organisers is 21 September 2027 at 09:00 to 27 September 2027 at 16:00. The specific exhibitor setup, judging, public opening and dismantling times are published in the programme and will also be sent via email.',
    ],
  },
  {
    question: 'Will prize-winning orchids be identified?',
    paragraphs: ['Yes, they will be identified and displayed prominently.'],
  },
];

export const metadata: Metadata = buildPageMetadata({
  title: PAGE_TITLE,
  image: nosOgImage(`${PAGE_TITLE} — National Orchid Show`),
  description: STANDFIRST[0],
  path: '/national-show/exhibitors',
});

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
  const linked = GATEWAY_IDS.map((id) => {
    const leaf = leaves.get(id);
    if (!leaf) throw new Error(`Exhibitors: the show nav has no leaf "${id}"`);
    return leaf;
  });
  return [...linked, { id: 'contact', label: CONTACT_LABEL, href: NOS_CONTACT_PATH }];
})();

export default async function ExhibitorEntryGuidePage() {
  const showFacts = await loadShowFacts();

  return (
    <>
      <NosHero
        route="/national-show/exhibitors"
        title={PAGE_TITLE}
        crumbLabel={PAGE_TITLE}
        facts={heroFactsFromShow(showFacts, FACTS_LABELS)}
        priority
      />

      <DocumentLayout
        asideBare
        aside={
          <nav aria-label={GATEWAY_LABEL} className="nos-ab-gateway">
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
        {STANDFIRST.map((paragraph) => (
          <p key={paragraph} className="doc-standfirst nos-ex-standfirst">
            {paragraph}
          </p>
        ))}
        <div data-qa-list="" className="nos-ex-qa">
          {QUESTIONS.map((item) => (
            <section key={item.question} data-qa-item="">
              <h2 className="doc-h2 nos-ex-q">{item.question}</h2>
              {item.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </DocumentLayout>
      <NosShowIndex current="/national-show/exhibitors" />
    </>
  );
}
