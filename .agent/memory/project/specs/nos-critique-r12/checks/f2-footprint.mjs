// nos-critique-r12 f2 footprint guard: the whole r12 branch may differ from BASE (main 26fde668) only in the union of goldens/f1- to f4-footprint.json and the docs file;
// HEAD descends from BASE. Same guard as f1-footprint.mjs (the gate runs at the tip, where the diff is cumulative).
import { finish, footprintFailures } from './_lib.mjs';

const { failures, count } = footprintFailures();
finish('f2-footprint.mjs', failures, `${count} changed path(s), all inside the r12 f1-f4 allowlist.`);
