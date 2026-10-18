// nos-critique-r14 footprint guard (F1 and F2 share the branch): the r14 branch may differ from BASE (main 9d16cf96) only in the union of
// goldens/f1-footprint.json and goldens/f2-footprint.json, the docs file and this spec directory; HEAD descends from BASE.
import { finish, footprintFailures } from './_lib.mjs';

const { failures, count } = footprintFailures();
finish('f1-footprint.mjs', failures, `${count} changed path(s), all inside the r14 allowlist.`);
