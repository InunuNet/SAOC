// =============================================================
// SAOC — components/show/ExhibitorSteps.tsx
// Server Component — the exhibitor journey, from deciding to enter through to removal.
//
// An <ol>, not a styled stack of divs: the order is the meaning here. A screen reader
// announcing "3 of 7" is telling the exhibitor something the visual numbering only
// implies.
//
// Ordering comes from the GROQ query (order asc), never from a client-side sort, so the
// sequence the committee sets in Studio is the sequence that renders.
// =============================================================

import { PortableText } from '@portabletext/react';

import type { ShowExhibitorStep } from '@/types';

import { ExhibitorStatusBadge } from './ExhibitorStatusBadge';

export interface ExhibitorStepsProps {
  heading?: string;
  steps?: ShowExhibitorStep[] | null;
  pendingLabel?: string | null;
  researchLabel?: string | null;
  questionLabel?: string | null;
  id?: string;
}

export function ExhibitorSteps({
  heading,
  steps,
  pendingLabel,
  researchLabel,
  questionLabel,
  id,
}: ExhibitorStepsProps) {
  const journey = (steps ?? []).filter((step) => step?.title);
  if (journey.length === 0) return null;

  return (
    <section id={id} className="border-t border-rule pt-8">
      {heading ? (
        <h2 className="font-serif text-[clamp(24px,2.6vw,32px)] font-medium text-ink">{heading}</h2>
      ) : null}

      <ol className="mt-6 space-y-8">
        {journey.map((step, index) => (
          <li key={step._id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-5">
            <span
              aria-hidden="true"
              className="mt-1 flex h-8 w-8 items-center justify-center border border-rule bg-parchment font-mono text-[12px] text-muted"
            >
              {index + 1}
            </span>
            <div>
              <h3 className="font-serif text-[22px] font-medium leading-snug text-ink">
                {step.title}
              </h3>
              {step.when ? (
                <p className="mt-1 font-mono text-[11px] tracking-[0.16em] text-muted">
                  {step.when}
                </p>
              ) : null}
              <ExhibitorStatusBadge
                status={step.status}
                pendingLabel={pendingLabel}
                researchLabel={researchLabel}
                questionLabel={questionLabel}
              />
              {step.body && step.body.length > 0 ? (
                <div className="mt-3 max-w-3xl space-y-3 font-sans text-[16px] leading-relaxed text-ink/80">
                  <PortableText value={step.body} />
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
