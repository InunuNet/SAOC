/**
 * The National Show's own share card for a page title (app/(nos)/national-show/og).
 * Pass it to `buildPageMetadata({ image })`; one card per distinct page title.
 */
export function nosOgImage(title: string): string {
  return `/national-show/og?title=${encodeURIComponent(title)}`;
}
