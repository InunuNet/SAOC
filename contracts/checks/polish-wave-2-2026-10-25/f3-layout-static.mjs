// F3 static (ticket checkout layout). Two things, both measured as broken or unverified on the backlog row:
//   CL-1 the breadcrumb links ("National Show", "Tickets") are 44px targets: `.nk-crumbs a` is inline-flex with
//        min-height 44px, replacing the 10px block padding, with its text size, colour and underline untouched
//   CL-2 one container axis: the ticket body sits in the shared NOS container ([data-nos-wrap], the axis the hero
//        copy uses) with the 560px form column left on that axis, not `mx-auto max-w-[560px] px-8`
// Not in this feature (see goldens/f3-checkout-layout.md): Buy at quantity 0 stays enabled by design, and the total
// already has aria-live="polite".
// Run as: node contracts/checks/polish-wave-2-2026-10-25/f3-layout-static.mjs   (POLISH_ROOT optional)
import { finish, read } from './_lib.mjs';

const failures = [];
const css = read('app/(nos)/national-show/nos-structure.css');
const rule = css.match(/\.nos-theme \.nk-crumbs a\s*\{([^}]*)\}/);
if (!rule) failures.push('`.nos-theme .nk-crumbs a` rule not found in nos-structure.css');
else {
  if (!/display:\s*inline-flex/.test(rule[1])) failures.push('`.nk-crumbs a` is not display: inline-flex');
  if (!/min-height:\s*(44px|2\.75rem)/.test(rule[1])) failures.push('`.nk-crumbs a` has no min-height of 44px');
  if (!/align-items:\s*center/.test(rule[1])) failures.push('`.nk-crumbs a` does not centre its text (align-items: center)');
  if (/padding-block:\s*10px/.test(rule[1])) failures.push('`.nk-crumbs a` still carries padding-block: 10px (the min-height replaces it)');
}
const page = read('app/(nos)/tickets/[slug]/page.tsx');
if (/mx-auto max-w-\[560px\] px-8/.test(page)) failures.push('the ticket body still uses `mx-auto max-w-[560px] px-8` (its own centred axis)');
const wrap = page.match(/<div\b[^>]*\bdata-nos-wrap\b[^>]*data-ticket-body[^>]*>|<div\b[^>]*\bdata-ticket-body\b[^>]*data-nos-wrap[^>]*>/);
if (!wrap) failures.push('no <div data-nos-wrap data-ticket-body> container in the ticket page');
if (!/<div className="max-w-\[560px\]">/.test(page)) failures.push('the form column is not an inner <div className="max-w-[560px]"> (left-aligned on the axis)');
finish('f3-layout-static', failures);
