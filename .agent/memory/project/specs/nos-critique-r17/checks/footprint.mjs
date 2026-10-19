// nos-critique-r17 footprint guard (F1, F2 and F3 share the branch): the r17 branch may differ from BASE (origin/main 39b15ec0) only in the
// union of goldens/f1-footprint.json, f2-footprint.json and f3-footprint.json, docs/nos-critique-r17.md and this spec directory; HEAD
// descends from BASE (a rebase onto a newer main keeps BASE as an ancestor).
import { finish, footprintFailures } from './_lib.mjs';

const { failures, count } = footprintFailures();
finish('footprint.mjs', failures, `${count} changed path(s), all inside the r17 allowlist.`);
