// nos-critique-r12 f4 route tables (QA input, hash-locked). Sources per route are in goldens/f4-spec.md.
export const DEFAULT_DESCRIPTION = 'The South African Orchid Council (SAOC) — coordinating orchid societies across South Africa since 1968.';
export const NOS_SUFFIX = ' — National Orchid Show | SAOC';
// SAOC pages that gain a description through buildPageMetadata (lib/seo.ts).
export const SAOC_TARGETS = [
  { route: '/about', file: 'app/(marketing)/about/page.tsx' },
  { route: '/judging', file: 'app/(marketing)/judging/page.tsx' },
  { route: '/events', file: 'app/(marketing)/events/page.tsx' },
  { route: '/contact', file: 'app/(marketing)/contact/page.tsx' },
  { route: '/sponsors', file: 'app/(marketing)/sponsors/page.tsx' },
];
// Left at the site default: no usable sourced lede (f4-spec.md; accepted by the lead 2026-10-18).
export const LEFT_AT_DEFAULT = [{ route: '/societies', file: 'app/(marketing)/societies/page.tsx' }];
// Ticket slugs that must resolve (26fde668); f4-rendered sweeps every active Sanity ticket type (_ticket-slugs.mjs) on top of these.
export const TICKET_SLUGS = ['day-visitor', 'early-bird', 'saoc-symposium', 'sunset-cocktails-single', 'vip', 'weekend-pass', 'weekend-pass-early-bird', 'wosa-conference'];
// Codi R64: the title head follows the h1's wording and casing. Each edit is the title and its og image line in one buildPageMetadata call.
export const CASING = [
  { route: '/national-show/what-to-expect', file: 'app/(marketing)/national-show/what-to-expect/page.tsx', from: 'What to Expect', to: 'What to expect', indent: '  ' },
  { route: '/national-show/plan-your-visit', file: 'app/(marketing)/national-show/plan-your-visit/page.tsx', from: 'Plan Your Visit', to: 'Plan your visit', indent: '    ' },
  { route: '/national-show/sponsors', file: 'app/(marketing)/national-show/sponsors/page.tsx', from: 'Show Sponsors', to: 'Sponsors', indent: '    ' },
];
export const casingEdit = ({ from, to, indent }) => [
  `${indent}title: '${from}',\n${indent}image: nosOgImage('${from} — National Orchid Show'),\n`,
  `${indent}title: '${to}',\n${indent}image: nosOgImage('${to} — National Orchid Show'),\n`,
];
// R64 audit at 26fde668 (f4-spec.md): NOS titles whose head differs from the h1 in WORDING, reported to the lead, not changed by r12.
// f4-rendered fails any other NOS inner route whose title head differs from its h1 (casing or wording).
export const WORDING_MISMATCH_REPORTED = ['/national-show/about', '/national-show/symposium', '/national-show/international-guests', '/national-show/archive', '/national-show/vendors/payment/status'];
// The Symposium description (F24 meta-talk, Codi R7) becomes the word-boundary ellipsis cut of its own longest rendered lede (lead ruling
// 2026-10-18): the F24 _rules.mjs ELLIPSIS_EXCEPTIONS route. f4-rendered derives the expected string at test time; f4-static S6 bounds the edit.
export const SYMPOSIUM = { route: '/national-show/symposium', file: 'app/(marketing)/national-show/symposium/page.tsx' };
