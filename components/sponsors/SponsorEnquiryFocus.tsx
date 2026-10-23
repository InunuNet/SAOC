'use client';

import { useEffect } from 'react';

const SECTION_ID = 'enquire';
const HEADING_ID = 'enquire-heading';
const CTA_SELECTOR = `a[href="#${SECTION_ID}"]`;

/**
 * Both "Talk to us about sponsorship" CTAs are plain `href="#enquire"` anchors, so they jump
 * without JavaScript. With it, a click scrolls to the section (smooth only when the visitor has not
 * asked for reduced motion), keeps the hash in the URL, and moves focus to the section heading.
 */
export function SponsorEnquiryFocus() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest(CTA_SELECTOR) : null;
      if (!target) return;
      const section = document.getElementById(SECTION_ID);
      const heading = document.getElementById(HEADING_ID);
      if (!section || !heading) return;

      event.preventDefault();
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      window.history.pushState(null, '', `#${SECTION_ID}`);
      heading.focus({ preventScroll: true });
    }

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}
