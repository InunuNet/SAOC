'use client';

import { useEffect, useRef } from 'react';

// F2 (ticketing-pages) — hidden auto-submitting form that posts the checkout API's
// signed field set straight to PayFast's processUrl. Split out of TicketPurchaseForm
// to keep both components under the project's 150-line limit.
interface PayfastRedirectFormProps {
  processUrl: string;
  fields: Record<string, string>;
}

export function PayfastRedirectForm({ processUrl, fields }: PayfastRedirectFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.submit();
  }, []);

  return (
    <form ref={formRef} action={processUrl} method="POST" className="hidden" aria-hidden="true">
      {Object.entries(fields).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
    </form>
  );
}
