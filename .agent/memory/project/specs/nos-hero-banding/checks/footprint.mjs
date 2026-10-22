// nos-hero-banding footprint guard (single F1): the rHB branch may differ from BASE (origin/main 1a7479f1) only in goldens/f1-footprint.json,
// docs/nos-hero-banding.md and this spec directory; HEAD descends from BASE (a rebase onto a newer main keeps BASE as an ancestor).
import { finish, footprintFailures } from './_lib.mjs';

const { failures, count } = footprintFailures();
finish('footprint.mjs', failures, `${count} changed path(s), all inside the rHB allowlist.`);
