// nos-vendor-apply-form (r55) footprint guard: the branch may differ from BASE (merge-base with origin/main) only in goldens/footprint.json,
// docs/nos-vendor-apply-form.md and this spec directory; HEAD descends from BASE.
import { finish, footprintFailures } from './_lib.mjs';

const { failures, count } = footprintFailures();
finish('footprint.mjs', failures, `${count} changed path(s), all inside the r55 allowlist.`);
