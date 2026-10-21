// nos-critique-r7 f2 footprint guard: f1's files and nos-theme.css (plus the docs file) only; nothing else may differ from main 1f8ad3de.
import { finish } from './_lib.mjs';
import { footprintFailures } from './r7-lib.mjs';

const { failures, count } = footprintFailures(3);
finish('f2-footprint.mjs', failures, `${count} changed path(s), all inside the r7 allowlist (f1 + f2).`);
