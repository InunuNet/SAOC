export const SELECT_CLASS =
  'appearance-none pr-10 [appearance:base-select] [&::picker(select)]:[appearance:base-select] [&::picker(select)]:rounded-sm [&::picker(select)]:border [&::picker(select)]:border-rule [&::picker(select)]:bg-ivory [&::picker(select)]:font-sans [&::picker(select)]:text-[15px] [&::picker(select)]:text-ink [&::picker-icon]:hidden [&_option]:px-3.5 [&_option]:py-2.5 [&_option]:leading-5 [&_option:hover]:bg-bone [&_option:checked]:bg-bone';

export function SelectChevron() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-ink">
      <path d="m3 6 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
