import type { VendorRegisterResponseDescription } from '@/lib/vendor-register-response';
import { VendorMarketingUploadField } from './VendorMarketingUploadField';

// Replaces the fieldsets (not a modal) once the submission succeeds. Displays the returned
// confirmation id so a submitter has a reference number to quote if they need to follow up.
interface VendorRegisterSuccessProps {
  descriptor: Extract<VendorRegisterResponseDescription, { kind: 'success' }>;
}

// M2 F18 (vendor-gated-registration-flow) -- logo/product-photo uploads happen here, not in
// the register form itself: descriptor.id is the first point in the flow where a real
// submission id exists to upload against, mirroring F7's proof-of-payment out-of-band posture.
export function VendorRegisterSuccess({ descriptor }: VendorRegisterSuccessProps) {
  return (
    <div role="status" className="space-y-3 border border-rule bg-parchment p-8">
      <h3 className="font-serif text-[22px] font-semibold text-ink">Thank you</h3>
      <p className="font-sans text-[15px] leading-relaxed text-ink/80">{descriptor.message}</p>
      <p className="font-sans text-[15px] leading-relaxed text-ink/80">
        Your confirmation reference is{' '}
        <span className="font-mono text-[14px] font-medium text-ink">{descriptor.id}</span>. Please
        quote this number in any follow-up correspondence.
      </p>

      <div className="space-y-4 border-t border-rule pt-6">
        {/* @qa finding, 2026-09-01 (M2 fix pass): the source doc says "Please attach 3 Product
            Photographs" -- 3 photos are REQUIRED, not "up to 3". Logo stays optional. Placement
            stays post-submission (no submission id exists any earlier, mirroring F7) -- only
            the copy changes, to tell the vendor their submission is incomplete until all 3 are
            supplied; app/admin/vendors/page.tsx's VendorReviewTable now surfaces the same
            incomplete state to the committee. */}
        <p className="font-sans text-[14px] text-ink/80">
          Optional: upload your logo. Your registration is not complete until you have also
          uploaded all 3 required product photos below.
        </p>
        <VendorMarketingUploadField submissionId={descriptor.id} assetSlot="logo" label="Logo" />
        <VendorMarketingUploadField
          submissionId={descriptor.id}
          assetSlot="product-photo-1"
          label="Product photo 1"
        />
        <VendorMarketingUploadField
          submissionId={descriptor.id}
          assetSlot="product-photo-2"
          label="Product photo 2"
        />
        <VendorMarketingUploadField
          submissionId={descriptor.id}
          assetSlot="product-photo-3"
          label="Product photo 3"
        />
      </div>
    </div>
  );
}
