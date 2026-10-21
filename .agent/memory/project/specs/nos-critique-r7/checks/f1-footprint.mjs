// nos-critique-r7 f1 footprint guard: only plan-your-visit/page.tsx and VisitorInfoBlock.tsx (plus the docs file) may differ from main 1f8ad3de.
import { finish } from './_lib.mjs';
import { footprintFailures } from './r7-lib.mjs';

const { failures, count } = footprintFailures(3);
finish('f1-footprint.mjs', failures, `${count} changed path(s), all inside the f1 allowlist.`);
