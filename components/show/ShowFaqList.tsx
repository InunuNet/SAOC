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
// Category display order is presentation, not editor content, so it is the one
// hardcoded list this feature permits. An unrecognised category coming back from Sanity
// is appended under General rather than silently dropped.
//
// R44-A3: a wrapping set of in-page jump chips, one per category that has questions, sits above
// the sections. Chips are built from the same CATEGORY_ORDER / CATEGORY_LABELS as the sections and
// point at each heading's existing `faq-<category>` id. No filter field; no client code.
// =============================================================

import { PortableText } from '@portabletext/react';
import type { ReactNode } from 'react';

import type { ShowFaq } from '@/types';

import { ConfirmationBadge } from './ConfirmationBadge';
import { ShowJumpChips } from './ShowJumpChips';

const CATEGORY_ORDER = [
  'getting-there',
  'tickets',
  'accessibility',
  'plant-sales',
  'general',
] as const;

const CATEGORY_LABELS: Record<(typeof CATEGORY_ORDER)[number], string> = {
  'getting-there': 'Getting there',
  tickets: 'Tickets',
  accessibility: 'Accessibility',
  'plant-sales': 'Plant sales',
  general: 'General',
};

type KnownCategory = (typeof CATEGORY_ORDER)[number];

function categoryOf(faq: ShowFaq): KnownCategory {
  const category = faq.category as KnownCategory | null | undefined;
  return category && CATEGORY_ORDER.includes(category) ? category : 'general';
}

/** A question carries an answer when its portable text has at least one block. */
export function hasFaqAnswer(faq: ShowFaq): boolean {
  return Array.isArray(faq.answer) && faq.answer.length > 0;
}

/**
 * A row whose answer is read from a published source rather than typed in Sanity (keyed by the
 * showFaq _id). `replaces` swaps the Sanity answer for `body`; otherwise `body` follows it. A wired
 * row carries no marker: its source is the page that publishes the fact.
 */
export interface WiredFaq {
  kind: string;
  body: ReactNode;
  // The plain text of `body`'s answer, for the FAQPage node: the same words the row shows.
  text: string;
  replaces: boolean;
}

export interface ShowFaqListProps {
  wired?: Readonly<Record<string, WiredFaq>>;
  faqs?: ShowFaq[] | null;
  pendingLabel?: string | null;
  researchLabel?: string | null;
  /**
   * R77 #2 (F18): a question with no answer renders no row at all. The route passes
   * `withholdPlaceholderProse()`, so beta keeps every row with its chip and a public build
   * shows only what the Council has answered.
   */
  hideUnanswered?: boolean;
}

export function ShowFaqList({
  faqs,
  pendingLabel,
  researchLabel,
  hideUnanswered = false,
  wired = {},
}: ShowFaqListProps) {
  const entries = (faqs ?? []).filter(
    (faq) => faq?.question && (!hideUnanswered || hasFaqAnswer(faq) || Boolean(wired[faq._id]))
  );
  if (entries.length === 0) return null;

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    inCategory: entries.filter((faq) => categoryOf(faq) === category),
  })).filter(({ inCategory }) => inCategory.length > 0);

  return (
    <>
      {groups.length > 1 ? (
        <ShowJumpChips
          label="FAQ categories"
          items={groups.map(({ category }) => ({
            href: `#faq-${category}`,
            label: CATEGORY_LABELS[category],
          }))}
        />
      ) : null}

      <div className="space-y-12">
        {groups.map(({ category, inCategory }) => (
          <section key={category} aria-labelledby={`faq-${category}`}>
            <h2
              id={`faq-${category}`}
              className="nos-label scroll-mt-[62px] font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-accent md:scroll-mt-[74px]"
            >
              {CATEGORY_LABELS[category]}
            </h2>

            <ul className="mt-4 space-y-4">
              {inCategory.map((faq) => (
                <li key={faq._id} className="nos-surface nos-faq-item">
                  <details>
                    <summary
                      data-faq-summary=""
                      className="nos-faq-summary cursor-pointer font-serif font-medium text-[19px] leading-snug text-ink hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring-focus)]"
                    >
                      <span data-faq-question="" className="nos-faq-question">
                        <span>{faq.question}</span>
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
                          <path d="M4 10h12" />
                          <path className="nos-faq-icon-v" d="M10 4v12" />
                        </svg>
                      </span>
                    </summary>

                    <div className="nos-faq-answer">
                      {/* The marker sits in the answer panel, not the summary: a marker in the summary
                          is part of every accessible name and doubles the row's height at 390. */}
                      {hideUnanswered || wired[faq._id] ? null : (
                        <ConfirmationBadge
                          status={faq.status}
                          pendingLabel={pendingLabel}
                          researchLabel={researchLabel}
                        />
                      )}
                      {faq.answer && faq.answer.length > 0 && !wired[faq._id]?.replaces ? (
                        <div className="max-w-3xl font-sans text-[length:var(--fs-body,1rem)] leading-[1.55] text-ink/80">
                          <PortableText value={faq.answer} />
                        </div>
                      ) : null}
                      {wired[faq._id] ? (
                        <div data-faq-wired={wired[faq._id].kind}>{wired[faq._id].body}</div>
                      ) : null}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
