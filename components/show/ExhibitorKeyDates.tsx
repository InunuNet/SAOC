// =============================================================
// SAOC — components/show/ExhibitorKeyDates.tsx
// Server Component — the exhibitor key-dates table.
//
// A real <table> with a real <caption> and scoped headers, not a grid of divs. This is
// the single most likely block on the page to be read assistively or printed, and a
// dates table announced as a pile of divs is not usable either way.
//
// The caption is editor-owned content, not a claim frozen in JSX. It used to assert here
// that no date had been fixed — true today, false the moment the committee sets real
// dates and the per-row markers correctly disappear, leaving two contradictory claims in
// one viewport that no editor could reach. It names the table and nothing more now.
//
// The note renders ABOVE the table on purpose: the unset state has to be unmissable
// before anyone reads a row, not explained after they have already planned around one.
// Every "when" value is free text from Sanity, never a formatted calendar value — see
// sanity/schemas/objects/showExhibitorDate.ts.
// =============================================================

import type { ShowExhibitorDate } from '@/types';

import { ExhibitorStatusBadge } from './ExhibitorStatusBadge';

export interface ExhibitorKeyDatesProps {
  heading?: string | null;
  note?: string | null;
  caption?: string | null;
  rows?: ShowExhibitorDate[] | null;
  pendingLabel?: string | null;
  researchLabel?: string | null;
  questionLabel?: string | null;
  id?: string;
}

export function ExhibitorKeyDates({
  heading,
  note,
  caption,
  rows,
  pendingLabel,
  researchLabel,
  questionLabel,
  id,
}: ExhibitorKeyDatesProps) {
  const dates = (rows ?? []).filter((row) => row?.label);
  if (dates.length === 0) return null;

  return (
    <section id={id} className="border-t border-rule pt-8">
      {heading ? (
        <h2 className="font-serif text-[clamp(24px,2.6vw,32px)] font-medium text-ink">{heading}</h2>
      ) : null}

      {note ? (
        <p className="mt-3 max-w-3xl font-sans text-[16px] leading-relaxed text-ink/80">{note}</p>
      ) : null}

      <div className="mt-6 sm:overflow-x-auto">
        <table className="w-full border-collapse text-left max-sm:block sm:min-w-[560px]">
          {caption ? (
            <caption className="mb-3 text-left font-mono text-[12px] tracking-[0.16em] text-muted">
              {caption}
            </caption>
          ) : null}
          <thead className="max-sm:sr-only">
            <tr className="border-b border-rule">
              <th
                scope="col"
                className="py-3 pr-4 font-mono text-[12px] tracking-[0.16em] text-muted"
              >
                Milestone
              </th>
              <th
                scope="col"
                className="py-3 pr-4 font-mono text-[12px] tracking-[0.16em] text-muted"
              >
                When
              </th>
              <th
                scope="col"
                className="py-3 font-mono text-[12px] tracking-[0.16em] text-muted"
              >
                Detail
              </th>
            </tr>
          </thead>
          <tbody className="max-sm:block">
            {dates.map((row, index) => (
              <tr key={row._key ?? `${row.label}-${index}`} className="border-b border-rule max-sm:block">
                <th
                  scope="row"
                  className="py-4 pr-4 align-top max-sm:block max-sm:pb-1 font-serif text-[17px] font-medium text-ink"
                >
                  {row.label}
                </th>
                <td className="py-4 pr-4 align-top max-sm:block max-sm:py-1 font-sans text-[15px] leading-relaxed text-ink/80">
                  {row.dateNote}
                  <ExhibitorStatusBadge
                    status={row.status}
                    pendingLabel={pendingLabel}
                    researchLabel={researchLabel}
                    questionLabel={questionLabel}
                  />
                </td>
                <td className="py-4 align-top max-sm:block max-sm:py-1 max-sm:pb-4 font-sans text-[15px] leading-relaxed text-ink/70">
                  {row.detail}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
