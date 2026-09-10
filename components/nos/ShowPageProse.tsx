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

export function ShowPageProse({ section }: ShowPageProseProps) {
  const { blocks, notice } = unwrapGatedProse(section.body);

  return (
    <div className="nos-show-page-prose" data-section-key={section.sectionKey}>
      {notice ? (
        <p className="nos-show-page-notice" role="note">
          <strong>{notice.label}:</strong> {notice.text}
        </p>
      ) : null}
      {section.heading ? <h2>{section.heading}</h2> : null}
      <PortableText value={blocks} />
    </div>
  );
}
