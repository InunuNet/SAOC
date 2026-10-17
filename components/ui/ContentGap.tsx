// =============================================================
// SAOC — components/ui/ContentGap.tsx
// Server Component — the public build's designed gap state (F19, vote 1C). Where a section holds only
// facts the Council has not supplied, the page shows the Council's own existing absence sentence
// instead of an empty or invented section. Built only from that sentence; no new copy.
// =============================================================

import { ABSENT_SHOW_PAGE_FIXED_SENTENCE } from '@/lib/data/show-pages';

export function ContentGap() {
  return (
    <div data-content-gap>
      <p className="font-sans text-[16px] leading-[1.55] text-muted max-w-[60ch]">
        {ABSENT_SHOW_PAGE_FIXED_SENTENCE}
      </p>
    </div>
  );
}
