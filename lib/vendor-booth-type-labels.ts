export const BOOTH_TYPE_OPTIONS = [
  { value: 'standard-in-row', label: 'Standard / In-row' },
  { value: 'corner', label: 'Corner' },
  { value: 'end-of-row', label: 'End-of-row' },
  { value: 'no-preference', label: 'No preference' },
];

/** The label for a known booth type slug, or null when the value is absent or unrecognised. */
export function getBoothTypeLabel(value: string | null | undefined): string | null {
  return BOOTH_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? null;
}
