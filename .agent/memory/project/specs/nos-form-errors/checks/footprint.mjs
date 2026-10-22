// nos-form-errors (rFE) footprint guard: the branch may differ from BASE (origin/main 64cf1bd2) only in goldens/footprint.json,
// docs/nos-form-errors.md and this spec directory; HEAD descends from BASE. e2e/contact-form-mocked.spec.ts is not on the list.
import { finish, footprintFailures } from './_lib.mjs';

const { failures, count } = footprintFailures();
finish('footprint.mjs', failures, `${count} changed path(s), all inside the rFE allowlist.`);
