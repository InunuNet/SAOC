// nos-critique-r6 f6 (R34 exhibitors) footprint guard. Tolerates the stacked f1..f8 tree: every changed path must be an
// f1 scope file (class-only unless it is another feature's file), one of the files in f6-f8-lib.mjs F6_MODIFY / F6_NEW,
// or another feature's allowlisted file; new files only from NEW_OK; never off-limits paths; no CSS written for f6's markup.
import { finish } from './_lib.mjs';
import { footprintFailures } from './f6-f8-lib.mjs';

const { failures, count } = footprintFailures('f6');
finish('f6-footprint.mjs', failures, `${count} changed path(s), all inside the cleared stacked footprint; f6 files limited to its allowlist.`);
