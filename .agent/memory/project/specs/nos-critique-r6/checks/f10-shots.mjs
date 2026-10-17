// Shared by f10-capture-pre.mjs and f10-rendered.mjs: the two 1280 routes whose sub-nav must stay pixel-identical, and the clip.
export const F10_SHOTS = [
  { route: '/national-show/programme', file: 'f10-pre-programme-1280.png' },
  { route: '/national-show/faq', file: 'f10-pre-faq-1280.png' },
];

/** The sub-nav plus 60px of the hero above and 60px of content below, in page coordinates. */
export async function subnavClip(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('nav.nos-subnav');
    if (!nav) return null;
    const r = nav.getBoundingClientRect();
    const top = r.top + scrollY;
    const y = Math.max(0, top - 60);
    return { x: 0, y, width: 1280, height: top + r.height + 60 - y };
  });
}
