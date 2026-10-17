// nos-critique-r6 f8 (R50 what-to-expect) footprint guard. As f6-footprint.mjs; f8 may change only what-to-expect/page.tsx and
// components/show/VisitorInfoBlock.tsx. LongFormPage, ShowFacts, HoldingState and show-facts.ts are locked: class-only
// differences from f1's R65 sweep pass, any structural difference fails.
import { finish } from './_lib.mjs';
import { footprintFailures } from './f6-f8-lib.mjs';

const { failures, count } = footprintFailures('f8');
finish('f8-footprint.mjs', failures, `${count} changed path(s), all inside the cleared stacked footprint; LongFormPage/ShowFacts/HoldingState/show-facts untouched.`);
