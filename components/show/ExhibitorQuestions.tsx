// =============================================================
// SAOC — components/show/ExhibitorQuestions.tsx
// Server Component — the open questions for the show committee.
//
// These are published rather than quietly filled in with a plausible guess. The
// `context` line under each question is load-bearing: it says what the research looked
// for and what it found, which is the difference between a question that reads as
// diligence and one that reads as ignorance.
// =============================================================

import type { ExhibitorQuestion } from '@/types';

export interface ExhibitorQuestionsProps {
  heading?: string | null;
  intro?: string | null;
  questions?: ExhibitorQuestion[] | null;
  id?: string;
  headingId?: string;
}

export function ExhibitorQuestions({
  heading,
  intro,
  questions,
  id,
  headingId,
}: ExhibitorQuestionsProps) {
  const open = (questions ?? []).filter((item) => item?.question);
  if (open.length === 0) return null;

  return (
    <section id={id}>
      {heading ? (
        <h2 id={headingId} className="scroll-mt-[62px] font-serif text-ink md:scroll-mt-[74px]">
          {heading}
        </h2>
      ) : null}

      {intro ? (
        <p className="mt-3 max-w-3xl font-sans text-[16px] leading-[1.55] text-ink/80">{intro}</p>
      ) : null}

      <ul className="mt-8 border-t border-rule">
        {open.map((item, index) => (
          <li
            key={item._key ?? `${item.topic ?? 'question'}-${index}`}
            className="border-b border-rule py-6"
          >
            {item.topic ? (
              <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
                {item.topic.replace(/-/g, ' ')}
              </p>
            ) : null}
            <h3 className="mt-2 font-serif text-[20px] font-medium leading-snug text-ink">
              {item.question}
            </h3>
            {item.context ? (
              <p className="mt-2 font-sans text-[length:var(--fs-body,1rem)] leading-[1.55] text-ink/70">
                {item.context}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
