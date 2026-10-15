import { PresenterGrid } from '@/components/nos/PresenterGrid';
import { hasProvisionalOrder, orderPresenters } from '@/lib/view-models/presenter-order';
import type { PresenterCardViewModel } from '@/lib/view-models/ticket-card';

// nos-presenter-cards (F1) — the one reusable presenter section both event pages render
// under their hero (Lee-Ann's spec §4.6/§4.7). Renders nothing while an event has no
// presenters (WOSA today, or a Sanity failure). Heading and eyebrow only; the cards and the
// full-bio dialog are the client PresenterGrid.
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
  const idBase = `presenters-${presenters[0].event}`;
  const titleId = `${idBase}-title`;

  return (
    <section className="nos-presenters" aria-labelledby={titleId}>
      <div className="pc-wrap">
        <div className="pc-sec-top">
          <div className="pc-sec-head">
            <p className="pc-eyebrow">{eyebrow}</p>
            <h2 id={titleId} className="pc-title">
              Presenters
            </h2>
          </div>
          {provisional ? (
            <p className="pc-order-note">Sample sequence. Lee-Ann will confirm the order.</p>
          ) : null}
        </div>
        <PresenterGrid presenters={ordered} dialogIdBase={idBase} />
      </div>
    </section>
  );
}
