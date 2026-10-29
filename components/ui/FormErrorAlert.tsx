// Form-wide error summary: the ruled (a) shape (2px status-error border, aria-hidden icon,
// status-error text, no tint). Per-field errors keep using TicketFieldAlert.
import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

interface FormErrorAlertProps {
  children: ReactNode;
  id?: string;
}

export function FormErrorAlert({ children, id }: FormErrorAlertProps) {
  return (
    <p
      id={id}
      role="alert"
      className="flex items-start gap-2 rounded-sm border-2 border-[var(--status-error)] px-4 py-3 font-sans text-[14px] font-medium text-[var(--status-error)]"
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
