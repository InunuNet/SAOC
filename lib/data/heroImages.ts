import heroSourceWidths from '@/lib/hero-source-widths.json';
import type { HeroImage } from '@/types';

export const heroImages: HeroImage[] = [
  // orchid-yellow returns to the rotation when a high-quality original arrives; the current file bands under the scrim (rHB).
  { name: 'orchid-violet', path: '/images/orchid-violet.jpg', alt: 'Violet orchid' },
  { name: 'orchid-pink', path: '/images/orchid-pink.jpg', alt: 'Pink orchid' },
  { name: 'orchid-dark', path: '/images/orchid-dark.jpg', alt: 'Dark orchid' },
];

const NATIVE_WIDTHS: Readonly<Record<string, number>> = heroSourceWidths;

/**
 * The pixel width of a hero photograph's source file, or null for a path that is not a hero source.
 * A full-bleed hero box never grows past this: beyond it the box stops and the scrim fills the rest,
 * so a source is never upscaled (loader and variant script already stop at the same width).
 */
export function heroSourceWidth(path: string): number | null {
  return NATIVE_WIDTHS[path] ?? null;
}
