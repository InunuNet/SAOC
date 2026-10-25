// F8 static: the national-show layout sets the same ISR window the sibling pages already have, so no
// NOS page under it stays frozen at its build-time nav; the vendors/apply page file is not touched
// (NOS Site PR #76 owns its hero); the nav still comes from the single getVisibleNav() source.
// Run as: node contracts/checks/polish-wave-2026-10-25/f8-nav-static.mjs   (POLISH_ROOT optional)
import { finish, read } from './_lib.mjs';

const failures = [];
const layout = read('app/(nos)/national-show/layout.tsx');
if (!/^export const revalidate = 60;/m.test(layout)) failures.push('app/(nos)/national-show/layout.tsx has no `export const revalidate = 60;`');
if (!/getVisibleNav\(\)/.test(layout)) failures.push('layout lost its getVisibleNav() call');
const apply = read('app/(nos)/national-show/vendors/apply/page.tsx');
if (/export const (revalidate|dynamic)/.test(apply)) failures.push('vendors/apply/page.tsx must not carry its own revalidate/dynamic (fix lives in the layout)');
const nav = read('lib/data/past-shows-public.ts');
if (!/export async function getVisibleNav\(\)/.test(nav)) failures.push('getVisibleNav() is gone from lib/data/past-shows-public.ts');
finish('f8-nav-static', failures);
