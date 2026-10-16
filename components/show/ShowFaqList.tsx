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

import type { ShowFaq } from '@/types';

import { ConfirmationBadge } from './ConfirmationBadge';

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

export interface ShowFaqListProps {
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
}: ShowFaqListProps) {
  const entries = (faqs ?? []).filter(
    (faq) => faq?.question && (!hideUnanswered || hasFaqAnswer(faq))
  );
  if (entries.length === 0) return null;

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    inCategory: entries.filter((faq) => categoryOf(faq) === category),
  })).filter(({ inCategory }) => inCategory.length > 0);

  return (
    <>
      {groups.length > 1 ? (
        <nav aria-label="FAQ categories" className="mb-10">
          <ul className="flex flex-wrap gap-2">
            {groups.map(({ category }) => (
              <li key={category}>
                <a
                  href={`#faq-${category}`}
                  className="inline-flex min-h-[44px] items-center rounded-[length:var(--radius-pill)] border-[length:var(--border-primary)] border-primary bg-transparent px-3 font-sans text-[14px] font-semibold tracking-normal text-ink hover:bg-bone motion-safe:transition-[color,background-color] motion-safe:duration-150 focus-visible:bg-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring-focus)]"
                >
                  {CATEGORY_LABELS[category]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
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
                      className="nos-faq-summary cursor-pointer font-serif text-[19px] font-medium leading-snug text-ink hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring-focus)]"
                    >
                      {/* The marker sits inline after the question, inside the summary, not in
                          the panel: a marker inside a closed disclosure is invisible to a visitor
                          scanning the list, so fourteen unconfirmed answers read as settled fact
                          until each one is opened. */}
                      <span data-faq-question="" className="nos-faq-question">
                        <span>{faq.question}</span>
                        {hideUnanswered ? null : (
                          <ConfirmationBadge
                            as="span"
                            status={faq.status}
                            pendingLabel={pendingLabel}
                            researchLabel={researchLabel}
                          />
                        )}
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
                      {faq.answer && faq.answer.length > 0 ? (
                        <div className="max-w-3xl font-sans text-[17px] leading-relaxed text-ink/80">
                          <PortableText value={faq.answer} />
                        </div>
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
