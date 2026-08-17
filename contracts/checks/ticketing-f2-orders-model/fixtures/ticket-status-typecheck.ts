// F2 (ticketing-foundation) — behavioural (compiler-driven, not source-grep) proof that
// `TicketStatus` is EXACTLY the five-member union the corrected design requires: the four
// values that already existed pre-F2 ('reserved' | 'paid' | 'cancelled' | 'checked-in'),
// plus 'refunded'.
//
// CORRECTION to the mission brief's Done criterion: the brief says "status field on
// position correctly reads as one of four values including refunded". That is
// arithmetically wrong, not a scoping decision to re-derive — `TicketStatus` already had
// FOUR values before F2 ('reserved', 'paid', 'cancelled', 'checked-in'; see
// types/index.ts:128 pre-F2). Adding 'refunded' makes FIVE, not four. This file asserts
// five positive members and one rejected sixth value; do not "fix" it back to four.
//
// Technique: `@ts-expect-error` on the sixth (invalid) literal. If TicketStatus is ever
// loosened back to `string` (or the invalid literal stops erroring for any other reason),
// tsc reports an "Unused '@ts-expect-error' directive" error and this file — and therefore
// A2 — fails. This is a real compiler-driven proof, not a grep for the word "refunded" in
// types/index.ts.
//
// Run as: npx tsc --noEmit -p contracts/checks/ticketing-f2-orders-model/tsconfig.typecheck.json
// (that config extends the root tsconfig.json but overrides `exclude` — the root config
// excludes the whole `contracts/` directory from `pnpm type-check`, so this file is
// invisible to A1 and needs its own scoped compiler invocation.)

import type { TicketStatus } from '../../../../types/index';

const reserved: TicketStatus = 'reserved';
const paid: TicketStatus = 'paid';
const cancelled: TicketStatus = 'cancelled';
const checkedIn: TicketStatus = 'checked-in';
const refunded: TicketStatus = 'refunded';

// @ts-expect-error — 'expired' has never been, and must never silently become, a member
// of TicketStatus. Five real values only.
const invalid: TicketStatus = 'expired';

export { reserved, paid, cancelled, checkedIn, refunded, invalid };
