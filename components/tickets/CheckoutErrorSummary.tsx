// Focused error summary for the ticket checkout. Same markup, classes and tokens as the vendor
// application's summary (components/vendors/VendorApplyForm.tsx); a server refusal renders its
// message verbatim in the same focusable container, with no heading and no links.
import { CircleAlert } from 'lucide-react';
import type { Ref } from 'react';

import { FormErrorAlert } from '@/components/ui/FormErrorAlert';

export interface CheckoutErrorEntry {
  key: string;
  message: string;
  // CSS selector of the field the entry points at (its id, or the day group's first enabled radio).
  target: string;
}

interface CheckoutErrorSummaryProps {
  id: string;
  heading: string;
  entries: CheckoutErrorEntry[];
  serverMessage: string | null;
  summaryRef: Ref<HTMLDivElement>;
}

// Focus() lands the summary clear of the sticky stack (NOS test bar 48 + header 97 = 145px).
function focusTarget(selector: string) {
  const target = document.querySelector<HTMLElement>(selector);
  target?.focus();
  target?.scrollIntoView({ block: 'center' });
}

const SUMMARY_CLASS =
  'scroll-mt-40 focus:outline-2 focus:outline-solid focus:outline-primary focus:outline-offset-[3px]';

export function CheckoutErrorSummary({
  id,
  heading,
  entries,
  serverMessage,
  summaryRef,
}: CheckoutErrorSummaryProps) {
  if (entries.length === 0 && !serverMessage) return null;
  return (
    <div ref={summaryRef} id={id} tabIndex={-1} className={SUMMARY_CLASS}>
      {entries.length > 0 ? (
        <div
          role="alert"
          className="space-y-2 rounded-sm border-2 border-[var(--status-error)] p-4"
        >
          <p className="flex items-start gap-2 font-sans text-[15px] font-medium text-[var(--status-error)]">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{heading}</span>
          </p>
          <ul className="list-disc space-y-1 pl-5 font-sans text-[14px] text-ink">
            {entries.map((entry) => (
              <li key={entry.key}>
                <a
                  href={entry.target.split(' ')[0]}
                  onClick={(e) => {
                    e.preventDefault();
                    focusTarget(entry.target);
                  }}
                  className="underline underline-offset-2"
                >
                  {entry.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <FormErrorAlert>{serverMessage}</FormErrorAlert>
      )}
    </div>
  );
}
