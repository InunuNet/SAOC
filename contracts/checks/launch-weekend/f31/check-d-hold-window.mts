// F31-A4 - the pure pending-hold helpers (lib/payments/pending-hold.ts).
// Run from the repo root: pnpm exec tsx contracts/checks/launch-weekend/f31/check-d-hold-window.mts
import { readFileSync } from 'node:fs';
import { Timestamp } from 'firebase-admin/firestore';
import * as hold from '../../../../lib/payments/pending-hold.ts';
import { makeChecker } from './_lib.mts';

const table = JSON.parse(readFileSync('.agent/memory/project/specs/launch-weekend/goldens/f31/state-table.json', 'utf8'));
const { eq, finish } = makeChecker('F31-A4 hold window');
eq('hold minutes match the golden', hold.PENDING_PAYMENT_HOLD_MINUTES, table.holdMinutes);
const active = hold.isPendingPaymentHoldActive as ((m: unknown, now?: Date) => boolean) | undefined;
if (typeof active !== 'function') { console.error('FAIL F31-A4: isPendingPaymentHoldActive not exported'); process.exit(1); }
const now = new Date('2026-10-20T12:00:00Z');
const at = (minutesAgo: number) => ({ rawStatus: 'Pending', at: Timestamp.fromMillis(now.getTime() - minutesAgo * 60_000) });
eq('just recorded is active', active(at(1), now), true);
eq('inside window is active', active(at(hold.PENDING_PAYMENT_HOLD_MINUTES - 1), now), true);
eq('past window is inactive', active(at(hold.PENDING_PAYMENT_HOLD_MINUTES + 1), now), false);
eq('null marker inactive', active(null, now), false);
eq('undefined marker inactive', active(undefined, now), false);
eq('marker without at inactive (fail-open to retry, not lockout)', active({ rawStatus: 'Pending' }, now), false);
finish();
