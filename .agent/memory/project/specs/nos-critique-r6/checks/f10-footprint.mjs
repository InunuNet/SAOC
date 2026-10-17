// nos-critique-r6 f10 (R27 group sub-nav at <768) footprint guard, stacked-tree tolerant as f6-footprint.mjs.
// f10 may change only components/nos/NosSubNav.tsx and app/(marketing)/national-show/nos-structure.css (goldens/f10-footprint.json).
import { finish } from './_lib.mjs';
import { footprintFailures } from './f6-f8-lib.mjs';

const { failures, count } = footprintFailures('f10');
finish('f10-footprint.mjs', failures, `${count} changed path(s), all inside the cleared stacked footprint; f10 limited to NosSubNav.tsx and nos-structure.css.`);
