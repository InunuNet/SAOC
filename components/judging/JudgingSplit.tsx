import type { ReactNode } from 'react';

import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';

export interface JudgingSplitProps {
  heading: string;
  /** Section background: the page alternates paper and tint. */
  tone: 'parchment' | 'bone';
  /** Beta preview: the prose states facts the Council has not supplied, so it is marked. */
  marked?: boolean;
  children: ReactNode;
}

// F19 (R72 #2): heading on the shared axis in the narrow column, prose (at most 60ch) in the wide
// one, tops aligned; one column below 1024. The grid itself is [data-judging-split] in globals.css.
export function JudgingSplit({ heading, tone, marked = false, children }: JudgingSplitProps) {
  return (
    <section className={`${tone === 'bone' ? 'bg-bone' : 'bg-parchment'} py-24`}>
      <div className="saoc-container">
        <div data-judging-split>
          <h2 className="eyebrow justify-self-start">{heading}</h2>
          <div
            data-placeholder={marked ? 'true' : undefined}
            className="flex max-w-[60ch] flex-col items-start gap-4"
          >
            <div className="space-y-4 font-sans text-[16px] leading-[1.55] text-ink/80">
              {children}
            </div>
            {marked ? <PlaceholderMarker /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
