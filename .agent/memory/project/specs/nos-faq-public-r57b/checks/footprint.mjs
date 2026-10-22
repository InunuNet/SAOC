// nos-faq-public-r57b (r57b) footprint guard: the branch may differ from BASE (fix/nos-faq-r57 head, 6c170c4e) only in goldens/footprint.json,
// docs/nos-faq-public-r57b.md and this spec directory; HEAD descends from BASE.
import { finish, footprintFailures } from './_lib.mjs';

const { failures, count } = footprintFailures();
finish('footprint.mjs', failures, `${count} changed path(s), all inside the r57b allowlist.`);
