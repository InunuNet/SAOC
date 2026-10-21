// nos-critique-r12 f1 footprint guard: only the manifest generator and its output (item a), the two re-recorded checks (items c and d, edited by @architect, never by @dev;
// goldens/f1-footprint.json) and the docs file may differ from BASE (main 26fde668); HEAD descends from BASE. The allowlist is the union of the f1-f4 footprints (sweep findings F2-F4 joined r12 with their own paths).
import { finish, footprintFailures } from './_lib.mjs';

const { failures, count } = footprintFailures();
finish('f1-footprint.mjs', failures, `${count} changed path(s), all inside the r12 f1-f4 allowlist.`);
