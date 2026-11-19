import { tokenHex, type TokenName } from './tokens';
import type { ShippedDesign } from './schema';

/** WCAG 2.2 SC 1.4.3: body-size text needs at least 4.5:1. */
export const MIN_CONTRAST = 4.5;

function channel(hex: string, offset: number): number {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

export function contrastRatio(foreground: TokenName, background: TokenName): number {
  const [light, dark] = [luminance(tokenHex(foreground)), luminance(tokenHex(background))].sort(
    (a, b) => b - a
  );
  return (light + 0.05) / (dark + 0.05);
}

export interface ContrastReading {
  label: string;
  ratio: number;
  passes: boolean;
}

/** The accent-on-ground readings the studio shows; every one must pass before a save. */
export function designContrast(design: ShippedDesign): ContrastReading[] {
  const pairs: [string, TokenName, TokenName][] = [
    ['Email accent on card', design.email.accent, design.email.cardGround],
    ['Email accent on outer ground', design.email.accent, design.email.outerGround],
    ['PDF accent on stub', design.pdf.accent, design.pdf.stubGround],
  ];
  return pairs.map(([label, fg, bg]) => {
    const ratio = contrastRatio(fg, bg);
    return { label, ratio, passes: ratio >= MIN_CONTRAST };
  });
}

export function contrastFailures(design: ShippedDesign): ContrastReading[] {
  return designContrast(design).filter((reading) => !reading.passes);
}
