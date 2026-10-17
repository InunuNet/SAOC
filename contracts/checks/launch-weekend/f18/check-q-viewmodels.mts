// F18-A27 (F18b, v13 data layer, pure, no CMS, no server): buildTicketCardViewModels from lib/data/ticket-card-view-models.ts against goldens/f18b/v13-viewmodel-fixtures.json.
// Proves the locked interface of HANDOFF section 2 on real-shaped inputs: state precedence (pricePending > soldOut > earlyBirdSoldOut > low > available), low at <=10% remaining, the shared early-bird
// pool (total = smallest effective capacity of its members, sold = sum of member sold x headcount), the early-bird SKU while the pool lasts and the regular SKU at 0, regularPrice only on early-bird
// SKUs, scarcity null when there is no real capacity (R7), dayPassFrom (R30: the Day Pass card's effective price or null), per-day remaining from real sold-by-day counts or null (no count rendered) when there is no source, never a negative remaining, and no card
// for a product whose type does not exist (nothing invented). Run: pnpm exec tsx contracts/checks/launch-weekend/f18/check-q-viewmodels.mts   (cwd = implementation worktree)
import { existsSync, readFileSync } from 'node:fs';

import * as mod from '../../../../lib/data/ticket-card-view-models';

type Obj = Record<string, unknown>;
const fx = JSON.parse(readFileSync('.agent/memory/project/specs/launch-weekend/goldens/f18b/v13-viewmodel-fixtures.json', 'utf8')) as { showDays: string[]; types: Obj[]; cases: Obj[]; ledeCases: Obj[]; salesCases: Obj[] };
const problems: string[] = [];
const fail = (m: string) => problems.push(m);
const build = (mod as unknown as { buildTicketCardViewModels?: (i: Obj) => { cards: Record<string, Obj | undefined>; pool: Obj | null; dayPassFrom: number | null } }).buildTicketCardViewModels;
if (typeof build !== 'function') fail('lib/data/ticket-card-view-models.ts does not export buildTicketCardViewModels');

const subset = (got: unknown, want: unknown, path: string) => {
  if (want === null) { if (got !== null && got !== undefined) fail(`${path}: want null, got ${JSON.stringify(got)}`); return; }
  if (Array.isArray(want)) {
    if (!Array.isArray(got) || got.length !== want.length) { fail(`${path}: want ${want.length} entries, got ${JSON.stringify(got)}`); return; }
    want.forEach((w, i) => subset(got[i], w, `${path}[${i}]`));
    return;
  }
  if (want && typeof want === 'object') {
    if (!got || typeof got !== 'object') { fail(`${path}: want an object, got ${JSON.stringify(got)}`); return; }
    for (const [k, v] of Object.entries(want)) subset((got as Obj)[k], v, `${path}.${k}`);
    return;
  }
  if (got !== want) fail(`${path}: want ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
};

if (typeof build === 'function') {
  for (const c of fx.cases) {
    let types = fx.types.map((t) => ({ ...t }));
    const over = (c.typesOverride ?? {}) as Record<string, Obj>;
    types = types.map((t) => ({ ...t, ...(over[t.slug as string] ?? {}) }));
    const omit = (c.omitTypes ?? []) as string[];
    types = types.filter((t) => !omit.includes(t.slug as string));
    const out = build({ showDays: fx.showDays, types, soldByType: c.soldByType, soldByDay: c.soldByDay, thresholdPercent: 10 });
    const expect = c.expect as Obj;
    const name = c.name as string;
    if (expect.pool !== undefined) subset(out.pool, expect.pool, `${name}: pool`);
    for (const [k, v] of Object.entries(expect)) {
      if (k === 'pool') continue;
      if (k === 'dayPassFrom') { if (out.dayPassFrom !== v) fail(`${name}: dayPassFrom want ${JSON.stringify(v)}, got ${JSON.stringify(out.dayPassFrom)}`); continue; }
      if (k === 'absent') { for (const a of v as string[]) if (out.cards[a]) fail(`${name}: a card exists for ${a} though its type is absent`); continue; }
      subset(out.cards[k], v, `${name}: ${k}`);
    }
    for (const [k, card] of Object.entries(out.cards)) {
      const sc = card?.scarcity as Obj | null | undefined;
      if (sc && (typeof sc.remaining !== 'number' || sc.remaining < 0)) fail(`${name}: ${k} scarcity.remaining is ${String(sc.remaining)}`);
      if (card && card.regularPrice !== null && card.regularPrice !== undefined && !String(card.slug).includes('early-bird')) fail(`${name}: ${k} carries regularPrice on a non-early-bird SKU`);
      if (card && card.state === 'pricePending' && card.price !== null) fail(`${name}: ${k} pricePending with a non-null price`);
    }
  }
  // sales closed (design-cb): salesOpen false masks EVERY card (state salesClosed, no price, no scarcity), hides the pool and the Day Pass 'from' price; salesOpen true changes nothing
  const closed = build({ showDays: fx.showDays, types: fx.types, soldByType: {}, soldByDay: null, thresholdPercent: 10, salesOpen: false });
  const closedCards = Object.entries(closed.cards).filter(([, c]) => c);
  if (!closedCards.length) fail('salesOpen false returned no cards (the v13 cards still render while sales are closed)');
  for (const [k, c] of closedCards) {
    if (c?.state !== 'salesClosed') fail(`salesOpen false: ${k} state is ${JSON.stringify(c?.state)}, want salesClosed`);
    if (c?.price !== null && c?.price !== undefined) fail(`salesOpen false: ${k} still carries a price`);
    if (c?.regularPrice !== null && c?.regularPrice !== undefined) fail(`salesOpen false: ${k} still carries a regularPrice`);
    if (c?.scarcity !== null && c?.scarcity !== undefined) fail(`salesOpen false: ${k} still carries scarcity`);
  }
  if (closed.pool !== null) fail('salesOpen false: the pool banner data is not null (the pool banner is hidden)');
  if (closed.dayPassFrom !== null) fail('salesOpen false: dayPassFrom is not null (no price may render while closed)');
  const open = build({ showDays: fx.showDays, types: fx.types, soldByType: {}, soldByDay: null, thresholdPercent: 10, salesOpen: true });
  const dflt = build({ showDays: fx.showDays, types: fx.types, soldByType: {}, soldByDay: null, thresholdPercent: 10 });
  if (JSON.stringify(open) !== JSON.stringify(dflt)) fail('salesOpen true differs from the omitted default (default must be open)');
  if (Object.values(open.cards).some((c) => (c as Obj | undefined)?.state === 'salesClosed')) fail('salesOpen true produced a salesClosed card');
  if (!fx.salesCases?.length) fail('v13-viewmodel-fixtures.json has no salesCases');
  const a = build({ showDays: fx.showDays, types: fx.types, soldByType: {}, soldByDay: null, thresholdPercent: 10 });
  const b = build({ showDays: fx.showDays, types: fx.types, soldByType: {}, soldByDay: null, thresholdPercent: 10 });
  if (JSON.stringify(a) !== JSON.stringify(b)) fail('buildTicketCardViewModels is not pure (two identical calls differ)');
}

// Section sub-ledes (design-cb: part of v13): lib/data/ticket-section-ledes.ts buildSectionLedes against ledeCases, and no date literal in the lede source or the hub page (R24: dates come from the show singleton).
const LEDES = 'lib/data/ticket-section-ledes.ts';
if (!existsSync(LEDES)) fail(`${LEDES} is missing`);
else {
  const lm = (await import('../../../../lib/data/ticket-section-ledes')) as unknown as { buildSectionLedes?: (i: Obj) => Obj };
  if (typeof lm.buildSectionLedes !== 'function') fail(`${LEDES} does not export buildSectionLedes`);
  else for (const c of (fx as unknown as { ledeCases: Obj[] }).ledeCases) {
    const out = lm.buildSectionLedes(c.input as Obj);
    for (const [k, v] of Object.entries(c.expect as Obj)) if ((out[k] ?? null) !== v) fail(`ledes "${c.name as string}": ${k} want ${JSON.stringify(v)}, got ${JSON.stringify(out[k] ?? null)}`);
  }
  const DATE_LITERAL = /\b2[3-6]\s+(Sept|September)\b|\b(Thursday|Friday|Saturday|Sunday)\s+2[3-6]\b|2027-09-2\d/;
  for (const f of [LEDES, 'app/(marketing)/national-show/tickets/page.tsx']) {
    const code = (existsSync(f) ? readFileSync(f, 'utf8') : '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (DATE_LITERAL.test(code)) fail(`${f}: a show date is typed in the source (R24: interpolate from the nationalShow singleton)`);
  }
}
if (problems.length) { console.error(`FAIL F18-A27 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`PASS F18-A27 ticket card view models (${fx.cases.length} cases)`);
