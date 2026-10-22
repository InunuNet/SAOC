// nos-critique-r20 footprint guard (single F1): the r20 branch may differ from BASE (origin/main 7fb251a1) only in goldens/f1-footprint.json,
// docs/nos-critique-r20.md and this spec directory; HEAD descends from BASE (a rebase onto a newer main keeps BASE as an ancestor).
import { finish, footprintFailures } from './_lib.mjs';

const { failures, count } = footprintFailures();
finish('footprint.mjs', failures, `${count} changed path(s), all inside the r20 allowlist.`);
