// nos-critique-r9 f2 footprint guard (stacked, gate-at-tip): only the paths of f1..f4 and the docs file may differ from BASE; nothing off limits. branding/ and public/images/nos are read-only.
import { finish } from './_lib.mjs';
import { footprintFailures } from './r9-lib.mjs';

const { failures, count } = footprintFailures(4);
finish('f2-footprint.mjs', failures, `${count} changed path(s), all inside the f1..f4 allowlist.`);
