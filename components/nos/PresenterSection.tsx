import { PresenterGrid } from '@/components/nos/PresenterGrid';
import { ConfirmationBadge } from '@/components/show';
import { hasProvisionalOrder, orderPresenters } from '@/lib/view-models/presenter-order';
import type { PresenterCardViewModel } from '@/lib/view-models/ticket-card';

// nos-presenter-cards (F1) — the one reusable presenter section both event pages render
// under their hero (Lee-Ann's spec §4.6/§4.7). Renders nothing while an event has no
// presenters (WOSA today, or a Sanity failure). Heading and eyebrow only; the cards and the
// inline bio disclosure are the client PresenterGrid.

// nos-critique-r3 (R44 A5) — the id the symposium "Presenters (N)" jump link points at.
export function presenterSectionId(presenters: PresenterCardViewModel[]): string {
  return `presenters-${presenters[0].event}`;
}

export function PresenterJumpLink({ presenters }: { presenters: PresenterCardViewModel[] }) {
  if (presenters.length === 0) return null;

  return (
    <div className="pc-jump">
      <div className="pc-wrap">
        <a className="pc-jump-link" href={`#${presenterSectionId(presenters)}`}>
          Presenters ({presenters.length})
        </a>
      </div>
    </div>
  );
}

export function PresenterSection({
  eyebrow,
  presenters,
}: {
  eyebrow: string;
  presenters: PresenterCardViewModel[];
}) {
  if (presenters.length === 0) return null;

  const ordered = orderPresenters(presenters);
  const provisional = hasProvisionalOrder(presenters);
  const idBase = presenterSectionId(presenters);
  const titleId = `${idBase}-title`;

  return (
    <section className="nos-presenters" aria-labelledby={titleId}>
      <div className="pc-wrap">
        <div id={idBase} className={provisional ? 'pc-sec-top nos-surface' : 'pc-sec-top'}>
          <div className="pc-sec-head">
            <p className="pc-eyebrow">{eyebrow}</p>
            <h2 id={titleId} className="pc-title">
              Presenters
            </h2>
          </div>
          {provisional ? (
            <ConfirmationBadge
              status="pending"
              pendingLabel="To be confirmed by the show committee"
            />
          ) : null}
        </div>
        <PresenterGrid presenters={ordered} idBase={idBase} />
      </div>
    </section>
  );
}
