// lib/view-models/presenter-photo.ts
//
// nos-presenter-cards (F1) — exact 4:5 portrait crops (golden §6). A crop box is in the
// original image's pixel space, so it is keyed by the Sanity image asset `_ref`: if a photo
// is replaced in Studio the new asset has no entry and falls back to a centre crop instead
// of a stale rect cutting the wrong pixels. Crop boxes are Codi's.

interface CropBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface PresenterPhoto {
  src: string;
  srcSet: string;
  width: number;
  height: number;
}

export const PRESENTER_PHOTO_CROPS: Record<string, CropBox> = {
  'image-22d78f9df6c4a9188138aba0787ce2d21af8a636-2113x2113-png': {
    x0: 560,
    y0: 0,
    x1: 2113,
    y1: 1941,
  },
  'image-dc5d8e33477da7e5f2aad746c49b989d5ff70c32-690x940-png': {
    x0: 0,
    y0: 0,
    x1: 690,
    y1: 862,
  },
  'image-29f471e86c4fbc6854aef0598554b1cb3f197822-201x317-png': {
    x0: 0,
    y0: 0,
    x1: 201,
    y1: 251,
  },
  'image-02d56160c37ec45f6d752b1c836a7683df0c1899-2448x3264-jpg': {
    x0: 473,
    y0: 74,
    x1: 2073,
    y1: 2074,
  },
};

// The card plate is 160 CSS px (presenters.css .pc-photo); the 2x candidate doubles it.
const PLATE_WIDTH_1X = 160;
const PLATE_WIDTH_2X = 320;
const ASPECT_WIDTH = 4;
const ASPECT_HEIGHT = 5;
// Sanity asset refs end -<W>x<H>-<ext>: the asset's own original size.
const ASSET_REF_SIZE = /-(\d+)x(\d+)-[a-z]+$/;

function heightFor(width: number): number {
  return Math.round((width * ASPECT_HEIGHT) / ASPECT_WIDTH);
}

function rectUrl(url: string, crop: CropBox, width: number): string {
  // Commas are percent-encoded so a naive srcset split on "," cannot cut the URL in half.
  const rect = [crop.x0, crop.y0, crop.x1 - crop.x0, crop.y1 - crop.y0].join('%2C');
  return `${url}?rect=${rect}&w=${width}&h=${heightFor(width)}&fit=max&auto=format`;
}

function cropUrl(url: string, width: number): string {
  return `${url}?w=${width}&h=${heightFor(width)}&fit=crop&auto=format`;
}

function photoFor(src: string, width: number, src2x: string | null): PresenterPhoto {
  return {
    src,
    srcSet: src2x ? `${src} 1x, ${src2x} 2x` : `${src} 1x`,
    width,
    height: heightFor(width),
  };
}

// Mapped asset: the crop rect is already an exact 4:5 cut of the original, so cap at its width.
function mappedPhoto(url: string, crop: CropBox): PresenterPhoto {
  const available = crop.x1 - crop.x0;
  const width = Math.min(PLATE_WIDTH_1X, available);
  return photoFor(
    rectUrl(url, crop, width),
    width,
    rectUrl(url, crop, Math.min(PLATE_WIDTH_2X, available)),
  );
}

// Unmapped asset: centre-crop to 4:5 (fit=crop). The widest 4:5 crop that needs no upscale is
// min(W, floor(H x 4/5)); the 2x rung is dropped when it would exceed that. An unparseable ref
// ships a single 1x rung, never upscaling blind.
function fallbackPhoto(url: string, assetRef: string | null): PresenterPhoto {
  const match = assetRef ? ASSET_REF_SIZE.exec(assetRef) : null;
  const sourceWidth = match ? Number(match[1]) : 0;
  const sourceHeight = match ? Number(match[2]) : 0;
  const cap =
    sourceWidth > 0 && sourceHeight > 0
      ? Math.min(sourceWidth, Math.floor((sourceHeight * ASPECT_WIDTH) / ASPECT_HEIGHT))
      : PLATE_WIDTH_1X;
  const width = Math.min(PLATE_WIDTH_1X, cap);
  const src2x = PLATE_WIDTH_2X <= cap ? cropUrl(url, PLATE_WIDTH_2X) : null;
  return photoFor(cropUrl(url, width), width, src2x);
}

export function presenterPhoto(url: string | null, assetRef: string | null): PresenterPhoto | null {
  if (!url) return null;

  const crop = assetRef ? PRESENTER_PHOTO_CROPS[assetRef] : undefined;
  return crop ? mappedPhoto(url, crop) : fallbackPhoto(url, assetRef);
}
