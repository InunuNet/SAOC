import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHero } from '@/components/ui/PageHero';
import {
  EntryFormLink,
  ExhibitorKeyDates,
  ExhibitorQuestions,
  ExhibitorSection,
  ExhibitorSteps,
} from '@/components/show';
import { sanityFetch } from '@/sanity/lib/fetch';
import { showExhibitorInfoQuery, showExhibitorStepsQuery } from '@/sanity/queries';
import type { ShowExhibitorInfo, ShowExhibitorStep } from '@/types';

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

  return {
    title: `${info?.title ?? 'Exhibitor Information'} — National Orchid Show`,
    description:
      'Entering plants in the South African National Orchid Show: how entry works, what is ' +
      'still to be confirmed by the show committee, and the questions we are asking them.',
  };
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

export default async function ExhibitorInfoPage() {
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

  return (
    <>
      <PageHero
        image="/images/orchid-purple.jpg"
        eyebrow="National Show"
        heading={info?.title ?? 'Exhibitor Information'}
        lede={info?.intro ?? undefined}
      />

      <div className="mx-auto max-w-[1280px] space-y-12 px-8 py-16">
        <p>
          <Link
            href="/national-show"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted transition-colors duration-150 hover:text-ink"
          >
            ← Show overview
          </Link>
        </p>

        <ExhibitorKeyDates
          heading={info?.keyDatesHeading}
          note={info?.keyDatesNote}
          caption={info?.keyDatesCaption}
          rows={info?.keyDates}
          pendingLabel={pendingLabel}
          researchLabel={researchLabel}
          questionLabel={questionLabel}
        />

        <EntryFormLink
          heading={info?.entryFormHeading}
          fileUrl={info?.entryFormFileUrl}
          fileName={info?.entryFormFileName}
          url={info?.entryFormUrl}
          entryFormPendingNote={info?.entryFormPendingNote}
          status={status.entryForm}
          pendingLabel={pendingLabel}
          researchLabel={researchLabel}
          questionLabel={questionLabel}
        />

        <ExhibitorSteps
          heading="From deciding to enter, to taking your plants home"
          steps={steps}
          pendingLabel={pendingLabel}
          researchLabel={researchLabel}
          questionLabel={questionLabel}
        />

        <div className="space-y-10">
          {REFERENCE_SECTIONS.map((name) => (
            <ExhibitorSection
              key={name}
              section={info?.[name]}
              status={status[name]}
              pendingLabel={pendingLabel}
              researchLabel={researchLabel}
              questionLabel={questionLabel}
            >
              {name === 'classes' ? (
                <p className="mt-4">
                  <Link
                    href="/national-show"
                    className="font-sans text-[15px] font-medium text-primary underline underline-offset-4"
                  >
                    {info?.classesLinkLabel ?? 'Show classes'} →
                  </Link>
                </p>
              ) : null}
              {name === 'judging' ? (
                <p className="mt-4">
                  <Link
                    href="/judging"
                    className="font-sans text-[15px] font-medium text-primary underline underline-offset-4"
                  >
                    {info?.judgingLinkLabel ?? 'SAOC judging standards'} →
                  </Link>
                </p>
              ) : null}
              {name === 'permits' ? (
                <p className="mt-4">
                  <a
                    href="https://wildorchids.co.za"
                    rel="noopener noreferrer"
                    className="font-sans text-[15px] font-medium text-primary underline underline-offset-4"
                  >
                    Wild Orchids of Southern Africa →
                  </a>
                </p>
              ) : null}
            </ExhibitorSection>
          ))}
        </div>

        <ExhibitorQuestions
          heading={info?.questionsHeading}
          intro={info?.questionsIntro}
          questions={info?.openQuestions}
        />

        <section className="border-t border-rule pt-8">
          {info?.contactNote ? (
            <p className="max-w-3xl font-sans text-[16px] leading-relaxed text-ink/80">
              {info.contactNote}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-4">
            <Link
              href="/contact"
              className="bg-primary px-6 py-3 font-sans text-[14px] font-medium text-ivory transition-colors duration-150 hover:bg-primary/85"
            >
              Contact the council
            </Link>
            <Link
              href="/judging"
              className="border border-ink/30 px-6 py-3 font-sans text-[14px] font-medium text-ink transition-colors duration-150 hover:bg-ink/5"
            >
              {info?.judgingLinkLabel ?? 'SAOC judging standards'}
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
