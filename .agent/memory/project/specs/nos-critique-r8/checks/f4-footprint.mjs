// nos-critique-r8 f4 footprint guard (stacked branch): only the paths of f1..f5 (all features: the gate runs at the tip, where the diff against BASE is cumulative) and the docs file may differ from BASE; nothing off limits.
import { finish } from './_lib.mjs';
import { footprintFailures } from './r8-lib.mjs';

const { failures, count } = footprintFailures(5);
finish('f4-footprint.mjs', failures, `${count} changed path(s), all inside the f1..f5 allowlist.`);
