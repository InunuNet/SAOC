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

// 2x the 160px card plate.
const MAX_REQUEST_WIDTH = 320;
// Codi's upscale ceiling: never request wider than 1.3x the crop's own width.
const MAX_UPSCALE = 1.3;
const ASPECT_WIDTH = 4;
const ASPECT_HEIGHT = 5;

function heightFor(width: number): number {
  return Math.round((width * ASPECT_HEIGHT) / ASPECT_WIDTH);
}

export function presenterPhoto(url: string | null, assetRef: string | null): PresenterPhoto | null {
  if (!url) return null;

  const crop = assetRef ? PRESENTER_PHOTO_CROPS[assetRef] : undefined;
  if (!crop) {
    const height = heightFor(MAX_REQUEST_WIDTH);
    return {
      src: `${url}?w=${MAX_REQUEST_WIDTH}&h=${height}&fit=crop&auto=format`,
      width: MAX_REQUEST_WIDTH,
      height,
    };
  }

  const cropWidth = crop.x1 - crop.x0;
  const cropHeight = crop.y1 - crop.y0;
  const width = Math.min(MAX_REQUEST_WIDTH, Math.floor(cropWidth * MAX_UPSCALE));
  const height = heightFor(width);
  return {
    src: `${url}?rect=${crop.x0},${crop.y0},${cropWidth},${cropHeight}&w=${width}&h=${height}&auto=format`,
    width,
    height,
  };
}
