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
// Sanity asset refs end -<W>x<H>-<ext>: the asset's own original width.
const ASSET_REF_WIDTH = /-(\d+)x\d+-[a-z]+$/;

function heightFor(width: number): number {
  return Math.round((width * ASPECT_HEIGHT) / ASPECT_WIDTH);
}

// Widest the CDN can honestly serve: the crop rect (cut from the original) for a mapped asset,
// else the width in the asset ref. An unparseable ref caps at the 1x plate, never upscaling blind.
function availableWidth(assetRef: string | null, crop: CropBox | undefined): number {
  if (crop) return crop.x1 - crop.x0;
  const parsed = assetRef ? Number(ASSET_REF_WIDTH.exec(assetRef)?.[1]) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : PLATE_WIDTH_1X;
}

function urlAt(url: string, crop: CropBox | undefined, width: number): string {
  const height = heightFor(width);
  if (!crop) return `${url}?w=${width}&h=${height}&fit=max&auto=format`;
  // Commas are percent-encoded so a naive srcset split on "," cannot cut the URL in half.
  const rect = [crop.x0, crop.y0, crop.x1 - crop.x0, crop.y1 - crop.y0].join('%2C');
  return `${url}?rect=${rect}&w=${width}&h=${height}&fit=max&auto=format`;
}

export function presenterPhoto(url: string | null, assetRef: string | null): PresenterPhoto | null {
  if (!url) return null;

  const crop = assetRef ? PRESENTER_PHOTO_CROPS[assetRef] : undefined;
  const available = availableWidth(assetRef, crop);
  const width = Math.min(PLATE_WIDTH_1X, available);
  const src = urlAt(url, crop, width);
  const src2x = urlAt(url, crop, Math.min(PLATE_WIDTH_2X, available));
  return {
    src,
    srcSet: `${src} 1x, ${src2x} 2x`,
    width,
    height: heightFor(width),
  };
}
