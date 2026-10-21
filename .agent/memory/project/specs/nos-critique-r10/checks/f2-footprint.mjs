// nos-critique-r10 f2 footprint guard (one branch, gate at the tip): only the paths of f1 (nos-theme.css, nos-structure.css) and f2 (what-to-expect/page.tsx), from
// goldens/f1..f2-footprint.json, and the docs file may differ from BASE (main d05c85a5); HEAD descends from BASE. F24 (lead, in flight) edits page metadata; if r10 is rebased
// onto a main that carries it, move BASE in _lib.mjs rather than widening this list (f2-static masks the metadata export and imports for exactly that merge).
import { finish, footprintFailures } from './_lib.mjs';

const { failures, count } = footprintFailures();
finish('f2-footprint.mjs', failures, `${count} changed path(s), all inside the r10 f1..f2 allowlist.`);
