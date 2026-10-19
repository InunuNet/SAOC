// nos-critique-r19 footprint guard (single F1): the r19 branch may differ from BASE (origin/main a4807791) only in goldens/f1-footprint.json,
// docs/nos-critique-r19.md and this spec directory; HEAD descends from BASE (a rebase onto a newer main keeps BASE as an ancestor).
import { finish, footprintFailures } from './_lib.mjs';

const { failures, count } = footprintFailures();
finish('footprint.mjs', failures, `${count} changed path(s), all inside the r19 allowlist.`);
