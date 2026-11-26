// =============================================================
// NOS — components/nos/SaocText.tsx
// Server Component. Brad, 19 Nov 2026: every mention of "SAOC" or "South African Orchid Council"
// in NOS page copy links back to the SAOC site, in a new tab. `SaocText` does it for a plain string;
// `SaocPortableText` does it for Sanity portable text. The link carries the repo's new-tab cue.
// =============================================================

import { PortableText, type PortableTextComponents } from '@portabletext/react';
import type { ComponentProps, ReactNode } from 'react';

import { NEW_TAB_CUE, SAOC_MENTION_MARK, linkSaocInBlocks, splitSaocMentions } from '@/lib/saoc-mentions';
import { saocUrl } from '@/lib/site-hosts';
import { portableLinkMarks } from '@/components/ui/SiteLink';

function SaocAnchor({ children }: { children: ReactNode }) {
  return (
    <a href={saocUrl('/')} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> {NEW_TAB_CUE}</span>
    </a>
  );
}

const SAOC_MARKS: NonNullable<PortableTextComponents['marks']> = {
  [SAOC_MENTION_MARK]: ({ children }) => <SaocAnchor>{children}</SaocAnchor>,
};

export function SaocText({ children }: { children: string }) {
  return (
    <>
      {splitSaocMentions(children).map((segment, index) =>
        segment.isSaoc ? <SaocAnchor key={index}>{segment.text}</SaocAnchor> : segment.text
      )}
    </>
  );
}

type PortableTextValue = ComponentProps<typeof PortableText>['value'];

export function SaocPortableText({
  value,
  components,
}: {
  value: PortableTextValue;
  components?: PortableTextComponents;
}) {
  const blocks = Array.isArray(value) ? linkSaocInBlocks(value) : value;
  const merged: PortableTextComponents = { ...components, marks: { ...portableLinkMarks('nos'), ...components?.marks, ...SAOC_MARKS } };
  return <PortableText value={blocks} components={merged} />;
}
