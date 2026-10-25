// =============================================================
// SAOC — components/show/ShowFaqList.tsx
// Server Component — groups showFaq documents by category and renders each answer in
// a NATIVE <details>/<summary> disclosure.
//
// Native, and asserted to stay native, for four reasons a hand-rolled accordion gets
// wrong by default: it is keyboard-operable without any JS, it is announced correctly
// by screen readers, it works with JavaScript disabled, and — the one that matters for
// a council document — the answer text is in the DOM even while collapsed, so the page
// prints and in-page browser search finds it.
//
// Section order, titles and introductions are Lee-Ann's: lib/data/faq-sections.ts is the one source.
// Her numbering is rendered: a category reads "3. Getting to the venue and accessibility", a question
// "18. Where is the venue?". An unrecognised category coming back from Sanity is appended under the
// first section rather than silently dropped.
//
// nos-content-standard (FAQ-NAV): one section per category, its h2 above ONE warm card holding the
// category's rows with hairline dividers. The category index is the page's DocumentLayout aside
// (faqIndexEntries), never a chip row, and nothing here announces which answers are unconfirmed
// before the first category.
// =============================================================

import { PortableText } from '@portabletext/react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { FAQ_SECTIONS, type FaqSection } from '@/lib/data/faq-sections';
import { nosPath } from '@/lib/nos-paths';
import type { ShowFaq } from '@/types';

import { ConfirmationBadge } from './ConfirmationBadge';

const FALLBACK_SECTION_ID = FAQ_SECTIONS[0].id;

// Her section 10 sentence names the website's "Plan your visit" tab; the page links that name.
const PLAN_YOUR_VISIT_NAME = 'Plan your visit';
const PLAN_YOUR_VISIT_HREF = '/national-show/plan-your-visit';

// An introduction paragraph with the Plan your visit tab name drawn as a link, the text unchanged.
function introWithLinks(paragraph: string): ReactNode {
  const at = paragraph.indexOf(PLAN_YOUR_VISIT_NAME);
  if (at === -1) return paragraph;
  return (
    <>
      {paragraph.slice(0, at)}
      <Link href={nosPath(PLAN_YOUR_VISIT_HREF)}>{PLAN_YOUR_VISIT_NAME}</Link>
      {paragraph.slice(at + PLAN_YOUR_VISIT_NAME.length)}
    </>
  );
}

function categoryOf(faq: ShowFaq): string {
  const category = faq.category;
  return category && FAQ_SECTIONS.some((section) => section.id === category)
    ? category
    : FALLBACK_SECTION_ID;
}

/** A question carries an answer when its portable text has at least one block. */
export function hasFaqAnswer(faq: ShowFaq): boolean {
  return Array.isArray(faq.answer) && faq.answer.length > 0;
}

export interface FaqGroup {
  section: FaqSection;
  /** Her heading: the category's number in her document, then its title. */
  heading: string;
  /** Her number for the category ("3.") and the title it numbers, drawn as separate spans. */
  number: string;
  title: string;
  /** The h2 id, `faq-<n>-h`; its section is `faq-<n>`. */
  id: string;
  inCategory: ShowFaq[];
}

/**
 * The categories the page draws, in her order. A category with no question is still drawn when she
 * gave it an introduction (her section 10).
 */
export function faqGroups(faqs: ShowFaq[] | null | undefined, hideUnanswered = false): FaqGroup[] {
  const entries = (faqs ?? []).filter(
    (faq) => faq?.question && (!hideUnanswered || hasFaqAnswer(faq))
  );
  return FAQ_SECTIONS.map((section, position) => ({
    section,
    heading: `${position + 1}. ${section.title}`,
    number: `${position + 1}.`,
    title: section.title,
    id: `faq-${position + 1}-h`,
    inCategory: entries.filter((faq) => categoryOf(faq) === section.id),
  })).filter(({ section, inCategory }) => inCategory.length > 0 || section.intro.length > 0);
}

/** The DocumentLayout index entries for the groups: one link per category h2. */
export function faqIndexEntries(groups: readonly FaqGroup[]): { id: string; label: string }[] {
  return groups.map(({ id, heading }) => ({ id, label: heading }));
}

export interface ShowFaqListProps {
  faqs?: ShowFaq[] | null;
  pendingLabel?: string | null;
  researchLabel?: string | null;
  /**
   * R77 #2 (F18): a question with no answer renders no row at all. The route passes
   * `withholdPlaceholderProse()`, so beta keeps every row with its marker and a public build
   * shows only what the Council has answered.
   */
  hideUnanswered?: boolean;
}

export function ShowFaqList({
  faqs,
  pendingLabel,
  researchLabel,
  hideUnanswered = false,
}: ShowFaqListProps) {
  const groups = faqGroups(faqs, hideUnanswered);
  if (groups.length === 0) return null;

  return (
    <>
      {groups.map(({ section, number, title, id, inCategory }, groupIndex) => (
        <section
          key={section.id}
          id={id.replace(/-h$/, '')}
          className="doc-section"
          aria-labelledby={id}
        >
          <h2 id={id} className="doc-h2 nos-faq-h2">
            <span className="nos-faq-num">{number}</span>
            <span>{title}</span>
          </h2>
          {inCategory.length > 0
            ? section.intro.map((paragraph) => (
                <p key={paragraph} className="nos-faq-intro">
                  {introWithLinks(paragraph)}
                </p>
              ))
            : null}

          <div data-faq-card="" className="nos-faq-card">
            {inCategory.length === 0
              ? section.intro.map((paragraph) => (
                  <p key={paragraph} className="nos-faq-intro nos-faq-intro-only">
                    {introWithLinks(paragraph)}
                  </p>
                ))
              : null}
            {inCategory.length > 0 ? (
              <ul>
                {inCategory.map((faq, rowIndex) => (
                  <li key={faq._id}>
                    <details open={groupIndex === 0 && rowIndex === 0 ? true : undefined}>
                      <summary data-faq-summary="" className="nos-faq-summary">
                        <span data-faq-number="" className="nos-faq-qn">
                          {typeof faq.order === 'number' ? `${faq.order}.` : ''}
                        </span>
                        <span data-faq-question="" className="nos-faq-question">
                          {faq.question}
                        </span>
                        <span data-faq-icon="" aria-hidden="true" className="nos-faq-icon">
                          <svg
                            viewBox="0 0 20 20"
                            width="20"
                            height="20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                          >
                            <path d="M3 10h14" />
                            <path className="nos-faq-icon-v" d="M10 3v14" />
                          </svg>
                        </span>
                      </summary>

                      <div className="nos-faq-answer">
                        {/* The marker sits in the answer panel, not the summary: a marker in the summary
                            is part of every accessible name and doubles the row's height at 390. */}
                        {hideUnanswered ? null : (
                          <ConfirmationBadge
                            status={faq.status}
                            pendingLabel={pendingLabel}
                            researchLabel={researchLabel}
                          />
                        )}
                        {hasFaqAnswer(faq) ? (
                          <div className="doc-prose">
                            <PortableText value={faq.answer ?? []} />
                          </div>
                        ) : null}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ))}
    </>
  );
}
