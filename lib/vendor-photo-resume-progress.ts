/**
 * Live upload progress for the photo-resume page (mission vendor-flow-fixes, F2 Amendment 1).
 * Pure -- the client component seeds it from the server-rendered state and feeds it the slots
 * whose uploads succeeded this session.
 */

export const REQUIRED_PRODUCT_PHOTO_COUNT = 3;

export interface ResumeProgressInput {
  serverUploadedCount: number;
  missingSlots: readonly string[];
  uploadedNowSlots: ReadonlySet<string>;
}

export interface ResumeProgress {
  uploadedCount: number;
  complete: boolean;
}

/** Returns a NEW set so React state sees a changed identity. */
export function addUploadedSlot(prev: ReadonlySet<string>, slot: string): Set<string> {
  return new Set([...prev, slot]);
}

/**
 * Only slots in the SEEDED `missingSlots` count, so a slot already counted server-side is
 * never double counted and the logo never counts. Capped at the required total.
 */
export function computeResumeProgress(input: ResumeProgressInput): ResumeProgress {
  const uploadedNow = input.missingSlots.filter((slot) => input.uploadedNowSlots.has(slot)).length;
  const uploadedCount = Math.min(
    input.serverUploadedCount + uploadedNow,
    REQUIRED_PRODUCT_PHOTO_COUNT,
  );
  return { uploadedCount, complete: uploadedCount >= REQUIRED_PRODUCT_PHOTO_COUNT };
}
