// lib/view-models/presenter-order.ts
//
// nos-presenter-cards (F1) — pure ordering for the presenter section (golden §4). Sanity
// `order` wins when set; while Lee-Ann has not set it, Codi's sample sequence applies and
// the section shows a note saying so. No React and no `@/` imports: the contract's check
// scripts load this file through a bare tsx register().

/** Codi's sample sequence — Sanity doc `name`, exact match. Used only for null orders. */
export const PRESENTER_FALLBACK_SEQUENCE = [
  'Elbert Wijaya',
  'Hildegard Crous',
  'Michael Tibbs',
  'Robert Fuchs',
];

interface OrderablePresenter {
  name: string;
  order: number | null;
}

const NAME_LOCALE = 'en';

function byName(a: OrderablePresenter, b: OrderablePresenter): number {
  return a.name.localeCompare(b.name, NAME_LOCALE);
}

function fallbackRank(name: string): number {
  const index = PRESENTER_FALLBACK_SEQUENCE.indexOf(name);
  return index === -1 ? PRESENTER_FALLBACK_SEQUENCE.length : index;
}

/** Returns a new array: set orders ascending, then null orders by the sample sequence. */
export function orderPresenters<T extends OrderablePresenter>(list: readonly T[]): T[] {
  const ordered = list.filter((p) => p.order !== null);
  const unordered = list.filter((p) => p.order === null);
  ordered.sort((a, b) => (a.order as number) - (b.order as number) || byName(a, b));
  unordered.sort((a, b) => fallbackRank(a.name) - fallbackRank(b.name) || byName(a, b));
  return [...ordered, ...unordered];
}

/** True while any presenter still relies on the sample sequence. */
export function hasProvisionalOrder(list: readonly OrderablePresenter[]): boolean {
  return list.some((p) => p.order === null);
}
