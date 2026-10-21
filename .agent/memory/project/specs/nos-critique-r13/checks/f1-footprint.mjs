// nos-critique-r13 f1 footprint guard: the whole r13 branch may differ from BASE (main 5f8d2311) only in goldens/f1-footprint.json and the
// docs file; HEAD descends from BASE.
import { finish, footprintFailures } from './_lib.mjs';

const { failures, count } = footprintFailures();
finish('f1-footprint.mjs', failures, `${count} changed path(s), all inside the r13 allowlist.`);
