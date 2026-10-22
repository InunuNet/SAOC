// form-controls-16px-r71 (r71) footprint guard: the branch may differ from BASE (origin/main 85cf0814) only in goldens/footprint.json,
// docs/form-controls-16px-r71.md and this spec directory; HEAD descends from BASE.
import { finish, footprintFailures } from './_lib.mjs';

const { failures, count } = footprintFailures();
finish('footprint.mjs', failures, `${count} changed path(s), all inside the r71 allowlist.`);
