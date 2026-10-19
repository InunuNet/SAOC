// nos-critique-r16 footprint guard (F1, F2 and F3 share the branch): the r16 branch may differ from BASE (origin/main cea06daf) only in the
// union of goldens/f1-footprint.json, f2-footprint.json and f3-footprint.json, docs/nos-critique-r16.md and this spec directory; HEAD
// descends from BASE (a rebase onto a newer main keeps BASE as an ancestor).
import { finish, footprintFailures } from './_lib.mjs';

const { failures, count } = footprintFailures();
finish('footprint.mjs', failures, `${count} changed path(s), all inside the r16 allowlist.`);
