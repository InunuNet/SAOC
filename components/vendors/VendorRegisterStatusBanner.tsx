import { humaniseFieldError, type VendorRegisterResponseDescription } from '@/lib/vendor-register-response';

// Renders validation-error/rate-limited/error descriptor kinds above the fieldsets. Returns
// null for kind 'success' -- VendorRegisterSuccess replaces the whole form in that case.
interface VendorRegisterStatusBannerProps {
  descriptor: VendorRegisterResponseDescription;
}

const bannerClass = 'space-y-2 rounded-sm border border-primary-800 bg-bone p-4';
const headingClass = 'font-sans text-[15px] font-medium text-primary-800';
const listClass = 'list-disc space-y-1 pl-5 font-sans text-[14px] text-ink/80';

export function VendorRegisterStatusBanner({ descriptor }: VendorRegisterStatusBannerProps) {
  if (descriptor.kind === 'success') {
    return null;
  }

  return (
    <div role="alert" className={bannerClass}>
      <p className={headingClass}>{descriptor.message}</p>

      {descriptor.kind === 'validation-error' ? (
        <ul className={listClass}>
          {descriptor.fieldErrors.map((message) => (
            <li key={message}>{humaniseFieldError(message)}</li>
          ))}
        </ul>
      ) : null}

      {descriptor.kind === 'rate-limited' ? (
        <p className="font-sans text-[14px] text-ink/80">
          Please try again in {descriptor.retryAfterLabel}.
        </p>
      ) : null}
    </div>
  );
}
