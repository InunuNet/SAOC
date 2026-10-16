// F16 (launch-weekend, R31-A2): groups the public admission products into the typographic rows
// of /national-show/tickets. Pure: no clock, no Sanity, no Firebase. Every price goes through
// resolveEffectivePrice(), the function checkout itself calls, so a row can never advertise a
// price checkout would refuse.
import { resolveEffectivePrice } from './checkout-reservation.ts';
import { REGULAR_PRICE_SIBLING_SLUG } from './admission-siblings.ts';

export interface AdmissionRowSource {
  slug: string;
  name: string;
  price: number;
  regularPrice?: number | null;
  earlyBirdCutoff?: string | null;
  requiresDaySelection?: boolean | null;
  provisional?: boolean | null;
  order: number;
}

export interface AdmissionTier {
  kind: 'earlyBird' | 'standard';
  slug: string;
  name: string;
  price: number;
}

export interface AdmissionRow {
  key: string;
  name: string;
  tiers: AdmissionTier[];
  actionSlug: string;
  requiresDaySelection: boolean;
  provisional: boolean;
  earlyBirdEnds: string | null;
}

const EARLY_BIRD_FOR: Record<string, string> = Object.fromEntries(
  Object.entries(REGULAR_PRICE_SIBLING_SLUG).map(([early, standard]) => [standard, early]),
);

function effective(t: AdmissionRowSource, now: Date): number | null {
  return resolveEffectivePrice({
    price: t.price,
    regularPrice: t.regularPrice ?? null,
    earlyBirdCutoff: t.earlyBirdCutoff ?? null,
    now,
  });
}

/** Tiers one SKU contributes: its own early-bird window (cutoff + regularPrice) can yield two. */
function tiersOf(t: AdmissionRowSource, now: Date, isEarlySku: boolean): { tiers: AdmissionTier[]; ends: string | null } {
  const price = effective(t, now);
  if (price === null) return { tiers: [], ends: null };
  const inWindow = Boolean(t.earlyBirdCutoff) && price === t.price;
  if (inWindow && t.regularPrice != null && t.regularPrice !== t.price) {
    return {
      tiers: [
        { kind: 'earlyBird', slug: t.slug, name: t.name, price: t.price },
        { kind: 'standard', slug: t.slug, name: t.name, price: t.regularPrice },
      ],
      ends: t.earlyBirdCutoff ?? null,
    };
  }
  return {
    tiers: [{ kind: isEarlySku || inWindow ? 'earlyBird' : 'standard', slug: t.slug, name: t.name, price }],
    ends: inWindow ? (t.earlyBirdCutoff ?? null) : null,
  };
}

export function buildAdmissionRows(types: AdmissionRowSource[], opts: { now: Date }): AdmissionRow[] {
  const bySlug = new Map(types.map((t) => [t.slug, t]));
  const rows: AdmissionRow[] = [];
  const consumed = new Set<string>();
  for (const t of [...types].sort((a, b) => a.order - b.order)) {
    if (consumed.has(t.slug)) continue;
    const isEarly = t.slug in REGULAR_PRICE_SIBLING_SLUG;
    const standardSlug = isEarly ? REGULAR_PRICE_SIBLING_SLUG[t.slug] : t.slug;
    const standard = bySlug.get(standardSlug);
    // An early-bird SKU whose standard sibling is listed is folded into the sibling's row.
    if (isEarly && standard) continue;
    const early = bySlug.get(EARLY_BIRD_FOR[t.slug] ?? '');
    const members: AdmissionRowSource[] = early ? [early, t] : [t];
    const tiers: AdmissionTier[] = [];
    let ends: string | null = null;
    for (const m of members) {
      const r = tiersOf(m, opts.now, m.slug in REGULAR_PRICE_SIBLING_SLUG);
      tiers.push(...r.tiers);
      ends = ends ?? r.ends;
      consumed.add(m.slug);
    }
    if (tiers.length === 0) continue;
    tiers.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'earlyBird' ? -1 : 1));
    rows.push({
      key: t.slug,
      name: t.name,
      tiers,
      actionSlug: tiers[0].slug,
      requiresDaySelection: members.some((m) => m.requiresDaySelection === true),
      provisional: members.some((m) => m.provisional === true),
      earlyBirdEnds: ends,
    });
  }
  return rows;
}
