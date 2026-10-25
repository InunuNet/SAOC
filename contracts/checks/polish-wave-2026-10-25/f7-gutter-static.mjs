// F7 static: globals.css reserves the scrollbar gutter (SG-1). RED on baseline.
// Run as: node contracts/checks/polish-wave-2026-10-25/f7-gutter-static.mjs   (POLISH_ROOT optional)
import { finish, read } from './_lib.mjs';

const failures = [];
const css = read('app/globals.css');
if (!/scrollbar-gutter:\s*stable/.test(css)) failures.push('app/globals.css does not declare scrollbar-gutter: stable');
finish('f7-gutter-static', failures);
