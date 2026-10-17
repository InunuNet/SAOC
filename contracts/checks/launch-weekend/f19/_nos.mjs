// National Show route list and the in-page fingerprint shared by the NOS baseline capture and its comparison.
export const NOS_ROUTES = [
  '/national-show', '/national-show/about', '/national-show/what-to-expect', '/national-show/plan-your-visit',
  '/national-show/programme', '/national-show/workshops', '/national-show/conferences', '/national-show/symposium',
  '/national-show/wosa-conference', '/national-show/exhibitors', '/national-show/vendors', '/national-show/sa-exhibitors',
  '/national-show/international-guests', '/national-show/sponsors', '/national-show/archive', '/national-show/faq',
  '/national-show/tickets',
];

export const FINGERPRINT_SRC = `(() => {
  const sig = new Set(), left = new Set();
  document.querySelectorAll('main h1, main h2, main h3, main p').forEach((el) => {
    if (el.tagName === 'P' && el.closest('section.isolate')) return;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const cs = getComputedStyle(el);
    sig.add([el.tagName.toLowerCase(), cs.fontSize, cs.lineHeight].join('|'));
    if (cs.textAlign !== 'center' && cs.textTransform !== 'uppercase' && !el.closest('[class*="text-center"]')) left.add(String(Math.round(r.left))); // centred text and the ticking countdown labels move with their content
  });
  return { sig: [...sig].sort(), left: [...left].sort((a, b) => a - b) };
})()`;
