// nos-critique-r18 footprint guard (single F1): the r18 branch may differ from BASE (origin/main 93940e04) only in goldens/f1-footprint.json,
// docs/nos-critique-r18.md and this spec directory; HEAD descends from BASE (a rebase onto a newer main keeps BASE as an ancestor).
import { finish, footprintFailures } from './_lib.mjs';

const { failures, count } = footprintFailures();
finish('footprint.mjs', failures, `${count} changed path(s), all inside the r18 allowlist.`);
