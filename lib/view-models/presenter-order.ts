// lib/view-models/presenter-order.ts
//
// nos-presenter-cards (F1) — pure ordering for the presenter section (golden §4). Sanity
// `order` wins when set; while Lee-Ann has not set it, Codi's sample sequence applies and
// the section shows a note saying so. No React and no `@/` imports: the contract's check
// scripts load this file through a bare tsx register().

// Codi's sample sequence by Sanity document `_id`, exact match, so a corrected spelling of a name never
// moves a presenter. Used only for null orders.
export const PRESENTER_FALLBACK_SEQUENCE = [
  'conferencePresenter-elbert-wijaya',
  'conferencePresenter-hildegard-crous',
  'conferencePresenter-michael-tibbs',
  'conferencePresenter-robert-fuchs',
];

interface OrderablePresenter {
  id: string;
  name: string;
  order: number | null;
}

const NAME_LOCALE = 'en';

function byName(a: OrderablePresenter, b: OrderablePresenter): number {
  return a.name.localeCompare(b.name, NAME_LOCALE);
}

function fallbackRank(id: string): number {
  const index = PRESENTER_FALLBACK_SEQUENCE.indexOf(id);
  return index === -1 ? PRESENTER_FALLBACK_SEQUENCE.length : index;
}

/** Returns a new array: set orders ascending, then null orders by the sample sequence. */
export function orderPresenters<T extends OrderablePresenter>(list: readonly T[]): T[] {
  const ordered = list.filter((p) => p.order !== null);
  const unordered = list.filter((p) => p.order === null);
  ordered.sort((a, b) => (a.order as number) - (b.order as number) || byName(a, b));
  unordered.sort((a, b) => fallbackRank(a.id) - fallbackRank(b.id) || byName(a, b));
  return [...ordered, ...unordered];
}

/** True while any presenter still relies on the sample sequence. */
export function hasProvisionalOrder(list: readonly OrderablePresenter[]): boolean {
  return list.some((p) => p.order === null);
}
