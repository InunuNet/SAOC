// nos-critique-r13 f1 route tables (QA input, hash-locked). Source: Codi R64 (title follows the h1's WORDING; lead ruling 2026-10-18) and the
// architect's audit of the 5f8d2311 public build (goldens/f1-spec.md). The title head comes only from the rendered h1; suffixes are the existing templates.
export const SITE_SUFFIX = ' | South African Orchid Council';
export const NOS_SUFFIX = ' — National Orchid Show | SAOC';
export const suffixFor = (route) => (route.startsWith('/national-show/') ? NOS_SUFFIX : SITE_SUFFIX);

// The five pages whose title head moves to the h1 wording. `lines` are exact whole-line replacements against BASE (2-space indent, in the
// buildPageMetadata call); og image lines follow their title as r12 F4 S5 did. Nothing else in the file may change.
export const EDITS = [
  { route: '/national-show/international-guests', file: 'app/(marketing)/national-show/international-guests/page.tsx', h1: 'International Guests and Exhibitors', lines: [
    ["  title: 'International Guests',", "  title: 'International Guests and Exhibitors',"],
    ["  image: nosOgImage('International Guests — National Orchid Show'),", "  image: nosOgImage('International Guests and Exhibitors — National Orchid Show'),"],
  ] },
  { route: '/national-show/vendors/payment/status', file: 'app/(marketing)/national-show/vendors/payment/status/page.tsx', h1: 'Vendor Stand Payment', lines: [
    ["  title: 'Vendor Stand Payment Status',", "  title: 'Vendor Stand Payment',"],
    ["  image: nosOgImage('Vendor Stand Payment Status — National Show'),", "  image: nosOgImage('Vendor Stand Payment — National Show'),"],
  ] },
  { route: '/about', file: 'app/(marketing)/about/page.tsx', h1: 'About the South African Orchid Council', lines: [
    ["  title: 'About SAOC',", "  title: 'About the South African Orchid Council',"],
  ] },
  { route: '/judging', file: 'app/(marketing)/judging/page.tsx', h1: 'Judging at SAOC', lines: [
    ["  title: 'Judging',", "  title: 'Judging at SAOC',"],
  ] },
  { route: '/contact', file: 'app/(marketing)/contact/page.tsx', h1: 'Contact SAOC', lines: [
    ["  title: 'Contact',", "  title: 'Contact SAOC',"],
  ] },
];

// Explicit exceptions: these titles stay exactly as they are at BASE. Each cites its rule; f1-rendered fails any other route whose title head
// differs from its h1.
export const EXCEPTIONS = [
  { route: '/', title: 'South African Orchid Council', reason: 'sentence', cite: 'h1 is a sentence ("The national home of orchid culture in South Africa."); lead exception 2026-10-18; F24 T2 fixes the home title' },
  { route: '/societies', title: 'Affiliated Societies | South African Orchid Council', reason: 'sentence', cite: 'h1 is a sentence ("Find an orchid society near you"); lead exception 2026-10-18; listed for Codi' },
  { route: '/national-show/about', title: 'About the Show — National Orchid Show | SAOC', reason: 'F24-T3', cite: 'h1 "2027 South African National Orchid Show" repeats the show name, which F24 T3 (design-cb FINAL) forbids in a NOS inner head; kept by lead ruling 2026-10-18, sent to Codi' },
  { route: '/national-show/symposium', title: 'Symposium — National Orchid Show | SAOC', reason: 'F24-T3', cite: 'h1 "National Orchid Show Symposium" repeats the show name (F24 T3); kept by lead ruling 2026-10-18, sent to Codi' },
  { route: '/national-show/archive', title: 'Archive — National Orchid Show | SAOC', reason: 'F24-T3', cite: 'h1 "National Show archive" repeats the show name (F24 T3); kept by lead ruling 2026-10-18, sent to Codi' },
];

// F24-A2 titles.json entries that r13 supersedes (Codi R64): the only golden that pins any of the five titles.
export const TITLES_JSON = '.agent/memory/project/specs/launch-weekend/goldens/f24/titles.json';
export const TITLES_JSON_EDITS = [
  ['    "/about": "About SAOC | South African Orchid Council",', '    "/about": "About the South African Orchid Council | South African Orchid Council",'],
  ['    "/contact": "Contact | South African Orchid Council",', '    "/contact": "Contact SAOC | South African Orchid Council",'],
];
// Routes measured beyond F24's sweep: the payment status page is noindex but public, so it is in scope.
export const EXTRA_ROUTES = ['/national-show/vendors/payment/status'];
