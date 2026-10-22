import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';

import {
  EntryFormLink,
  ExhibitorJumpNav,
  ExhibitorKeyDates,
  ExhibitorQuestions,
  ExhibitorSection,
  ExhibitorSteps,
  ShowStatusFoot,
  ShowStatusLine,
} from '@/components/show';
import { Badge } from '@/components/nos/Badge';
import { Button } from '@/components/nos/Button';
import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { sanityFetch } from '@/sanity/lib/fetch';
import { showExhibitorInfoQuery, showExhibitorStepsQuery } from '@/sanity/queries';
import { buildPageMetadata } from '@/lib/seo';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import type { ShowExhibitorInfo, ShowExhibitorStep } from '@/types';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { saocUrl } from '@/lib/site-hosts';

// Bound CDN staleness to 60s, matching every other CMS-backed route on the site.
export const revalidate = 60;

// Everything visible on this page is Sanity-driven; the metadata used to hardcode "19th
// National Orchid Show", which goes stale at the 20th in the one place nobody looks. The
// title now comes from the same singleton the page renders, and the edition is not
// restated here at all — /national-show owns the show's identity.
export async function generateMetadata(): Promise<Metadata> {
  const info = await sanityFetch<ShowExhibitorInfo>({
    query: showExhibitorInfoQuery,
    tags: ['showExhibitorInfo', 'sanity'],
  });

  return buildPageMetadata({
    title: info?.title ?? 'Exhibitor information',
    image: nosOgImage(`${info?.title ?? 'Exhibitor information'} — National Orchid Show`),
    description: ENTRIES_NOT_OPEN,
    path: '/national-show/exhibitors',
  });
}

// Section order is the exhibitor's own sequence, not the schema's: someone arriving here
// is checking a deadline, not reading an essay. Key dates come first for that reason.
// The nine reference sections follow the journey, in the order the research groups them.
// See contracts/golden/show-exhibitor-info/exhibitor-page-map.golden.md.
const REFERENCE_SECTIONS = [
  'entryProcess',
  'fees',
  'classes',
  'judging',
  'eligibility',
  'display',
  'sales',
  'practicalities',
  'permits',
] as const;

const CONTACT_LABEL = 'Contact the council';
// NOS Design (Codi) ruling 2026-10-17: the status list names the steps section as "steps".
const STEPS_LIST_LABEL = 'steps';
const ENTRIES_NOT_OPEN =
  'Exhibitor entries are not yet open — this page covers what to expect when they do. Contact the council to be notified.';

type Marker = 'pending' | 'research' | 'question';

// The marker StatusMarker would draw for a status; confirmed draws none and anything
// unrecognised falls to pending, the same fail-closed rule.
function markerOf(status?: string | null): Marker | null {
  if (status === 'confirmed') return null;
  return status === 'research' || status === 'question' ? status : 'pending';
}

// A sentence ends at . ! or ? (plus any closing quote or bracket) followed by whitespace.
const SENTENCE_BOUNDARY = /[.!?]["'\u201d\u2019)\]]*\s/g;
// A full stop after one of these honorifics never ends a sentence (etc., vs., no., e.g. and
// i.e. can, so they are not listed).
const ABBREVIATIONS = ['dr', 'mr', 'mrs', 'ms', 'prof', 'st'];

// A public build leads with the intro's first sentence only; the committee provenance that
// follows is preview material. Fails closed: with no boundary found there is no lede at all,
// never the whole intro.
function firstSentence(text: string): string | undefined {
  for (const boundary of text.matchAll(SENTENCE_BOUNDARY)) {
    const word = /([A-Za-z.]+)$/.exec(text.slice(0, boundary.index))?.[1]?.toLowerCase();
    if (boundary[0].startsWith('.') && word && ABBREVIATIONS.includes(word)) continue;
    return text.slice(0, boundary.index + boundary[0].trimEnd().length);
  }
  return undefined;
}

export default async function ExhibitorInfoPage() {
  // The public-versus-preview switch reads the environment, so this page renders per request
  // rather than being frozen at build time with whichever setting the build happened to have.
  await connection();
  const [info, steps] = await Promise.all([
    sanityFetch<ShowExhibitorInfo>({
      query: showExhibitorInfoQuery,
      tags: ['showExhibitorInfo', 'sanity'],
    }),
    sanityFetch<ShowExhibitorStep[]>({
      query: showExhibitorStepsQuery,
      tags: ['showExhibitorStep', 'sanity'],
    }),
  ]);

  const pendingLabel = info?.pendingLabel;
  const researchLabel = info?.researchLabel;
  const questionLabel = info?.questionLabel;
  const status = info?.confirmations ?? {};

  // Public build: rows carrying an open-question marker are not rendered, and the research and
  // pending chips collapse into one line each under the banner (R11). Preview keeps every marker.
  const publicMode = withholdPlaceholderProse();
  const keyDates = (info?.keyDates ?? []).filter(
    (row) => row?.label && !(publicMode && markerOf(row.status) === 'question')
  );
  const journey = (steps ?? []).filter(
    (step) => step?.title && !(publicMode && markerOf(step.status) === 'question')
  );
  const sections = REFERENCE_SECTIONS.filter((name) => {
    const section = info?.[name];
    const renders = !!section?.heading || (section?.body ?? []).length > 0;
    return renders && !(publicMode && markerOf(status[name]) === 'question');
  });
  const openQuestions = (info?.openQuestions ?? []).filter((item) => item?.question);
  const questionsShown = !publicMode && openQuestions.length > 0;
  const entryFormStatus = status.entryForm;
  const entryFormShown = !(publicMode && markerOf(entryFormStatus) === 'question');

  const stepsHeading = 'From deciding to enter, to taking your plants home';
  const chips = [
    keyDates.length > 0 && info?.keyDatesHeading
      ? { href: '#exhibitor-key-dates', label: info.keyDatesHeading }
      : null,
    entryFormShown && info?.entryFormHeading
      ? { href: '#exhibitor-entry-form', label: info.entryFormHeading }
      : null,
    journey.length > 0 ? { href: '#exhibitor-steps', label: stepsHeading } : null,
    ...sections.map((name) => {
      const heading = info?.[name]?.heading;
      return heading ? { href: `#exhibitor-${name}`, label: heading } : null;
    }),
    questionsShown && info?.questionsHeading
      ? { href: '#exhibitor-questions', label: info.questionsHeading }
      : null,
  ].filter((chip): chip is { href: string; label: string } => chip !== null);

  // Public build: every row that would have carried a marker, by the heading it carries.
  const covered: { name: string | null | undefined; marker: Marker | null }[] = publicMode
    ? [
        // A group is named by its own heading, once per marker that one of its rows carried.
        ...keyDates.map((row) => ({ name: info?.keyDatesHeading, marker: markerOf(row.status) })),
        ...journey.map((step) => ({ name: STEPS_LIST_LABEL, marker: markerOf(step.status) })),
        ...sections.map((name) => ({
          name: info?.[name]?.heading,
          marker: markerOf(status[name]),
        })),
        { name: entryFormShown ? info?.entryFormHeading : null, marker: markerOf(entryFormStatus) },
      ]
    : [];
  const namesFor = (marker: Marker) => [
    ...new Set(
      covered.filter((row) => row.marker === marker && row.name).map((row) => row.name as string)
    ),
  ];
  const pendingItems = namesFor('pending').map((name, index) =>
    index === 0 ? name : name.toLowerCase()
  );

  const researchFoot = namesFor('research').length > 0 ? (researchLabel ?? undefined) : undefined;
  const contactButton = (
    <p>
      <Button as="a" href={saocUrl('/contact')} variant="primary" className="min-h-[44px]">
        {CONTACT_LABEL}
      </Button>
    </p>
  );

  return (
    <>
      <NosHero
        route="/national-show/exhibitors"
        title={info?.title ?? 'Exhibitor information'}
        lede={publicMode ? firstSentence(info?.intro ?? '') : (info?.intro ?? undefined)}
        priority
      />

      <NosSection wrapClassName="space-y-12 [&_p]:max-w-[60ch]">
        {publicMode && pendingItems.length > 0 ? (
          <ShowStatusLine
            status="pending"
            pendingLabel={pendingLabel}
            items={pendingItems}
            body={ENTRIES_NOT_OPEN}
            foot={researchFoot}
          >
            {contactButton}
          </ShowStatusLine>
        ) : (
          <div className="space-y-4">
            {/* tone="purple" not "olive": olive-deep is 4.30:1 on white/parchment, which fails
                body-text contrast (needs 4.5:1) — see nos-contrast.golden.md note 1. Olive text
                is legal only on dark grounds or as large (≥24px) text. */}
            <Badge tone="purple" className="normal-case">
              <span aria-hidden="true">※</span>
              <span className="normal-case tracking-[0.02em]">{ENTRIES_NOT_OPEN}</span>
            </Badge>
            {contactButton}
            {publicMode && researchFoot ? <ShowStatusFoot>{researchFoot}</ShowStatusFoot> : null}
          </div>
        )}

        <ExhibitorJumpNav items={chips} />

        <ExhibitorKeyDates
          heading={info?.keyDatesHeading}
          note={info?.keyDatesNote}
          caption={info?.keyDatesCaption}
          rows={keyDates}
          headingId="exhibitor-key-dates"
          hideMarkers={publicMode}
          pendingLabel={pendingLabel}
          researchLabel={researchLabel}
          questionLabel={questionLabel}
        />

        {entryFormShown ? (
          <EntryFormLink
            heading={info?.entryFormHeading}
            fileUrl={info?.entryFormFileUrl}
            fileName={info?.entryFormFileName}
            url={info?.entryFormUrl}
            entryFormPendingNote={info?.entryFormPendingNote}
            status={entryFormStatus}
            headingId="exhibitor-entry-form"
            hideMarkers={publicMode}
            pendingLabel={pendingLabel}
            researchLabel={researchLabel}
            questionLabel={questionLabel}
          />
        ) : null}

        <ExhibitorSteps
          heading={stepsHeading}
          steps={journey}
          headingId="exhibitor-steps"
          hideMarkers={publicMode}
          pendingLabel={pendingLabel}
          researchLabel={researchLabel}
          questionLabel={questionLabel}
        />

        <div className="space-y-10">
          {sections.map((name) => (
            <ExhibitorSection
              key={name}
              headingId={`exhibitor-${name}`}
              hideMarkers={publicMode}
              section={info?.[name]}
              status={status[name]}
              pendingLabel={pendingLabel}
              researchLabel={researchLabel}
              questionLabel={questionLabel}
            >
              {name === 'classes' ? (
                <p className="mt-4">
                  <Link
                    href="/"
                    className="inline-flex min-h-6 items-center font-sans text-[15px] font-medium text-primary underline underline-offset-4"
                  >
                    {info?.classesLinkLabel ?? 'Show classes'} →
                  </Link>
                </p>
              ) : null}
              {name === 'judging' ? (
                <p className="mt-4">
                  <a
                    href={saocUrl('/judging')}
                    className="inline-flex min-h-6 items-center font-sans text-[15px] font-medium text-primary underline underline-offset-4"
                  >
                    {info?.judgingLinkLabel ?? 'SAOC judging standards'} →
                  </a>
                </p>
              ) : null}
              {name === 'permits' ? (
                <p className="mt-4">
                  <a
                    href="https://wildorchids.co.za"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-6 items-center font-sans text-[15px] font-medium text-primary underline underline-offset-4"
                  >
                    Wild Orchids of Southern Africa →
                  </a>
                </p>
              ) : null}
            </ExhibitorSection>
          ))}
        </div>

        {questionsShown ? (
          <ExhibitorQuestions
            heading={info?.questionsHeading}
            intro={info?.questionsIntro}
            questions={info?.openQuestions}
            headingId="exhibitor-questions"
          />
        ) : null}

        <section className="border-t border-rule pt-8">
          {info?.contactNote ? (
            <p className="max-w-3xl font-sans text-[16px] leading-[1.55] text-ink/80">
              {info.contactNote}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-4">
            <Button as="a" href={saocUrl('/contact')} variant="primary">
              {CONTACT_LABEL}
            </Button>
            <Button as="a" href={saocUrl('/judging')} variant="ghost">
              {info?.judgingLinkLabel ?? 'SAOC judging standards'}
            </Button>
          </div>
        </section>
      </NosSection>
      <NosShowIndex current="/national-show/exhibitors" />
    </>
  );
}
