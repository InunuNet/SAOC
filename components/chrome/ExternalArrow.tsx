import { ArrowUpRight } from 'lucide-react';

const ICON_SIZE = 14;
const ICON_STROKE = 1.5;

/** The "opens in a new tab" mark on a footer link: one icon for both the SAOC and NOS footers. */
export function ExternalArrow() {
  return <ArrowUpRight size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" className="shrink-0" />;
}
