import type { VendorRegisterResponseDescription } from '@/lib/vendor-register-response';

// Replaces the fieldsets (not a modal) once the submission succeeds. Displays the returned
// confirmation id so a submitter has a reference number to quote if they need to follow up.
interface VendorRegisterSuccessProps {
  descriptor: Extract<VendorRegisterResponseDescription, { kind: 'success' }>;
}

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
    </div>
  );
}
