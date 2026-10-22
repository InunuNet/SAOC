// nos-checkout-left-counts (rLC) footprint guard: the branch may differ from BASE (origin/main 62dd9f63) only in goldens/footprint.json,
// docs/nos-checkout-left-counts.md and this spec directory; HEAD descends from BASE.
import { finish, footprintFailures } from './_lib.mjs';

const { failures, count } = footprintFailures();
finish('footprint.mjs', failures, `${count} changed path(s), all inside the rLC allowlist.`);
