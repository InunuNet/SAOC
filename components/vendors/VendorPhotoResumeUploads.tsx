'use client';

import { useState } from 'react';

import { VendorMarketingUploadField } from './VendorMarketingUploadField';
import { addUploadedSlot, computeResumeProgress } from '@/lib/vendor-photo-resume-progress';
import type { ProductPhotoSlot } from '@/lib/vendor-photo-resume-gate';

// F2 Amendment 1 -- seeded from the server-rendered photo state, then updated after each
// successful upload so the count and completion line never wait for a reload. Fields are
// mapped from the SEEDED missingSlots (never filtered by live progress) so each stays mounted
// and keeps its own "Uploaded." feedback.
interface VendorPhotoResumeUploadsProps {
  submissionId: string;
  missingSlots: ProductPhotoSlot[];
  serverUploadedCount: number;
}

const SLOT_LABELS: Record<ProductPhotoSlot, string> = {
  'product-photo-1': 'Product photo 1',
  'product-photo-2': 'Product photo 2',
  'product-photo-3': 'Product photo 3',
};

export function VendorPhotoResumeUploads({
  submissionId,
  missingSlots,
  serverUploadedCount,
}: VendorPhotoResumeUploadsProps) {
  const [uploadedNowSlots, setUploadedNowSlots] = useState<ReadonlySet<string>>(new Set());
  const progress = computeResumeProgress({ serverUploadedCount, missingSlots, uploadedNowSlots });

  return (
    <div className="space-y-4">
      {progress.complete ? (
        <p role="status" className="font-sans text-[15px] text-ink">
          All 3 required product photos have been uploaded.
        </p>
      ) : (
        <>
          <p className="font-sans text-[14px] text-ink/80">
            Your registration is not complete until you have uploaded all 3 required product
            photos.
          </p>
          <p className="font-sans text-[14px] text-ink/80">
            {progress.uploadedCount} of 3 product photos uploaded.
          </p>
        </>
      )}
      {missingSlots.map((slot) => (
        <VendorMarketingUploadField
          key={slot}
          submissionId={submissionId}
          assetSlot={slot}
          label={SLOT_LABELS[slot]}
          onUploaded={() => setUploadedNowSlots((prev) => addUploadedSlot(prev, slot))}
        />
      ))}
    </div>
  );
}
