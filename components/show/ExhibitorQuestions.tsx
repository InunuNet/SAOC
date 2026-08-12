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
}

export function ExhibitorQuestions({ heading, intro, questions, id }: ExhibitorQuestionsProps) {
  const open = (questions ?? []).filter((item) => item?.question);
  if (open.length === 0) return null;

  return (
    <section id={id} className="border-t border-rule bg-bone px-6 py-10 sm:px-8">
      {heading ? (
        <h2 className="font-serif text-[clamp(24px,2.6vw,32px)] font-medium text-ink">{heading}</h2>
      ) : null}

      {intro ? (
        <p className="mt-3 max-w-3xl font-sans text-[16px] leading-relaxed text-ink/80">{intro}</p>
      ) : null}

      <ul className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {open.map((item, index) => (
          <li
            key={item._key ?? `${item.topic ?? 'question'}-${index}`}
            className="border border-rule bg-parchment p-5"
          >
            {item.topic ? (
              <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">
                {item.topic.replace(/-/g, ' ')}
              </p>
            ) : null}
            <p className="mt-2 font-serif text-[18px] font-medium leading-snug text-ink">
              {item.question}
            </p>
            {item.context ? (
              <p className="mt-2 font-sans text-[15px] leading-relaxed text-ink/70">
                {item.context}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
