// nos-archive-public-r64 (r64) footprint guard: the branch may differ from BASE (origin/main b1c29304) only in goldens/footprint.json,
// docs/nos-archive-public-r64.md and this spec directory; HEAD descends from BASE.
import { finish, footprintFailures } from './_lib.mjs';

const { failures, count } = footprintFailures();
finish('footprint.mjs', failures, `${count} changed path(s), all inside the r64 allowlist.`);
