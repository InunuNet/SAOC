// =============================================================
// NOS — components/nos/ShowPageProse.tsx
// Server Component. THE ONLY renderer of a showPage section's GatedProse value.
//
// See .agent/memory/project/specs/national-show-ia-alignment/goldens/m1/provenance-gate.golden.md
// and page-contract.golden.md.
//
// The notice and the copy are emitted in one JSX expression — there is no prop that
// suppresses the notice, and no code path through this component that reaches the body
// blocks without having rendered the notice first. `ShowPageProseProps` has exactly one
// key on purpose (assertion G7): a second prop is how a "just this once, skip the
// notice" escape hatch would sneak in.
//
// Visual treatment (colour, weight, position of the notice) is a design question for
// saoc-nos-design-cc — see codi-handover.golden.md. This component only guarantees DOM
// order: the notice text precedes the body text in the rendered markup (assertion G6).
// =============================================================

import { PortableText } from '@portabletext/react';

import type { ShowPageSection } from '@/lib/data/show-pages';

import { unwrapGatedProse } from './gated-prose-internal';

export interface ShowPageProseProps {
  section: ShowPageSection;
}

// F17 (national-show-ia-alignment, M4) — R11's disclosure: a chip, then exactly one
// sentence, then a dashed 2px rail down the FULL HEIGHT of the block it governs. See
// .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/r11-disclosure.golden.md.
//
// The rail is a `border-left` on THIS component's own outer element — the same box that
// wraps the heading and body — so its rendered height is mechanically the governed
// block's height (N13) with no separate measurement to keep in sync. Colour comes from
// `notice.tone` ('warning' | 'muted'), NEVER `--status-error-*` (N14): the two Tailwind
// arbitrary-value classes below resolve to `--status-warning`/`--status-muted`, which
// `.nos-on-dark` flips per ground — never a literal hex, never `red-*`.
const RAIL_TONE_CLASS: Record<'warning' | 'muted', string> = {
  warning: 'border-[color:var(--status-warning)]',
  muted: 'border-[color:var(--status-muted)]',
};

export function ShowPageProse({ section }: ShowPageProseProps) {
  const { blocks, notice } = unwrapGatedProse(section.body);

  return (
    <div
      className={
        notice
          ? `nos-show-page-prose border-l-2 border-dashed pl-5 ${RAIL_TONE_CLASS[notice.tone]}`
          : 'nos-show-page-prose'
      }
      data-section-key={section.sectionKey}
    >
      {notice ? (
        <p className="nos-show-page-notice mb-4 flex flex-wrap items-baseline gap-2" role="note">
          <span
            className={`inline-block rounded-[length:var(--radius-1)] border px-2 py-0.5 font-sans text-[11px] font-medium uppercase tracking-[0.14em] ${
              notice.tone === 'warning' ? 'text-[var(--status-warning)]' : 'text-[var(--status-muted)]'
            }`}
            style={{ borderColor: 'currentColor' }}
          >
            {notice.label}
          </span>
          <span className="font-sans text-[15px] not-italic leading-relaxed text-ink/80">
            {notice.text}
          </span>
        </p>
      ) : null}
      {section.heading ? <h2>{section.heading}</h2> : null}
      <PortableText value={blocks} />
    </div>
  );
}
