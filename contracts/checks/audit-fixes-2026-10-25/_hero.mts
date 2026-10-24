// Shared by check-hero-bytes.mts and bloom-crops.mts: which file a full-bleed hero serves at a viewport.
// Emulates Next's srcset for `sizes="100vw"` (one w-descriptor per deviceSize, browser takes the smallest
// descriptor >= viewport width x DPR, else the largest) and resolves it through the real loader.
import { statSync } from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

import loaderModule from '../../../lib/image-loader.ts';
import widths from '../../../lib/image-widths.json' with { type: 'json' };

// tsx hands a TS module's default export back wrapped ({ default }) when it is imported from .mts.
type Loader = (props: { src: string; width: number; quality?: number }) => string;
export const imageLoader: Loader =
  typeof loaderModule === 'function' ? (loaderModule as Loader) : (loaderModule as { default: Loader }).default;

export const HERO_QUALITY = 88;
export const HERO_NAMES = ['orchid-dark', 'orchid-pink', 'orchid-violet', 'orchid-purple', 'orchid-yellow'] as const;
export const heroSrc = (name: string) => `/images/${name}.jpg`;

export interface Viewport { label: string; width: number; dpr: number; maxBytes: number }
const MIB = 1024 * 1024;
// NOS Design's gate (Brad P0): served width >= box x DPR at these four, no exceptions. Byte ceilings per
// viewport are the architect's: they force intermediate srcset widths so a 1280@2 or 1440@2 screen does
// not download the 2056@2 file.
export const VIEWPORTS: Viewport[] = [
  { label: '2056@2', width: 2056, dpr: 2, maxBytes: 2.5 * MIB },
  { label: '1440@2', width: 1440, dpr: 2, maxBytes: 1.2 * MIB },
  { label: '1280@2', width: 1280, dpr: 2, maxBytes: 1.0 * MIB },
  { label: '390@3', width: 390, dpr: 3, maxBytes: 0.2 * MIB },
];

export const DEVICE_SIZES: number[] = [...widths.deviceSizes].sort((a, b) => a - b);

export function candidateWidth(needed: number): number {
  return DEVICE_SIZES.find((w) => w >= needed) ?? DEVICE_SIZES[DEVICE_SIZES.length - 1];
}

export function servedUrl(name: string, requestedWidth: number): string {
  return imageLoader({ src: heroSrc(name), width: requestedWidth, quality: HERO_QUALITY });
}

export const filePathOf = (url: string) => path.join('public', url);
export const bytesOf = (url: string): number => statSync(filePathOf(url)).size;

export async function pixelWidthOf(url: string): Promise<number> {
  return (await sharp(filePathOf(url)).metadata()).width ?? 0;
}
export async function nativeWidthOf(name: string): Promise<number> {
  return (await sharp(path.join('public', heroSrc(name))).metadata()).width ?? 0;
}
