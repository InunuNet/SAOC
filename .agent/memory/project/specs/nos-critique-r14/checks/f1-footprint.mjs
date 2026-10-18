// nos-critique-r14 f1 footprint guard: the r14 branch may differ from BASE (main 9d16cf96) only in goldens/f1-footprint.json, the docs file and
// this spec directory; HEAD descends from BASE.
import { finish, footprintFailures } from './_lib.mjs';

const { failures, count } = footprintFailures();
finish('f1-footprint.mjs', failures, `${count} changed path(s), all inside the r14 allowlist.`);
